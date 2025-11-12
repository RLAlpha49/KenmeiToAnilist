/**
 * Provides worker-pool-backed advanced filtering for manga match results with main-thread fallback.
 * @source
 */

import { getGenericWorkerPool } from "../core/worker-pool";
import type { AdvancedFilterMessage } from "../core/types";
import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";
import { filterByAdvancedCriteria } from "@/components/sync/filtering";
import {
  failsConfidenceFilter,
  failsFormatFilter,
  failsGenreFilter,
  failsStatusFilter,
  failsYearFilter,
  failsTagFilter,
} from "../shared/filters";

/**
 * Result of applying advanced filters to match results.
 * @source
 */
export interface FilterOperationResult {
  /** Filtered matches that satisfy all active filters. */
  filteredMatches: MangaMatchResult[];

  /** Aggregated counts describing filter impact. */
  stats: {
    totalMatches: number;
    filteredCount: number;
    confidenceFiltered: number;
    formatFiltered: number;
    genreFiltered: number;
    statusFiltered: number;
    yearFiltered: number;
    tagFiltered: number;
  };

  /** Timing metrics for processing and filter application. */
  timing: {
    processingTimeMs: number;
    filterApplicationTimeMs: number;
  };

  /** Indicates whether execution used a worker or the main thread. */
  executedOnWorker: boolean;

  /** Optional debug information about filtered matches. */
  debug?: {
    mismatchReasons: Array<{
      matchId: number;
      reason: string;
    }>;
  };
}

/**
 * Generates a unique task id for filter operations.
 * @returns A unique task id string.
 * @source
 */
function generateTaskId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Computes aggregated statistics explaining how filters affected the result set.
 * @source
 */
function computeFilterStats(
  matches: MangaMatchResult[],
  filteredMatches: MangaMatchResult[],
  filters: AdvancedMatchFilters,
): Record<string, number> {
  const filteredMatchIds = new Set(
    filteredMatches.map((m) => m.kenmeiManga.id),
  );
  const excludedMatches = matches.filter(
    (m) => !filteredMatchIds.has(m.kenmeiManga.id),
  );

  let confidenceFiltered = 0;
  let formatFiltered = 0;
  let genreFiltered = 0;
  let statusFiltered = 0;
  let yearFiltered = 0;
  let tagFiltered = 0;

  for (const match of excludedMatches) {
    if (failsConfidenceFilter(match, filters)) {
      confidenceFiltered++;
    }
    if (failsFormatFilter(match, filters)) {
      formatFiltered++;
    }
    if (failsGenreFilter(match, filters)) {
      genreFiltered++;
    }
    if (failsStatusFilter(match, filters)) {
      statusFiltered++;
    }
    if (failsYearFilter(match, filters)) {
      yearFiltered++;
    }
    if (failsTagFilter(match, filters)) {
      tagFiltered++;
    }
  }

  return {
    totalMatches: matches.length,
    filteredCount: filteredMatches.length,
    confidenceFiltered,
    formatFiltered,
    genreFiltered,
    statusFiltered,
    yearFiltered,
    tagFiltered,
  };
}

/**
 * Manages advanced filter tasks using the shared worker pool with robust fallbacks.
 * @source
 */
