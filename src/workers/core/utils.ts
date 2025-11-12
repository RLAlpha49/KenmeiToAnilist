/**
 * Helpers for worker-backed matching with seamless main-thread fallback.
 * @source
 */

import { getWorkerPool } from "./pool";
import { findBestMatches } from "@/api/matching/match-engine";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";

/**
 * Result wrapper for a cancellable matching execution.
 * @source
 */
export interface CancellableExecution {
  /**
   * Promise that resolves to match results
   */
  promise: Promise<MangaMatchResult[]>;

  /**
   * Function to cancel the execution
   */
  cancel: () => void;

  /**
   * Task ID for tracking
   */
  taskId: string;
}

/**
 * Executes batch matching via workers when possible, falling back to main thread.
 * @param kenmeiMangaList - Kenmei manga to match.
 * @param anilistCandidatesMap - Candidate AniList entries keyed by ID.
 * @param config - Matching engine configuration overrides.
 * @param progressCallback - Optional progress callback.
 * @param useWorkers - Whether to try workers (default: true).
 * @returns Cancellable execution descriptor.
 * @source
 */
export function executeMatchingWithWorkers(
  kenmeiMangaList: KenmeiManga[],
  anilistCandidatesMap: Map<string, AniListManga[]>,
  config: Partial<MatchEngineConfig> = {},
  progressCallback?: (
    current: number,
    total: number,
    currentTitle?: string,
  ) => void,
  useWorkers = true,
): CancellableExecution {
  // Generate task ID upfront to ensure consistency and eliminate race condition
  // This ID is passed to the pool and used for all cancellation operations
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const pool = useWorkers ? getWorkerPool() : null;

  const promise = (async () => {
    // Check if workers should be used
    if (useWorkers && pool) {
      try {
        // Pass the upfront taskId to ensure pool uses same ID for all tracking
        const execution = await pool.executeMatchBatch(
          kenmeiMangaList,
          anilistCandidatesMap,
          config as MatchEngineConfig,
          progressCallback,
          taskId,
        );
        // Return the promise from the execution
        return await execution.promise;
      } catch (error) {
        console.warn(
          "Worker execution failed, falling back to main thread:",
          error,
        );
        // Fall through to main thread execution
      }
    }

    // Fallback to main thread execution
    return executeMatchingOnMainThread(
      kenmeiMangaList,
      anilistCandidatesMap,
      config,
      progressCallback,
    );
  })();

  return {
    promise,
    taskId,
    cancel: () => {
      // Always use the upfront taskId - it's guaranteed to be valid
      // For sync fallback (no pool), this is a safe no-op
      if (pool) {
        pool.cancelBatch(taskId);
      }
    },
  };
}

/**
 * Executes batch matching on the main thread as a fallback.
 * @param kenmeiMangaList - Kenmei manga to match.
 * @param anilistCandidatesMap - Candidate AniList entries keyed by index.
 * @param config - Matching engine configuration overrides.
 * @param progressCallback - Optional progress callback.
 * @returns Promise resolving to match results.
 * @source
 */
export async function executeMatchingOnMainThread(
  kenmeiMangaList: KenmeiManga[],
  anilistCandidatesMap: Map<string, AniListManga[]>,
  config: Partial<MatchEngineConfig> = {},
  progressCallback?: (
    current: number,
    total: number,
    currentTitle?: string,
  ) => void,
): Promise<MangaMatchResult[]> {
  const results: MangaMatchResult[] = [];
  const total = kenmeiMangaList.length;

  for (let i = 0; i < total; i++) {
    const manga = kenmeiMangaList[i];
    // Use index-based key to match worker and results.ts convention
    const candidates = anilistCandidatesMap.get(String(i)) || [];

    const matchResult = findBestMatches(
      manga,
      candidates,
      config as MatchEngineConfig,
    );
    results.push(matchResult);

    if (progressCallback) {
      progressCallback(i + 1, total, manga.title);
    }

    // Yield to event loop periodically to keep UI responsive
    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * Returns the available worker count from the matching pool.
 * For pool-specific availability checks, call getAvailableWorkerCount() directly on the pool instance.
 * This function is primarily used for UI indicators of worker readiness.
 * @returns Number of available workers in the matching pool (0 if unavailable).
 * @source
 */
export function areWorkersAvailable(): number {
  const matchingPool = getWorkerPool();
  return matchingPool.getAvailableWorkerCount?.() ?? 0;
}

/**
 * Waits until the worker pool is initialized or fallback is configured.
 * @source
 */
export async function awaitWorkerReady(): Promise<void> {
  const pool = getWorkerPool();
  await pool.initialize();
}
