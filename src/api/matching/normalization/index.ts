/**
 * Barrel exports for manga title normalization utilities.
 * Provides functions for title processing, character replacement, and pattern detection.
 * @module normalization
 * @source
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
