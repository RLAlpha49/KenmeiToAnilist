/**
 * Cache debugging utilities
 * @module cache/debugger
 */

import { mangaCache } from "./storage";
import type { MangaCache } from "./types";
import { generateCacheKey, clearMangaCache } from "./utils";
import { syncWithClientCache } from "./sync";

/**
 * Types for cache debugger utilities
 */
interface LocalStorageCacheCounts {
  mangaCache: number;
  searchCache: number;
}

export interface CacheStatus {
  inMemoryCache: number;
  localStorage: LocalStorageCacheCounts;
}

export interface CacheEntryInfo {
  mangaCount: number;
  timestamp: number;
  age: string;
}

export interface CheckMangaInCacheResult {
  isFound: boolean;
  cacheKey: string;
  entry?: CacheEntryInfo;
}

export interface CacheEntrySummary {
  cacheKey: string;
  mangaCount: number;
  timestamp: number;
  age: string;
}

/**
 * Returns a human-readable age string from a timestamp.
 */
function formatCacheAge(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageMinutes = Math.floor(ageMs / 60000);

  if (ageMinutes < 60) {
    return `${ageMinutes} minute(s)`;
  }

  if (ageMinutes < 1440) {
    return `${Math.floor(ageMinutes / 60)} hour(s)`;
  }

  return `${Math.floor(ageMinutes / 1440)} day(s)`;
}

/**
 * Debugging utilities for cache inspection and management.
 * Provides methods to check cache status, inspect entries, reset caches, and force synchronization.
 * @source
 */
export const cacheDebugger = {
  /**
   * Retrieves cache status summary for in-memory and localStorage layers.
   * @returns Object with in-memory cache count and localStorage cache counts.
   * @source
   */
  getCacheStatus(): CacheStatus {
    // Check in-memory cache for entry count
    const inMemoryCacheCount = Object.keys(mangaCache).length;

    // Check localStorage for cached manga and search data
    let localStorageMangaCount = 0;
    let localStorageSearchCount = 0;

    if (globalThis.window !== undefined) {
      try {
        const localStorageMangaCacheData = localStorage.getItem(
          "anilist_manga_cache",
        );
        if (localStorageMangaCacheData) {
          const parsedLocalStorageMangaCache = JSON.parse(
            localStorageMangaCacheData,
          );
          localStorageMangaCount = Object.keys(
            parsedLocalStorageMangaCache,
          ).length;
        }

        const localStorageSearchCacheData = localStorage.getItem(
          "anilist_search_cache",
        );
        if (localStorageSearchCacheData) {
          const parsedLocalStorageSearchCache = JSON.parse(
            localStorageSearchCacheData,
          );
          localStorageSearchCount = Object.keys(
            parsedLocalStorageSearchCache,
          ).length;
        }
      } catch (error) {
        console.error(
          "[MangaSearchService] Error checking localStorage cache:",
          error,
        );
      }
    }

    return {
      inMemoryCache: inMemoryCacheCount,
      localStorage: {
        mangaCache: localStorageMangaCount,
        searchCache: localStorageSearchCount,
      },
    };
  },

  /**
   * Checks if a manga title exists in cache and retrieves its metadata.
   * @param title - Manga title to look up.
   * @returns Object with isFound flag, cache key, and entry metadata if found (count, timestamp, age).
   * @source
   */
  checkMangaInCache(title: string): CheckMangaInCacheResult {
    const cacheKey = generateCacheKey(title);
    const cacheEntry = mangaCache[cacheKey] as MangaCache[string] | undefined;

    if (!cacheEntry) {
      return { isFound: false, cacheKey };
    }

    // Format cache entry age using helper
    const ageLabel = formatCacheAge(cacheEntry.timestamp);

    return {
      isFound: true,
      cacheKey,
      entry: {
        mangaCount: cacheEntry.manga.length,
        timestamp: cacheEntry.timestamp,
        age: ageLabel,
      },
    };
  },

  /**
   * Forces cache synchronization and logs current status.
   * @source
   */
  forceSyncCaches(): void {
    syncWithClientCache();
    console.info("[MangaSearchService] Cache sync forced, current status:");
    console.debug("[MangaSearchService]", this.getCacheStatus());
  },

  /**
   * Clears all in-memory and localStorage caches.
   * @source
   */
  resetAllCaches(): void {
    // Clear in-memory cache
    clearMangaCache();

    // Clear localStorage caches
    if (globalThis.window !== undefined) {
      try {
        localStorage.removeItem("anilist_manga_cache");
        localStorage.removeItem("anilist_search_cache");
        console.info(
          "[MangaSearchService] All AniList caches have been cleared",
        );
      } catch (error) {
        console.error(
          "[MangaSearchService] Error clearing localStorage caches:",
          error,
        );
      }
    }
  },

  /**
   * Clears cache entry for a specific manga title.
   * @param title - Manga title to clear from cache.
   * @returns True if entry was found and cleared; false if not found.
   * @source
   */
  clearMangaCacheEntry(title: string): boolean {
    const cacheKey = generateCacheKey(title);

    if (mangaCache[cacheKey]) {
      delete mangaCache[cacheKey];
      console.info(`[MangaSearchService] Cleared cache entry for "${title}"`);
      return true;
    }

    console.warn(
      `[MangaSearchService] No cache entry found for "${title}" to clear`,
    );
    return false;
  },

  /**
   * Retrieves detailed information about all cached manga entries.
   * @returns Array of objects with cache key, manga count, timestamp, and formatted age.
   * @source
   */
  getAllCacheEntries(): CacheEntrySummary[] {
    const cacheEntries: CacheEntrySummary[] = [];

    for (const [cacheKey, cacheEntry] of Object.entries(mangaCache)) {
      // Format age using helper
      const ageLabel = formatCacheAge(cacheEntry.timestamp);
      cacheEntries.push({
        cacheKey,
        mangaCount: cacheEntry.manga.length,
        timestamp: cacheEntry.timestamp,
        age: ageLabel,
      });
    }

    return cacheEntries;
  },
};
