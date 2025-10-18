/**
 * Comick fallback search when no AniList results are found.
 *
 * @module sources/comick-fallback
 * @packageDocumentation
 */

import type { AniListManga } from "../../anilist/types";
import { MangaSource, mangaSourceRegistry } from "../../manga-sources";
import type { SearchServiceConfig } from "../orchestration/types";
import { getMatchConfig } from "../../../utils/storage";
import {
  processComickResults,
  applyComickFiltering,
} from "./comick-processing";
import type { ComickSourceMap } from "./types";

/**
 * Execute Comick fallback search when no AniList results found.
 * @param title - Manga title to search for.
 * @param token - Optional authentication token.
 * @param finalResults - Current results (fallback if search fails).
 * @param searchConfig - Search configuration.
 * @returns Results and Comick source map.
 * @source
 */
export async function executeComickFallback(
  title: string,
  token: string | undefined,
  finalResults: AniListManga[],
  searchConfig: SearchServiceConfig,
): Promise<{
  results: AniListManga[];
  comickSourceMap: ComickSourceMap;
}> {
  const comickSourceMap: ComickSourceMap = new Map();

  const matchConfig = getMatchConfig();

  // Early return if conditions not met for Comick search
  if (!token) {
    return { results: finalResults, comickSourceMap };
  }

  if (!matchConfig.enableComickSearch) {
    return { results: finalResults, comickSourceMap };
  }

  console.info(
    `[MangaSearchService] 🎯 No AniList results found for "${title}", trying Comick fallback...`,
  );

  try {
    const comickLimit = 1;

    console.debug(
      `[MangaSearchService] 🔍 Searching Comick with limit ${comickLimit} for "${title}"`,
    );

    const comickResults = await mangaSourceRegistry.searchAndGetAniListManga(
      MangaSource.COMICK,
      title,
      token,
      comickLimit,
    );

    if (comickResults.length === 0) {
      console.debug(
        `[MangaSearchService] 📦 No Comick results found for "${title}"`,
      );
      return { results: finalResults, comickSourceMap };
    }

    console.info(
      `[MangaSearchService] ✅ Comick found ${comickResults.length} results for "${title}"`,
    );

    // Process the Comick results
    let processedResults = processComickResults(
      comickResults,
      title,
      comickSourceMap,
    );

    console.debug(
      `[MangaSearchService] 🎯 Using ${processedResults.length} Comick results as fallback for "${title}"`,
    );

    // Apply filtering to Comick results
    processedResults = applyComickFiltering(
      processedResults,
      title,
      searchConfig,
    );

    return { results: processedResults, comickSourceMap };
  } catch (error) {
    console.error(
      `[MangaSearchService] ❌ Comick fallback failed for "${title}":`,
      error,
    );
    return { results: finalResults, comickSourceMap };
  }
}
