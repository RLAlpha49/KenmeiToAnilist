/**
 * Inclusion rules for filtering manga by match score.
 * @module filtering/inclusion-rules
 */

import type { AniListManga } from "../../anilist/types";
import { checkExactMatch } from "./exact-match-checker";

/**
 * Decision result for manga inclusion with optional score adjustment.
 * @property include - Whether the manga should be included in results.
 * @property adjustedScore - The match score, potentially adjusted based on match quality.
 * @source
 */
export interface InclusionResult {
  include: boolean;
  adjustedScore: number;
}

/**
 * Determines if a manga should be included in exact match results.
 * Applies stricter thresholds (0.6+) for exact matching mode.
 * @param manga - The manga to evaluate.
 * @param score - The match score (0-1).
 * @param searchTitle - The original search title.
 * @param results - Current results array for context.
 * @returns Inclusion decision with potentially adjusted score.
 * @source
 */
export function shouldIncludeMangaExact(
  manga: AniListManga,
  score: number,
  searchTitle: string,
  results: AniListManga[],
): InclusionResult {
  console.debug(
    `[MangaSearchService] 🔍 Checking titles for exact match against "${searchTitle}"`,
  );

  // In exact matching mode, do a thorough check of all titles
  // This ensures we don't miss matches due to normalization differences
  const foundGoodMatch = checkExactMatch(manga, searchTitle);

  // If this is an exact match run and we have a good score or manually found a good match
  // Increased threshold from 0.5 to 0.6 for stricter inclusion
  if (score > 0.6 || foundGoodMatch || results.length <= 2) {
    console.debug(
      `[MangaSearchService] ✅ Including manga "${manga.title?.romaji || manga.title?.english}" with score: ${score}`,
    );
    return {
      include: true,
      adjustedScore: foundGoodMatch ? Math.max(score, 0.75) : score,
    };
  } else {
    console.debug(
      `[MangaSearchService] ❌ Excluding manga "${manga.title?.romaji || manga.title?.english}" with score: ${score} (below threshold)`,
    );
    return { include: false, adjustedScore: score };
  }
}

/**
 * Determines if a manga should be included in regular (non-exact) match results.
 * Applies lenient threshold (0.15+) for general searches.
 * @param manga - The manga to evaluate.
 * @param score - The match score (0-1).
 * @param results - Current results array for context.
 * @returns Inclusion decision with potentially adjusted score.
 * @source
 */
export function shouldIncludeMangaRegular(
  manga: AniListManga,
  score: number,
  results: AniListManga[],
): InclusionResult {
  if (score > 0.15 || results.length <= 2) {
    console.debug(
      `[MangaSearchService] ✅ Including manga "${manga.title?.romaji || manga.title?.english}" with score: ${score}`,
    );
    return { include: true, adjustedScore: score };
  } else {
    console.debug(
      `[MangaSearchService] ❌ Excluding manga "${manga.title?.romaji || manga.title?.english}" with score: ${score} (below threshold)`,
    );
    return { include: false, adjustedScore: score };
  }
}
