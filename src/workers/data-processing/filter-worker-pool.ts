/**
 * Provides worker-pool-backed advanced filtering for manga match results with main-thread fallback.
 * @source
 */

import { BaseWorkerPool } from "../core/base-worker-pool";
import { generateTaskId, computeFilterStats } from "../core/pool-utils";
import type { AdvancedFilterMessage } from "../core/types";
import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";
import { filterByAdvancedCriteria } from "@/components/sync/filtering";

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
 * Manages advanced filter tasks using the shared worker pool with robust fallbacks.
 * @source
 */
export class AdvancedFilterWorkerPool extends BaseWorkerPool {
  constructor(maxWorkers?: number) {
    super({ maxWorkers });
  }

  protected getPoolName(): string {
    return "AdvancedFilterWorkerPool";
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
    const taskId = generateTaskId("filter");
    await this.ensureInitialized();

    return this.executeWithFallback(
      () => this.executeOnWorker(taskId, matches, filters),
      () => this.executeOnMainThread(matches, filters),
      taskId,
    );
  }

  /**
   * Executes filtering on a worker via the generic worker pool API.
   * @param taskId - Unique task id.
   * @param matches - Matches to filter.
   * @param filters - Filters to apply.
   * @returns Filter operation result from worker.
   * @source
   */
  private async executeOnWorker(
    taskId: string,
    matches: MangaMatchResult[],
    filters: AdvancedMatchFilters,
  ): Promise<FilterOperationResult> {
    try {
      const workerIndex = this.selectWorker();
      if (workerIndex === -1) {
        throw new Error("No workers available from pool");
      }

      const worker = this.getWorker(workerIndex);
      if (!worker) {
        throw new Error("Failed to get worker from pool");
      }

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

      this.registerTask(taskId, task);

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

      return taskPromise;
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
