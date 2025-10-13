/**
 * Comick source integration - result processing and filtering.
 *
 * @module sources/comick-processing
 * @packageDocumentation
 */

import type { AniListManga } from "../../anilist/types";
import type { EnhancedAniListManga } from "../../manga-sources/types";
import { convertEnhancedMangaToAniList } from "./conversion";
import type { ComickSourceMap } from "./types";
import type { SearchServiceConfig } from "../orchestration/types";
import { getMatchConfig } from "../../../utils/storage";
import { calculateConfidence, calculateTitleTypePriority } from "../scoring";
import { isOneShot } from "../normalization";

/**
 * Process Comick search results and return sorted manga with confidence scores
 * @param comickResults - Enhanced manga results from Comick API
 * @param title - Original search title
 * @param comickSourceMap - Map to populate with Comick source information
 * @returns Sorted array of AniListManga results
 */
export function processComickResults(
  comickResults: EnhancedAniListManga[],
  title: string,
  comickSourceMap: ComickSourceMap,
): AniListManga[] {
  const processedResults = comickResults.map((enhancedManga) => {
    if (enhancedManga.sourceInfo) {
      comickSourceMap.set(enhancedManga.id, {
        title: enhancedManga.sourceInfo.title,
        slug: enhancedManga.sourceInfo.slug,
        comickId: enhancedManga.sourceInfo.sourceId,
        foundViaComick: enhancedManga.sourceInfo.foundViaAlternativeSearch,
      });
    }

    const manga = convertEnhancedMangaToAniList(enhancedManga);
    const confidence = calculateConfidence(title, manga);
    const titleTypePriority = calculateTitleTypePriority(manga, title);

    console.debug(
      `[MangaSearchService] ⚖️ Comick result confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (found via Comick: ${enhancedManga.sourceInfo?.title || "unknown"})`,
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
 * Apply content filtering to Comick results based on match configuration
 * @param comickResults - Manga results from Comick
 * @param title - Original search title
 * @param searchConfig - Search configuration
 * @returns Filtered manga array
 */
export function applyComickFiltering(
  comickResults: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  if (searchConfig.bypassCache) {
    return comickResults;
  }

  const matchConfig = getMatchConfig();
  let filteredResults = comickResults;

  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !isOneShot(manga));
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) from Comick results for "${title}"`,
      );
    }
  }

  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !manga.isAdult);
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} adult content from Comick results for "${title}"`,
      );
    }
  }

  return filteredResults;
}
