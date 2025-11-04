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
  /** Whether to bypass the search cache. */
  bypassCache?: boolean;
}

/**
 * Performs a search with rate limiting and automatic retry logic.
 *
 * Acquires a rate limit slot and executes the search. Transient errors are
 * re-queued via the rate limit processor's retry mechanism. The processor drives
 * all retries with exponential backoff, ensuring consistent spacing and no duplicate
 * backoff sleeps.
 *
 * @param query - Search query string.
 * @param page - Page number for pagination (default: 1).
 * @param perPage - Results per page (default: 50).
 * @param token - Optional authentication token.
 * @param acquireLimit - Whether to acquire rate limit slot (default: true).
 * @param bypassCache - Whether to bypass cache (default: false).
 * @returns Promise resolving to search results.
 * @throws Propagates search errors after exhausting retries via the queue processor.
 * @source
 */
export async function searchWithRateLimit(
  query: string,
  page: number = 1,
  perPage: number = 50,
  token?: string,
  acquireLimit: boolean = true,
  bypassCache: boolean = false,
): Promise<SearchResult<AniListManga>> {
  await waitWhileManuallyPaused();

  // Only wait for rate limit if requested (first request in a batch should wait, subsequent ones should not)
  if (acquireLimit) {
    await acquireRateLimit();
  }

  // Call the AniList client search function - this will handle caching in the client
  return await searchManga(query, page, perPage, token, bypassCache);
}

/**
 * Performs an advanced search with rate limiting and automatic retry logic.
 *
 * Similar to searchWithRateLimit but accepts flexible options. Acquires a rate limit slot
 * and executes the search. Transient errors are re-queued via the rate limit processor's retry
 * mechanism. The processor drives all retries with exponential backoff, ensuring consistent
 * spacing and no duplicate backoff sleeps.
 *
 * @param query - Search query string.
 * @param options - Additional search options including pagination and caching settings.
 * @returns Promise resolving to search results.
 * @throws Propagates search errors after exhausting retries via the queue processor.
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
    bypassCache = false,
  } = options;

  // Only wait for rate limit if requested
  if (acquireLimit) {
    await acquireRateLimit();
  }

  // Call the AniList client search function - this will handle caching in the client
  return await advancedSearchManga(query, page, perPage, token, bypassCache);
}
