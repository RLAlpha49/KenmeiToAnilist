/**
 * @file Manga result ranking and filtering
 * @module matching/orchestration/ranking
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import { calculateMatchScore } from "../scoring";
import {
  shouldIncludeMangaExact,
  shouldIncludeMangaRegular,
} from "../filtering/inclusion-rules";
import { shouldSkipManga as shouldSkipMangaByRules } from "../filtering/skip-rules";

/**
 * Core ranking logic applied with custom inclusion predicate.
 *
 * Scores results, filters by inclusion predicate, and sorts by confidence.
 * Always includes at least one result even with low score.
 *
 * @param results - Manga results to rank
 * @param searchTitle - Original search title
 * @param isManualSearch - Whether this is a manual search operation
 * @param includeMangaFn - Predicate function determining inclusion
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation
 * @returns Ranked manga results
 *
 * @example
 * ```typescript
 * const ranked = rankMangaCore(results, "Naruto", false, includeFn, kenmeiManga);
 * console.log(`Ranked ${ranked.length} results`);
 * ```
 *
 * @source
 */
function rankMangaCore(
  results: AniListManga[],
  searchTitle: string,
  isManualSearch: boolean,
  includeMangaFn: (
    manga: AniListManga,
    score: number,
  ) => { include: boolean; adjustedScore: number },
  kenmeiManga?: KenmeiManga,
): AniListManga[] {
  const scoredResults: Array<{ manga: AniListManga; score: number }> = [];

  // Score each manga result
  for (const manga of results) {
    // Check if manga should be skipped
    if (shouldSkipMangaByRules(manga, isManualSearch, kenmeiManga)) {
      continue;
    }

    const score = calculateMatchScore(manga, searchTitle);

    // Evaluate if manga should be included using the provided function
    const { include, adjustedScore } = includeMangaFn(manga, score);

    if (include) {
      scoredResults.push({ manga, score: adjustedScore });
    }
  }

  // Sort by score (descending)
  scoredResults.sort((a, b) => b.score - a.score);

  // Always include at least one result if available, even with low score
  if (scoredResults.length === 0 && results.length > 0) {
    console.debug(
      `[MangaSearchService] 🔄 No results matched score threshold but including top result anyway`,
    );
    const bestGuess = results[0];
    scoredResults.push({
      manga: bestGuess,
      score: 0.1, // Very low confidence
    });
  }

  console.debug(
    `[MangaSearchService] 🏆 Ranked results: ${scoredResults.length} manga after filtering and ranking`,
  );

  // Return just the manga objects, preserving the new order
  return scoredResults.map((item) => item.manga);
}

/**
 * Filter and rank manga results by match quality.
 *
 * Applies custom inclusion rules and sorts by confidence score.
 *
 * @param results - Manga results to rank
 * @param searchTitle - Original search title
 * @param exactMatchingOnly - Use exact matching mode
 * @param isManualSearch - Whether this is a manual search operation
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation
 * @returns Ranked manga results
 *
 * @example
 * ```typescript
 * const ranked = rankMangaResults(results, "Naruto", true, false, kenmeiManga);
 * console.log(`Ranked ${ranked.length} results`);
 * ```
 *
 * @source
 */
export function rankMangaResults(
  results: AniListManga[],
  searchTitle: string,
  exactMatchingOnly: boolean,
  isManualSearch: boolean = false,
  kenmeiManga?: KenmeiManga,
): AniListManga[] {
  const includeMangaFn = exactMatchingOnly
    ? (manga: AniListManga, score: number) =>
        shouldIncludeMangaExact(manga, score, searchTitle, results, kenmeiManga)
    : (manga: AniListManga, score: number) =>
        shouldIncludeMangaRegular(manga, score, results, kenmeiManga);

  return rankMangaCore(
    results,
    searchTitle,
    isManualSearch,
    includeMangaFn,
    kenmeiManga,
  );
}
