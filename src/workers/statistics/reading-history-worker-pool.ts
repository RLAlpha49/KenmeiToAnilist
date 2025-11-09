/**
 * Reading History Worker Pool
 *
 * Manages off-thread reading history filtering and aggregation to keep
 * statistics filters responsive even with large reading histories.
 *
 * Supports optional aggregation by day or week and returns filtered entries
 * with comprehensive statistics.
 */

import type { ReadingHistory, ReadingHistoryEntry } from "@/utils/storage";
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
 * Statistics computed from filtered reading history
 */
export interface ReadingHistoryStats {
  totalEntries: number;
  totalChaptersRead: number;
  uniqueMangaCount: number;
  dateRange: {
    start: number;
    end: number;
  };
  activeDays: number;
  averageChaptersPerDay: number;
}

/**
 * Result returned from reading history filtering
 */
export interface ReadingHistoryFilterResult {
  filteredEntries: ReadingHistoryEntry[];
  stats: ReadingHistoryStats;
  aggregatedData?: Array<{
    date: string;
    chaptersRead: number;
    entriesCount: number;
  }>;
  timing: {
    filteringTimeMs: number;
    aggregationTimeMs?: number;
    totalTimeMs: number;
  };
}

/**
 * Singleton worker pool for reading history filtering and aggregation
 */
export class ReadingHistoryWorkerPool {
  private static instance: ReadingHistoryWorkerPool | null = null;
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
  }): ReadingHistoryWorkerPool {
    this.instance ??= new ReadingHistoryWorkerPool(config);
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
   * Execute reading history filtering operation
   * Dispatches to worker pool or falls back to main thread
   */
  async filterReadingHistory(
    history: ReadingHistory,
    dateRange: {
      start: Date | number;
      end: Date | number;
    },
    aggregationType?: "daily" | "weekly" | "none",
    progressCallback?: (
      stage: string,
      progress: number,
      message: string,
    ) => void,
    taskId?: string,
  ): Promise<ReadingHistoryFilterResult> {
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

    // Normalize date range to timestamps
    const startMs =
      dateRange.start instanceof Date
        ? dateRange.start.getTime()
        : dateRange.start;
    const endMs =
      dateRange.end instanceof Date ? dateRange.end.getTime() : dateRange.end;

    return new Promise<ReadingHistoryFilterResult>((resolve, reject) => {
      // If pool is not available or workers are disabled, use main thread
      if (!pool.isAvailable() || !this.config.enableWorkers) {
        this.filterReadingHistoryMainThread(
          history,
          startMs,
          endMs,
          aggregationType || "none",
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      // Try to get a worker
      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        // No workers available, fall back to main thread
        this.filterReadingHistoryMainThread(
          history,
          startMs,
          endMs,
          aggregationType || "none",
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        // Worker retrieval failed, fall back to main thread
        this.filterReadingHistoryMainThread(
          history,
          startMs,
          endMs,
          aggregationType || "none",
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      // Register task with pool
      const task = {
        taskId: mainTaskId,
        type: "reading-history" as const,
        resolve: (result: ReadingHistoryFilterResult) => {
          resolve({
            filteredEntries: result.filteredEntries,
            stats: result.stats,
            aggregatedData: result.aggregatedData,
            timing: result.timing,
          });
        },
        reject,
        cancelled: false,
        progressCallback,
        onProgress: (message: MessageEvent) => {
          // Adapt READING_HISTORY_FILTER_PROGRESS message to typed callback
          const data = message.data || message;
          if (
            data.type === "READING_HISTORY_FILTER_PROGRESS" &&
            progressCallback &&
            data.payload
          ) {
            const { stage, progress, message: progressMessage } = data.payload;
            progressCallback(stage, progress, progressMessage);
          }
        },
        workerIndex,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pool as any).registerTask?.(mainTaskId, task);

      // Dispatch task to worker
      worker.postMessage({
        type: "READING_HISTORY_FILTER",
        payload: {
          taskId: mainTaskId,
          history,
          dateRange: {
            start: startMs,
            end: endMs,
          },
          aggregationType: aggregationType || "none",
        },
      });

      console.info(
        `[ReadingHistoryWorkerPool] Dispatched reading history filter to worker ${workerIndex}`,
      );
    });
  }

  /**
   * Execute reading history filtering on main thread
   */
  private async filterReadingHistoryMainThread(
    history: ReadingHistory,
    startMs: number,
    endMs: number,
    aggregationType: "daily" | "weekly" | "none",
  ): Promise<ReadingHistoryFilterResult> {
    const startTime = performance.now();

    // Filter entries by date range
    const filterStartTime = performance.now();
    const filteredEntries = history.entries.filter(
      (entry) => entry.timestamp >= startMs && entry.timestamp <= endMs,
    );
    const filteringTimeMs = performance.now() - filterStartTime;

    // Compute statistics
    const aggregationStartTime = performance.now();

    // Count unique manga
    const uniqueManga = new Set(filteredEntries.map((e) => e.mangaId));

    // Count total chapters
    const totalChapters = filteredEntries.reduce(
      (sum, e) => sum + e.chaptersRead,
      0,
    );

    // Count active days
    const activeDays = new Set(
      filteredEntries.map((e) => {
        const date = new Date(e.timestamp);
        return date.toISOString().split("T")[0];
      }),
    ).size;

    // Calculate average chapters per day
    const averageChaptersPerDay =
      activeDays > 0 ? Math.round((totalChapters / activeDays) * 100) / 100 : 0;

    // Aggregate data if requested
    let aggregatedData:
      | Array<{
          date: string;
          chaptersRead: number;
          entriesCount: number;
        }>
      | undefined;

    if (aggregationType !== "none") {
      const aggregationMap = new Map<
        string,
        { chaptersRead: number; entriesCount: number }
      >();

      for (const entry of filteredEntries) {
        let key: string;
        if (aggregationType === "daily") {
          const date = new Date(entry.timestamp);
          key = date.toISOString().split("T")[0];
        } else {
          // Weekly
          const date = new Date(entry.timestamp);
          const day = date.getUTCDay();
          const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff),
          );
          key = weekStart.toISOString().split("T")[0];
        }

        const current = aggregationMap.get(key) || {
          chaptersRead: 0,
          entriesCount: 0,
        };
        aggregationMap.set(key, {
          chaptersRead: current.chaptersRead + entry.chaptersRead,
          entriesCount: current.entriesCount + 1,
        });
      }

      // Convert to sorted array
      aggregatedData = Array.from(aggregationMap.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, data]) => ({
          date,
          chaptersRead: data.chaptersRead,
          entriesCount: data.entriesCount,
        }));
    }

    const aggregationTimeMs = performance.now() - aggregationStartTime;
    const totalTimeMs = performance.now() - startTime;

    return {
      filteredEntries,
      stats: {
        totalEntries: filteredEntries.length,
        totalChaptersRead: totalChapters,
        uniqueMangaCount: uniqueManga.size,
        dateRange: {
          start: startMs,
          end: endMs,
        },
        activeDays,
        averageChaptersPerDay,
      },
      aggregatedData,
      timing: {
        filteringTimeMs,
        aggregationTimeMs:
          aggregationType === "none" ? undefined : aggregationTimeMs,
        totalTimeMs,
      },
    };
  }

  /**
   * Cancel a filtering operation
   */
  cancelFilter(taskId: string): void {
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
export function getReadingHistoryWorkerPool(): ReadingHistoryWorkerPool {
  return ReadingHistoryWorkerPool.getInstance();
}
