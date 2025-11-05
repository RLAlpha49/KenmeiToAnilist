/**
 * Rate-limited search operation wrappers.
 *
 * Provides search and advanced search functions with automatic rate limiting,
 * manual pause support, and delegated retry logic through the queue processor.
 *
 * @packageDocumentation
 * @source
 */

import type { AniListManga, SearchResult } from "@/api/anilist/types";
import { searchManga, advancedSearchManga } from "@/api/anilist/client";
import { waitWhileManuallyPaused } from "./manual-pause";
import { acquireRateLimit } from "./queue-processor";

/**
 * Configuration options for rate-limited search operations.
 * @source
 */
export interface SearchRateLimitOptions {
  /** Page number for pagination (1-based). */
  page?: number;
  /** Number of results per page. */
  perPage?: number;
  /** Authentication token for private searches. */
  token?: string;
  /** Whether to acquire a rate limit slot before searching (default: true). */
  acquireLimit?: boolean;
  /** Whether to bypass the search cache (default: false). */
  bypassCache?: boolean;
}

/**
 * Perform a simple search with rate limiting.
 *
 * Waits for manual pause to be lifted, optionally acquires a rate limit slot,
 * then executes the search via the AniList client. Transient errors are handled
 * by the rate limit queue's retry mechanism.
 *
 * @param query - Search query string.
 * @param page - Page number (1-based, default: 1).
 * @param perPage - Results per page (default: 50).
 * @param token - Optional authentication token.
 * @param acquireLimit - Whether to acquire rate limit slot (default: true).
 * @param bypassCache - Whether to bypass cache (default: false).
 * @returns Promise resolving to search results.
 * @throws Propagates search errors after retries exhausted.
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
  // Wait for any active manual pause to be lifted
  await waitWhileManuallyPaused();

  // Only wait for rate limit on the first request in a batch to avoid double-waiting
  if (acquireLimit) {
    await acquireRateLimit();
  }

  // Execute the search (client handles caching independently)
  return await searchManga(query, page, perPage, token, bypassCache);
}

/**
 * Perform an advanced search with rate limiting and flexible options.
 *
 * Similar to searchWithRateLimit but accepts options as a single object.
 * Waits for manual pause, optionally acquires rate limit slot, then executes search.
 *
 * @param query - Search query string.
 * @param options - Search options (pagination, token, limits, cache).
 * @returns Promise resolving to search results.
 * @throws Propagates search errors after retries exhausted.
 * @source
 */
export async function advancedSearchWithRateLimit(
  query: string,
  options: SearchRateLimitOptions = {},
): Promise<SearchResult<AniListManga>> {
  // Wait for any active manual pause to be lifted
  await waitWhileManuallyPaused();

  const {
    page = 1,
    perPage = 50,
    token,
    acquireLimit = true,
    bypassCache = false,
  } = options;

  // Only wait for rate limit on the first request in a batch
  if (acquireLimit) {
    await acquireRateLimit();
  }

  // Execute the search (client handles caching independently)
  return await advancedSearchManga(query, page, perPage, token, bypassCache);
}
