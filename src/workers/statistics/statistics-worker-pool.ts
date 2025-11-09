/**
 * Statistics Aggregation Worker Pool
 *
 * Manages off-thread statistics aggregation to accelerate statistics page rendering.
 * Handles filtering, normalization, and aggregation of match and reading history data.
 */

import type {
  NormalizedMatchForStats,
  TimeRange,
} from "@/utils/statisticsAdapter";
import type { ReadingHistory } from "@/utils/storage";
import type { StatisticsFilters, ComparisonMode } from "@/types/statistics";
import { getGenericWorkerPool } from "../core/worker-pool";

/**
 * Generate a UUID v4 string
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(
    /[xy]/g,
    function (c) {
      const r = Math.trunc(Math.random() * 16);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
}

/**
 * Result returned from statistics aggregation
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
 * Singleton worker pool for statistics aggregation
 * Currently uses main thread fallback; future enhancement will add Web Worker support
 */
export class StatisticsAggregationWorkerPool {
  private static instance: StatisticsAggregationWorkerPool | null = null;
  private initialized = false;
  private readonly config: {
    maxWorkers: number;
    enableWorkers: boolean;
    fallbackToMainThread: boolean;
  };

  private constructor(config?: {
    maxWorkers?: number;
    enableWorkers?: boolean;
    fallbackToMainThread?: boolean;
  }) {
    this.config = {
      maxWorkers: config?.maxWorkers ?? 4,
      enableWorkers: config?.enableWorkers ?? true,
      fallbackToMainThread: config?.fallbackToMainThread ?? true,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: {
    maxWorkers?: number;
    enableWorkers?: boolean;
    fallbackToMainThread?: boolean;
  }): StatisticsAggregationWorkerPool {
    this.instance ??= new StatisticsAggregationWorkerPool(config);
    return this.instance;
  }

  /**
   * Initialize the pool
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
   * Execute statistics aggregation operation
   * Dispatches to worker pool or falls back to main thread
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
    // Initialize pool if not already done
    if (!this.initialized) {
      await this.initialize();
    }

    const mainTaskId = taskId || generateUUID();
    const pool = getGenericWorkerPool({
      maxWorkers: this.config.maxWorkers,
      enableWorkers: this.config.enableWorkers,
      fallbackToMainThread: this.config.fallbackToMainThread,
    });

    // Ensure pool is initialized
    if (!pool.isAvailable()) {
      await pool.initialize();
    }

    return new Promise<StatisticsAggregationResult>((resolve, reject) => {
      // If pool is not available or workers are disabled, use main thread
      if (!pool.isAvailable() || !this.config.enableWorkers) {
        this.aggregateStatisticsMainThread(
          matchResults,
          readingHistory,
          filters,
          comparisonMode,
          selectedTimeRange,
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      // Try to get a worker
      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        // No workers available, fall back to main thread
        this.aggregateStatisticsMainThread(
          matchResults,
          readingHistory,
          filters,
          comparisonMode,
          selectedTimeRange,
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        // Worker retrieval failed, fall back to main thread
        this.aggregateStatisticsMainThread(
          matchResults,
          readingHistory,
          filters,
          comparisonMode,
          selectedTimeRange,
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      // Register task with pool
      const task = {
        taskId: mainTaskId,
        type: "statistics" as const,
        resolve: (result: unknown) => {
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
        },
        reject,
        cancelled: false,
        progressCallback,
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pool as any).registerTask?.(mainTaskId, task);

      // Dispatch task to worker
      worker.postMessage({
        type: "STATISTICS_AGGREGATION",
        payload: {
          taskId: mainTaskId,
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
    });
  }

  /**
   * Execute statistics aggregation on main thread
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
    } = await import("@/utils/statisticsAdapter");

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
   * Generate a cache key for memoization
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
   * Cancel an aggregation operation
   */
  cancelAggregation(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Get pool statistics
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
   * Terminate the pool
   */
  terminate(): void {
    // No-op for now
  }

  /**
   * Get the number of currently available workers
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return pool.getAvailableWorkerCount();
  }
}

/**
 * Get singleton instance
 */
export function getStatisticsWorkerPool(): StatisticsAggregationWorkerPool {
  return StatisticsAggregationWorkerPool.getInstance();
}
