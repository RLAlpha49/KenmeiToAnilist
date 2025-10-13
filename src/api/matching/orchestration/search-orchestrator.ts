/**
 * @file Main search orchestration - coordinates all search operations
 * @module matching/orchestration/search-orchestrator
 */

import type { MangaSearchResponse, SearchServiceConfig } from "./types";
import { DEFAULT_SEARCH_CONFIG } from "./types";
import { handleCacheBypass, processCachedResults } from "./cache-handlers";
import { executeSearchLoop } from "./search-execution";
import {
  processSearchResults,
  applyContentFiltering,
  handleNoResultsFallback,
} from "./result-processing";
import { buildFinalResponse } from "./response-builder";
import { acquireRateLimit } from "../rate-limiting";
import { generateCacheKey } from "../cache";
import {
  executeComickFallback,
  executeMangaDexFallback,
  mergeSourceResults,
} from "../sources";

/**
 * Search for manga by title with rate limiting and caching
 *
 * Main entry point for manga search operations. Coordinates:
 * - Cache checking/bypass
 * - AniList API search with pagination
 * - Result ranking and filtering
 * - Fallback sources (Comick, MangaDex)
 * - Response building with confidence scores
 *
 * @param title - The manga title to search for
 * @param token - Optional authentication token
 * @param config - Optional search service configuration
 * @param abortSignal - Optional abort signal to cancel the search
 * @param specificPage - Optional specific page number (disables pagination)
 * @returns Promise resolving to manga search response with matches
 */
export async function searchMangaByTitle(
  title: string,
  token?: string,
  config: Partial<SearchServiceConfig> = {},
  abortSignal?: AbortSignal,
  specificPage?: number,
): Promise<MangaSearchResponse> {
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };
  const cacheKey = generateCacheKey(title);

  // Handle cache operations
  if (searchConfig.bypassCache && cacheKey) {
    handleCacheBypass(title, cacheKey);
  } else if (!searchConfig.bypassCache) {
    const cachedResult = processCachedResults(title, cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  } else if (searchConfig.exactMatchingOnly) {
    console.debug(
      `[MangaSearchService] 🔍 MANUAL SEARCH: Ensuring exact matching is correctly configured`,
    );
    searchConfig.exactMatchingOnly = true;
  }

  // Execute the search
  const searchQuery = title;
  await acquireRateLimit();

  const { results, lastPageInfo } = await executeSearchLoop(
    searchQuery,
    searchConfig,
    token,
    abortSignal,
    specificPage,
  );

  // Process and filter results
  const rankedResults = processSearchResults(results, title, searchConfig);
  let filteredResults = applyContentFiltering(
    rankedResults,
    title,
    searchConfig,
  );
  filteredResults = handleNoResultsFallback(
    filteredResults,
    results,
    searchConfig,
  );

  // Handle fallback sources only if no original AniList results were found
  let finalResults = filteredResults;
  let comickSourceMap = new Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >();
  let mangaDexSourceMap = new Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >();

  // Only use fallback sources if no AniList results were found
  if (filteredResults.length === 0) {
    console.info(
      `[MangaSearchService] 🎯 No AniList results found for "${title}", trying fallback sources...`,
    );

    // Try both fallback sources when enabled
    const comickFallback = await executeComickFallback(
      title,
      token,
      finalResults,
      searchConfig,
    );
    const mangaDexFallback = await executeMangaDexFallback(
      title,
      token,
      finalResults,
      searchConfig,
    );

    // Merge results and handle duplicates
    const mergedResults = mergeSourceResults(
      finalResults,
      comickFallback.results,
      mangaDexFallback.results,
      comickFallback.comickSourceMap,
      mangaDexFallback.mangaDexSourceMap,
    );

    finalResults = mergedResults.mergedResults;
    comickSourceMap = mergedResults.comickSourceMap;
    mangaDexSourceMap = mergedResults.mangaDexSourceMap;
  } else {
    console.debug(
      `[MangaSearchService] ✅ Found ${filteredResults.length} AniList results for "${title}", skipping fallback sources`,
    );
  }

  // Build and return final response
  return buildFinalResponse(
    finalResults,
    title,
    comickSourceMap,
    mangaDexSourceMap,
    lastPageInfo,
  );
}
