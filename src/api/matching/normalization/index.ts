/**
 * @packageDocumentation
 * @module Matching/Normalization
 * @description Barrel exports for manga normalization utilities
 */

// Title normalization
export {
  normalizeForMatching,
  processTitle,
  createNormalizedTitles,
  collectMangaTitles,
  isDifferenceOnlyArticles,
} from "./title-normalizer";

// Character utilities
export { replaceSpecialChars, removePunctuation } from "./character-utils";

// Pattern detection
export {
  isOneShot,
  checkSeasonPattern,
  checkSeasonPatterns,
} from "./pattern-detection";
