/**
 * Matching Worker Pool Wrapper
 *
 * Provides a familiar API for manga matching operations while using
 * the unified worker pool under the hood to share workers with CSV parsing.
 *
 * @module workers/matching-worker-pool
 */

import type { WorkerPoolConfig, MatchBatchExecution } from "../core/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import { findBestMatches } from "@/api/matching/match-engine";
import { getGenericWorkerPool } from "../core/worker-pool";

/**
 * Generates a RFC4122-like UUID for matching tasks.
 * @returns A unique task identifier.
 * @source
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
 * Manages manga matching operations using the shared worker pool.
 * @source
 */
export class MatchingWorkerPool {
  private readonly config: WorkerPoolConfig;
  private initialized = false;

  constructor(config?: Partial<WorkerPoolConfig>) {
    this.config = {
      maxWorkers: config?.maxWorkers ?? 4,
      enableWorkers: config?.enableWorkers ?? true,
      fallbackToMainThread: config?.fallbackToMainThread ?? true,
    };
  }

  /**
   * Initializes the shared worker pool for matching operations.
   * @returns A promise that resolves when initialization is complete.
   * @source
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
   * Indicates whether the worker pool is initialized and usable.
   * @returns True if the pool is initialized and available.
   * @source
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Retrieves the number of currently available workers.
   * @returns Count of available workers or 0 if uninitialized.
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Executes a batch manga matching operation using a worker or the main thread.
   * @param kenmeiMangaList - Source manga entries from Kenmei.
   * @param anilistMangaMap - Candidate AniList manga grouped by key.
   * @param config - Partial matching engine configuration.
   * @param progressCallback - Optional progress callback for UI updates.
   * @param taskId - Optional external task identifier.
   * @returns Batch execution handle with aggregated promise.
   * @source
   */
  async executeMatchBatch(
    kenmeiMangaList: KenmeiManga[],
    anilistMangaMap: Map<string, AniListManga[]>,
    config: Partial<MatchEngineConfig>,
    progressCallback?: (
      current: number,
      total: number,
      currentTitle?: string,
    ) => void,
    taskId?: string,
  ): Promise<MatchBatchExecution> {
    const pool = getGenericWorkerPool();

    // Ensure pool is initialized
    if (!pool.isAvailable()) {
      await pool.initialize();
    }

    const mainTaskId = taskId || generateUUID();

    const promise = new Promise<MangaMatchResult[]>((resolve, reject) => {
      if (!pool.isAvailable()) {
        // Fallback to main thread
        this.executeMatchBatchMainThread(
          kenmeiMangaList,
          anilistMangaMap,
          config,
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        // Fallback to main thread
        this.executeMatchBatchMainThread(
          kenmeiMangaList,
          anilistMangaMap,
          config,
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        // Fallback to main thread
        this.executeMatchBatchMainThread(
          kenmeiMangaList,
          anilistMangaMap,
          config,
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      // Register task
      const task = {
        taskId: mainTaskId,
        type: "matching" as const,
        kenmeiManga: kenmeiMangaList,
        anilistCandidates: Array.from(anilistMangaMap),
        config,
        resolve: (result: unknown) => {
          // Adapt raw payload to expected shape: extract results array
          const adaptedResult =
            (result as { results?: MangaMatchResult[] }).results ||
            (result as MangaMatchResult[]);
          resolve(adaptedResult);
        },
        reject,
        cancelled: false,
        progressCallback,
        onProgress: (message: unknown) => {
          // Adapt generic message to typed callback
          const msgWithType = message as {
            type?: string;
            payload?: {
              current?: number;
              total?: number;
              currentTitle?: string;
            };
          };
          if (
            msgWithType.type === "PROGRESS" &&
            progressCallback &&
            msgWithType.payload &&
            typeof msgWithType.payload.current === "number" &&
            typeof msgWithType.payload.total === "number"
          ) {
            const { current, total, currentTitle } = msgWithType.payload;
            progressCallback(current, total, currentTitle);
          }
        },
        workerIndex,
      };

      pool.registerTask(mainTaskId, task);

      // Send message to worker
      worker.postMessage({
        type: "MATCH_BATCH",
        payload: {
          taskId: mainTaskId,
          kenmeiManga: kenmeiMangaList,
          anilistCandidates: Array.from(anilistMangaMap),
          config,
        },
      });

      console.info(
        `[MatchingWorkerPool] 📤 Dispatched batch match to worker ${workerIndex}: ${kenmeiMangaList.length} items`,
      );
    });

    return {
      taskId: mainTaskId,
      chunkTaskIds: [],
      promise,
    };
  }

  /**
   * Executes batch matching on the main thread as a fallback.
   * @param kenmeiMangaList - Source manga entries from Kenmei.
   * @param anilistMangaMap - Candidate AniList manga grouped by key.
   * @param config - Partial matching engine configuration.
   * @returns Promise resolving to raw match results.
   * @source
   */
  private async executeMatchBatchMainThread(
    kenmeiMangaList: KenmeiManga[],
    anilistMangaMap: Map<string, AniListManga[]>,
    config: Partial<MatchEngineConfig>,
  ): Promise<MangaMatchResult[]> {
    console.warn("[MatchingWorkerPool] Falling back to main thread matching");
    const results: MangaMatchResult[] = [];
    const total = kenmeiMangaList.length;

    for (let i = 0; i < total; i++) {
      const manga = kenmeiMangaList[i];
      const candidates = anilistMangaMap.get(String(i)) || [];
      const matchResult = findBestMatches(
        manga,
        candidates,
        config as MatchEngineConfig,
      );
      results.push(matchResult);
    }

    return results;
  }

  /**
   * Cancels a matching batch task in the worker pool.
   * @param taskId - Identifier of the task to cancel.
   * @source
   */
  cancelBatch(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Returns current pool statistics.
   * @returns Aggregate worker and task metrics.
   * @source
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
   * Terminates the shared worker pool.
   * @source
   */
  terminate(): void {
    const pool = getGenericWorkerPool();
    pool.terminate();
  }
}
