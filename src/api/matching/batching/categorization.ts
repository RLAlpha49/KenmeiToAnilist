/**
 * @file Batch categorization - Separates manga into cached, known IDs, and uncached
 * @module matching/batching/categorization
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { BatchCategorizationResult, SearchServiceConfig } from "./types";
import { generateCacheKey, isCacheValid, mangaCache } from "../cache";

/**
 * Categorizes manga list into cached, known IDs, and uncached entries
 *
 * Separates manga into three categories:
 * - Cached: Results already in cache (immediate)
 * - Known IDs: Manga with anilistId (batch fetch)
 * - Uncached: Needs title search (sequential)
 *
 * @param mangaList - List of Kenmei manga to categorize
 * @param searchConfig - Search configuration (bypassCache flag)
 * @param updateProgress - Callback to update progress for cached entries
 * @returns Categorized manga with cached results and source maps
 */
export function categorizeMangaForBatching(
  mangaList: KenmeiManga[],
  searchConfig: SearchServiceConfig,
  updateProgress: (index: number, title?: string) => void,
): BatchCategorizationResult {
  const cachedResults: Record<number, AniListManga[]> = {};
  const cachedComickSources: BatchCategorizationResult["cachedComickSources"] =
    {};
  const cachedMangaDexSources: BatchCategorizationResult["cachedMangaDexSources"] =
    {};
  const uncachedManga: { index: number; manga: KenmeiManga }[] = [];
  const knownMangaIds: { index: number; id: number }[] = [];

  // If we're bypassing cache, treat all manga as uncached
  if (searchConfig.bypassCache) {
    console.info(
      `[MangaSearchService] 🚨 FRESH SEARCH: Bypassing cache for all ${mangaList.length} manga titles`,
    );

    // Put all manga in the uncached list
    for (const [index, manga] of mangaList.entries()) {
      uncachedManga.push({ index, manga });
    }
  } else {
    console.debug(
      `[MangaSearchService] Checking cache for ${mangaList.length} manga titles...`,
    );

    // Check cache for all manga first
    for (const [index, manga] of mangaList.entries()) {
      const cacheKey = generateCacheKey(manga.title);

      // If manga has a known AniList ID, we can batch fetch it
      if (manga.anilistId && Number.isInteger(manga.anilistId)) {
        knownMangaIds.push({ index, id: manga.anilistId });
      }
      // Otherwise check the cache
      else if (isCacheValid(cacheKey)) {
        // This manga is in cache
        cachedResults[index] = mangaCache[cacheKey].manga;
        cachedComickSources[index] = new Map(); // Cached results from direct AniList cache don't have Comick source info
        cachedMangaDexSources[index] = new Map();
        console.debug(
          `[MangaSearchService] Found cached results for: ${manga.title}`,
        );

        // Immediately update progress for cached manga
        updateProgress(index, manga.title);
      } else {
        // This manga needs to be fetched by search
        uncachedManga.push({ index, manga });
      }
    }

    console.info(
      `[MangaSearchService] Found ${Object.keys(cachedResults).length} cached manga, ${knownMangaIds.length} have known IDs, ${uncachedManga.length} require searching`,
    );
  }

  return {
    cachedResults,
    cachedComickSources,
    cachedMangaDexSources,
    uncachedManga,
    knownMangaIds,
  };
}
