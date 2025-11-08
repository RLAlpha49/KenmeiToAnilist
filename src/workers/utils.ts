/**
 * Utility functions for worker-based matching with fallback support.
 *
 * Provides a simple API for executing matching operations that automatically
 * uses workers when available and falls back to main thread execution otherwise.
 *
 * @module workers/utils
 */

import { getWorkerPool } from "./pool";
import { findBestMatches } from "@/api/matching/match-engine";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";

/**
 * Result of executing matching operations, including a cancel function.
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
 * Execute matching for a batch of manga, using workers if available.
 *
 * This is a convenience function that handles worker availability checking
 * and provides seamless fallback to main thread execution. Returns an object
 * with a promise and a cancel function for cancellation support.
 *
 * @param kenmeiMangaList - List of Kenmei manga to match
 * @param anilistCandidatesMap - Map of manga IDs to their AniList candidates
 * @param config - Matching engine configuration
 * @param progressCallback - Optional callback for progress updates
 * @param useWorkers - Whether to attempt using workers (default: true)
 * @returns Object with promise and cancel function
 *
 * @example
 * ```typescript
 * const execution = executeMatchingWithWorkers(
 *   mangaList,
 *   candidatesMap,
 *   matchConfig,
 *   (current, total, title) => {
 *     console.log(`${current}/${total}: ${title}`);
 *   }
 * );
 * const results = await execution.promise;
 * // or cancel with: execution.cancel();
 * ```
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
        pool.cancelTask(taskId);
      }
    },
  };
}

/**
 * Execute matching on the main thread (synchronous fallback).
 *
 * This function mimics the worker behavior but executes on the main thread.
 * Used as a fallback when workers are unavailable or disabled.
 *
 * @param kenmeiMangaList - List of Kenmei manga to match
 * @param anilistCandidatesMap - Map of manga IDs to their AniList candidates
 * @param config - Matching engine configuration
 * @param progressCallback - Optional callback for progress updates
 * @returns Promise resolving to match results
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
 * Check if workers are available and initialized.
 *
 * **Important**: This function returns the current availability state. It may return `false`
 * during worker pool initialization, even though workers will become available shortly.
 *
 * **Recommended Usage**: For most use cases, call `executeMatchingWithWorkers()` directly.
 * It handles initialization internally and falls back to main thread execution if needed.
 *
 * If you need to explicitly wait for worker initialization, use `awaitWorkerReady()`.
 *
 * @returns True if workers are currently available and ready for use
 *
 * @example
 * ```typescript
 * // Recommended: Call executeMatchingWithWorkers directly
 * const execution = executeMatchingWithWorkers(mangaList, candidatesMap, config);
 * const results = await execution.promise;
 *
 * // Alternative: Check availability with explicit wait
 * await awaitWorkerReady();
 * if (areWorkersAvailable()) {
 *   // Safe to use workers
 * }
 * ```
 */
export function areWorkersAvailable(): boolean {
  const pool = getWorkerPool();
  return pool.isAvailable();
}

/**
 * Wait for the worker pool to be fully initialized and ready.
 *
 * This is useful if you want to explicitly ensure workers are ready before
 * checking `areWorkersAvailable()` or making assumptions about worker availability.
 *
 * In most cases, you don't need this—just call `executeMatchingWithWorkers()` directly,
 * which handles initialization automatically.
 *
 * @returns Promise that resolves once workers are initialized (or fallback is ready)
 *
 * @example
 * ```typescript
 * await awaitWorkerReady();
 * if (areWorkersAvailable()) {
 *   // Now safe to rely on workers
 * }
 * ```
 */
export async function awaitWorkerReady(): Promise<void> {
  const pool = getWorkerPool();
  await pool.initialize();
}
