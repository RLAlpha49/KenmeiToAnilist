/**
 * @packageDocumentation
 * @module Matching/Scoring
 * @description Barrel exports for manga match scoring utilities
 */

// Core match scoring
export { calculateMatchScore } from "./match-scorer";

// Confidence mapping
export { calculateConfidence } from "./confidence-mapper";

// Similarity calculations
export {
  calculateWordOrderSimilarity,
  containsCompleteTitle,
  calculateWordMatchScore,
} from "./similarity-calculator";

// Title priority
export { calculateTitleTypePriority } from "./title-priority";
