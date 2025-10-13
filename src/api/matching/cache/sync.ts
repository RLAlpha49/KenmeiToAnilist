/**
 * Cache initialization and synchronization with client cache
 * @module cache/sync
 */

import type { AniListManga } from "../../anilist/types";
import { mangaCache } from "./storage";
import { MANGA_CACHE_KEY, SEARCH_CACHE_KEY } from "./types";
import { generateCacheKey } from "./utils";
import { saveCache } from "./persistence";

/**
 * Process and merge manga cache data from localStorage
 * @param cachedMangaData - JSON string containing cached manga data
 * @returns Number of manga entries loaded from cache
 */
function processMangaCache(cachedMangaData: string): number {
  try {
    const parsedCache = JSON.parse(cachedMangaData);
    let loadedCount = 0;

    // Merge with our in-memory cache and filter out Light Novels
    for (const key of Object.keys(parsedCache)) {
      if (
        !mangaCache[key] ||
        parsedCache[key].timestamp > mangaCache[key].timestamp
      ) {
        // Filter out Light Novels from the cached data
        const filteredManga = parsedCache[key].manga.filter(
          (manga: AniListManga) =>
            manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
        );

        mangaCache[key] = {
          manga: filteredManga,
          timestamp: parsedCache[key].timestamp,
        };
        loadedCount++;
      }
    }

    console.debug(
      `[MangaSearchService] Loaded ${Object.keys(parsedCache).length} cached manga from localStorage`,
    );
    return loadedCount;
  } catch (e) {
    console.error("[MangaSearchService] Error parsing cached manga data:", e);
    return 0;
  }
}

/**
 * Process search cache entries and extract manga data
 * @param searchEntry - Search cache entry containing manga data and timestamp
 * @returns Number of manga entries imported from the search cache entry
 */
function processSearchCacheEntry(searchEntry: {
  data?: {
    Page?: {
      media?: AniListManga[];
    };
  };
  timestamp: number;
}): number {
  let importedCount = 0;

  // Only process valid entries
  if (!searchEntry?.data?.Page?.media?.length) {
    return 0;
  }

  const media = searchEntry.data.Page.media;

  // Generate a proper cache key for each manga title
  for (const manga of media) {
    if (!manga.title?.romaji) continue;

    const mangaKey = generateCacheKey(manga.title.romaji);

    // If we don't have this manga in cache, or it's newer, add it
    if (
      !mangaCache[mangaKey] ||
      searchEntry.timestamp > mangaCache[mangaKey].timestamp
    ) {
      mangaCache[mangaKey] = {
        manga: [manga],
        timestamp: searchEntry.timestamp,
      };
      importedCount++;
    }

    // Also try with English title if available
    if (manga.title.english) {
      const engKey = generateCacheKey(manga.title.english);
      if (
        !mangaCache[engKey] ||
        searchEntry.timestamp > mangaCache[engKey].timestamp
      ) {
        mangaCache[engKey] = {
          manga: [manga],
          timestamp: searchEntry.timestamp,
        };
        importedCount++;
      }
    }
  }

  return importedCount;
}

/**
 * Process search cache data from localStorage
 * @param cachedSearchData - JSON string containing cached search data
 */
function processSearchCache(cachedSearchData: string): void {
  try {
    const parsedSearchCache = JSON.parse(cachedSearchData);
    let totalImportedCount = 0;

    // Extract manga from search results and add to manga cache
    for (const key of Object.keys(parsedSearchCache)) {
      const searchEntry = parsedSearchCache[key];
      totalImportedCount += processSearchCacheEntry(searchEntry);
    }

    if (totalImportedCount > 0) {
      console.debug(
        `[MangaSearchService] Imported ${totalImportedCount} manga entries from search cache to manga cache`,
      );
      // Save the updated cache
      saveCache();
    }
  } catch (e) {
    console.error("[MangaSearchService] Error processing search cache:", e);
  }
}

/**
 * Sync the manga-search-service cache with the client search cache
 * This ensures we don't miss cached results from previous searches
 */
export function syncWithClientCache(): void {
  // Check localStorage cache first
  if (globalThis.window === undefined) {
    return;
  }

  try {
    // Process manga cache
    const cachedMangaData = localStorage.getItem(MANGA_CACHE_KEY);
    if (cachedMangaData) {
      processMangaCache(cachedMangaData);
    }

    // Process search cache to extract manga
    const cachedSearchData = localStorage.getItem(SEARCH_CACHE_KEY);
    if (cachedSearchData) {
      processSearchCache(cachedSearchData);
    }
  } catch (e) {
    console.error("[MangaSearchService] Error accessing localStorage:", e);
  }
}
