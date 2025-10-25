/**
 * Inclusion rules for filtering manga by match score.
 * @module filtering/inclusion-rules
 */

import type { AniListManga } from "../../anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import { checkExactMatch } from "./exact-match-checker";
import {
  shouldAcceptByCustomRules,
  ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT,
  ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR,
} from "./custom-rules";

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
 *
 * Applies stricter thresholds (0.6+) for exact matching mode.
 * Custom accept rules can boost confidence to guarantee inclusion.
 *
 * Note: Custom accept rules only apply when kenmeiManga context is available.
 * Manual searches that do not provide kenmeiManga will not trigger accept rules.
 * This ensures accept rule evaluation has proper context from the user's library.
 *
 * @param manga - The manga to evaluate.
 * @param score - The match score (0-1).
 * @param searchTitle - The original search title.
 * @param results - Current results array for context.
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation.
 * @returns Inclusion decision with potentially adjusted score.
 *
 * @example
 * ```typescript
 * const result = shouldIncludeMangaExact(manga, 0.7, "Naruto", [], kenmeiManga);
 * if (result.include) {
 *   console.log(`Including with score: ${result.adjustedScore}`);
 * }
 * ```
 *
 * @source
 */
export function shouldIncludeMangaExact(
  manga: AniListManga,
  score: number,
  searchTitle: string,
  results: AniListManga[],
  kenmeiManga?: KenmeiManga,
): InclusionResult {
  console.debug(
    `[MangaSearchService] 🔍 Checking titles for exact match against "${searchTitle}"`,
  );

  // Check custom accept rules if kenmeiManga provided
  if (kenmeiManga) {
    const { shouldAccept, matchedRule } = shouldAcceptByCustomRules(
      manga,
      kenmeiManga,
    );
    if (shouldAccept) {
      console.debug(
        `[MangaSearchService] ✅ Auto-accepting manga "${manga.title?.romaji || manga.title?.english}" due to custom rule: ${matchedRule?.description}`,
      );
      return {
        include: true,
        adjustedScore: Math.max(score, ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT), // Boost to high confidence
      };
    }
  }

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
      adjustedScore: foundGoodMatch
        ? Math.max(score, ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR)
        : score,
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
 *
 * Applies lenient threshold (0.15+) for general searches.
 * Custom accept rules can boost confidence to guarantee inclusion.
 *
 * Note: Custom accept rules only apply when kenmeiManga context is available.
 * Manual searches that do not provide kenmeiManga will not trigger accept rules.
 * This ensures accept rule evaluation has proper context from the user's library.
 *
 * @param manga - The manga to evaluate.
 * @param score - The match score (0-1).
 * @param results - Current results array for context.
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation.
 * @returns Inclusion decision with potentially adjusted score.
 *
 * @example
 * ```typescript
 * const result = shouldIncludeMangaRegular(manga, 0.2, [], kenmeiManga);
 * if (result.include) {
 *   console.log(`Including with score: ${result.adjustedScore}`);
 * }
 * ```
 *
 * @source
 */
export function shouldIncludeMangaRegular(
  manga: AniListManga,
  score: number,
  results: AniListManga[],
  kenmeiManga?: KenmeiManga,
): InclusionResult {
  // Check custom accept rules if kenmeiManga provided
  if (kenmeiManga) {
    const { shouldAccept, matchedRule } = shouldAcceptByCustomRules(
      manga,
      kenmeiManga,
    );
    if (shouldAccept) {
      console.debug(
        `[MangaSearchService] ✅ Auto-accepting manga "${manga.title?.romaji || manga.title?.english}" due to custom rule: ${matchedRule?.description}`,
      );
      return {
        include: true,
        adjustedScore: Math.max(score, ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR), // Boost to high confidence
      };
    }
  }

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
