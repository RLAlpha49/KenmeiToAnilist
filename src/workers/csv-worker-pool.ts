/**
 * CSV Worker Pool Wrapper
 *
 * Provides a familiar API for CSV parsing operations while using
 * the unified worker pool under the hood to share workers with matching.
 *
 * @module workers/csv-worker-pool
 */

import type {
  CSVStartMessage,
  CSVChunkMessage,
  ProgressMessage,
} from "./types";
import type { KenmeiManga, KenmeiStatus } from "@/api/kenmei/types";
import { getGenericWorkerPool } from "./worker-pool";

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

export interface CSVWorkerPoolConfig {
  maxWorkers?: number;
  chunkSize?: number;
  enableWorkers?: boolean;
  fallbackToMainThread?: boolean;
}

interface CSVResult {
  manga: KenmeiManga[];
  stats: {
    totalParsed: number;
    processingTimeMs: number;
    bytesProcessed: number;
  };
}

/**
 * Wrapper around unified pool for CSV parsing operations
 */
export class CSVWorkerPool {
  private readonly chunkSize: number;
  private initialized = false;

  constructor(config?: CSVWorkerPoolConfig) {
    this.chunkSize = config?.chunkSize ?? 65536;
  }

  /**
   * Initialize the pool (delegates to unified pool)
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
   * Check if pool is available
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Get the number of currently available workers
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Start parsing CSV file with taskId exposed for cancellation
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
   * Parse CSV file using the unified worker pool
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
   * Dispatch CSV parsing to the unified pool
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
   * Internal helper to dispatch to worker after pool is ready
   */
  private dispatchToWorker(
    pool: any,
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
    const wrappedResolve = (result: any) => {
      // CSV_COMPLETE and CSV_CANCELLED return raw payload
      // For CSV_COMPLETE: { taskId, manga, stats }
      // For CSV_CANCELLED: { taskId }
      if (result.manga) {
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
      resolve: wrappedResolve,
      reject,
      cancelled: false,
      onProgress,
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
   * Parse CSV on main thread (fallback)
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
   * Cancel a parsing task
   */
  cancelTask(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Get pool statistics
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
   * Terminate the pool
   */
  terminate(): void {
    const pool = getGenericWorkerPool();
    pool.terminate();
  }
}

/**
 * Global CSV worker pool instance
 */
let csvWorkerPoolInstance: CSVWorkerPool | null = null;
let initializePromise: Promise<void> | null = null;

/**
 * Get or create CSV worker pool
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
