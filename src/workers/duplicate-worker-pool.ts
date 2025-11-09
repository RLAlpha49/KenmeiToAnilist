/**
 * Duplicate Detection Worker Pool
 *
 * Manages duplicate AniList ID detection through the shared worker pool.
 * Provides a convenient API for detecting when a single AniList manga entry
 * is mapped to multiple Kenmei manga titles.
 *
 * Features:
 * - Leverages existing worker pool infrastructure
 * - Task queuing and execution
 * - Error handling with main thread fallback
 * - Performance metrics
 * - Cancellation support
 */

import { getGenericWorkerPool } from "./worker-pool";
import type { DuplicateDetectionMessage } from "./types";
import type { MangaMatchResult } from "@/api/anilist/types";
import { detectDuplicateAniListIds } from "@/components/matching/detectDuplicateAniListIds";
import { getIgnoredDuplicates } from "@/utils/storage";

/**
 * Duplicate entry result from detection
 */
export interface DuplicateDetectionEntry {
  anilistId: number;
  anilistTitle: string;
  matchIndices: number[];
  kenmeiTitles: string[];
}

/**
 * Result from a duplicate detection operation
 */
export interface DuplicateDetectionResult {
  /**
   * Array of detected duplicate entries
   */
  duplicates: DuplicateDetectionEntry[];

  /**
   * Performance timing information
   */
  timing: {
    processingTimeMs: number;
    comparisonCount: number;
  };

  /**
   * Whether this was executed on a worker or main thread
   */
  executedOnWorker: boolean;
}

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `dup_detection_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Advanced duplicate detection worker pool manager
 */
export class DuplicateDetectionWorkerPool {
  private initialized = false;
  private readonly maxWorkers: number;

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers ?? 2;
  }

  /**
   * Initialize the pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const pool = getGenericWorkerPool();
      await pool.initialize();
      this.initialized = true;
      console.info("[DuplicateDetectionWorkerPool] Pool initialized");
    } catch (error) {
      console.warn(
        "[DuplicateDetectionWorkerPool] Failed to initialize pool:",
        error,
      );
      // Still mark as initialized to use main thread fallback
      this.initialized = true;
    }
  }

  /**
   * Detect duplicate AniList IDs in matches
   * Executes on worker if available, falls back to main thread
   */
  async detectDuplicates(
    matches: MangaMatchResult[],
  ): Promise<DuplicateDetectionResult> {
    const taskId = generateTaskId();

    // Ensure pool is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const pool = getGenericWorkerPool();

      // Check if workers are available
      if (!pool.isAvailable()) {
        console.debug(
          "[DuplicateDetectionWorkerPool] No workers available, using main thread",
        );
        return this.executeOnMainThread(matches);
      }

      // Try to use worker
      return await this.executeOnWorker(pool, taskId, matches);
    } catch (error) {
      console.warn(
        "[DuplicateDetectionWorkerPool] Worker execution failed, falling back to main thread:",
        error,
      );
      return this.executeOnMainThread(matches);
    }
  }

  /**
   * Execute duplicate detection on a worker
   */
  private async executeOnWorker(
    pool: ReturnType<typeof getGenericWorkerPool>,
    taskId: string,
    matches: MangaMatchResult[],
  ): Promise<DuplicateDetectionResult> {
    try {
      // Get a worker from the pool
      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        throw new Error("No workers available from pool");
      }

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        throw new Error("Failed to get worker from pool");
      }

      // Get ignored duplicates for filtering
      const ignoredDuplicates = getIgnoredDuplicates();
      const ignoredDuplicateIds = ignoredDuplicates.map(
        (item) => item.anilistId,
      );

      // Create task tracking
      const task = {
        taskId,
        type: "duplicate_detection" as const,
        resolve: null as unknown as (result: unknown) => void,
        reject: null as unknown as (error: Error) => void,
        cancelled: false,
        workerIndex,
      };

      const taskPromise = new Promise<DuplicateDetectionResult>(
        (resolve, reject) => {
          task.resolve = (result: unknown) => {
            const typedResult = result as Record<string, unknown>;
            resolve({
              duplicates: typedResult.duplicates as DuplicateDetectionEntry[],
              timing: typedResult.timing as DuplicateDetectionResult["timing"],
              executedOnWorker: true,
            });
          };
          task.reject = reject;
        },
      );

      pool.registerTask(taskId, task as unknown as any);

      // Send message to the worker
      const message: DuplicateDetectionMessage = {
        type: "DUPLICATE_DETECTION",
        payload: {
          taskId,
          matches,
          ignoredDuplicateIds,
        },
      };

      worker.postMessage(message);

      console.debug(
        `[DuplicateDetectionWorkerPool] Dispatched duplicate detection task ${taskId}: ${matches.length} matches`,
      );

      // Set timeout for task completion (30 seconds)
      const timeout = setTimeout(() => {
        pool.cancelTask(taskId);
        task.reject(
          new Error(
            `[DuplicateDetectionWorkerPool] Duplicate detection task ${taskId} timed out after 30s`,
          ),
        );
        console.warn(
          `[DuplicateDetectionWorkerPool] Duplicate detection task ${taskId} timed out after 30s`,
        );
      }, 30000);

      // Wait for result and clear timeout
      try {
        const result = await taskPromise;
        clearTimeout(timeout);
        return result;
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    } catch (error) {
      console.error(
        "[DuplicateDetectionWorkerPool] Error executing on worker:",
        error,
      );
      throw error;
    }
  }

  /**
   * Execute duplicate detection on main thread (fallback)
   */
  private executeOnMainThread(
    matches: MangaMatchResult[],
  ): DuplicateDetectionResult {
    const startTime = performance.now();

    // Use the existing duplicate detection function
    const duplicates = detectDuplicateAniListIds(matches);

    const processingTimeMs = performance.now() - startTime;

    return {
      duplicates: duplicates.map((dup) => ({
        anilistId: dup.anilistId,
        anilistTitle: dup.anilistTitle,
        matchIndices: matches
          .map((m, idx) =>
            m.status === "matched" && m.selectedMatch?.id === dup.anilistId
              ? idx
              : -1,
          )
          .filter((idx) => idx !== -1),
        kenmeiTitles: dup.kenmeiTitles,
      })),
      timing: {
        processingTimeMs,
        comparisonCount: matches.length,
      },
      executedOnWorker: false,
    };
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    initialized: boolean;
  } {
    return {
      initialized: this.initialized,
    };
  }

  /**
   * Get the number of currently available workers
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Terminate the pool
   */
  terminate(): void {
    if (this.initialized) {
      try {
        const pool = getGenericWorkerPool();
        pool.terminate();
        this.initialized = false;
      } catch (error) {
        console.warn(
          "[DuplicateDetectionWorkerPool] Error terminating pool:",
          error,
        );
      }
    }
  }
}

/**
 * Global singleton instance
 */
let duplicateDetectionPoolInstance: DuplicateDetectionWorkerPool | null = null;

/**
 * Get or create the singleton duplicate detection worker pool
 */
export function getDuplicateDetectionWorkerPool(
  maxWorkers?: number,
): DuplicateDetectionWorkerPool {
  duplicateDetectionPoolInstance ??= new DuplicateDetectionWorkerPool(
    maxWorkers,
  );
  return duplicateDetectionPoolInstance;
}
