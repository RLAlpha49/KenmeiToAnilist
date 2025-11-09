/**
 * Data Table Worker Pool
 *
 * Manages data table preparation operations through the shared worker pool.
 * Preprocesses large DataTable slices in a worker to avoid UI stalls during "Load More" operations.
 *
 * Features:
 * - Virtualized data slicing and preprocessing
 * - Precomputed row heights for smooth virtualization
 * - Formatted values (status, scores, dates) prepared off-thread
 * - Task queuing and execution
 * - Error handling with main thread fallback
 * - Performance metrics
 */

import { getGenericWorkerPool } from "./worker-pool";
import type { DataTablePreparationMessage } from "./types";
import type { KenmeiMangaItem } from "@/types/kenmei";

/**
 * Precomputed data prepared for table display
 */
export interface PreparedTableRow {
  /**
   * Original manga data
   */
  original: KenmeiMangaItem;

  /**
   * Precomputed formatted values for display
   */
  formattedValues: {
    status: string;
    score: string;
    chapters: string;
    volumes: string;
    lastRead: string;
  };

  /**
   * Computed row height for virtualization
   */
  rowHeight: number;
}

/**
 * Result from a data table preparation operation
 */
export interface DataTablePreparationResult {
  /**
   * The prepared data slice with precomputed values
   */
  preparedData: PreparedTableRow[];

  /**
   * Index information for the slice
   */
  indexInfo: {
    startIndex: number;
    endIndex: number;
    totalCount: number;
  };

