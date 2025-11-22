/**
 * Main search orchestration - coordinates all search operations
 * @module matching/orchestration/search-orchestrator
 */

import type { MangaSearchResponse, SearchServiceConfig } from "./types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { ComickSourceMap, MangaDexSourceMap } from "../sources/types";
import type { AniListManga } from "@/api/anilist/types";
import { DEFAULT_SEARCH_CONFIG } from "./types";
import {
  handleCacheBypass,
  processCachedResults,
  storeFallbackSourceMetadata,
} from "./cache-handlers";
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
import { filterOutBlacklistedManga } from "../filtering/blacklist";
import { executeMatchingWithWorkers } from "@/workers";

/**
 * Generates extra search queries by splitting the title on a wider set of punctuation markers.
 * @param title - Original title
 * @returns Array of unique extra queries
 */
function generateExtraSearchQueries(title: string): string[] {
  const queries = new Set<string>();

  const addParts = (separator: string) => {
    if (!title.includes(separator)) return;
    const parts = title
      .split(separator)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length <= 1) return;

    for (const part of parts) {
      queries.add(part);
    }
  };

  const separators = [
    "...",
    "..",
    ":",
    " - ",
    " – ",
    "—",
    ";",
    "|",
    "/",
    "? ",
    "! ",
    "~",
  ];

  for (const separator of separators) {
    addParts(separator);
  }

  const parenRegex = /\(([^)]+)\)/g;
  let parenMatch: RegExpExecArray | null = null;
  while ((parenMatch = parenRegex.exec(title)) !== null) {
    const inner = parenMatch[1]?.trim();
    if (inner) {
      queries.add(inner);
    }
  }

  const strippedTitle = title.replaceAll(/\s*\([^)]*\)/g, "").trim();
  if (strippedTitle && strippedTitle.length > 5) {
    queries.add(strippedTitle);
  }

  return Array.from(queries).filter(
    (query) => query.length > 5 && query !== title,
  );
}

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
  if (
    !searchConfig.shouldUseWorkers ||
    rankedResults.length === 0 ||
    !kenmeiManga
  ) {
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
 * Execute extra searches if enabled and no results found.
 * @param title - Original title
 * @param searchConfig - Search configuration
 * @param token - Auth token
 * @param abortSignal - Abort signal
 * @param specificPage - Specific page number
 * @param kenmeiManga - Kenmei manga context
 * @param currentResults - Current filtered results
 * @returns Updated results with extra matches
 */
export async function performExtraSearches(
  title: string,
  searchConfig: SearchServiceConfig,
  token: string | undefined,
  abortSignal: AbortSignal | undefined,
  specificPage: number | undefined,
  kenmeiManga: KenmeiManga | undefined,
  currentResults: AniListManga[],
): Promise<AniListManga[]> {
  if (
    currentResults.length > 0 ||
    !searchConfig.matchConfig?.enableExtraTitleSearches
  ) {
    return currentResults;
  }

  const extraQueries = generateExtraSearchQueries(title);
  if (extraQueries.length === 0) return currentResults;

  console.info(
    `[MangaSearchService] 🔄 No results found. Trying extra searches: ${extraQueries.join(", ")}`,
  );

  const newResults = [...currentResults];
  const existingIds = new Set(newResults.map((m) => m.id));

  for (const query of extraQueries) {
    await acquireRateLimit();

    const { results: extraResults } = await executeSearchLoop(
      query,
      searchConfig,
      token,
      abortSignal,
      specificPage,
    );

    if (extraResults.length > 0) {
      const sanitizedExtra = filterOutBlacklistedManga(extraResults);
      const rankedExtra = processSearchResults(
        sanitizedExtra,
        title,
        searchConfig,
        kenmeiManga,
      );

      for (const res of rankedExtra) {
        if (!existingIds.has(res.id)) {
          newResults.push(res);
          existingIds.add(res.id);
        }
      }
    }
  }
  return newResults;
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
 * Executes the search loop and processes the results.
 * @param title - Title to search for
 * @param searchConfig - Search configuration
 * @param token - Auth token
 * @param abortSignal - Abort signal
 * @param specificPage - Specific page number
 * @param kenmeiManga - Kenmei manga context
 * @returns Processed results and page info
 */
async function executeAndProcessSearch(
  title: string,
  searchConfig: SearchServiceConfig,
  token: string | undefined,
  abortSignal: AbortSignal | undefined,
  specificPage: number | undefined,
  kenmeiManga: KenmeiManga | undefined,
) {
  await acquireRateLimit();

  if (typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(
      new CustomEvent("matching:cache-miss", {
        detail: { title, cacheKey: generateCacheKey(title) },
      }),
    );
  }

  const { results, lastPageInfo } = await executeSearchLoop(
    title,
    searchConfig,
    token,
    abortSignal,
    specificPage,
  );

  const hadAnyApiResults = results.length > 0;
  const sanitizedResults = filterOutBlacklistedManga(results);

  // Process and filter results
  const rankedResults = processSearchResults(
    sanitizedResults,
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
    sanitizedResults,
    searchConfig,
    hadAnyApiResults,
  );

  return { filteredResults, lastPageInfo };
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
  const { filteredResults, lastPageInfo } = await executeAndProcessSearch(
    title,
    searchConfig,
    token,
    abortSignal,
    specificPage,
    kenmeiManga,
  );

  // Extra searches logic
  const extraResults = await performExtraSearches(
    title,
    searchConfig,
    token,
    abortSignal,
    specificPage,
    kenmeiManga,
    filteredResults,
  );

  // Handle fallback sources
  const { finalResults, comickSourceMap, mangaDexSourceMap } =
    await handleFallbackSources(extraResults, title, token, searchConfig);

  storeFallbackSourceMetadata(
    title,
    comickSourceMap,
    mangaDexSourceMap,
    searchConfig,
  );

  // Build and return final response
  return buildFinalResponse(
    finalResults,
    title,
    comickSourceMap,
    mangaDexSourceMap,
    lastPageInfo,
  );
}