export class AdvancedFilterWorkerPool {
  private initialized = false;
  private readonly maxWorkers: number;

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers ?? 2;
  }

  /**
   * Initializes the worker-backed filtering environment once.
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
      console.info("[AdvancedFilterWorkerPool] Pool initialized");
    } catch (error) {
      console.warn(
        "[AdvancedFilterWorkerPool] Failed to initialize pool:",
        error,
      );
      // Still mark as initialized to use main thread fallback
      this.initialized = true;
    }
  }

  /**
   * Applies advanced filters to matches using workers when available, falling back to main thread.
   * @param matches - Candidate match results to filter.
   * @param filters - Advanced filter configuration.
   * @returns Filter operation result with stats and timing.
   * @source
   */
  async filterMatches(
    matches: MangaMatchResult[],
    filters: AdvancedMatchFilters,
  ): Promise<FilterOperationResult> {
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
          "[AdvancedFilterWorkerPool] No workers available, using main thread",
        );
        return this.executeOnMainThread(matches, filters);
      }

      // Try to use worker
      return await this.executeOnWorker(pool, taskId, matches, filters);
    } catch (error) {
      console.warn(
        "[AdvancedFilterWorkerPool] Worker execution failed, falling back to main thread:",
        error,
      );
      return this.executeOnMainThread(matches, filters);
    }
  }

  /**
   * Executes filtering on a worker via the generic worker pool API.
   * @param pool - Shared worker pool instance.
   * @param taskId - Unique task id.
   * @param matches - Matches to filter.
   * @param filters - Filters to apply.
   * @returns Filter operation result from worker.
   * @source
   */
  private async executeOnWorker(
    pool: ReturnType<typeof getGenericWorkerPool>,
    taskId: string,
    matches: MangaMatchResult[],
    filters: AdvancedMatchFilters,
  ): Promise<FilterOperationResult> {
    try {
      // Get a worker from the pool using selectWorker API
      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        throw new Error("No workers available from pool");
      }

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        throw new Error("Failed to get worker from pool");
      }

      // Register task with the pool so it handles message dispatching
      // and marks the worker as busy/available
      const task = {
        taskId,
        type: "advanced_filter" as const,
        matches,
        filters,
        resolve: null as unknown as (result: unknown) => void,
        reject: null as unknown as (error: Error) => void,
        cancelled: false,
        workerIndex,
      };

      const taskPromise = new Promise<FilterOperationResult>(
        (resolve, reject) => {
          task.resolve = (result: unknown) => {
            const typedResult = result as Record<string, unknown>;
            resolve({
              filteredMatches:
                typedResult.filteredMatches as MangaMatchResult[],
              stats: typedResult.stats as FilterOperationResult["stats"],
              timing: typedResult.timing as FilterOperationResult["timing"],
              executedOnWorker: true,
            });
          };
          task.reject = reject;
        },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool.registerTask(taskId, task as unknown as any);

      // Send message to the worker
      const message: AdvancedFilterMessage = {
        type: "ADVANCED_FILTER",
        payload: {
          taskId,
          matches,
          filters,
        },
      };

      worker.postMessage(message);

      console.debug(
        `[AdvancedFilterWorkerPool] Dispatched filter task ${taskId}: ${matches.length} matches`,
      );

      // Set timeout for task completion (30 seconds)
      const timeout = setTimeout(() => {
        pool.cancelTask(taskId);
        // Reject the promise with a TimeoutError to notify caller
        task.reject(
          new Error(
            `[AdvancedFilterWorkerPool] Filter task ${taskId} timed out after 30s`,
          ),
        );
        console.warn(
          `[AdvancedFilterWorkerPool] Filter task ${taskId} timed out after 30s`,
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
        "[AdvancedFilterWorkerPool] Error executing filter on worker:",
        error,
      );
      throw error;
    }
  }

  /**
   * Executes advanced filtering on the main thread when workers are unavailable.
   * @param matches - Matches to filter.
   * @param filters - Filters to apply.
   * @returns Filter operation result computed on main thread.
   * @source
   */
  private executeOnMainThread(
    matches: MangaMatchResult[],
    filters: AdvancedMatchFilters,
  ): FilterOperationResult {
    const startTime = performance.now();
    const filterStartTime = performance.now();

    // Apply filtering using the existing function
    const filteredMatches = filterByAdvancedCriteria(matches, filters);

    const filterEndTime = performance.now();
    const totalTime = performance.now() - startTime;

    // Calculate statistics based on what was filtered out
    const statsRecord = computeFilterStats(matches, filteredMatches, filters);

    const stats = {
      totalMatches: statsRecord.totalMatches,
      filteredCount: statsRecord.filteredCount,
      confidenceFiltered: statsRecord.confidenceFiltered,
      formatFiltered: statsRecord.formatFiltered,
      genreFiltered: statsRecord.genreFiltered,
      statusFiltered: statsRecord.statusFiltered,
      yearFiltered: statsRecord.yearFiltered,
      tagFiltered: statsRecord.tagFiltered,
    };

    return {
      filteredMatches,
      stats,
      timing: {
        processingTimeMs: totalTime,
        filterApplicationTimeMs: filterEndTime - filterStartTime,
      },
      executedOnWorker: false,
    };
  }

  /**
   * Returns basic initialization state for the filter worker pool.
   * @returns Object indicating whether the pool is initialized.
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
   * Returns the number of available workers for filter tasks.
   * @returns Count of idle workers.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Terminates the underlying shared worker pool used for filtering.
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
          "[AdvancedFilterWorkerPool] Error terminating pool:",
          error,
        );
      }
    }
  }
}

/**
 * Global singleton instance for the advanced filter worker pool.
 * @source
 */
let filterPoolInstance: AdvancedFilterWorkerPool | null = null;

/**
 * Returns the shared advanced filter worker pool instance, lazily creating it.
 * @param maxWorkers - Optional maximum workers used on first creation.
 * @returns Advanced filter worker pool singleton.
 * @source
 */
export function getFilterWorkerPool(
  maxWorkers?: number,
): AdvancedFilterWorkerPool {
  filterPoolInstance ??= new AdvancedFilterWorkerPool(maxWorkers);
  return filterPoolInstance;
}
