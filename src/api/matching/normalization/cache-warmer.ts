/**
 * Title Normalization Cache Warmer Service
 *
 * Provides background cache seeding for title normalization using worker pools.
 * Manages canonical caches on the main thread and applies worker-produced deltas.
 *
 * @module api/matching/normalization/cache-warmer
 */

import { getTitleNormalizationPool } from "@/workers";
import {
  getTitleNormalizationCache,
  saveTitleNormalizationCache,
  applyNormalizationCacheDeltas,
} from "@/utils/storage";
import type {
  NormalizationCacheResult,
  NormalizationProgressCallback,
} from "@/workers";

export type WorkerNormalizationAlgorithm =
  | "normalizeForMatching"
  | "processTitle";
export type CacheNormalizationKey =
  | WorkerNormalizationAlgorithm
  | "collectMangaTitles";

/**
 * Service for warming title normalization caches off-thread.
 * Maintains canonical caches on the main thread and applies worker deltas.
 */
export class TitleNormalizationCacheWarmer {
  private currentTaskId: string | null = null;
  private progressCallback?: NormalizationProgressCallback;

  /**
   * Start background cache warmup for title normalization.
   * Schedules warmup to run when idle for better UX.
   * @param titles - List of titles to normalize
   * @param algorithms - Algorithms to apply
   * @param progressCallback - Optional progress callback for UI updates
   * @returns Task ID for tracking/cancellation
   */
  async warmupCachesInBackground(
    titles: string[],
    algorithms: WorkerNormalizationAlgorithm[] = ["normalizeForMatching"],
    progressCallback?: NormalizationProgressCallback,
  ): Promise<string> {
    if (!titles || titles.length === 0) {
      console.debug(
        "[TitleNormalizationCacheWarmer] No titles to normalize, skipping warmup",
      );
      return "";
    }

    this.progressCallback = progressCallback;
    const taskId = this.generateTaskId();
    this.currentTaskId = taskId;

    // Schedule warmup using requestIdleCallback if available, otherwise setTimeout
    const scheduleWarmup = () => {
      this.performCacheWarmup(titles, algorithms, taskId).catch((error) => {
        console.error(
          "[TitleNormalizationCacheWarmer] Error during cache warmup:",
          error,
        );
      });
    };

    if (globalThis.requestIdleCallback) {
      globalThis.requestIdleCallback(scheduleWarmup, { timeout: 30000 });
    } else {
      setTimeout(scheduleWarmup, 1000);
    }

    console.info(
      `[TitleNormalizationCacheWarmer] 🔥 Scheduled cache warmup (${titles.length} titles) with task ID: ${taskId}`,
    );
    return taskId;
  }

  /**
   * Perform the actual cache warmup operation.
   * @param titles - List of titles to normalize
   * @param algorithms - Algorithms to apply
   * @param taskId - Task ID for tracking
   */
  private async performCacheWarmup(
    titles: string[],
    algorithms: WorkerNormalizationAlgorithm[],
    taskId: string,
  ): Promise<void> {
    try {
      console.info(
        `[TitleNormalizationCacheWarmer] 🚀 Starting cache warmup (task: ${taskId})`,
      );

      const startTime = performance.now();
      const pool = getTitleNormalizationPool();

      // Initialize pool if needed
      await pool.initialize();

      if (!pool.isAvailable()) {
        console.warn(
          "[TitleNormalizationCacheWarmer] Worker pool not available, skipping warmup",
        );
        return;
      }

      // Get normalization results from worker
      const result = await pool.normalizeTitles(
        titles,
        algorithms,
        (algorithm, current, total) => {
          console.debug(
            `[TitleNormalizationCacheWarmer] 📊 Progress: ${algorithm} ${current}/${total}`,
          );
          this.progressCallback?.(algorithm, current, total);
        },
        taskId,
      );

      // Clear task if cancelled
      if (this.currentTaskId !== taskId) {
        console.info(
          `[TitleNormalizationCacheWarmer] ⏹️ Cache warmup cancelled (task: ${taskId})`,
        );
        return;
      }

      // Apply deltas to canonical cache
      this.applyResultsToCache(result);

      const duration = performance.now() - startTime;
      console.info(
        `[TitleNormalizationCacheWarmer] ✅ Cache warmup completed (${duration.toFixed(2)}ms, task: ${taskId})`,
      );
    } catch (error) {
      console.error(
        "[TitleNormalizationCacheWarmer] ❌ Cache warmup failed:",
        error,
      );
    }
  }

