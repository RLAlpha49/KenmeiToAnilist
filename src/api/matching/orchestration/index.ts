/**
 * Orchestration module for manga search operations
 * @module orchestration
 *
 * Coordinates all manga search operations including:
 * - Cache management (check, bypass, save)
 * - Search execution (API calls, pagination)
 * - Result processing (ranking, filtering)
 * - Fallback sources (Comick, MangaDex)
 * - Response building (confidence scores, source info)
 */

// Types
export type {
  SearchServiceConfig,
  MangaSearchResponse,
  MangaMatch,
  SearchLoopResult,
} from "./types";
export { DEFAULT_SEARCH_CONFIG } from "./types";

// Ranking utilities
export { rankMangaResults } from "./ranking";

// Cache handlers
export {
  handleCacheBypass,
  processCachedResults,
  cacheSearchResults,
} from "./cache-handlers";

// Search execution
export { executeSearchLoop } from "./search-execution";

// Result processing
export {
  processSearchResults,
  applyContentFiltering,
  handleNoResultsFallback,
} from "./result-processing";

// Response builder
export { buildFinalResponse } from "./response-builder";

// Main orchestrator
export { searchMangaByTitle } from "./search-orchestrator";
