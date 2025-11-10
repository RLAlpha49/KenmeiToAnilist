/**
 * Provides a unified worker-pool-based API for CSV parsing used by Kenmei export workflows.
 * @source
 */

import type {
  CSVStartMessage,
  CSVChunkMessage,
  ProgressMessage,
} from "../core/types";
import type { KenmeiManga, KenmeiStatus } from "@/api/kenmei/types";
import { getGenericWorkerPool } from "../core/worker-pool";

/**
 * Generates a random UUID for worker tasks.
 * @returns A UUID string.
 * @source
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(
    /[xy]/g,
    function (c) {
      const r = Math.trunc(Math.random() * 16);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
}

/**
 * Configuration for CSV worker pool behavior.
 * @source
 */
export interface CSVWorkerPoolConfig {
  maxWorkers?: number;
  chunkSize?: number;
  enableWorkers?: boolean;
  fallbackToMainThread?: boolean;
}

/**
 * Result payload returned by CSV parsing operations.
 * @source
 */
interface CSVResult {
  manga: KenmeiManga[];
  stats: {
    totalParsed: number;
    processingTimeMs: number;
    bytesProcessed: number;
  };
}

/**
 * Manages CSV parsing tasks backed by the shared generic worker pool with main-thread fallback.
 * @source
 */
export class CSVWorkerPool {
  private readonly chunkSize: number;
  private initialized = false;

  constructor(config?: CSVWorkerPoolConfig) {
    this.chunkSize = config?.chunkSize ?? 65536;
  }

  /**
   * Initializes the shared worker pool once for CSV parsing.
   * @source
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const pool = getGenericWorkerPool();
    await pool.initialize();
    this.initialized = true;
  }

  /**
   * Indicates whether the CSV worker pool is initialized and usable.
   * @returns True if the pool is initialized and available.
   * @source
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Returns the number of currently available workers for CSV tasks.
   * @returns Count of idle workers.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Starts CSV parsing and exposes a task id for tracking and cancellation.
   * @param fileContent - CSV file contents.
   * @param options - Optional parsing options including default status.
   * @param onProgress - Optional callback for progress updates.
   * @returns The task id and result promise.
   * @source
   */
  startParsing(
    fileContent: string,
    options: { defaultStatus?: KenmeiStatus } = {},
    onProgress?: (progress: ProgressMessage) => void,
  ): { taskId: string; promise: Promise<CSVResult> } {
    const taskId = generateUUID();
    const promise = this.dispatchParsing(
      taskId,
      fileContent,
      onProgress,
      options,
    );
    return { taskId, promise };
  }

  /**
   * Parses a CSV file via the worker pool, returning structured results.
   * @param fileContent - CSV file contents.
   * @param options - Optional parsing options including default status.
   * @param onProgress - Optional callback for progress updates.
   * @returns Parsed manga and stats.
   * @source
   */
  async parseCSVFile(
    fileContent: string,
    options: { defaultStatus?: KenmeiStatus } = {},
    onProgress?: (progress: ProgressMessage) => void,
  ): Promise<CSVResult> {
    const { promise } = this.startParsing(fileContent, options, onProgress);
    return promise;
  }

  /**
   * Dispatches CSV parsing to the shared worker pool with main-thread fallback.
   * @param taskId - Unique id for the parsing task.
   * @param fileContent - CSV file contents.
   * @param onProgress - Optional callback for progress updates.
   * @param options - Optional parsing options.
   * @returns Promise resolving with CSV parsing result.
   * @source
   */
  private dispatchParsing(
    taskId: string,
    fileContent: string,
    onProgress?: (progress: ProgressMessage) => void,
    options: { defaultStatus?: KenmeiStatus } = {},
  ): Promise<CSVResult> {
    return new Promise<CSVResult>((resolve, reject) => {
      const pool = getGenericWorkerPool();

      // Ensure pool is initialized before checking availability
      if (!pool.isAvailable()) {
        pool
          .initialize()
          .then(() => {
            this.dispatchToWorker(
              pool,
              taskId,
              fileContent,
              onProgress,
              resolve,
              reject,
              options,
            );
          })
          .catch(() => {
            // Fallback to main thread if pool init fails
            this.parseCSVMainThread(fileContent, options)
              .then(resolve)
              .catch(reject);
          });
        return;
      }

      this.dispatchToWorker(
        pool,
        taskId,
        fileContent,
        onProgress,
        resolve,
        reject,
        options,
      );
    });
  }

