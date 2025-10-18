/**
 * Cache debugging utilities
 * @module cache/debugger
 */

import { mangaCache } from "./storage";
import { generateCacheKey, clearMangaCache } from "./utils";
import { syncWithClientCache } from "./sync";

/**
 * Debugging utilities for cache inspection and management.
 * Provides methods to check cache status, inspect entries, reset caches, and force synchronization.
 * @source
 */
export const cacheDebugger = {
  /**
   * Retrieves a summary of cache status across in-memory and localStorage layers.
   * @returns Summary of cache counts in memory and localStorage.
   * @source
   */
  getCacheStatus(): {
    inMemoryCache: number;
    localStorage: {
      mangaCache: number;
      searchCache: number;
    };
  } {
    // Check in-memory cache for entry count
    const inMemoryCount = Object.keys(mangaCache).length;

    // Check localStorage for cached manga and search data
    let storedMangaCount = 0;
    let storedSearchCount = 0;

    if (globalThis.window !== undefined) {
      try {
        const mangaCacheData = localStorage.getItem("anilist_manga_cache");
        if (mangaCacheData) {
          const parsed = JSON.parse(mangaCacheData);
          storedMangaCount = Object.keys(parsed).length;
        }

        const searchCacheData = localStorage.getItem("anilist_search_cache");
        if (searchCacheData) {
          const parsed = JSON.parse(searchCacheData);
          storedSearchCount = Object.keys(parsed).length;
        }
      } catch (e) {
        console.error(
          "[MangaSearchService] Error checking localStorage cache:",
          e,
        );
      }
    }

    return {
      inMemoryCache: inMemoryCount,
      localStorage: {
        mangaCache: storedMangaCount,
        searchCache: storedSearchCount,
      },
    };
  },

  /**
   * Checks if a manga title is cached and retrieves cache metadata.
   * @param title - Manga title to look up in cache.
   * @returns Cache lookup result with key, presence flag, and entry metadata (manga count, timestamp, age).
   * @source
   */
  checkMangaInCache(title: string): {
    found: boolean;
    cacheKey: string;
    entry?: {
      mangaCount: number;
      timestamp: number;
      age: string;
    };
  } {
    const cacheKey = generateCacheKey(title);
    const entry = mangaCache[cacheKey];

    if (!entry) {
      return { found: false, cacheKey };
    }

    // Calculate cache entry age in human-readable format
    const ageMs = Date.now() - entry.timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);

    let age: string;
    if (ageMinutes < 60) {
      age = `${ageMinutes} minute(s)`;
    } else if (ageMinutes < 1440) {
      age = `${Math.floor(ageMinutes / 60)} hour(s)`;
    } else {
      age = `${Math.floor(ageMinutes / 1440)} day(s)`;
    }

    return {
      found: true,
      cacheKey,
      entry: {
        mangaCount: entry.manga.length,
        timestamp: entry.timestamp,
        age,
      },
    };
  },

  /**
   * Forces cache synchronization and logs current cache status.
   * @returns void
   * @source
   */
  forceSyncCaches(): void {
    syncWithClientCache();
    console.info("[MangaSearchService] Cache sync forced, current status:");
    console.debug("[MangaSearchService]", this.getCacheStatus());
  },

  /**
   * Clears all in-memory and localStorage caches.
   * @returns void
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
      } catch (e) {
        console.error(
          "[MangaSearchService] Error clearing localStorage caches:",
          e,
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
   * @returns Array of cache entries with key, manga count, timestamp, and age.
   * @source
   */
  getAllCacheEntries(): Array<{
    cacheKey: string;
    mangaCount: number;
    timestamp: number;
    age: string;
  }> {
    const entries = [];

    for (const [cacheKey, entry] of Object.entries(mangaCache)) {
      // Format age from milliseconds to human-readable string
      const ageMs = Date.now() - entry.timestamp;
      const ageMinutes = Math.floor(ageMs / 60000);

      let age: string;
      if (ageMinutes < 60) {
        age = `${ageMinutes} minute(s)`;
      } else if (ageMinutes < 1440) {
        age = `${Math.floor(ageMinutes / 60)} hour(s)`;
      } else {
        age = `${Math.floor(ageMinutes / 1440)} day(s)`;
      }

      entries.push({
        cacheKey,
        mangaCount: entry.manga.length,
        timestamp: entry.timestamp,
        age,
      });
    }

    return entries;
  },
};
