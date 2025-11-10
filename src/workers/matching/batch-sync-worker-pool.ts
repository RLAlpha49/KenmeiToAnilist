import { getGenericWorkerPool } from "../core/worker-pool";
import type {
  WorkerPoolConfig,
  BatchSyncMessage,
  PreparedSyncOperation,
} from "../core/types";
import type { AniListMediaEntry } from "@/api/anilist/types";

/**
 * Generates a unique ID for batch sync tasks.
 * @returns A unique task identifier.
 * @source
 */
function generateUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Describes an in-flight batch sync task.
 * @source
 */
export interface BatchSyncExecution {
  taskId: string;
  promise: Promise<PreparedSyncOperation[]>;
}

/**
 * Manages batch sync pre-processing using the shared worker pool.
 * @source
 */
export class BatchSyncWorkerPool {
  private readonly config: WorkerPoolConfig;
  private initialized = false;

  constructor(config?: Partial<WorkerPoolConfig>) {
    this.config = {
      maxWorkers: config?.maxWorkers ?? 4,
      enableWorkers: config?.enableWorkers ?? true,
      fallbackToMainThread: config?.fallbackToMainThread ?? true,
    };
  }

  /**
   * Initializes the shared worker pool for batch sync operations.
   * @returns A promise that resolves when initialization is complete.
   * @source
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const pool = getGenericWorkerPool({
      maxWorkers: this.config.maxWorkers,
      enableWorkers: this.config.enableWorkers,
      fallbackToMainThread: this.config.fallbackToMainThread,
    });
    await pool.initialize();
    this.initialized = true;
  }

  /**
   * Indicates whether the worker pool is initialized and usable.
   * @returns True if the pool is initialized and available.
   * @source
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Retrieves the number of currently available workers.
   * @returns Count of available workers or 0 if uninitialized.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Executes batch sync pre-processing using a worker or the main thread.
   * @param entries - Entries to prepare for synchronization.
   * @param onProgress - Optional callback for progress updates.
   * @param taskId - Optional external task identifier.
   * @returns Promise resolving to prepared sync operations.
   * @source
   */
  async executeBatchSyncPreprocessing(
    entries: AniListMediaEntry[],
    onProgress?: (
      phase: "organizing" | "building" | "ready",
      processed: number,
      total: number,
      currentMediaId?: number,
    ) => void,
    taskId?: string,
  ): Promise<PreparedSyncOperation[]> {
    const pool = getGenericWorkerPool();

    // Ensure pool is initialized
    if (!pool.isAvailable()) {
      await pool.initialize();
    }

    const mainTaskId = taskId || generateUUID();

    const promise = new Promise<PreparedSyncOperation[]>((resolve, reject) => {
      if (!pool.isAvailable()) {
        // Fallback to main thread
        this.executeBatchSyncMainThread(entries).then(resolve).catch(reject);
        return;
      }

      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        // Fallback to main thread
        this.executeBatchSyncMainThread(entries).then(resolve).catch(reject);
        return;
      }

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        // Fallback to main thread
        this.executeBatchSyncMainThread(entries).then(resolve).catch(reject);
        return;
      }

      // Set up message handler for this specific task
      const messageHandler = (event: MessageEvent) => {
        const message = event.data;

        if (
          message.type === "BATCH_SYNC_RESULT" &&
          message.payload.taskId === mainTaskId
        ) {
          worker.removeEventListener("message", messageHandler);
          resolve(message.payload.operations || []);
        } else if (
          message.type === "BATCH_SYNC_PROGRESS" &&
          message.payload.taskId === mainTaskId
        ) {
          if (onProgress && message.payload) {
            const { phase, processed, total, currentMediaId } = message.payload;
            onProgress(phase, processed, total, currentMediaId);
          }
        } else if (
          message.type === "ERROR" &&
          message.payload.taskId === mainTaskId
        ) {
          worker.removeEventListener("message", messageHandler);
          reject(
            new Error(message.payload.error?.message || "Batch sync error"),
          );
        }
      };

      worker.addEventListener("message", messageHandler);

      // Send message to worker
      const batchSyncMessage: BatchSyncMessage = {
        type: "BATCH_SYNC",
        payload: {
          taskId: mainTaskId,
          entries,
          rateLimitConfig: {
            maxRequestsPerMinute: 60,
            requestInterval: 1000,
          },
        },
      };

      worker.postMessage(batchSyncMessage);

      console.info(
        `[BatchSyncWorkerPool] 📦 Dispatched batch sync pre-processing to worker ${workerIndex}: ${entries.length} entries`,
      );
    });

    return promise;
  }

  /**
   * Executes batch sync pre-processing on the main thread as a fallback.
   * @param entries - Entries to prepare when workers are unavailable.
   * @returns Promise resolving to prepared sync operations.
   * @source
   */
  private async executeBatchSyncMainThread(
    entries: AniListMediaEntry[],
  ): Promise<PreparedSyncOperation[]> {
    console.warn(
      "[BatchSyncWorkerPool] Falling back to main thread batch sync pre-processing",
    );

    const operations: PreparedSyncOperation[] = [];
    const entriesByMediaId: Record<number, AniListMediaEntry[]> = {};

    // Organize by media ID
    for (const entry of entries) {
      if (!entriesByMediaId[entry.mediaId]) {
        entriesByMediaId[entry.mediaId] = [];
      }
      entriesByMediaId[entry.mediaId].push(entry);
    }

    // Create operations for each media ID
    for (const [mediaIdStr, mediaEntries] of Object.entries(entriesByMediaId)) {
      const mediaId = Number(mediaIdStr);

      operations.push({
        mediaId,
        entries: mediaEntries,
        steps: [1, 2], // Default to all steps for fallback
        variables: mediaEntries.map((entry) => ({
          mediaId: entry.mediaId,
          status: entry.status,
          progress: entry.progress,
          score: entry.score,
        })),
        estimatedApiCalls: 2 * mediaEntries.length,
      });
    }

    return operations;
  }

  /**
   * Cancels a batch sync task in the worker pool.
   * @param taskId - Identifier of the task to cancel.
   * @source
   */
  cancelBatchSync(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Returns current pool statistics.
   * @returns Aggregate worker and task metrics.
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
   * Terminates the shared worker pool.
   * @source
   */
  terminate(): void {
    const pool = getGenericWorkerPool();
    pool.terminate();
  }
}
