/**
 * Cache key generation and validation utilities
 * @module cache/utils
 */

import { normalizeString } from "../match-engine";
import { mangaCache } from "./storage";
import { CACHE_EXPIRY } from "./types";

/**
 * Generate a cache key from a title
 * @param title - Title to generate cache key from
 * @returns Normalized cache key (max 30 characters)
 */
export function generateCacheKey(title: string): string {
  return normalizeString(title).substring(0, 30);
}

/**
 * Check if a cache entry is valid (exists and not expired)
 * @param key - Cache key to check
 * @returns True if the cache entry exists and is not expired
 */
export function isCacheValid(key: string): boolean {
  const entry = mangaCache[key];
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_EXPIRY;
}

/**
 * Clear all manga cache entries
 */
export function clearMangaCache(): void {
  const keyCount = Object.keys(mangaCache).length;
  console.info(
    `[MangaSearchService] 🗑️ Clearing manga cache: ${keyCount} entries`,
  );

  for (const key of Object.keys(mangaCache)) {
    delete mangaCache[key];
  }

  console.info("[MangaSearchService] ✅ Manga cache cleared successfully");
}

/**
 * Clear cache entries for specific manga titles
 *
 * @param titles - Array of manga titles to clear from cache
 * @returns Object with statistics about the clearing operation
 */
export function clearCacheForTitles(titles: string[]): {
  clearedCount: number;
  remainingCacheSize: number;
  titlesWithNoCache: number;
} {
  console.debug(
    `[MangaSearchService] Clearing cache for ${titles.length} manga titles...`,
  );

  let clearedCount = 0;
  let titlesWithNoCache = 0;

  // Clear each title's cache entry
  for (const title of titles) {
    const cacheKey = generateCacheKey(title);

    if (mangaCache[cacheKey]) {
      delete mangaCache[cacheKey];
      clearedCount++;
    } else {
      titlesWithNoCache++;
    }
  }

  // Save the updated cache to localStorage (import from persistence)
  if (clearedCount > 0) {
    // Use dynamic import to avoid circular dependency
    import("./persistence").then(({ saveCache }) => saveCache());
  }

  const remainingCacheSize = Object.keys(mangaCache).length;

  console.debug(
    `[MangaSearchService] Cache cleared: ${clearedCount} entries removed, ${titlesWithNoCache} not found, ${remainingCacheSize} remaining`,
  );

  return {
    clearedCount,
    remainingCacheSize,
    titlesWithNoCache,
  };
}
