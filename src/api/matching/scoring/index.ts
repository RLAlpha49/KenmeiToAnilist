/**
 * @packageDocumentation
 * @module Matching/Scoring
 * @description Barrel exports for manga match scoring and confidence calculation utilities.
 */

// Core match scoring
/** Calculates normalized match score (0-1) between a manga title and search query. @source */
export { calculateMatchScore } from "./match-scorer";

// Confidence mapping
/** Converts match score to confidence percentage (0-100) with adaptive scaling. @source */
export { calculateConfidence } from "./confidence-mapper";

// Similarity calculations
/** Calculates similarity based on word order preservation using longest common subsequence. @source */
export { calculateWordOrderSimilarity } from "./similarity-calculator";
/** Checks if title contains complete search term and returns significance score. @source */
export { containsCompleteTitle } from "./similarity-calculator";
/** Calculates word match ratio between title and search words with prefix matching. @source */
export { calculateWordMatchScore } from "./similarity-calculator";

// Title priority
/** Calculates priority score for sorting matches by title type (English > Romaji > Native > Synonym). @source */
export { calculateTitleTypePriority } from "./title-priority";
