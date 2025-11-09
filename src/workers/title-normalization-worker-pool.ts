/**
 * Title Normalization Worker Pool
 *
 * Manages off-thread title normalization to seed similarity caches during
 * first-run normalization for large manga libraries.
 *
 * @module workers/title-normalization-worker-pool
 */

import type { TitleNormalizationMessage } from "./types";
import { getGenericWorkerPool } from "./worker-pool";

/**
 * Interface for normalized cache results from worker.
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
 * Callback function for progress updates during normalization.
 */
export type NormalizationProgressCallback = (
  algorithm: string,
  current: number,
  total: number,
) => void;

/**
 * Title Normalization Worker Pool
 *
 * Provides API for seeding title normalization caches off-thread.
 * Results include per-algorithm normalized title caches and optional deltas
 * for incremental cache updates.
 */
export class TitleNormalizationWorkerPool {
  private initialized = false;

  /**
   * Initialize the pool (delegates to unified pool)
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
   * Check if pool is available
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
   * Normalize a list of titles using specified algorithms off-thread.
   *
   * @param titles - List of titles to normalize
   * @param algorithms - Normalization algorithms to apply
   * @param progressCallback - Optional callback for progress updates by algorithm
   * @param taskId - Optional task ID for tracking/cancellation
   * @returns Promise resolving to normalized caches and deltas
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
        resolve: (result: any) => {
          console.info(
            `[TitleNormalizationWorkerPool] ✅ Task ${effectiveTaskId} resolved with result`,
          );
          resolve({
            caches: result.caches || {},
            deltas: result.deltas,
            timing: result.timing || {
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
        cancelled: false,
        onProgress: (message: any) => {
          if (
            message.type === "TITLE_NORMALIZATION_PROGRESS" &&
            progressCallback
          ) {
            const payload = message.payload;
            console.debug(
              `[TitleNormalizationWorkerPool] 📊 Progress for task ${effectiveTaskId} - ${payload.algorithm}: ${payload.current}/${payload.total}`,
            );
            progressCallback(payload.algorithm, payload.current, payload.total);
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
   * Cancel an in-progress normalization task.
   *
   * @param taskId - Task ID to cancel
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
   * Generate a unique task ID.
   */
  private generateTaskId(): string {
    return `title-norm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get the number of currently available workers
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }
}

/**
 * Singleton instance of title normalization worker pool
 */
let titleNormalizationPool: TitleNormalizationWorkerPool | null = null;

/**
 * Get or create the title normalization worker pool singleton.
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
