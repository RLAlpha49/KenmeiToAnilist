/**
 * Manages off-thread statistics aggregation for efficient statistics page rendering.
 * @source
 */

import type {
  NormalizedMatchForStats,
  TimeRange,
} from "@/utils/statistics-adapter";
import type { ReadingHistory } from "@/utils/storage";
import type { StatisticsFilters, ComparisonMode } from "@/types/statistics";
import {
  BaseWorkerPool,
  type BaseWorkerPoolConfig,
} from "../core/base-worker-pool";
import { getGenericWorkerPool } from "../core/worker-pool";
import { generateUUID } from "../core/pool-utils";

/**
 * Result of a statistics aggregation operation including data, options, and timing.
 * @source
 */
export interface StatisticsAggregationResult {
  filteredData: {
    matchResults: NormalizedMatchForStats[];
    readingHistory: ReadingHistory;
  };
  filterOptions: {
    genres: string[];
    formats: string[];
    statuses: string[];
    tags: string[];
  };
  comparisonDatasets: {
    primary: {
      trends: Array<{ date: string; chapters: number; count: number }>;
      velocity: {
        perDay: number;
        perWeek: number;
        perMonth: number;
        totalChapters: number;
        activeDays: number;
      };
      habits: {
        byDayOfWeek: Array<{ day: string; chapters: number }>;
        byTimeOfDay: Array<{ hour: string; chapters: number }>;
        peakDay: string | null;
        peakHour: string | null;
      };
    };
    secondary: {
      trends: Array<{ date: string; chapters: number; count: number }>;
      velocity: {
        perDay: number;
        perWeek: number;
        perMonth: number;
        totalChapters: number;
        activeDays: number;
      };
      habits: {
        byDayOfWeek: Array<{ day: string; chapters: number }>;
        byTimeOfDay: Array<{ hour: string; chapters: number }>;
        peakDay: string | null;
        peakHour: string | null;
      };
    };
    primaryLabel: string;
    secondaryLabel: string;
  } | null;
  cacheKey: string;
  timing: {
    filteringTimeMs: number;
    aggregationTimeMs: number;
    totalTimeMs: number;
  };
}

/**
 * Singleton-backed worker pool for statistics aggregation with main-thread fallback.
 * @source
 */
export class StatisticsAggregationWorkerPool extends BaseWorkerPool {
  constructor(config?: Partial<BaseWorkerPoolConfig>) {
    super(config);
  }

  protected getPoolName(): string {
    return "StatisticsAggregationWorkerPool";
  }

  /**
   * Aggregates statistics using workers when available, otherwise on the main thread.
   * @param matchResults - Normalized match results for statistics.
   * @param readingHistory - Reading history to correlate.
   * @param filters - Active statistics filter configuration.
   * @param comparisonMode - Comparison mode configuration.
   * @param selectedTimeRange - Selected time range for aggregation.
   * @param progressCallback - Optional callback for progress updates.
   * @param taskId - Optional task identifier.
   * @returns Aggregation result with datasets, cache key, and timing.
   * @source
   */
  async aggregateStatistics(
    matchResults: NormalizedMatchForStats[],
    readingHistory: ReadingHistory,
    filters: StatisticsFilters,
    comparisonMode: ComparisonMode,
    selectedTimeRange: TimeRange,
    progressCallback?: (
      stage: string,
      progress: number,
      message: string,
    ) => void,
    taskId?: string,
  ): Promise<StatisticsAggregationResult> {
    const mainTaskId = taskId || generateUUID();
    await this.ensureInitialized();

    return this.executeWithFallback(
      () =>
        this.executeOnWorker(
          mainTaskId,
          matchResults,
          readingHistory,
          filters,
          comparisonMode,
          selectedTimeRange,
          progressCallback,
        ),
      () =>
        this.aggregateStatisticsMainThread(
          matchResults,
          readingHistory,
          filters,
          comparisonMode,
          selectedTimeRange,
        ),
      mainTaskId,
    );
  }

