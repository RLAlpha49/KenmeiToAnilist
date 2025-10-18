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
 * Execute a single search request with the appropriate method.
 *
 * @param searchQuery - Search query to execute
 * @param currentPage - Current page number for pagination
 * @param searchConfig - Search service configuration
 * @param token - Optional authentication token
 * @returns Promise resolving to search results
 * @source
 */
async function executeSingleSearch(
  searchQuery: string,
  currentPage: number,
  searchConfig: SearchServiceConfig,
  token: string | undefined,
): Promise<SearchResult<AniListManga>> {
  let searchResult: SearchResult<AniListManga>;

  if (searchConfig.useAdvancedSearch) {
    searchResult = await advancedSearchWithRateLimit(searchQuery, {
      page: currentPage,
      perPage: searchConfig.searchPerPage,
      token,
      acquireLimit: false,
      retryCount: 0,
      bypassCache: searchConfig.bypassCache,
    });
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
 * Determine if pagination should continue based on current state.
 *
 * Stops pagination in single page mode or when max results reached.
 *
 * @param pageInfo - Page information from current search result
 * @param currentPage - Current page number
 * @param resultsLength - Current number of results collected
 * @param maxResults - Maximum number of results allowed
 * @param singlePageMode - Whether operating in single page mode
 * @returns True if pagination should continue
 * @source
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
 * Validate search result structure and normalize if needed.
 *
 * @param searchResult - Search result to validate
 * @param searchQuery - Search query that generated this result
 * @returns True if valid and properly structured
 * @source
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
 * Log search errors with appropriate context.
 *
 * @param error - Error that occurred
 * @param searchQuery - Search query that caused the error
 * @source
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
 * Execute paginated search loop collecting results until completion.
 *
 * Continues pagination while results available, max not reached, and not aborted.
 * Respects rate limiting between requests.
 *
 * @param searchQuery - Search query string
 * @param searchConfig - Search configuration
 * @param token - Optional authentication token
 * @param abortSignal - Optional abort signal to cancel search
 * @param specificPage - Optional specific page number (disables pagination)
 * @returns Promise with collected results and final page info
 * @source
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