  /**
   * Apply worker results to the canonical cache.
   * Merges worker-produced caches and deltas into main thread storage.
   * @param result - Normalization result from worker
   */
  private applyResultsToCache(result: NormalizationCacheResult): void {
    try {
      // Get current canonical cache
      const canonicalCache = getTitleNormalizationCache();

      // Merge new caches into canonical
      for (const [algorithm, cache] of Object.entries(result.caches)) {
        if (!canonicalCache.caches[algorithm]) {
          canonicalCache.caches[algorithm] = {};
        }
        Object.assign(canonicalCache.caches[algorithm], cache);
      }

      canonicalCache.lastUpdated = Date.now();

      // Save updated canonical cache
      saveTitleNormalizationCache(canonicalCache);

      // Also apply deltas if provided
      if (result.deltas) {
        applyNormalizationCacheDeltas(result.deltas);
      }

      console.info(
        `[TitleNormalizationCacheWarmer] 💾 Applied ${Object.keys(result.caches).length} algorithm caches to storage`,
      );
    } catch (error) {
      console.error(
        "[TitleNormalizationCacheWarmer] Error applying results to cache:",
        error,
      );
    }
  }

  /**
   * Cancel the current cache warmup operation.
   */
  cancel(): void {
    if (this.currentTaskId) {
      const pool = getTitleNormalizationPool();
      pool.cancel(this.currentTaskId);
      console.info(
        `[TitleNormalizationCacheWarmer] ⏹️ Cancelled cache warmup (task: ${this.currentTaskId})`,
      );
      this.currentTaskId = null;
    }
  }

  /**
   * Get normalized title from cache.
   * Falls back to main-thread normalization if not cached.
   * @param title - Title to lookup
   * @param algorithm - Normalization algorithm to use
   * @param normalizer - Fallback normalizer function
   * @returns Normalized title
   */
  getNormalizedTitle(
    title: string,
    algorithm: CacheNormalizationKey,
    normalizer: (title: string) => string,
  ): string {
    try {
      const cache = getTitleNormalizationCache();
      if (cache.caches[algorithm]?.[title]) {
        return cache.caches[algorithm][title];
      }
    } catch (error) {
      console.debug(
        "[TitleNormalizationCacheWarmer] Cache lookup failed, using fallback normalizer",
        error,
      );
    }

    // Fallback to direct normalization
    return normalizer(title);
  }

  /**
   * Get all normalized titles for an algorithm.
   * @param algorithm - Algorithm to retrieve
   * @returns Map of original to normalized titles
   */
  getNormalizedTitlesForAlgorithm(
    algorithm: CacheNormalizationKey,
  ): Record<string, string> | null {
    try {
      const cache = getTitleNormalizationCache();
      return cache.caches[algorithm] || null;
    } catch (error) {
      console.debug(
        "[TitleNormalizationCacheWarmer] Error retrieving algorithm cache:",
        error,
      );
      return null;
    }
  }

  /**
   * Preload a batch of titles into the cache synchronously.
   * Stores directly to cache without worker processing.
   * @param titles - Titles to preload
   * @param algorithm - Algorithm to use for preload
   * @param normalizer - Normalizer function
   */
  preloadTitles(
    titles: string[],
    algorithm: CacheNormalizationKey,
    normalizer: (title: string) => string,
  ): void {
    try {
      const cache = getTitleNormalizationCache();
      if (!cache.caches[algorithm]) {
        cache.caches[algorithm] = {};
      }

      for (const title of titles) {
        if (!cache.caches[algorithm][title]) {
          cache.caches[algorithm][title] = normalizer(title);
        }
      }

      cache.lastUpdated = Date.now();
      saveTitleNormalizationCache(cache);

      console.debug(
        `[TitleNormalizationCacheWarmer] 📌 Preloaded ${titles.length} titles for algorithm: ${algorithm}`,
      );
    } catch (error) {
      console.error(
        "[TitleNormalizationCacheWarmer] Error preloading titles:",
        error,
      );
    }
  }

  /**
   * Generate a unique task ID.
   */
  private generateTaskId(): string {
    return `norm-warmup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Singleton instance of the cache warmer service.
 */
let cacheWarmerInstance: TitleNormalizationCacheWarmer | null = null;

/**
 * Get or create the singleton cache warmer service.
 */
export function getCacheWarmer(): TitleNormalizationCacheWarmer {
  cacheWarmerInstance ??= new TitleNormalizationCacheWarmer();
  return cacheWarmerInstance;
}
