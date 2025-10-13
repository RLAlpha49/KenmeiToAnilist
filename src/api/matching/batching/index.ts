/**
 * Batching module for manga search operations
 * @module batching
 *
 * Provides batch processing functionality for manga matching, including:
 * - Categorization: Separates manga into cached/known/uncached
 * - Known IDs: Efficiently fetches manga with known AniList IDs
 * - Uncached: Searches for manga not in cache with concurrency control
 * - Results: Compiles and filters final match results
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

// Results compilation
export {
  applyMatchFiltering,
  createMangaMatchResult,
  compileMatchResults,
  handleCancellationResults,
} from "./results";
