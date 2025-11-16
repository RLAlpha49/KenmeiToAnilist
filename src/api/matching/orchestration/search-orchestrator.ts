/**
 * Main search orchestration - coordinates all search operations
 * @module matching/orchestration/search-orchestrator
 */

import type { MangaSearchResponse, SearchServiceConfig } from "./types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { ComickSourceMap, MangaDexSourceMap } from "../sources/types";
import type { AniListManga } from "@/api/anilist/types";
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
import { executeMatchingWithWorkers } from "@/workers";

/**
 * Handle cache checking and return cached result if available.
 * @param title - Manga title to search for
 * @param cacheKey - Cache key for the search
 * @param kenmeiManga - Optional Kenmei manga context for custom rule evaluation
 * @param bypassCache - Whether to bypass cache
 * @returns Cached result if available and not bypassed, otherwise null
 */
function handleCacheCheck(
  title: string,
  cacheKey: string,
  kenmeiManga: KenmeiManga | undefined,
  bypassCache: boolean,
): MangaSearchResponse | null {
  if (bypassCache && cacheKey) {
    handleCacheBypass(title, cacheKey);
    return null;
  }

  const cachedResult = processCachedResults(title, cacheKey, kenmeiManga);
  if (cachedResult) {
    if (typeof globalThis.dispatchEvent === "function") {
      globalThis.dispatchEvent(
        new CustomEvent("matching:cache-hit", {
          detail: { title, cacheKey },
        }),
      );
    }
    return cachedResult;
  }

  return null;
}

/**
 * Apply worker-based scoring to search results.
 * @param rankedResults - Initial ranked results from search
 * @param kenmeiManga - Kenmei manga context for scoring
 * @param searchConfig - Search service configuration
 * @returns Scored results or original results if worker execution fails
 */
async function applyWorkerScoring(
  rankedResults: AniListManga[],
  kenmeiManga: KenmeiManga | undefined,
  searchConfig: SearchServiceConfig,
): Promise<AniListManga[]> {
  if (!searchConfig.shouldUseWorkers || rankedResults.length === 0 || !kenmeiManga) {
    return rankedResults;
  }

  try {
    const candidatesMap = new Map<string, AniListManga[]>();
    candidatesMap.set("0", rankedResults);
    const execution = executeMatchingWithWorkers(
      [kenmeiManga],
      candidatesMap,
      searchConfig.matchConfig,
    );
    const workerResults = await execution.promise;
    if (
      workerResults &&
      workerResults.length > 0 &&
      workerResults[0]?.anilistMatches
    ) {
      return workerResults[0].anilistMatches.map((match) => match.manga);
    }
  } catch {
    // Fallback to sync results if worker execution fails
  }

  return rankedResults;
}

/**
 * Handle fallback sources when no AniList results are found.
 * @param filteredResults - Filtered results from AniList
 * @param title - Manga title being searched
 * @param token - Authentication token
 * @param searchConfig - Search service configuration
 * @returns Object with final results and source maps
 */
async function handleFallbackSources(
  filteredResults: AniListManga[],
  title: string,
  token: string | undefined,
  searchConfig: SearchServiceConfig,
): Promise<{
  finalResults: AniListManga[];
  comickSourceMap: ComickSourceMap;
  mangaDexSourceMap: MangaDexSourceMap;
}> {
  const comickSourceMap: ComickSourceMap = new Map();
  const mangaDexSourceMap: MangaDexSourceMap = new Map();

  if (filteredResults.length > 0) {
    console.debug(
      `[MangaSearchService] ✅ Found ${filteredResults.length} AniList results for "${title}", skipping fallback sources`,
    );
    return {
      finalResults: filteredResults,
      comickSourceMap,
      mangaDexSourceMap,
    };
  }

  console.info(
    `[MangaSearchService] 🎯 No AniList results found for "${title}", trying fallback sources...`,
  );

  const comickFallback = await executeComickFallback(
    title,
    token,
    filteredResults,
    searchConfig,
  );
  const mangaDexFallback = await executeMangaDexFallback(
    title,
    token,
    filteredResults,
    searchConfig,
  );

  const mergedResults = mergeSourceResults(
    filteredResults,
    comickFallback.results,
    mangaDexFallback.results,
    comickFallback.comickSourceMap,
    mangaDexFallback.mangaDexSourceMap,
  );

  return {
    finalResults: mergedResults.mergedResults,
    comickSourceMap: mergedResults.comickSourceMap,
    mangaDexSourceMap: mergedResults.mangaDexSourceMap,
  };
}

/**
 * Search for manga by title with rate limiting and caching.
 *
 * Main entry point coordinating cache checking, AniList API search with pagination,
 * result ranking/filtering, fallback sources (Comick, MangaDex), and confidence scoring.
 *
 * Note: Custom accept rules only apply when kenmeiManga context is provided (automatic
 * matching flows). Manual searches that do not provide kenmeiManga will not have accept
 * rules applied, only skip rules are skipped (they don't apply to manual searches).
 * This is by design: accept rules require Kenmei context to evaluate properly.
 *
 * @param title - Manga title to search for
 * @param token - Optional authentication token
 * @param config - Optional search service configuration
 * @param abortSignal - Optional abort signal to cancel search
 * @param specificPage - Optional specific page number (disables pagination)
 * @param kenmeiManga - Optional Kenmei manga context for custom rule evaluation
 * @returns Promise resolving to manga search response with matches
 *
 * @source
 */
export async function searchMangaByTitle(
  title: string,
  token?: string,
  config: Partial<SearchServiceConfig> = {},
  abortSignal?: AbortSignal,
  specificPage?: number,
  kenmeiManga?: KenmeiManga,
): Promise<MangaSearchResponse> {
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };
  const cacheKey = generateCacheKey(title);

  // Check cache first
  const cachedResult = handleCacheCheck(
    title,
    cacheKey,
    kenmeiManga,
    searchConfig.bypassCache ?? false,
  );
  if (cachedResult) {
    return cachedResult;
  }

  if (searchConfig.exactMatchingOnly) {
    console.debug(
      `[MangaSearchService] 🔍 MANUAL SEARCH: Ensuring exact matching is correctly configured`,
    );
    searchConfig.exactMatchingOnly = true;
  }

  // Execute the search
  const searchQuery = title;
  await acquireRateLimit();

  // Dispatch cache miss event for performance tracking
  if (typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(
      new CustomEvent("matching:cache-miss", {
        detail: { title, cacheKey },
      }),
    );
  }

  const { results, lastPageInfo } = await executeSearchLoop(
    searchQuery,
    searchConfig,
    token,
    abortSignal,
    specificPage,
  );

  // Process and filter results
  const rankedResults = processSearchResults(
    results,
    title,
    searchConfig,
    kenmeiManga,
  );

  // Apply worker-based scoring if enabled
  const scoredResults = await applyWorkerScoring(
    rankedResults,
    kenmeiManga,
    searchConfig,
  );

  let filteredResults = applyContentFiltering(
    scoredResults,
    title,
    searchConfig,
  );
  filteredResults = handleNoResultsFallback(
    filteredResults,
    results,
    searchConfig,
  );

  // Handle fallback sources
  const { finalResults, comickSourceMap, mangaDexSourceMap } =
    await handleFallbackSources(filteredResults, title, token, searchConfig);

  // Build and return final response
  return buildFinalResponse(
    finalResults,
    title,
    comickSourceMap,
    mangaDexSourceMap,
    lastPageInfo,
  );
}
