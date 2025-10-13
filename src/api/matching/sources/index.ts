/**
 * Sources module - Manga source integration (Comick, MangaDex).
 * Handles fallback searches, result processing, and merging from alternative sources.
 *
 * @module sources
 * @packageDocumentation
 */

export type {
  ComickSourceInfo,
  MangaDexSourceInfo,
  ComickSourceMap,
  MangaDexSourceMap,
  GenericSourceInfo,
} from "./types";

export { convertEnhancedMangaToAniList } from "./conversion";

export {
  processComickResults,
  applyComickFiltering,
} from "./comick-processing";

export {
  processMangaDexResults,
  applyMangaDexFiltering,
} from "./mangadex-processing";

export { executeComickFallback } from "./comick-fallback";
export { executeMangaDexFallback } from "./mangadex-fallback";

export { mergeSourceResults, getSourceInfo } from "./merge-utils";
