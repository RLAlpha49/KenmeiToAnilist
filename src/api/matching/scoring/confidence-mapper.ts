/**
 * @packageDocumentation
 * @module Matching/Scoring/ConfidenceMapper
 * @description Converts match scores (0-1) to confidence percentages (0-100)
 */

// TODO: Improve confidence calculation algorithm

import { AniListManga } from "../../anilist/types";
import { calculateMatchScore } from "./match-scorer";

/**
 * Calculate confidence percentage from match score
 * Converts the 0-1 match score to a 0-100 confidence percentage
 * Uses a more conservative algorithm to avoid inflated confidence scores
 *
 * @param searchTitle - The search title used for matching
 * @param manga - The manga to calculate confidence for
 * @returns Confidence percentage (0-100)
 *
 * @example
 * ```typescript
 * const confidence = calculateConfidence("One Piece", manga);
 * // Returns: 95 (for near-perfect match)
 * ```
 */
export function calculateConfidence(
  searchTitle: string,
  manga: AniListManga,
): number {
  // Calculate the match score first - always use original search title, not manga's own title
  const score = calculateMatchScore(manga, searchTitle);

  console.debug(
    `[MangaSearchService] Calculating confidence for match score: ${score.toFixed(3)} between "${searchTitle}" and "${manga.title.english || manga.title.romaji}"`,
  );

  if (score <= 0) {
    // No match found
    return 0;
  } else if (score >= 0.97) {
    // Near-perfect match - cap at 99% to avoid overconfidence
    return 99;
  } else if (score >= 0.94) {
    // Almost perfect match - very high confidence
    return Math.round(90 + (score - 0.94) * 125); // 90-96% range
  } else if (score >= 0.87) {
    // Strong match - high confidence (80-90%)
    return Math.round(80 + (score - 0.87) * 143);
  } else if (score >= 0.75) {
    // Good match - medium-high confidence (65-80%)
    return Math.round(65 + (score - 0.75) * 125);
  } else if (score >= 0.6) {
    // Reasonable match - medium confidence (50-65%)
    return Math.round(50 + (score - 0.6) * 100);
  } else if (score >= 0.4) {
    // Weak match - low confidence (30-50%)
    return Math.round(30 + (score - 0.4) * 100);
  } else if (score >= 0.2) {
    // Very weak match - very low confidence (15-30%)
    return Math.round(15 + (score - 0.2) * 75);
  } else {
    // Extremely weak match - minimal confidence (1-15%)
    return Math.max(1, Math.round(score * 75));
  }
}