  /**
   * Executes statistics aggregation on a worker thread.
   * @param taskId - Unique task identifier.
   * @param matchResults - Normalized match results.
   * @param readingHistory - Reading history dataset.
   * @param filters - Filters to apply.
   * @param comparisonMode - Comparison mode configuration.
   * @param selectedTimeRange - Selected time range.
   * @param progressCallback - Optional progress callback.
   * @returns Aggregation result from worker.
   * @source
   */
  private async executeOnWorker(
    taskId: string,
    matchResults: NormalizedMatchForStats[],
    readingHistory: ReadingHistory,
    filters: StatisticsFilters,
    comparisonMode: ComparisonMode,
    selectedTimeRange: TimeRange,
    progressCallback?: (
      stage: string,
      progress: number,
      message: string,
    ) => void,
  ): Promise<StatisticsAggregationResult> {
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
        type: "statistics" as const,
        resolve: null as unknown as (result: unknown) => void,
        reject: null as unknown as (error: Error) => void,
        isCancelled: false,
        onProgress: (message: unknown) => {
          // Adapt STATISTICS_AGGREGATION_PROGRESS message to typed callback
          const msgWithType = message as { type?: string; payload?: unknown };
          if (
            msgWithType.type === "STATISTICS_AGGREGATION_PROGRESS" &&
            progressCallback &&
            msgWithType.payload
          ) {
            const {
              stage,
              progress,
              message: progressMessage,
            } = msgWithType.payload as {
              stage?: string;
              progress?: number;
              message?: string;
            };
            if (
              typeof stage === "string" &&
              typeof progress === "number" &&
              typeof progressMessage === "string"
            ) {
              progressCallback(stage, progress, progressMessage);
            }
          }
        },
        workerIndex,
      };

      const taskPromise = new Promise<StatisticsAggregationResult>(
        (resolve, reject) => {
          task.resolve = (result: unknown) => {
            const typedResult = result as StatisticsAggregationResult & {
              comparisonDatasets?: unknown;
              timing?: {
                filteringTimeMs: number;
                aggregationTimeMs: number;
                totalTimeMs: number;
              };
            };
            resolve({
              filteredData: typedResult.filteredData,
              filterOptions: typedResult.filterOptions,
              comparisonDatasets: typedResult.comparisonDatasets || null,
              cacheKey: typedResult.cacheKey,
              timing: typedResult.timing || {
                filteringTimeMs: 0,
                aggregationTimeMs: 0,
                totalTimeMs: 0,
              },
            });
          };
          task.reject = reject;
        },
      );

      this.registerTask(taskId, task);

      // Dispatch task to worker
      worker.postMessage({
        type: "STATISTICS_AGGREGATION",
        payload: {
          taskId,
          matchResults,
          readingHistory,
          filters,
          comparisonMode,
          selectedTimeRange,
        },
      });

      console.info(
        `[StatisticsWorkerPool] Dispatched statistics aggregation to worker ${workerIndex}`,
      );

