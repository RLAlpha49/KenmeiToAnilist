/**
 * Rate-limited wrappers for AniList search functions.
 *
 * Provides search and advanced search functions with automatic rate limiting,
 * retry logic with exponential backoff, and manual pause support.
 *
 * @packageDocumentation
 * @source
 */

import type { AniListManga, SearchResult } from "@/api/anilist/types";
import { searchManga, advancedSearchManga } from "@/api/anilist/client";
import { waitWhileManuallyPaused } from "./manual-pause";
import { acquireRateLimit } from "./queue-processor";
import { sleep } from "./utils";

/**
 * Options for search rate limiting.
 * @source
 */
export interface SearchRateLimitOptions {
  /** Page number for pagination. */
  page?: number;
  /** Number of results per page. */
  perPage?: number;
  /** Optional authentication token. */
  token?: string;
  /** Whether to acquire a rate limit slot before searching. */
  acquireLimit?: boolean;
  /** Current retry attempt count (used internally). */
  retryCount?: number;
  /** Whether to bypass the search cache. */
  bypassCache?: boolean;
}

/**
 * Performs a search with rate limiting and automatic retry logic.
 *
 * Acquires a rate limit slot, executes the search, and retries up to 3 times on failure
 * with exponential backoff. Respects manual pause states.
 *
 * @param query - Search query string.
 * @param page - Page number for pagination (default: 1).
 * @param perPage - Results per page (default: 50).
 * @param token - Optional authentication token.
 * @param acquireLimit - Whether to acquire rate limit slot (default: true).
 * @param retryCount - Current retry attempt (default: 0).
 * @param bypassCache - Whether to bypass cache (default: false).
 * @returns Promise resolving to search results.
 * @throws Propagates search errors after exhausting retries.
 * @source
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
 * Performs an advanced search with rate limiting and automatic retry logic.
 *
 * Similar to searchWithRateLimit but accepts flexible options. Acquires a rate limit slot,
 * executes the search, and retries up to 3 times on failure with exponential backoff.
 * Respects manual pause states.
 *
 * @param query - Search query string.
 * @param options - Additional search options including pagination and caching settings.
 * @returns Promise resolving to search results.
 * @throws Propagates search errors after exhausting retries.
 * @source
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
