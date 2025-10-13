/**
 * @file Search execution and pagination handling
 * @module matching/orchestration/search-execution
 */

import type { AniListManga, PageInfo, SearchResult } from "@/api/anilist/types";
import type { SearchServiceConfig, SearchLoopResult } from "./types";
import {
  acquireRateLimit,
  searchWithRateLimit,
  advancedSearchWithRateLimit,
} from "../rate-limiting";

/**
 * Execute a single search request with the appropriate method
 *
 * @param searchQuery - The search query to execute
 * @param currentPage - Current page number for pagination
 * @param searchConfig - Configuration for the search service
 * @param token - Optional authentication token
 * @returns Promise resolving to search results
 */
async function executeSingleSearch(
  searchQuery: string,
  currentPage: number,
  searchConfig: SearchServiceConfig,
  token: string | undefined,
): Promise<SearchResult<AniListManga>> {
  let searchResult: SearchResult<AniListManga>;

  if (searchConfig.useAdvancedSearch) {
    searchResult = await advancedSearchWithRateLimit(
      searchQuery,
      {},
      {
        page: currentPage,
        perPage: searchConfig.searchPerPage,
        token,
        acquireLimit: false,
        retryCount: 0,
        bypassCache: searchConfig.bypassCache,
      },
    );
  } else {
    searchResult = await searchWithRateLimit(
      searchQuery,
      currentPage,
      searchConfig.searchPerPage,
      token,
      false,
      0,
      searchConfig.bypassCache,
    );
  }

  return searchResult;
}

/**
 * Check if pagination should continue based on current state
 *
 * @param pageInfo - Page information from the current search result
 * @param currentPage - Current page number
 * @param resultsLength - Current number of results collected
 * @param maxResults - Maximum number of results allowed
 * @param singlePageMode - Whether operating in single page mode
 * @returns True if pagination should continue
 */
function shouldContinuePagination(
  pageInfo: PageInfo,
  currentPage: number,
  resultsLength: number,
  maxResults: number,
  singlePageMode: boolean,
): boolean {
  if (singlePageMode) {
    console.debug(
      `[MangaSearchService] 🔍 Single page mode: Fetched page ${currentPage}, stopping search`,
    );
    return false;
  }

  return (
    pageInfo.hasNextPage &&
    currentPage < pageInfo.lastPage &&
    resultsLength < maxResults
  );
}

/**
 * Validate and normalize search result structure
 *
 * @param searchResult - The search result to validate
 * @param searchQuery - The search query that generated this result
 * @returns True if the search result is valid and properly structured
 */
function validateSearchResult(
  searchResult: SearchResult<AniListManga>,
  searchQuery: string,
): boolean {
  if (!searchResult?.Page) {
    console.error(
      `[MangaSearchService] Invalid search result for "${searchQuery}":`,
      searchResult,
    );
    return false;
  }

  if (!searchResult.Page.media) {
    console.error(
      `[MangaSearchService] Search result for "${searchQuery}" missing media array:`,
      searchResult,
    );
    searchResult.Page.media = [];
  }

  if (!searchResult.Page.pageInfo) {
    console.error(
      `[MangaSearchService] Search result for "${searchQuery}" missing pageInfo:`,
      searchResult,
    );
    return false;
  }

  return true;
}

/**
 * Handle search errors with proper logging
 *
 * @param error - The error that occurred
 * @param searchQuery - The search query that caused the error
 */
function handleSearchError(error: unknown, searchQuery: string): void {
  if (error instanceof Error) {
    console.error(
      `[MangaSearchService] Error searching for manga "${searchQuery}": ${error.message}`,
      error,
    );
  } else {
    console.error(
      `[MangaSearchService] Error searching for manga "${searchQuery}"`,
      error,
    );
  }
}

/**
 * Execute the main search loop with pagination
 *
 * Performs paginated search requests, collecting results until:
 * - No more pages available
 * - Maximum results reached
 * - Single page mode (specificPage provided)
 * - Error occurs
 * - Operation aborted
 *
 * @param searchQuery - The search query string
 * @param searchConfig - Search configuration
 * @param token - Optional authentication token
 * @param abortSignal - Optional abort signal to cancel the search
 * @param specificPage - Optional specific page number (disables pagination)
 * @returns Promise with collected results and final page info
 */
export async function executeSearchLoop(
  searchQuery: string,
  searchConfig: SearchServiceConfig,
  token: string | undefined,
  abortSignal: AbortSignal | undefined,
  specificPage?: number,
): Promise<SearchLoopResult> {
  let results: AniListManga[] = [];
  let currentPage = specificPage || 1;
  let hasNextPage = true;
  let lastPageInfo: PageInfo | undefined = undefined;
  const singlePageMode = specificPage !== undefined;

  console.info(
    `[MangaSearchService] 🌐 Making network request to AniList API for "${searchQuery}" - bypassCache=${searchConfig.bypassCache}`,
  );

  while (hasNextPage && results.length < searchConfig.maxSearchResults) {
    try {
      if (abortSignal?.aborted) {
        throw new Error("Search aborted by abort signal");
      }

      // Execute the search request
      const searchResult = await executeSingleSearch(
        searchQuery,
        currentPage,
        searchConfig,
        token,
      );

      console.debug(
        `[MangaSearchService] 🔍 Search response for "${searchQuery}" page ${currentPage}: ${searchResult?.Page?.media?.length || 0} results`,
      );

      // Log detailed results if cache is bypassed
      if (searchConfig.bypassCache && searchResult?.Page?.media?.length > 0) {
        console.debug(
          `[MangaSearchService] 🔍 Titles received from API:`,
          searchResult.Page.media.map((m) => ({
            id: m.id,
            romaji: m.title?.romaji,
            english: m.title?.english,
            native: m.title?.native,
            synonyms: m.synonyms?.length,
          })),
        );
      }

      // Validate search result structure
      if (!validateSearchResult(searchResult, searchQuery)) {
        break;
      }

      // Add results to collection
      results = [...results, ...searchResult.Page.media];
      lastPageInfo = searchResult.Page.pageInfo;

      // Check if pagination should continue
      hasNextPage = shouldContinuePagination(
        searchResult.Page.pageInfo,
        currentPage,
        results.length,
        searchConfig.maxSearchResults,
        singlePageMode,
      );

      currentPage++;

      if (hasNextPage) {
        await acquireRateLimit();
      }
    } catch (error: unknown) {
      handleSearchError(error, searchQuery);
      throw error;
    }
  }

  return { results, lastPageInfo };
}
