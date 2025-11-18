/**
 * Manages off-thread title normalization to seed and update similarity caches.
 * @source
 */

import type { TitleNormalizationMessage } from "../core/types";
import { getGenericWorkerPool } from "../core/worker-pool";

/**
 * Normalized title cache result produced by the worker.
 * @source
 */
export interface NormalizationCacheResult {
  caches: Record<string, Record<string, string>>;
  deltas?: {
    [algorithm: string]: {
      added: Record<string, string>;
      modified: Record<string, string>;
    };
  };
  timing: {
    processingTimeMs: number;
    totalTitlesProcessed: number;
  };
}

/**
 * Callback invoked with per-algorithm normalization progress.
 * @source
 */
export type NormalizationProgressCallback = (
  algorithm: string,
  current: number,
  total: number,
) => void;

/**
 * Coordinates title normalization tasks via the generic worker pool.
 * Provides cache seeding and incremental update support.
 * @source
 */
export class TitleNormalizationWorkerPool {
  private initialized = false;

  /**
   * Initializes the worker pool for title normalization.
   * @source
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.debug("[TitleNormalizationWorkerPool] ✓ Already initialized");
      return;
    }
    console.info("[TitleNormalizationWorkerPool] 🔧 Initializing pool...");
    const pool = getGenericWorkerPool();
    await pool.initialize();
    this.initialized = true;
    console.info("[TitleNormalizationWorkerPool] ✅ Pool initialized");
  }

  /**
   * Indicates whether the underlying pool is initialized and has workers.
   * @returns True if normalization workers are available.
   * @source
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    const available = this.initialized && pool.isAvailable();
    if (!available) {
      console.warn(
        `[TitleNormalizationWorkerPool] ⚠️ Pool not available (initialized: ${this.initialized}, pool available: ${pool.isAvailable()})`,
      );
    }
    return available;
  }

  /**
   * Normalizes titles using specified algorithms on a worker.
   * @param titles - Titles to normalize.
   * @param algorithms - Algorithms to apply for normalization.
   * @param progressCallback - Optional callback for progress updates.
   * @param taskId - Optional task identifier.
   * @returns Normalization cache result with timing and deltas.
   * @source
   */
  async normalizeTitles(
    titles: string[],
    algorithms: Array<"normalizeForMatching" | "processTitle"> = [
      "normalizeForMatching",
    ],
    progressCallback?: NormalizationProgressCallback,
    taskId?: string,
  ): Promise<NormalizationCacheResult> {
    if (!this.initialized) {
      console.debug("[TitleNormalizationWorkerPool] 🚀 Auto-initializing pool");
      await this.initialize();
    }

    const pool = getGenericWorkerPool();
    const effectiveTaskId = taskId || this.generateTaskId();

    console.info(
      `[TitleNormalizationWorkerPool] 📚 normalizeTitles called: ${titles.length} titles, algorithms: [${algorithms.join(", ")}], taskId: ${effectiveTaskId}`,
    );

    return new Promise((resolve, reject) => {
      if (!pool.isAvailable()) {
        console.error(
          "[TitleNormalizationWorkerPool] ❌ Worker pool not available",
        );
        reject(
          new Error(
            "Worker pool is not available for title normalization. Check if workers are enabled.",
          ),
        );
        return;
      }

      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        console.error(
          "[TitleNormalizationWorkerPool] ❌ No available workers (all busy)",
        );
        reject(new Error("No available workers for title normalization"));
        return;
      }

      console.debug(
        `[TitleNormalizationWorkerPool] 🔗 Selected worker index: ${workerIndex}`,
      );

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        console.error(
          `[TitleNormalizationWorkerPool] ❌ Failed to acquire worker at index ${workerIndex}`,
        );
        reject(new Error("Failed to acquire worker for title normalization"));
        return;
      }

      // Register task with progress handler
      const task = {
        taskId: effectiveTaskId,
        type: "normalization" as const,
        resolve: (result: unknown) => {
          const typedResult = result as Partial<NormalizationCacheResult>;
          console.info(
            `[TitleNormalizationWorkerPool] ✅ Task ${effectiveTaskId} resolved with result`,
          );
          resolve({
            caches: typedResult.caches || {},
            deltas: typedResult.deltas,
            timing: typedResult.timing || {
              processingTimeMs: 0,
              totalTitlesProcessed: 0,
            },
          });
        },
        reject: (error: Error) => {
          console.error(
            `[TitleNormalizationWorkerPool] ❌ Task ${effectiveTaskId} rejected:`,
            error.message,
          );
          reject(error);
        },
        isCancelled: false,
        onProgress: (message: unknown) => {
          const msgWithType = message as {
            type?: string;
            payload?: { algorithm?: string; current?: number; total?: number };
          };
          if (
            msgWithType.type === "TITLE_NORMALIZATION_PROGRESS" &&
            progressCallback &&
            msgWithType.payload
          ) {
            const { algorithm, current, total } = msgWithType.payload;
            if (
              typeof algorithm === "string" &&
              typeof current === "number" &&
              typeof total === "number"
            ) {
              console.debug(
                `[TitleNormalizationWorkerPool] 📊 Progress for task ${effectiveTaskId} - ${algorithm}: ${current}/${total}`,
              );
              progressCallback(algorithm, current, total);
            }
          }
        },
        workerIndex,
      };

      pool.registerTask(effectiveTaskId, task);
      console.debug(
        `[TitleNormalizationWorkerPool] 📋 Task ${effectiveTaskId} registered with worker ${workerIndex}`,
      );

      // Send normalization message to worker
      const message: TitleNormalizationMessage = {
        type: "TITLE_NORMALIZATION",
        payload: {
          taskId: effectiveTaskId,
          titles,
          algorithms,
        },
      };

      try {
        worker.postMessage(message);
        console.info(
          `[TitleNormalizationWorkerPool] 📤 Dispatched title normalization to worker ${workerIndex}: ${titles.length} titles, taskId: ${effectiveTaskId}`,
        );
      } catch (error) {
        console.error(
          `[TitleNormalizationWorkerPool] ❌ Failed to post message to worker:`,
          error,
        );
        pool.completeTask(effectiveTaskId);
        reject(error);
      }
    });
  }

  /**
   * Cancels an in-progress normalization task.
   * @param taskId - Identifier of the task to cancel.
   * @source
   */
  cancel(taskId: string): void {
    console.info(
      `[TitleNormalizationWorkerPool] ⏹️ Cancelling normalization task: ${taskId}`,
    );
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
    console.debug(
      `[TitleNormalizationWorkerPool] ✓ Cancel request sent for ${taskId}`,
    );
  }

  /**
   * Generates a unique task identifier for title normalization tasks.
   * @returns Task ID string.
   * @source
   */
  private generateTaskId(): string {
    return `title-norm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Returns the number of currently available workers.
   * @returns Count of available workers.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }
}

/**
 * Singleton instance of the title normalization worker pool.
 * @source
 */
let titleNormalizationPool: TitleNormalizationWorkerPool | null = null;

/**
 * Returns the singleton title normalization worker pool, creating it if needed.
 * @returns Shared title normalization worker pool.
 * @source
 */
export function getTitleNormalizationPool(): TitleNormalizationWorkerPool {
  if (!titleNormalizationPool) {
    console.debug(
      "[TitleNormalizationWorkerPool] 🏗️ Creating new singleton instance",
    );
    titleNormalizationPool = new TitleNormalizationWorkerPool();
  }
  return titleNormalizationPool;
}
