/**
 * MangaDex source integration - result processing and filtering.
 *
 * @module sources/mangadex-processing
 * @packageDocumentation
 */

import type { AniListManga } from "../../anilist/types";
import type { EnhancedAniListManga } from "../../manga-sources/types";
import { convertEnhancedMangaToAniList } from "./conversion";
import type { MangaDexSourceMap } from "./types";
import type { SearchServiceConfig } from "../orchestration/types";
import { getMatchConfig } from "../../../utils/storage";
import { calculateConfidence, calculateTitleTypePriority } from "../scoring";
import { isOneShot } from "../normalization";

/**
 * Process MangaDex search results, score by confidence, and sort by relevance.
 * @param mangaDexResults - Enhanced manga results from MangaDex API.
 * @param title - Original search title.
 * @param mangaDexSourceMap - Map to populate with MangaDex source information.
 * @returns Sorted array of AniListManga results.
 * @source
 */
export function processMangaDexResults(
  mangaDexResults: EnhancedAniListManga[],
  title: string,
  mangaDexSourceMap: MangaDexSourceMap,
): AniListManga[] {
  const processedResults = mangaDexResults.map((enhancedManga) => {
    if (enhancedManga.sourceInfo) {
      mangaDexSourceMap.set(enhancedManga.id, {
        title: enhancedManga.sourceInfo.title,
        slug: enhancedManga.sourceInfo.slug,
        mangaDexId: enhancedManga.sourceInfo.sourceId,
        foundViaMangaDex: enhancedManga.sourceInfo.foundViaAlternativeSearch,
      });
    }

    const manga = convertEnhancedMangaToAniList(enhancedManga);
    const confidence = calculateConfidence(title, manga);
    const titleTypePriority = calculateTitleTypePriority(manga, title);

    console.debug(
      `[MangaSearchService] ⚖️ MangaDex result confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (found via MangaDex: ${enhancedManga.sourceInfo?.title || "unknown"})`,
    );

    return { manga, confidence, titleTypePriority };
  });

  // Sort by confidence and priority
  processedResults.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  return processedResults.map((match) => match.manga);
}

/**
 * Apply content filtering to MangaDex results based on match configuration.
 * @param mangaDexResults - Manga results from MangaDex.
 * @param title - Original search title.
 * @param searchConfig - Search configuration.
 * @returns Filtered manga array.
 * @source
 */
export function applyMangaDexFiltering(
  mangaDexResults: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  if (searchConfig.bypassCache) {
    return mangaDexResults;
  }

  const matchConfig = getMatchConfig();
  let filteredResults = mangaDexResults;

  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !isOneShot(manga));
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) from MangaDex results for "${title}"`,
      );
    }
  }

  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !manga.isAdult);
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} adult content from MangaDex results for "${title}"`,
      );
    }
  }

  return filteredResults;
}
