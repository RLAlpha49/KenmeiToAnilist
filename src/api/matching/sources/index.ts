/**
 * Sources module - Manga source integration (Comick, MangaDex).
 * Handles fallback searches, result processing, filtering, and merging from alternative sources.
 * Provides centralized exports for source-related functionality.
 *
 * @module sources
 * @packageDocumentation
 */

/** Comick source metadata. @source */
export type {
  ComickSourceInfo,
  MangaDexSourceInfo,
  ComickSourceMap,
  MangaDexSourceMap,
  GenericSourceInfo,
} from "./types";

/** Converts enhanced manga to standard AniList format. @source */
export { convertEnhancedMangaToAniList } from "./conversion";

/** Processes and filters Comick search results. @source */
export {
  processComickResults,
  applyComickFiltering,
} from "./comick-processing";

/** Processes and filters MangaDex search results. @source */
export {
  processMangaDexResults,
  applyMangaDexFiltering,
} from "./mangadex-processing";

/** Executes Comick fallback search. @source */
export { executeComickFallback } from "./comick-fallback";

/** Executes MangaDex fallback search. @source */
export { executeMangaDexFallback } from "./mangadex-fallback";

/** Merges and deduplicates results from multiple sources. @source */
export { mergeSourceResults, getSourceInfo } from "./merge-utils";
