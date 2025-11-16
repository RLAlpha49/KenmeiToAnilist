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
 * Processes and merges manga cache from localStorage into the in-memory cache.
 * Filters out light novels and prefers newer cache entries.
 * @param cachedMangaData - JSON string of cached manga data.
 * @returns Number of manga cache entries successfully loaded.
 * @source
 */
function processMangaCache(cachedMangaData: string): number {
  try {
    const parsedCache = JSON.parse(cachedMangaData);
    let loadedCount = 0;

    // Merge with in-memory cache, preferring newer entries and filtering light novels
    for (const key of Object.keys(parsedCache)) {
      if (
        !mangaCache[key] ||
        parsedCache[key].timestamp > mangaCache[key].timestamp
      ) {
        // Filter out Light Novels and other non-manga formats
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
 * Processes search cache entries and extracts manga into the manga cache.
 * Generates cache keys for each manga title (romaji and English).
 * @param searchEntry - Search cache entry with manga data and timestamp.
 * @returns Number of manga entries imported.
 * @source
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

  // Only process valid entries with media data
  if (!searchEntry?.data?.Page?.media?.length) {
    return 0;
  }

  const media = searchEntry.data.Page.media;

  // Cache each manga by its title(s) with generated cache keys
  for (const manga of media) {
    if (!manga.title?.romaji) continue;

    const mangaKey = generateCacheKey(manga.title.romaji);

    // Add or update manga cache entry, preferring newer timestamps
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

    // Also cache by English title if available for broader search coverage
    if (manga.title.english) {
      const englishKey = generateCacheKey(manga.title.english);
      if (
        !mangaCache[englishKey] ||
        searchEntry.timestamp > mangaCache[englishKey].timestamp
      ) {
        mangaCache[englishKey] = {
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
 * Processes search cache data from localStorage and imports manga into the manga cache.
 * Extracts manga from all search cache entries and merges into unified cache.
 * @param cachedSearchData - JSON string of cached search data.
 * @source
 */
function processSearchCache(cachedSearchData: string): void {
  try {
    const parsedSearchCache = JSON.parse(cachedSearchData);
    let totalImportedCount = 0;

    // Extract manga from all search results and add to manga cache
    for (const key of Object.keys(parsedSearchCache)) {
      const searchEntry = parsedSearchCache[key];
      totalImportedCount += processSearchCacheEntry(searchEntry);
    }

    if (totalImportedCount > 0) {
      console.debug(
        `[MangaSearchService] Imported ${totalImportedCount} manga entries from search cache to manga cache`,
      );
      // Save the updated combined cache
      saveCache();
    }
  } catch (e) {
    console.error("[MangaSearchService] Error processing search cache:", e);
  }
}

/**
 * Synchronizes the in-memory manga cache with client-side localStorage caches.
 * Merges manga cache and extracts manga from search cache into unified in-memory cache.
 * Safe to call in non-browser environments.
 * @source
 */
export function syncWithClientCache(): void {
  // Exit early if not in browser environment
  if (globalThis.window === undefined) {
    return;
  }

  try {
    // Process manga cache from localStorage
    const cachedMangaData = localStorage.getItem(MANGA_CACHE_KEY);
    if (cachedMangaData) {
      processMangaCache(cachedMangaData);
    }

    // Process search cache to extract manga data
    const cachedSearchData = localStorage.getItem(SEARCH_CACHE_KEY);
    if (cachedSearchData) {
      processSearchCache(cachedSearchData);
    }
  } catch (e) {
    console.error("[MangaSearchService] Error accessing localStorage:", e);
  }
}
