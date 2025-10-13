/**
 * Filtering module for manga search results
 * @module filtering
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
