/**
 * MangaDex fallback search when no AniList results are found.
 *
 * @module sources/mangadex-fallback
 * @packageDocumentation
 */

import type { AniListManga } from "../../anilist/types";
import { MangaSource, mangaSourceRegistry } from "../../manga-sources";
import type { SearchServiceConfig } from "../orchestration/types";
import { getMatchConfig } from "../../../utils/storage";
import {
  processMangaDexResults,
  applyMangaDexFiltering,
} from "./mangadex-processing";
import type { MangaDexSourceMap } from "./types";

/**
 * Execute MangaDex fallback search when no AniList results found
 * @param title - Manga title to search for
 * @param token - Optional authentication token
 * @param finalResults - Current results (fallback if search fails)
 * @param searchConfig - Search configuration
 * @returns Results and MangaDex source map
 */
export async function executeMangaDexFallback(
  title: string,
  token: string | undefined,
  finalResults: AniListManga[],
  searchConfig: SearchServiceConfig,
): Promise<{
  results: AniListManga[];
  mangaDexSourceMap: MangaDexSourceMap;
}> {
  const mangaDexSourceMap: MangaDexSourceMap = new Map();

  const matchConfig = getMatchConfig();

  // Early return if conditions not met for MangaDex search
  if (!token) {
    return { results: finalResults, mangaDexSourceMap };
  }

  if (!matchConfig.enableMangaDexSearch) {
    return { results: finalResults, mangaDexSourceMap };
  }

  console.info(
    `[MangaSearchService] 🎯 No AniList results found for "${title}", trying MangaDex fallback...`,
  );

  try {
    const mangaDexLimit = 1;

    console.debug(
      `[MangaSearchService] 🔍 Searching MangaDex with limit ${mangaDexLimit} for "${title}"`,
    );

    const mangaDexResults = await mangaSourceRegistry.searchAndGetAniListManga(
      MangaSource.MANGADEX,
      title,
      token,
      mangaDexLimit,
    );

    if (mangaDexResults.length === 0) {
      console.debug(
        `[MangaSearchService] 📦 No MangaDex results found for "${title}"`,
      );
      return { results: finalResults, mangaDexSourceMap };
    }

    console.info(
      `[MangaSearchService] ✅ MangaDex found ${mangaDexResults.length} results for "${title}"`,
    );

    // Process the MangaDex results
    let processedResults = processMangaDexResults(
      mangaDexResults,
      title,
      mangaDexSourceMap,
    );

    console.debug(
      `[MangaSearchService] 🎯 Using ${processedResults.length} MangaDex results as fallback for "${title}"`,
    );

    // Apply filtering to MangaDex results
    processedResults = applyMangaDexFiltering(
      processedResults,
      title,
      searchConfig,
    );

    return { results: processedResults, mangaDexSourceMap };
  } catch (error) {
    console.error(
      `[MangaSearchService] ❌ MangaDex fallback failed for "${title}":`,
      error,
    );
    return { results: finalResults, mangaDexSourceMap };
  }
}
