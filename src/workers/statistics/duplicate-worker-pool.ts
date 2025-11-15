/**
 * Manages duplicate AniList ID detection using the shared worker pool.
 * @source
 */

import { BaseWorkerPool } from "../core/base-worker-pool";
import { generateTaskId } from "../core/pool-utils";
import type {
  DuplicateDetectionMessage,
  DuplicateDetectionEntry,
} from "../core/types";
import type { MangaMatchResult } from "@/api/anilist/types";
import { detectDuplicateAniListIds } from "@/components/matching/detect-duplicate-anilist-ids";
import { getIgnoredDuplicates } from "@/utils/storage";

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
function generateUniqueTaskId(): string {
  return generateTaskId("dup_detection");
}

/**
 * Coordinates duplicate detection tasks across workers with main-thread fallback.
 * @source
 */
export class DuplicateDetectionWorkerPool extends BaseWorkerPool {
  constructor() {
    super();
  }

  protected getPoolName(): string {
    return "DuplicateDetectionWorkerPool";
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
    const taskId = generateUniqueTaskId();
    await this.ensureInitialized();

    return this.executeWithFallback(
      () => this.executeOnWorker(taskId, matches),
      () => this.executeOnMainThread(matches),
      taskId,
    );
  }

  /**
   * Executes duplicate detection on a worker thread via the generic pool.
   * @param taskId - Unique identifier for the dispatched task.
   * @param matches - Candidate matches to process.
   * @returns Duplicate detection result when the worker completes.
   * @source
   */
  private async executeOnWorker(
    taskId: string,
    matches: MangaMatchResult[],
  ): Promise<DuplicateDetectionResult> {
    try {
      const workerIndex = this.selectWorker();
      if (workerIndex === -1) {
        throw new Error("No workers available from pool");
      }

      const worker = this.getWorker(workerIndex);
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

      this.registerTask(taskId, task);

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

      return taskPromise;
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
export function getDuplicateDetectionWorkerPool(): DuplicateDetectionWorkerPool {
  duplicateDetectionPoolInstance ??= new DuplicateDetectionWorkerPool();
  return duplicateDetectionPoolInstance;
}
