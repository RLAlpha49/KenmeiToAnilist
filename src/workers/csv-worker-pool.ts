/**
 * CSV Worker Pool Manager
 *
 * Manages a pool of CSV parsing workers.
 * Distributes CSV parsing tasks and reassembles ordered results.
 */

import type {
  CSVStartMessage,
  CSVChunkMessage,
  WorkerMessage,
  ProgressMessage,
} from "./types";
import type { KenmeiManga, KenmeiStatus } from "@/api/kenmei/types";
import { CancelledError } from "@/utils/errorHandling";
import CSVWorker from "./csv-worker?worker";

/**
 * Generate a simple UUID v4
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(/[xy]/g, function (c) {
    const r = Math.trunc(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Configuration for CSV worker pool
 */
export interface CSVWorkerPoolConfig {
  /**
   * Maximum number of CSV workers to spawn
   * Default: 2 (CSV parsing is I/O bound, not CPU bound)
   */
  maxWorkers: number;

  /**
   * Chunk size in bytes for streaming
   * Default: 65536 (64KB)
   */
  chunkSize: number;

  /**
   * Enable worker-based CSV parsing
   * Default: true
   */
  enableWorkers: boolean;

  /**
   * Fall back to main thread if workers fail
   * Default: true
   */
  fallbackToMainThread: boolean;
}

/**
 * CSV parsing task state
 */
interface CSVParsingTask {
  taskId: string;
  workerIndex: number;
  totalChunks: number;
  processedChunks: number;
  resolve: (result: { manga: KenmeiManga[]; stats: { totalParsed: number; processingTimeMs: number; bytesProcessed: number } }) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
  progressCallback?: (progress: ProgressMessage) => void;
  manga: KenmeiManga[];
  startTime: number;
}

/**
 * CSV Worker Pool singleton
 */
class CSVWorkerPool {
  private workers: Worker[] = [];
  private readonly config: CSVWorkerPoolConfig;
  private readonly tasks = new Map<string, CSVParsingTask>();
  private workerBusy: boolean[] = [];

  constructor(config: Partial<CSVWorkerPoolConfig> = {}) {
    this.config = {
      maxWorkers: config.maxWorkers ?? 2,
      chunkSize: config.chunkSize ?? 65536, // 64KB
      enableWorkers: config.enableWorkers ?? true,
      fallbackToMainThread: config.fallbackToMainThread ?? true,
    };

    this.initializeWorkers();
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    if (!this.config.enableWorkers) {
      console.info("[CSV Worker Pool] Workers disabled, using main thread");
      return;
    }

    try {
      for (let i = 0; i < this.config.maxWorkers; i++) {
        // Use imported worker constructor (Vite ?worker pattern)
        const worker = new CSVWorker();
        worker.onmessage = (event: MessageEvent) => this.handleWorkerMessage(event, i);
        worker.onerror = (error: ErrorEvent) => this.handleWorkerError(error, i);
        this.workers.push(worker);
        this.workerBusy[i] = false;
      }

      console.info(
        `[CSV Worker Pool] ✅ Initialized ${this.config.maxWorkers} CSV workers`
      );
    } catch (error) {
      console.error("[CSV Worker Pool] Failed to initialize workers:", error);
      this.workers = [];
    }
  }

