/**
 * Batch processing module for manga search operations.
 *
 * Exports batch processing functionality for manga matching:
 * - Categorization: Separate manga into cached/known/uncached
 * - Known IDs: Efficiently fetch manga with known AniList IDs
 * - Uncached: Search uncached manga with concurrency control
 * - Results: Compile and filter final match results
 * @source
 */

// Types
export type {
  CachedResultsStorage,
  UpdateProgressCallbacks,
  KnownMangaData,
  KnownMangaConfig,
  KnownMangaControl,
  UncachedMangaData,
  UncachedMangaConfig,
  UncachedMangaControl,
  SearchServiceConfig,
  BatchCategorizationResult,
  ComickSourceStorage,
  MangaDexSourceStorage,
} from "./types";

// Categorization
export { categorizeMangaForBatching } from "./categorization";

// Known IDs processing
export { processKnownMangaIds } from "./known-ids";

// Uncached manga processing
export { processUncachedManga } from "./uncached";
export { processBatchedUncachedManga } from "./batch-search";

// Results compilation
export {
  applyMatchFiltering,
  createMangaMatchResult,
  compileMatchResults,
  handleCancellationResults,
} from "./results";