      return await taskPromise;
    } catch (error) {
      console.error(
        "[StatisticsAggregationWorkerPool] Error executing on worker:",
        error,
      );
      throw error;
    }
  }

  /**
   * Aggregates statistics on the main thread using statistics adapter utilities.
   * @param matchResults - Normalized match results.
   * @param readingHistory - Reading history dataset.
   * @param filters - Filters to apply.
   * @param comparisonMode - Comparison mode configuration.
   * @param selectedTimeRange - Selected time range.
   * @returns Aggregation result including filter options and comparison datasets.
   * @source
   */
  private async aggregateStatisticsMainThread(
    matchResults: NormalizedMatchForStats[],
    readingHistory: ReadingHistory,
    filters: StatisticsFilters,
    comparisonMode: ComparisonMode,
    selectedTimeRange: TimeRange,
  ): Promise<StatisticsAggregationResult> {
    const startTime = performance.now();

    // Import functions on demand
    const {
      applyStatisticsFilters: applyFilters,
      buildComparisonDatasets: buildComparison,
      extractAvailableFilterOptions: extractOptions,
    } = await import("@/utils/statistics-adapter");

    const filterStartTime = performance.now();

    // Apply filters
    const filteredData = applyFilters(matchResults, readingHistory, filters);

    const filteringTimeMs = performance.now() - filterStartTime;
    const aggregationStartTime = performance.now();

    // Extract options
    const filterOptions = extractOptions(matchResults);

    // Build comparison if enabled
    const comparisonDatasets =
      comparisonMode.enabled &&
      comparisonMode.primaryRange !== comparisonMode.secondaryRange
        ? buildComparison(
            filteredData.readingHistory,
            comparisonMode.primaryRange,
            comparisonMode.secondaryRange,
          )
        : null;

    const aggregationTimeMs = performance.now() - aggregationStartTime;
    const totalTimeMs = performance.now() - startTime;

    // Generate cache key
    const cacheKey = this.generateCacheKey(
      filters,
      comparisonMode,
      selectedTimeRange,
    );

    return {
      filteredData,
      filterOptions,
      comparisonDatasets,
      cacheKey,
      timing: {
        filteringTimeMs,
        aggregationTimeMs,
        totalTimeMs,
      },
    };
  }

  /**
   * Generates a stable cache key for a given filter and comparison configuration.
   * @param filters - Statistics filters applied.
   * @param comparisonMode - Comparison mode settings.
   * @param selectedTimeRange - Selected time range value.
   * @returns Cache key string.
   * @source
   */
  private generateCacheKey(
    filters: StatisticsFilters,
    comparisonMode: ComparisonMode,
    selectedTimeRange: TimeRange,
  ): string {
    const filterStr = JSON.stringify(filters);
    const comparisonStr = JSON.stringify(comparisonMode);
    const timeStr = selectedTimeRange;

    // Use a simple string concatenation instead of Buffer.from (browser compatible)
    const keyStr = `stats:${filterStr}:${comparisonStr}:${timeStr}`;
    // Simple hash function for browser compatibility
    let hash = 0;
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.codePointAt(i);
      if (char === undefined) continue;
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `stats:${Math.abs(hash)}`;
  }

  /**
   * Cancels an in-flight statistics aggregation task.
   * @param taskId - Identifier of the worker task to cancel.
   * @source
   */
  cancelAggregation(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Returns pool statistics for the underlying generic worker pool.
   * Provides detailed metrics about active workers and tasks.
   * @returns Pool statistics including total workers, active workers, and active tasks.
   * @source
   */
  getPoolStats(): {
    totalWorkers: number;
    activeWorkers: number;
    activeTasks: number;
  } {
    const pool = getGenericWorkerPool();
    return pool.getStats();
  }

  /**
   * Terminates the worker pool if needed. Currently a no-op.
   * @source
   */
  terminate(): void {
    // No-op for now
  }

  /**
   * Returns the number of currently available workers.
   * @returns Count of available workers.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return pool.getAvailableWorkerCount();
  }
}

/**
 * Module-level singleton instance of the statistics aggregation worker pool.
 */
let statisticsWorkerPoolInstance: StatisticsAggregationWorkerPool | null = null;

/**
 * Returns the singleton statistics aggregation worker pool instance.
 * @param config - Optional configuration for the pool.
 * @returns Shared statistics aggregation worker pool.
 * @source
 */
export function getStatisticsWorkerPool(
  config?: Partial<BaseWorkerPoolConfig>,
): StatisticsAggregationWorkerPool {
  statisticsWorkerPoolInstance ??= new StatisticsAggregationWorkerPool(config);
  return statisticsWorkerPoolInstance;
}