  /**
   * Get next available worker
   */
  private getAvailableWorker(): number | null {
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.workerBusy[i]) {
        this.workerBusy[i] = true;
        return i;
      }
    }
    return null;
  }

  /**
   * Internal method: dispatch CSV parsing to worker, handling shared logic
   * Returns taskId and promise
   */
  private dispatchParsing(
    fileContent: string,
    options: { defaultStatus?: KenmeiStatus } = {},
    onProgress?: (progress: ProgressMessage) => void
  ): {
    taskId: string;
    promise: Promise<{ manga: KenmeiManga[]; stats: { totalParsed: number; processingTimeMs: number; bytesProcessed: number } }>;
  } {
    let capturedTaskId = "";

    const promise = new Promise<{ manga: KenmeiManga[]; stats: { totalParsed: number; processingTimeMs: number; bytesProcessed: number } }>((resolve, reject) => {
      // Check if workers are available
      if (this.workers.length === 0) {
        if (this.config.fallbackToMainThread) {
          console.warn(
            "[CSV Worker Pool] No workers available, falling back to main thread"
          );
          this.parseCSVMainThread(fileContent, options)
            .then(resolve)
            .catch(reject);
          return;
        }
        reject(new Error("CSV workers not available and fallback disabled"));
        return;
      }

      const taskId = generateUUID();
      capturedTaskId = taskId;
      const workerIndex = this.getAvailableWorker();

      if (workerIndex === null) {
        if (this.config.fallbackToMainThread) {
          console.warn(
            "[CSV Worker Pool] No available workers, falling back to main thread"
          );
          this.parseCSVMainThread(fileContent, options)
            .then(resolve)
            .catch(reject);
          return;
        }
        reject(new Error("No available workers in pool"));
        return;
      }

      const task: CSVParsingTask = {
        taskId,
        workerIndex,
        totalChunks: Math.ceil(fileContent.length / this.config.chunkSize),
        processedChunks: 0,
        resolve,
        reject,
        cancelled: false,
        progressCallback: onProgress,
        manga: [],
        startTime: performance.now(),
      };

      this.tasks.set(taskId, task);

      try {
        // Initialize parser on worker
        const startMessage: CSVStartMessage = {
          type: "CSV_START",
          payload: {
            taskId,
            totalSize: fileContent.length,
            options: {
              defaultStatus: options.defaultStatus ?? "plan_to_read",
            },
          },
        };

        this.workers[workerIndex].postMessage(startMessage);

        // Send chunks
        let offset = 0;
        let chunkIndex = 0;

        while (offset < fileContent.length) {
          const chunk = fileContent.slice(
            offset,
            offset + this.config.chunkSize
          );
          const isLastChunk = offset + this.config.chunkSize >= fileContent.length;

          const chunkMessage: CSVChunkMessage = {
            type: "CSV_CHUNK",
            payload: {
              taskId,
              chunk,
              chunkIndex,
              isLastChunk,
            },
          };

          this.workers[workerIndex].postMessage(chunkMessage);

          offset += this.config.chunkSize;
          chunkIndex++;
        }

        console.info(
          `[CSV Worker Pool] 📤 Sent ${chunkIndex} chunks (${fileContent.length}B) to worker ${workerIndex} for task ${taskId}`
        );
      } catch (error) {
        this.tasks.delete(taskId);
        this.workerBusy[workerIndex] = false;
        reject(error);
      }
    });

    return {
      taskId: capturedTaskId,
      promise,
    };
  }

  /**
   * Start parsing CSV file with taskId exposed for cancellation
   * Returns an object with taskId and promise for the parsing result
   */
  startParsing(
    fileContent: string,
    options: { defaultStatus?: KenmeiStatus } = {},
    onProgress?: (progress: ProgressMessage) => void
  ): { taskId: string; promise: Promise<{ manga: KenmeiManga[]; stats: { totalParsed: number; processingTimeMs: number; bytesProcessed: number } }> } {
    return this.dispatchParsing(fileContent, options, onProgress);
  }

  /**
   * Parse CSV file using worker pool
   */
  async parseCSVFile(
    fileContent: string,
    options: { defaultStatus?: KenmeiStatus } = {},
    onProgress?: (progress: ProgressMessage) => void
  ): Promise<{ manga: KenmeiManga[]; stats: { totalParsed: number; processingTimeMs: number; bytesProcessed: number } }> {
    const { promise } = this.dispatchParsing(fileContent, options, onProgress);
    return promise;
  }

  /**
   * Parse CSV on main thread (fallback)
   */
  private async parseCSVMainThread(
    fileContent: string,
    options: { defaultStatus?: KenmeiStatus } = {}
  ): Promise<{ manga: KenmeiManga[]; stats: { totalParsed: number; processingTimeMs: number; bytesProcessed: number } }> {
    try {
      const startTime = performance.now();
      // Dynamically import the parser
      const { parseKenmeiCsvExport } = await import(
        "@/api/kenmei/parser"
      );

      const result = parseKenmeiCsvExport(fileContent, {
        defaultStatus: options.defaultStatus ?? "plan_to_read",
      });
      const processingTimeMs = performance.now() - startTime;
      
      return {
        manga: result.manga,
        stats: {
          totalParsed: result.manga.length,
          processingTimeMs,
          bytesProcessed: fileContent.length,
        },
      };
    } catch (error) {
      throw new Error(
        `Main thread CSV parsing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(
    event: MessageEvent<WorkerMessage>,
    workerIndex: number
  ): void {
    const message = event.data;

    switch (message.type) {
      case "PROGRESS": {
        const task = this.tasks.get(message.payload.taskId);
        if (task) {
          task.progressCallback?.(message);
        }
        break;
      }

      case "CSV_COMPLETE": {
        const task = this.tasks.get(message.payload.taskId);

        if (task) {
          console.info(
            `[CSV Worker Pool] ✅ Worker ${workerIndex} completed task ${message.payload.taskId}`
          );
          task.resolve({
            manga: message.payload.manga,
            stats: message.payload.stats,
          });
          this.cleanupTask(message.payload.taskId, workerIndex);
        }
        break;
      }

      case "ERROR": {
        const task = this.tasks.get(message.payload.taskId);

        if (task) {
          console.error(
            `[CSV Worker Pool] ❌ Worker ${workerIndex} error: ${message.payload.error.message}`
          );
          task.reject(
            new Error(
              `CSV parsing error: ${message.payload.error.message}`
            )
          );
          this.cleanupTask(message.payload.taskId, workerIndex);
        }
        break;
      }

      default: {
        console.warn(
          `[CSV Worker Pool] Unknown message type from worker ${workerIndex}: ${(message as any).type}`
        );
      }
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(error: ErrorEvent, workerIndex: number): void {
    console.error(`[CSV Worker Pool] ❌ Worker ${workerIndex} error:`, error);

    // Reject all tasks on this worker
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.workerIndex === workerIndex) {
        task.reject(
          new Error(
            `Worker ${workerIndex} encountered an error: ${error.message}`
          )
        );
        this.tasks.delete(taskId);
      }
    }

    // Recreate worker
    try {
      const worker = new CSVWorker();
      worker.onmessage = (event: MessageEvent) =>
        this.handleWorkerMessage(event, workerIndex);
      worker.onerror = (err: ErrorEvent) =>
        this.handleWorkerError(err, workerIndex);
      this.workers[workerIndex] = worker;
      this.workerBusy[workerIndex] = false;
      console.info(`[CSV Worker Pool] 🔄 Recreated worker ${workerIndex}`);
    } catch (recreateError) {
      console.error(
        `[CSV Worker Pool] Failed to recreate worker ${workerIndex}:`,
        recreateError
      );
      this.workers[workerIndex] = null as any;
    }
  }

  /**
   * Clean up completed task
   */
  private cleanupTask(taskId: string, workerIndex: number): void {
    this.tasks.delete(taskId);
    this.workerBusy[workerIndex] = false;
  }

  /**
   * Cancel a parsing task
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.cancelled = true;
      task.reject(new CancelledError("CSV parsing cancelled"));
      this.workers[task.workerIndex].postMessage({
        type: "CANCEL",
        payload: { taskId },
      });
      this.cleanupTask(taskId, task.workerIndex);
    }
  }

  /**
   * Get worker pool stats
   */
  getStats(): {
    activeWorkers: number;
    activeTasks: number;
    totalWorkers: number;
  } {
    return {
      activeWorkers: this.workerBusy.filter(Boolean).length,
      activeTasks: this.tasks.size,
      totalWorkers: this.workers.length,
    };
  }

  /**
   * Terminate all workers (for cleanup)
   */
  terminate(): void {
    for (const worker of this.workers) {
      if (worker) {
        worker.terminate();
      }
    }
    this.workers = [];
    this.workerBusy = [];
    this.tasks.clear();
    console.info("[CSV Worker Pool] ✅ All workers terminated");
  }
}

/**
 * Global CSV worker pool instance
 */
let csvWorkerPoolInstance: CSVWorkerPool | null = null;

/**
 * Get or create CSV worker pool
 */
export function getCSVWorkerPool(
  config?: Partial<CSVWorkerPoolConfig>
): CSVWorkerPool {
  csvWorkerPoolInstance ??= new CSVWorkerPool(config);
  return csvWorkerPoolInstance;
}

/**
 * Export for testing/cleanup
 */
export { CSVWorkerPool };
