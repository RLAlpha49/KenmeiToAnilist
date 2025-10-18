/**
 * Barrel exports for manga filtering utilities.
 * Provides functions for skipping, exact matching, and inclusion decision logic.
 * @module filtering
 * @source
 */

export {
  shouldIgnoreForAutomaticMatching,
  shouldSkipManga,
} from "./skip-rules";

export { checkExactMatch } from "./exact-match-checker";

export {
  shouldIncludeMangaExact,
  shouldIncludeMangaRegular,
  type InclusionResult,
} from "./inclusion-rules";
