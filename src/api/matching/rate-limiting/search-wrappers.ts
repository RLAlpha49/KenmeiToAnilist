/**
 * Rate-limited wrappers for AniList search functions
 * @module rate-limiting/search-wrappers
 */

import type { AniListManga, SearchResult } from "@/api/anilist/types";
import { searchManga, advancedSearchManga } from "@/api/anilist/client";
import { waitWhileManuallyPaused } from "./manual-pause";
import { acquireRateLimit } from "./queue-processor";
import { sleep } from "./utils";

/**
 * Options for search rate limiting
 */
export interface SearchRateLimitOptions {
  page?: number;
  perPage?: number;
  token?: string;
  acquireLimit?: boolean;
  retryCount?: number;
  bypassCache?: boolean;
}

/**
 * Make a search with rate limiting and retry logic
 *
 * @param query - Search query string
 * @param page - Page number for pagination (default: 1)
 * @param perPage - Results per page (default: 50)
 * @param token - Optional authentication token
 * @param acquireLimit - Whether to acquire rate limit slot (default: true)
 * @param retryCount - Current retry attempt (default: 0)
 * @param bypassCache - Whether to bypass cache (default: false)
 * @returns Promise resolving to search results
 */
export async function searchWithRateLimit(
  query: string,
  page: number = 1,
  perPage: number = 50,
  token?: string,
  acquireLimit: boolean = true,
  retryCount: number = 0,
  bypassCache: boolean = false,
): Promise<SearchResult<AniListManga>> {
  await waitWhileManuallyPaused();

  // Only wait for rate limit if requested (first request in a batch should wait, subsequent ones should not)
  if (acquireLimit) {
    await acquireRateLimit();
  }

  try {
    // Call the AniList client search function - this will handle caching in the client
    return await searchManga(query, page, perPage, token, bypassCache);
  } catch (error: unknown) {
    // Retry logic for transient errors
    if (retryCount < 3) {
      console.warn(
        `[MangaSearchService] Search error, retrying (${retryCount + 1}/3): ${query}`,
      );
      await sleep(1000 * (retryCount + 1)); // Exponential backoff

      // Retry with incremented retry count
      return searchWithRateLimit(
        query,
        page,
        perPage,
        token,
        true,
        retryCount + 1,
        bypassCache,
      );
    }

    // After all retries, propagate the error
    throw error;
  }
}

/**
 * Make an advanced search with rate limiting and retry logic
 *
 * @param query - Search query string
 * @param options - Additional search options including pagination and caching settings
 * @returns Promise resolving to search results
 */
export async function advancedSearchWithRateLimit(
  query: string,
  options: SearchRateLimitOptions = {},
): Promise<SearchResult<AniListManga>> {
  await waitWhileManuallyPaused();

  const {
    page = 1,
    perPage = 50,
    token,
    acquireLimit = true,
    retryCount = 0,
    bypassCache = false,
  } = options;

  // Only wait for rate limit if requested
  if (acquireLimit) {
    await acquireRateLimit();
  }

  try {
    // Call the AniList client search function - this will handle caching in the client
    return await advancedSearchManga(query, page, perPage, token, bypassCache);
  } catch (error: unknown) {
    // Retry logic for transient errors
    if (retryCount < 3) {
      console.warn(
        `[MangaSearchService] Advanced search error, retrying (${retryCount + 1}/3): ${query}`,
      );
      await sleep(1000 * (retryCount + 1)); // Exponential backoff
      await waitWhileManuallyPaused();

      // Retry with incremented retry count
      return advancedSearchWithRateLimit(query, {
        ...options,
        acquireLimit: true,
        retryCount: retryCount + 1,
      });
    }

    // After all retries, propagate the error
    throw error;
  }
}
