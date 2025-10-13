/**
 * Cache debugging utilities
 * @module cache/debugger
 */

import { mangaCache } from "./storage";
import { generateCacheKey, clearMangaCache } from "./utils";
import { syncWithClientCache } from "./sync";

/**
 * Cache debugger utility object for inspecting and managing cache state
 */
export const cacheDebugger = {
  /**
   * Get a summary of the current cache status
   */
  getCacheStatus(): {
    inMemoryCache: number;
    localStorage: {
      mangaCache: number;
      searchCache: number;
    };
  } {
    // Check in-memory cache
    const inMemoryCount = Object.keys(mangaCache).length;

    // Check localStorage
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
   * Check if a specific manga title is in cache
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

    // Calculate age
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
   * Force a sync of the caches
   */
  forceSyncCaches(): void {
    syncWithClientCache();
    console.info("[MangaSearchService] Cache sync forced, current status:");
    console.debug("[MangaSearchService]", this.getCacheStatus());
  },

  /**
   * Reset all caches (both in-memory and localStorage)
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
   * Clear cache entry for a specific manga title
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
   * Get detailed information about all cache entries
   */
  getAllCacheEntries(): Array<{
    cacheKey: string;
    mangaCount: number;
    timestamp: number;
    age: string;
  }> {
    const entries = [];

    for (const [cacheKey, entry] of Object.entries(mangaCache)) {
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