  /**
   * Sends a CSV task to a selected worker and wires completion, cancellation, and progress handlers.
   * Falls back to main-thread parsing if no worker is available.
   * @source
   */
  private dispatchToWorker(
    pool: ReturnType<typeof getGenericWorkerPool>,
    taskId: string,
    fileContent: string,
    onProgress: ((progress: ProgressMessage) => void) | undefined,
    resolve: (result: CSVResult) => void,
    reject: (error: Error) => void,
    options: { defaultStatus?: KenmeiStatus } = {},
  ): void {
    const workerIndex = pool.selectWorker();
    if (workerIndex === -1) {
      // Fallback to main thread
      this.parseCSVMainThread(fileContent, options).then(resolve).catch(reject);
      return;
    }

    const worker = pool.getWorker(workerIndex);
    if (!worker) {
      // Fallback to main thread
      this.parseCSVMainThread(fileContent, options).then(resolve).catch(reject);
      return;
    }

    // Wrap resolve to adapt raw payload to expected CSV result shape
    const wrappedResolve = (result: {
      taskId: string;
      manga?: KenmeiManga[];
      stats?: {
        totalParsed: number;
        processingTimeMs: number;
        bytesProcessed: number;
      };
    }) => {
      // CSV_COMPLETE and CSV_CANCELLED return raw payload
      // For CSV_COMPLETE: { taskId, manga, stats }
      // For CSV_CANCELLED: { taskId }
      if (result.manga && result.stats) {
        // CSV_COMPLETE case
        resolve({
          manga: result.manga,
          stats: result.stats,
        });
      } else {
        // CSV_CANCELLED case - return empty result
        resolve({
          manga: [],
          stats: {
            totalParsed: 0,
            processingTimeMs: 0,
            bytesProcessed: 0,
          },
        });
      }
    };

    // Register task
    const task = {
      taskId,
      type: "csv" as const,
      resolve: wrappedResolve as (result: Record<string, unknown>) => void,
      reject,
      cancelled: false,
      onProgress: onProgress as
        | ((message: import("../core/types").WorkerMessage) => void)
        | undefined,
      workerIndex,
    };

    pool.registerTask(taskId, task);

    // Send CSV_START message
    const startMessage: CSVStartMessage = {
      type: "CSV_START",
      payload: {
        taskId,
        totalSize: fileContent.length,
        options: { defaultStatus: options.defaultStatus ?? "plan_to_read" },
      },
    };

    worker.postMessage(startMessage);

    // Send chunks
    let offset = 0;
    let chunkIndex = 0;

    while (offset < fileContent.length) {
      const chunk = fileContent.slice(offset, offset + this.chunkSize);
      const isLastChunk = offset + this.chunkSize >= fileContent.length;

      const chunkMessage: CSVChunkMessage = {
        type: "CSV_CHUNK",
        payload: {
          taskId,
          chunk,
          chunkIndex,
          isLastChunk,
        },
      };

      worker.postMessage(chunkMessage);

      offset += this.chunkSize;
      chunkIndex++;
    }

    console.info(
      `[CSVWorkerPool] 📤 Sent ${chunkIndex} chunks (${fileContent.length}B) to worker ${workerIndex} for task ${taskId}`,
    );
  }

  /**
   * Parses CSV on the main thread as a fallback when workers are unavailable.
   * @param fileContent - CSV contents to parse.
   * @param options - Optional parsing options.
   * @returns Parsed manga and stats.
   * @source
   */
  private async parseCSVMainThread(
    fileContent: string,
    options: { defaultStatus?: KenmeiStatus } = {},
  ): Promise<CSVResult> {
    try {
      const startTime = performance.now();
      const { parseKenmeiCsvExport } = await import("@/api/kenmei/parser");

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
        `Main thread CSV parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cancels an in-flight CSV parsing task.
   * @param taskId - The id of the task to cancel.
   * @source
   */
  cancelTask(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Returns current statistics for the shared worker pool.
   * @returns Pool metrics including workers and active tasks.
   * @source
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    activeTasks: number;
  } {
    const pool = getGenericWorkerPool();
    return pool.getStats();
  }

  /**
   * Terminates all workers in the shared pool.
   * @source
   */
  terminate(): void {
    const pool = getGenericWorkerPool();
    pool.terminate();
  }
}

/**
 * Global singleton instance of the CSV worker pool.
 * @source
 */
let csvWorkerPoolInstance: CSVWorkerPool | null = null;
/**
 * Tracks in-flight initialization to prevent duplicate setup.
 * @source
 */
let initializePromise: Promise<void> | null = null;

/**
 * Returns the shared CSV worker pool instance, initializing it lazily.
 * @param config - Optional configuration applied on first creation.
 * @returns The CSV worker pool singleton.
 * @source
 */
export function getCSVWorkerPool(config?: CSVWorkerPoolConfig): CSVWorkerPool {
  csvWorkerPoolInstance ??= new CSVWorkerPool(config);

  // Trigger initialization if not already initialized
  if (!csvWorkerPoolInstance.isAvailable() && !initializePromise) {
    initializePromise = csvWorkerPoolInstance
      .initialize()
      .catch(console.error)
      .finally(() => {
        initializePromise = null;
      });
  }

  return csvWorkerPoolInstance;
}
