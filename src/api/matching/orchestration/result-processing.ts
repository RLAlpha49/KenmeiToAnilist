/**
 * @file Search result processing and filtering
 * @module matching/orchestration/result-processing
 */

import type { AniListManga } from "@/api/anilist/types";
import type { SearchServiceConfig } from "./types";
import { isOneShot } from "../normalization";
import { generateCacheKey, mangaCache, saveCache } from "../cache";
import { getMatchConfig } from "@/utils/storage";
import { rankMangaResults } from "./ranking";

/**
 * Process and rank search results, optionally caching them
 *
 * Takes raw search results, ranks them by relevance, and optionally
 * saves to cache for future searches.
 *
 * @param results - Raw search results from API
 * @param title - Original search title
 * @param searchConfig - Search configuration
 * @returns Ranked manga results
 */
export function processSearchResults(
  results: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  console.debug(
    `[MangaSearchService] 🔍 Found ${results.length} raw results for "${title}" before filtering/ranking`,
  );

  let exactMatchMode = searchConfig.exactMatchingOnly;

  if ((searchConfig.bypassCache && results.length > 0) || results.length <= 3) {
    exactMatchMode = false;
  }

  const rankedResults = rankMangaResults(
    results,
    title,
    exactMatchMode,
    searchConfig.bypassCache,
  );

  console.info(
    `[MangaSearchService] 🔍 Search complete for "${title}": Found ${results.length} results, ranked to ${rankedResults.length} relevant matches`,
  );

  // Cache results if not bypassing cache
  if (searchConfig.bypassCache) {
    console.debug(
      `[MangaSearchService] 🔍 MANUAL SEARCH: Skipping cache save for "${title}"`,
    );
  } else {
    const cacheKey = generateCacheKey(title);
    mangaCache[cacheKey] = {
      manga: rankedResults,
      timestamp: Date.now(),
    };
    saveCache();
  }

  return rankedResults;
}

/**
 * Apply content filtering based on match configuration
 *
 * Filters out novels, one-shots (if configured), and adult content (if configured).
 * Filtering only applies when not bypassing cache (automatic matching mode).
 *
 * @param results - Manga results to filter
 * @param title - Original search title (for logging)
 * @param searchConfig - Search configuration
 * @returns Filtered manga results
 */
export function applyContentFiltering(
  results: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  let filteredResults = results.filter(
    (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
  );

  if (!searchConfig.bypassCache) {
    const matchConfig = getMatchConfig();

    if (matchConfig.ignoreOneShots) {
      const beforeFilter = filteredResults.length;
      filteredResults = filteredResults.filter((manga) => !isOneShot(manga));
      const afterFilter = filteredResults.length;

      if (beforeFilter > afterFilter) {
        console.debug(
          `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) during automatic matching for "${title}"`,
        );
      }
    }

    if (matchConfig.ignoreAdultContent) {
      const beforeFilter = filteredResults.length;
      filteredResults = filteredResults.filter((manga) => !manga.isAdult);
      const afterFilter = filteredResults.length;

      if (beforeFilter > afterFilter) {
        console.debug(
          `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} adult content manga during automatic matching for "${title}"`,
        );
      }
    }
  }

  return filteredResults;
}

/**
 * Handle fallback when no results are found after filtering
 *
 * If filtering removed all results but original results exist,
 * returns a subset of original results as a fallback. This prevents
 * complete failure when filters are too aggressive.
 *
 * @param filteredResults - Results after filtering
 * @param originalResults - Original unfiltered results
 * @param searchConfig - Search configuration
 * @returns Final results (filtered or fallback)
 */
export function handleNoResultsFallback(
  filteredResults: AniListManga[],
  originalResults: AniListManga[],
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  if (filteredResults.length === 0 && originalResults.length > 0) {
    console.warn(
      `[MangaSearchService] ⚠️ No matches passed filtering, but including raw API results anyway`,
    );

    const fallbackResults = originalResults
      .slice(0, 3)
      .filter(
        (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
      );

    console.debug(
      `[MangaSearchService] 🔍 Including these API results:`,
      fallbackResults.map((m) => ({
        id: m.id,
        romaji: m.title?.romaji,
        english: m.title?.english,
      })),
    );

    return fallbackResults;
  }

  if (
    searchConfig.bypassCache &&
    filteredResults.length === 0 &&
    originalResults.length > 0
  ) {
    console.warn(
      `[MangaSearchService] ⚠️ MANUAL SEARCH with no ranked results - forcing inclusion of API results`,
    );
    return originalResults.filter(
      (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
    );
  }

  return filteredResults;
}
