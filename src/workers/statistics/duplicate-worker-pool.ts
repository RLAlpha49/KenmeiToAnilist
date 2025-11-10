/**
 * Manages duplicate AniList ID detection using the shared worker pool.
 * @source
 */

import { getGenericWorkerPool } from "../core/worker-pool";
import type { DuplicateDetectionMessage } from "../core/types";
import type { MangaMatchResult } from "@/api/anilist/types";
import { detectDuplicateAniListIds } from "@/components/matching/detectDuplicateAniListIds";
import { getIgnoredDuplicates } from "@/utils/storage";

/**
 * Represents a detected duplicate AniList entry across Kenmei titles.
 * @source
 */
export interface DuplicateDetectionEntry {
  anilistId: number;
  anilistTitle: string;
  matchIndices: number[];
  kenmeiTitles: string[];
}

/**
 * Result of a duplicate detection operation including timing and execution context.
 * @source
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
 * Generates a unique task identifier for duplicate detection tasks.
 * @returns A unique task ID string.
 * @source
 */
function generateTaskId(): string {
  return `dup_detection_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Coordinates duplicate detection tasks across workers with main-thread fallback.
 * @source
 */
export class DuplicateDetectionWorkerPool {
  private initialized = false;
  private readonly maxWorkers: number;

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers ?? 2;
  }

  /**
   * Initializes the worker pool or prepares main-thread fallback.
   * @source
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
   * Detects duplicate AniList IDs from matches using workers when available.
   * Falls back to main thread when worker execution is not possible.
   * @param matches - Candidate matches to evaluate.
   * @returns Duplicate detection result with timing metadata.
   * @source
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
   * Executes duplicate detection on a worker thread via the generic pool.
   * @param pool - The shared worker pool instance.
   * @param taskId - Unique identifier for the dispatched task.
   * @param matches - Candidate matches to process.
   * @returns Duplicate detection result when the worker completes.
   * @source
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * Executes duplicate detection on the main thread as a fallback.
   * @param matches - Candidate matches to process.
   * @returns Duplicate detection result computed on the main thread.
   * @source
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
   * Returns basic initialization status for the worker pool.
   * @returns Initialization state snapshot.
   * @source
   */
  getStats(): {
    initialized: boolean;
  } {
    return {
      initialized: this.initialized,
    };
  }

  /**
   * Returns the number of currently available workers in the pool.
   * @returns Count of available workers.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Terminates all workers in the pool and resets initialization state.
   * @source
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
 * Global singleton instance of the duplicate detection worker pool.
 * @source
 */
let duplicateDetectionPoolInstance: DuplicateDetectionWorkerPool | null = null;

/**
 * Returns the singleton duplicate detection worker pool, creating it if needed.
 * @param maxWorkers - Optional max worker count for initial creation.
 * @returns Shared duplicate detection worker pool instance.
 * @source
 */
export function getDuplicateDetectionWorkerPool(
  maxWorkers?: number,
): DuplicateDetectionWorkerPool {
  duplicateDetectionPoolInstance ??= new DuplicateDetectionWorkerPool(
    maxWorkers,
  );
  return duplicateDetectionPoolInstance;
}
