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
 * Wrapper around unified pool for matching operations
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
   * Initialize the pool (delegates to unified pool)
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
   * Check if pool is available
   */
  isAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Get the number of currently available workers in the pool
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Execute a batch matching operation
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
   * Execute matching on main thread (fallback)
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
   * Cancel a batch operation
   */
  cancelBatch(taskId: string): void {
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
    const pool = getGenericWorkerPool();
    pool.terminate();
  }
}
