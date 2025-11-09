/**
 * Advanced Filter Worker Pool
 *
 * Manages filtering operations through the shared worker pool.
 * Provides a convenient API for applying filters to match arrays.
 *
 * Features:
 * - Leverages existing worker pool infrastructure
 * - Task queuing and execution
 * - Error handling with main thread fallback
 * - Performance metrics
 */

import { getGenericWorkerPool } from "./worker-pool";
import type { AdvancedFilterMessage } from "./types";
import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";
import { filterByAdvancedCriteria } from "@/components/sync/filtering";

/**
 * Result from a filter operation
 */
export interface FilterOperationResult {
  /**
   * The filtered matches
   */
  filteredMatches: MangaMatchResult[];

  /**
   * Statistics about the filtering operation
   */
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

  /**
   * Performance timing information
   */
  timing: {
    processingTimeMs: number;
    filterApplicationTimeMs: number;
  };

  /**
   * Whether this was executed on a worker or main thread
   */
  executedOnWorker: boolean;

  /**
   * Optional debug information
   */
  debug?: {
    mismatchReasons: Array<{
      matchId: number;
      reason: string;
    }>;
  };
}

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if a match fails the confidence filter
 */
function failsConfidenceFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  let confidence = 0;

  if (match.selectedMatch && match.anilistMatches) {
    const selectedEntry = match.anilistMatches.find(
      (m) => m.manga?.id === match.selectedMatch?.id,
    );
    confidence = selectedEntry?.confidence ?? 0;
  } else if (match.anilistMatches?.length) {
    confidence = match.anilistMatches[0].confidence ?? 0;
  }

  return (
    confidence < filters.confidence.min || confidence > filters.confidence.max
  );
}

/**
 * Check if a match fails the format filter
 */
function failsFormatFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (filters.formats.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  return !matchData?.format || !filters.formats.includes(matchData.format);
}

/**
 * Check if a match fails the genre filter
 */
function failsGenreFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (filters.genres.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const genres = matchData?.genres || [];
  const genresLower = new Set(genres.map((g) => g.toLowerCase()));
  return !filters.genres.some((fg) => genresLower.has(fg.toLowerCase()));
}

/**
 * Check if a match fails the publication status filter
 */
function failsStatusFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (filters.publicationStatuses.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  return (
    !matchData?.status ||
    !filters.publicationStatuses.includes(matchData.status)
  );
}

/**
 * Check if a match fails the year filter
 */
function failsYearFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (!filters.yearRange) {
    return false;
  }
  if (filters.yearRange.min === null && filters.yearRange.max === null) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const year = matchData?.startDate?.year;

  if (year === undefined) {
    return true;
  }
  if (filters.yearRange.min !== null && year < filters.yearRange.min) {
    return true;
  }
  return filters.yearRange.max !== null && year > filters.yearRange.max;
}

/**
 * Check if a match fails the tag filter
 */
function failsTagFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (!filters.tags || filters.tags.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const tags = matchData?.tags || [];
  const tagNames = new Set(tags.map((t) => t.name.toLowerCase()));
  return !filters.tags.some((ft) => tagNames.has(ft.toLowerCase()));
}

/**
 * Compute filter statistics by analyzing excluded matches
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
 * Advanced filter worker pool manager
 */
export class AdvancedFilterWorkerPool {
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
   * Apply advanced filters to matches
   * Executes on worker if available, falls back to main thread
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
   * Execute filtering on a worker via the MatchingWorkerPool API
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
   * Execute filtering on main thread (fallback)
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
          "[AdvancedFilterWorkerPool] Error terminating pool:",
          error,
        );
      }
    }
  }
}

/**
 * Global singleton instance
 */
let filterPoolInstance: AdvancedFilterWorkerPool | null = null;

/**
 * Get or create the singleton filter worker pool
 */
export function getFilterWorkerPool(
  maxWorkers?: number,
): AdvancedFilterWorkerPool {
  filterPoolInstance ??= new AdvancedFilterWorkerPool(maxWorkers);
  return filterPoolInstance;
}
