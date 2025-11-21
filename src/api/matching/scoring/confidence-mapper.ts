/**
 * @packageDocumentation
 * @module Matching/Scoring/ConfidenceMapper
 * @description Converts normalized match scores (0-1) to confidence percentages (0-100) using a logistic curve and match-type adjustments.
 */

import { AniListManga } from "../../anilist/types";
import { calculateMatchScoreDetails } from "./match-scorer";
import type { MatchScoreDetails } from "./match-scorer";

const MAX_CONFIDENCE = 99;
const CONFIDENCE_FLOOR = 15;
const CONFIDENCE_RANGE = 85;
const LOGISTIC_STEEPNESS = 9;
const LOGISTIC_MIDPOINT = 0.7;

const MATCH_TYPE_BIAS: Record<MatchScoreDetails["matchType"], number> = {
  direct: 4,
  word: 2,
  legacy: -2,
  none: -4,
};

/**
 * Convert match score to confidence percentage using conservative adaptive scaling.
 * Applies different thresholds based on match score ranges to avoid overconfidence.
 *
 * @param searchTitle - The search title used for matching
 * @param manga - The manga to calculate confidence for
 * @returns Confidence percentage between 0-100 (capped at 99% for near-perfect matches)
 * @source
 */
export function calculateConfidence(
  searchTitle: string,
  manga: AniListManga,
): number {
  const matchDetails = calculateMatchScoreDetails(manga, searchTitle);
  const { score, matchType } = matchDetails;

  console.debug(
    `[MangaSearchService] Calculating confidence for match score: ${score.toFixed(3)} (${matchType}) between "${searchTitle}" and "${manga.title.english || manga.title.romaji}"`,
  );

  if (score <= 0) {
    return 0;
  }

  const logisticValue =
    1 / (1 + Math.exp(-LOGISTIC_STEEPNESS * (score - LOGISTIC_MIDPOINT)));
  const baseConfidence = CONFIDENCE_FLOOR + logisticValue * CONFIDENCE_RANGE;
  const adjustment = MATCH_TYPE_BIAS[matchType] ?? 0;
  const adjustedConfidence = Math.min(
    MAX_CONFIDENCE,
    Math.max(CONFIDENCE_FLOOR, baseConfidence + adjustment),
  );
  return Math.round(adjustedConfidence);
}
