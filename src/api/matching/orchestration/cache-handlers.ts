/**
 * @file Cache handling operations for search orchestration
 * @module matching/orchestration/cache-handlers
 */

import type { AniListManga } from "@/api/anilist/types";
import type { MangaSearchResponse, SearchServiceConfig } from "./types";
import {
  generateCacheKey,
  isCacheValid,
  mangaCache,
  saveCache,
} from "../cache";
import { isOneShot } from "../normalization";
import { calculateConfidence, calculateTitleTypePriority } from "../scoring";
import { getMatchConfig } from "@/utils/storage";

/**
 * Handle cache bypass by clearing existing cache entry
 *
 * When bypassCache is enabled, this function removes the cache entry
 * to ensure a fresh search is performed.
 *
 * @param title - Manga title to clear from cache
 * @param cacheKey - Cache key for the title
 */
export function handleCacheBypass(title: string, cacheKey: string): void {
  console.debug(
    `[MangaSearchService] 🔥 Fresh search: Explicitly clearing cache for "${title}"`,
  );

  if (mangaCache[cacheKey]) {
    delete mangaCache[cacheKey];
    console.debug(
      `[MangaSearchService] 🧹 Removed existing cache entry for "${title}"`,
    );
    saveCache();
  } else {
    console.debug(
      `[MangaSearchService] 🔍 No existing cache entry found for "${title}" to clear`,
    );
  }
}

/**
 * Process cached manga results with filtering and scoring
 *
 * Retrieves cached results, applies filtering based on match configuration,
 * recalculates confidence scores, and returns formatted response.
 *
 * @param title - The manga title to process cached results for
 * @param cacheKey - The cache key to retrieve results from
 * @returns Manga search response with cached results or null if no valid cache
 */
export function processCachedResults(
  title: string,
  cacheKey: string,
): MangaSearchResponse | null {
  if (!isCacheValid(cacheKey)) return null;

  console.debug(`[MangaSearchService] Using cache for ${title}`);
  let filteredManga = mangaCache[cacheKey].manga.filter(
    (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
  );

  const matchConfig = getMatchConfig();

  // Filter one-shots if enabled
  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredManga.length;
    filteredManga = filteredManga.filter((manga) => !isOneShot(manga));
    const afterFilter = filteredManga.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) from cached results for "${title}"`,
      );
    }
  }

  // Filter adult content if enabled
  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredManga.length;
    filteredManga = filteredManga.filter((manga) => !manga.isAdult);
    const afterFilter = filteredManga.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} adult content manga from cached results for "${title}"`,
      );
    }
  }

  console.debug(
    `[MangaSearchService] ⚖️ Calculating fresh confidence scores for ${filteredManga.length} cached matches`,
  );

  const matches = filteredManga.map((manga) => {
    const confidence = calculateConfidence(title, manga);
    const titleTypePriority = calculateTitleTypePriority(manga, title);

    console.debug(
      `[MangaSearchService] ⚖️ Cached match confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (priority: ${titleTypePriority})`,
    );

    return { manga, confidence, titleTypePriority };
  });

  // Sort by confidence and priority
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  const finalMatches = matches.map(({ manga, confidence }) => ({
    manga,
    confidence,
    comickSource: undefined,
  }));

  return {
    matches: finalMatches,
    pageInfo: undefined,
  };
}

/**
 * Save search results to cache
 *
 * Stores ranked manga results in the cache for future searches.
 * Skips caching if bypassCache is enabled in config.
 *
 * @param title - Manga title to cache results for
 * @param results - Ranked manga results to cache
 * @param searchConfig - Search configuration
 */
export function cacheSearchResults(
  title: string,
  results: AniListManga[],
  searchConfig: SearchServiceConfig,
): void {
  if (searchConfig.bypassCache) {
    console.debug(
      `[MangaSearchService] 🔍 MANUAL SEARCH: Skipping cache save for "${title}"`,
    );
    return;
  }

  const cacheKey = generateCacheKey(title);
  mangaCache[cacheKey] = {
    manga: results,
    timestamp: Date.now(),
  };
  saveCache();
}
