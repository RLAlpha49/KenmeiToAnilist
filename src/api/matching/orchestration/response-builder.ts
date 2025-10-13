/**
 * @file Build final search response with confidence scores and source info
 * @module matching/orchestration/response-builder
 */

import type { AniListManga, PageInfo } from "@/api/anilist/types";
import type { MangaSearchResponse } from "./types";
import { calculateConfidence, calculateTitleTypePriority } from "../scoring";
import { getSourceInfo } from "../sources";

/**
 * Build final search response with confidence scores and source information
 *
 * Takes filtered results, calculates confidence scores and title priorities,
 * sorts by these metrics, and includes source information from Comick/MangaDex
 * if available.
 *
 * @param finalResults - Filtered manga results
 * @param title - Original search title
 * @param comickSourceMap - Map of Comick source information by manga ID
 * @param mangaDexSourceMap - Map of MangaDex source information by manga ID
 * @param lastPageInfo - Optional pagination info from last search page
 * @returns Complete manga search response
 */
export function buildFinalResponse(
  finalResults: AniListManga[],
  title: string,
  comickSourceMap: Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >,
  lastPageInfo?: PageInfo,
): MangaSearchResponse {
  console.debug(
    `[MangaSearchService] 🔍 Final result count: ${finalResults.length} manga`,
  );

  console.debug(
    `[MangaSearchService] ⚖️ Calculating fresh confidence scores for ${finalResults.length} matches`,
  );

  const matches = finalResults.map((manga) => {
    const confidence = calculateConfidence(
      typeof title === "string" ? title : "",
      manga,
    );

    const titleTypePriority = calculateTitleTypePriority(
      manga,
      typeof title === "string" ? title : "",
    );

    console.debug(
      `[MangaSearchService] ⚖️ Confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (priority: ${titleTypePriority})`,
    );

    return {
      manga,
      confidence,
      titleTypePriority,
      comickSource: comickSourceMap.has(manga.id)
        ? comickSourceMap.get(manga.id)
        : undefined,
      mangaDexSource: mangaDexSourceMap.has(manga.id)
        ? mangaDexSourceMap.get(manga.id)
        : undefined,
      sourceInfo: getSourceInfo(manga.id, comickSourceMap, mangaDexSourceMap),
    };
  });

  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  const finalMatches = matches.map(
    ({ manga, confidence, comickSource, mangaDexSource, sourceInfo }) => ({
      manga,
      confidence,
      comickSource,
      mangaDexSource,
      sourceInfo,
    }),
  );

  return {
    matches: finalMatches,
    pageInfo: lastPageInfo,
  };
}
