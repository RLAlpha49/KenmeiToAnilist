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
export type { NormalizedTitle } from "./title-normalizer";

// Character utilities
export { replaceSpecialChars, removePunctuation } from "./character-utils";

// Pattern detection
export {
  isOneShot,
  checkSeasonPattern,
  checkSeasonPatterns,
} from "./pattern-detection";

// Cache warmer service
export { TitleNormalizationCacheWarmer, getCacheWarmer } from "./cache-warmer";
export type {
  WorkerNormalizationAlgorithm,
  CacheNormalizationKey,
} from "./cache-warmer";
export type { NormalizationCacheResult } from "@/workers";