  /**
   * Performance timing information
   */
  timing: {
    formattingTimeMs: number;
    metadataComputationTimeMs: number;
    totalTimeMs: number;
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
  return `table_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Data table worker pool manager
 */
export class DataTableWorkerPool {
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
      console.info("[DataTableWorkerPool] Pool initialized");
    } catch (error) {
      console.warn("[DataTableWorkerPool] Failed to initialize pool:", error);
      // Still mark as initialized to use main thread fallback
      this.initialized = true;
    }
  }

  /**
   * Prepare a slice of table data for display
   * Executes on worker if available, falls back to main thread
   */
  async prepareTableSlice(
    data: KenmeiMangaItem[],
    startIndex: number,
    endIndex: number,
    itemsPerPage: number,
    columnVisibility: {
      score: boolean;
      chapters: boolean;
      volumes: boolean;
      lastRead: boolean;
    },
  ): Promise<DataTablePreparationResult> {
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
          "[DataTableWorkerPool] No workers available, using main thread",
        );
        return this.executeOnMainThread(
          data,
          startIndex,
          endIndex,
          columnVisibility,
        );
      }

      // Try to use worker
      return await this.executeOnWorker(
        pool,
        taskId,
        data,
        startIndex,
        endIndex,
        itemsPerPage,
        columnVisibility,
      );
    } catch (error) {
      console.warn(
        "[DataTableWorkerPool] Worker execution failed, falling back to main thread:",
        error,
      );
      return this.executeOnMainThread(
        data,
        startIndex,
        endIndex,
        columnVisibility,
      );
    }
  }

  /**
   * Execute data table preparation on a worker
   */
  private async executeOnWorker(
    pool: ReturnType<typeof getGenericWorkerPool>,
    taskId: string,
    data: KenmeiMangaItem[],
    startIndex: number,
    endIndex: number,
    itemsPerPage: number,
    columnVisibility: {
      score: boolean;
      chapters: boolean;
      volumes: boolean;
      lastRead: boolean;
    },
  ): Promise<DataTablePreparationResult> {
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

      // Register task with the pool
      const task = {
        taskId,
        type: "data_table_preparation" as const,
        data,
        startIndex,
        endIndex,
        itemsPerPage,
        columnVisibility,
        resolve: null as unknown as (result: unknown) => void,
        reject: null as unknown as (error: Error) => void,
        cancelled: false,
        workerIndex,
      };

      const taskPromise = new Promise<DataTablePreparationResult>(
        (resolve, reject) => {
          task.resolve = (result: unknown) => {
            const typedResult = result as Record<string, unknown>;
            resolve({
              preparedData: typedResult.preparedData as PreparedTableRow[],
              indexInfo:
                typedResult.indexInfo as DataTablePreparationResult["indexInfo"],
              timing:
                typedResult.timing as DataTablePreparationResult["timing"],
              executedOnWorker: true,
            });
          };
          task.reject = reject;
        },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool.registerTask(taskId, task as unknown as any);

      // Send message to the worker
      const message: DataTablePreparationMessage = {
        type: "DATA_TABLE_PREPARATION",
        payload: {
          taskId,
          data,
          viewport: {
            startIndex,
            endIndex,
            itemsPerPage,
          },
          columnVisibility,
        },
      };

      worker.postMessage(message);

      console.debug(
        `[DataTableWorkerPool] Dispatched preparation task ${taskId}: ${endIndex - startIndex} items`,
      );

      // Set timeout for task completion (10 seconds)
      const timeout = setTimeout(() => {
        pool.cancelTask(taskId);
        task.reject(
          new Error(
            `[DataTableWorkerPool] Preparation task ${taskId} timed out after 10s`,
          ),
        );
        console.warn(
          `[DataTableWorkerPool] Preparation task ${taskId} timed out after 10s`,
        );
      }, 10000);

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
        "[DataTableWorkerPool] Error executing preparation on worker:",
        error,
      );
      throw error;
    }
  }

  /**
   * Execute data table preparation on main thread (fallback)
   */
  private executeOnMainThread(
    data: KenmeiMangaItem[],
    startIndex: number,
    endIndex: number,
    columnVisibility: {
      score: boolean;
      chapters: boolean;
      volumes: boolean;
      lastRead: boolean;
    },
  ): DataTablePreparationResult {
    const startTime = performance.now();
    const formattingStartTime = performance.now();

    // Extract and format the viewport slice
    const slice = data.slice(startIndex, endIndex);

    // Precompute formatted values for all visible rows
    const preparedData = slice.map((item) => {
      // Format status
      const statusDisplayValue = item.status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // Format score (only if visible and present)
      let scoreDisplayValue = "-";
      if (columnVisibility.score && item.score !== undefined) {
        scoreDisplayValue = item.score > 0 ? item.score.toString() : "-";
      }

      // Format chapters (only if visible and present)
      let chaptersDisplayValue = "-";
      if (columnVisibility.chapters && item.chapters_read !== undefined) {
        chaptersDisplayValue =
          item.chapters_read > 0 ? item.chapters_read.toString() : "0";
      }

      // Format volumes (only if visible and present)
      let volumesDisplayValue = "-";
      if (columnVisibility.volumes && item.volumes_read !== undefined) {
        volumesDisplayValue =
          item.volumes_read > 0 ? item.volumes_read.toString() : "0";
      }

      // Format last read date (only if visible)
      const lastReadDate = item.last_read_at || item.updated_at;
      const lastReadDisplayValue =
        columnVisibility.lastRead && lastReadDate
          ? (() => {
              try {
                const date = new Date(lastReadDate);
                return date.toLocaleDateString();
              } catch {
                return "-";
              }
            })()
          : "-";

      // Calculate approximate row height based on content
      const titleLength = item.title.length;
      const titleLines = Math.max(1, Math.ceil(titleLength / 40)); // ~40 chars per line
      const baseRowHeight = 40;
      const additionalHeight = (titleLines - 1) * 20;
      const rowHeight = baseRowHeight + additionalHeight;

      return {
        original: item,
        formattedValues: {
          status: statusDisplayValue,
          score: scoreDisplayValue,
          chapters: chaptersDisplayValue,
          volumes: volumesDisplayValue,
          lastRead: lastReadDisplayValue,
        },
        rowHeight,
      };
    });

    const formattingTimeMs = performance.now() - formattingStartTime;

    // Compute metadata
    const metadataStartTime = performance.now();

    // Metadata computation complete
    const metadataComputationTimeMs = performance.now() - metadataStartTime;
    const totalTimeMs = performance.now() - startTime;

    return {
      preparedData,
      indexInfo: {
        startIndex,
        endIndex,
        totalCount: data.length,
      },
      timing: {
        formattingTimeMs,
        metadataComputationTimeMs,
        totalTimeMs,
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
        console.warn("[DataTableWorkerPool] Error terminating pool:", error);
      }
    }
  }
}

/**
 * Global singleton instance
 */
let tablePoolInstance: DataTableWorkerPool | null = null;

/**
 * Get or create the singleton data table worker pool
 */
export function getDataTableWorkerPool(
  maxWorkers?: number,
): DataTableWorkerPool {
  tablePoolInstance ??= new DataTableWorkerPool(maxWorkers);
  return tablePoolInstance;
}
