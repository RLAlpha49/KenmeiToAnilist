/**
 * Cache key generation and validation utilities
 * @module cache/utils
 */

import { normalizeString } from "../match-engine";
import { mangaCache } from "./storage";
import { CACHE_EXPIRY } from "./types";

/**
 * Generates a normalized cache key from a manga title.
 * Uses string normalization and limits to 30 characters for consistency.
 * @param title - Manga title to convert to cache key.
 * @returns Normalized cache key (maximum 30 characters).
 * @source
 */
export function generateCacheKey(title: string): string {
  return normalizeString(title).substring(0, 30);
}

/**
 * Checks if a cache entry exists and is not expired.
 * @param key - Cache key to validate.
 * @returns True if the cache entry exists and has not exceeded CACHE_EXPIRY; false otherwise.
 * @source
 */
export function isCacheValid(key: string): boolean {
  const entry = mangaCache[key];
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_EXPIRY;
}

/**
 * Clears all entries from the in-memory manga cache.
 * Logs the operation before and after clearing.
 * @returns void
 * @source
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
 * Clears cache entries for specific manga titles and persists the change.
 * Generates cache keys from titles and removes matching entries from the cache.
 * @param titles - Array of manga titles whose cache entries should be removed.
 * @returns Statistics object with cleared count, remaining cache size, and titles with no cache.
 * @source
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

  // Remove cache entries for each provided title
  for (const title of titles) {
    const cacheKey = generateCacheKey(title);

    if (mangaCache[cacheKey]) {
      delete mangaCache[cacheKey];
      clearedCount++;
    } else {
      titlesWithNoCache++;
    }
  }

  // Save the updated cache to localStorage if entries were cleared
  if (clearedCount > 0) {
    // Use dynamic import to avoid circular dependency with persistence module
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
