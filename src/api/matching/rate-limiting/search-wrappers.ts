/**
 * Rate-limited search operation wrappers.
 *
 * Provides search functions with automatic rate limiting,
 * manual pause support, and delegated retry logic through the queue processor.
 *
 * @packageDocumentation
 * @source
 */

import type { AniListManga, SearchResult } from "@/api/anilist/types";
import { searchManga } from "@/api/anilist/client";
import { waitWhileManuallyPaused } from "./manual-pause";
import { acquireRateLimit } from "./queue-processor";

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
