/**
 * Manga search service - Main public API
 * @module matching/search-service
 *
 * This is the main entry point for manga search and matching operations.
 * Provides a clean, streamlined API that coordinates all the specialized modules.
 */

import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type {
  SearchServiceConfig,
  MangaSearchResponse,
  MangaMatch,
} from "./orchestration/types";
import type {
  ComickSourceStorage,
  MangaDexSourceStorage,
  UncachedMangaConfig,
  UncachedMangaControl,
} from "./batching/types";
import { DEFAULT_SEARCH_CONFIG } from "./orchestration/types";
import { searchMangaByTitle as orchestratedSearch } from "./orchestration";
import { syncWithClientCache, generateCacheKey, isCacheValid } from "./cache";
import {
  categorizeMangaForBatching,
  processKnownMangaIds,
  processBatchedUncachedManga,
  compileMatchResults,
  handleCancellationResults,
} from "./batching";
import { calculateMatchScore } from "./scoring";
import { findBestMatches } from "./match-engine";
import { getMangaByIds } from "@/api/anilist/client";
import { withGroupAsync } from "@/utils/logging";
import { CancelledError, captureError, ErrorType } from "@/utils/errorHandling";

/**
 * Checks if an error is a rate limit error (429).
 *
 * @param error - Error to check
 * @returns True if error is a rate limit error
 */
function isRateLimitError(
  error: unknown,
): error is { status?: number; isRateLimited?: boolean; retryAfter?: number } {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorObj = error as Record<string, unknown>;

  const hasRateLimitFlag =
    "isRateLimited" in errorObj && errorObj.isRateLimited === true;
  const hasStatus429 = "status" in errorObj && errorObj.status === 429;

  return hasRateLimitFlag || hasStatus429;
}

/**
 * Checks if operation should be cancelled due to abort signal or cancellation request.
 * Throws CancelledError if cancellation is detected.
 *
 * @param abortSignal - Optional abort signal
 * @param shouldCancel - Optional cancellation function
 * @param context - Context message for error logging
 */
function checkCancellationState(
  abortSignal: AbortSignal | undefined,
  shouldCancel: (() => boolean) | undefined,
  context: string,
): void {
  if (abortSignal?.aborted) {
    console.info(`[MangaSearchService] ${context}: Aborted by signal`);
    throw new CancelledError("Operation aborted by abort signal");
  }

  if (shouldCancel?.()) {
    console.info(`[MangaSearchService] ${context}: Cancelled by user`);
    throw new CancelledError("Operation cancelled by user");
  }
}

/**
 * Waits for rate limit to clear with cancellation support.
 *
 * @param retryAfterSeconds - Seconds to wait
 * @param abortSignal - Optional abort signal
 */
async function waitForRateLimitClear(
  retryAfterSeconds: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  const waitUntil = Date.now() + retryAfterSeconds * 1000;

  while (Date.now() < waitUntil) {
    // Check if we should cancel
    if (abortSignal?.aborted) {
      throw new CancelledError("Operation aborted during rate limit wait");
    }
    // Check if rate limit has been cleared via global state
    if (globalThis.matchingProcessState?.wasRateLimitPaused === false) {
      console.info(
        "[MangaSearchService] 🟢 Rate limit cleared, retrying batch processing",
      );
      break;
    }
    // Wait a short interval before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/**
 * Processes uncached manga with automatic rate limit retry and exponential backoff.
 *
 * @param params - Processing parameters
 * @param config - Search and token configuration
 * @param cancellation - Abort signal and cancellation function
 * @param progress - Progress callback
 * @param cache - Cached results storage
 */
async function processMangaWithRateLimit(
  params: {
    uncachedManga: { index: number; manga: KenmeiManga }[];
    mangaList: KenmeiManga[];
    reportedIndices: Set<number>;
  },
  config: UncachedMangaConfig,
  cancellation: UncachedMangaControl,
  progress: {
    updateProgress: (index: number, title?: string) => void;
  },
  cache: {
    cachedResults: Record<number, AniListManga[]>;
    cachedComickSources: ComickSourceStorage;
    cachedMangaDexSources: MangaDexSourceStorage;
  },
): Promise<void> {
  const MAX_RATE_LIMIT_RETRIES = 3;
  let rateLimitRetryCount = 0;

  while (true) {
    try {
      await processBatchedUncachedManga(
        {
          uncachedManga: params.uncachedManga,
          mangaList: params.mangaList,
          reportedIndices: params.reportedIndices,
        },
        config,
        cancellation,
        progress,
        cache,
      );
      break; // Success, exit retry loop
    } catch (error) {
      const isRateLimit = isRateLimitError(error);

      if (isRateLimit && rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES) {
        rateLimitRetryCount++;
        const retryAfterSeconds =
          (error as { retryAfter?: number }).retryAfter || 60;

        console.warn(
          `[MangaSearchService] ⏸️ Rate limited (429). Retry ${rateLimitRetryCount}/${MAX_RATE_LIMIT_RETRIES} after ${retryAfterSeconds}s`,
        );

        // Respect abort signal and shouldCancel before waiting
        cancellation.checkCancellation();

        // Wait for the rate limit to clear
        await waitForRateLimitClear(
          retryAfterSeconds,
          cancellation.abortSignal,
        );

        // Retry the operation
        continue;
      }

      console.warn("[MangaSearchService] Processing failed:", error);

      // If we got here due to cancellation, return partial results
      if (error instanceof CancelledError) {
        console.info(
          "[MangaSearchService] Cancellation detected, returning partial results",
        );
        throw error;
      }

      // If it's a different kind of error or max retries exceeded, rethrow it
      throw error;
    }
  }
}

/**
 * Attempt to execute matching using workers with automatic fallback.
 *
 * @param kenmeiManga - Manga to match
 * @param potentialMatches - Array of potential AniList matches
 * @param config - Match engine configuration
 * @param useWorkers - Whether to attempt worker usage
 * @returns Promise resolving to match result, or null if workers unavailable
 */
async function tryMatchWithWorkers(
  kenmeiManga: KenmeiManga,
  potentialMatches: MangaMatch[],
  config: Partial<SearchServiceConfig>,
  useWorkers = true,
): Promise<MangaMatchResult | null> {
  if (!useWorkers) return null;

  try {
    const { executeMatchingWithWorkers } = await import("@/workers");

    // Build candidates map for worker
    const candidatesMap = new Map<string, AniListManga[]>();
    candidatesMap.set(
      "0",
      potentialMatches.map((match) => match.manga),
    );

    // Execute matching with workers
    const execution = executeMatchingWithWorkers(
      [kenmeiManga],
      candidatesMap,
      config.matchConfig || {},
    );

    const workerResults = await execution.promise;

    if (workerResults && workerResults.length > 0) {
      return workerResults[0];
    }
  } catch (error) {
    console.warn(
      "[MangaSearchService] Worker execution failed for single manga, falling back to main thread:",
      error,
    );
  }

  return null;
}

/**
 * Searches AniList for manga by title with caching and rate limiting.
 *
 * Main entry point using cache-first strategy, rate-limited API calls, result ranking,
 * fallback sources (Comick, MangaDex), and confidence scoring.
 *
 * @param title - Manga title to search for.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration overrides.
 * @param abortSignal - Optional abort signal to cancel the search.
 * @param specificPage - Optional specific page number (disables pagination).
 * @param kenmeiManga - Optional Kenmei manga entry for context.
 * @returns Promise resolving to manga search response with matches.
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
  return orchestratedSearch(
    title,
    token,
    config,
    abortSignal,
    specificPage,
    kenmeiManga,
  );
}

/**
 * Matches a single Kenmei manga with AniList entries using title similarity.
 *
 * Searches for potential matches and applies the match engine to find the best candidate.
 *
 * @param kenmeiManga - Kenmei manga entry to match.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration overrides.
 * @returns Promise resolving to MangaMatchResult with best matches and status.
 * @source
 */
export async function matchSingleManga(
  kenmeiManga: KenmeiManga,
  token?: string,
  config: Partial<SearchServiceConfig> = {},
): Promise<MangaMatchResult> {
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

  // Search for potential matches
  const searchResponse = await searchMangaByTitle(
    kenmeiManga.title,
    token,
    searchConfig,
    undefined,
    undefined,
    kenmeiManga,
  );

  const potentialMatches = searchResponse.matches;

  // If using exact matching and we have matches, just use the top match
  if (searchConfig.exactMatchingOnly && potentialMatches.length > 0) {
    // Calculate a match score for the top result
    const score = calculateMatchScore(
      potentialMatches[0].manga,
      kenmeiManga.title,
    );

    // If we have a good match, return it directly
    if (score > 0.7) {
      return {
        kenmeiManga,
        anilistMatches: [
          { manga: potentialMatches[0].manga, confidence: score * 100 },
        ],
        selectedMatch: potentialMatches[0].manga,
        status: "matched",
        matchDate: new Date().toISOString(),
      };
    }
  }

  // Try using workers for parallel processing if enabled
  const workerResult = await tryMatchWithWorkers(
    kenmeiManga,
    potentialMatches,
    searchConfig,
    searchConfig.useWorkers,
  );

  if (workerResult) {
    return workerResult;
  }

  // Fallback: Use main thread
  return findBestMatches(
    kenmeiManga,
    potentialMatches.map((match) => match.manga),
    searchConfig.matchConfig,
  );
}

/**
 * Matches multiple Kenmei manga entries efficiently using batch operations.
 *
 * Uses cached results, batch ID fetching, and sequential searches for uncached entries.
 * Supports cancellation with partial results return and progress tracking.
 *
 * @param mangaList - Kenmei manga to match.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration overrides.
 * @param progressCallback - Optional callback for progress updates (current, total, currentTitle).
 * @param shouldCancel - Optional function to check for cancellation request.
 * @param abortSignal - Optional abort signal to cancel the operation.
 * @returns Promise resolving to array of MangaMatchResult objects.
 * @throws {CancelledError} If operation is cancelled or aborted.
 * @source
 */
export async function batchMatchManga(
  mangaList: KenmeiManga[],
  token?: string,
  config: Partial<SearchServiceConfig> = {},
  progressCallback?: (
    current: number,
    total: number,
    currentTitle?: string,
  ) => void,
  shouldCancel?: () => boolean,
  abortSignal?: AbortSignal,
): Promise<MangaMatchResult[]> {
  return withGroupAsync(
    `[MangaSearchService] Batch Match (${mangaList.length} manga)`,
    async () => {
      // Ensure we have the latest cache data
      syncWithClientCache();

      const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

      // Create a set to track which manga have been reported in the progress
      const reportedIndices = new Set<number>();

      // Declare cache variables in outer scope for access in catch block
      let cachedResults: Record<number, AniListManga[]> = {};
      let cachedComickSources: ComickSourceStorage = {};
      let cachedMangaDexSources: MangaDexSourceStorage = {};

      // Update progress with deduplication
      const updateProgress = (index: number, title?: string) => {
        if (progressCallback && !reportedIndices.has(index)) {
          reportedIndices.add(index);
          progressCallback(reportedIndices.size, mangaList.length, title);
        }
      };

      // Simplified cancellation check
      const checkCancellation = () => {
        checkCancellationState(abortSignal, shouldCancel, "Batch matching");
      };

      try {
        console.info(
          `[MangaSearchService] 🚀 Starting batch matching for ${mangaList.length} manga entries`,
        );

        // Categorize manga based on cache status
        const result = categorizeMangaForBatching(
          mangaList,
          searchConfig,
          updateProgress,
        );
        cachedResults = result.cachedResults;
        cachedComickSources = result.cachedComickSources;
        cachedMangaDexSources = result.cachedMangaDexSources;
        const { uncachedManga, knownMangaIds } = result;

        console.debug(
          `[MangaSearchService] 🔍 Categorization: ${Object.keys(cachedResults).length} cached, ${uncachedManga.length} uncached, ${knownMangaIds.length} known IDs`,
        );

        // Check for cancellation
        checkCancellation();

        // Process manga with known IDs first
        await processKnownMangaIds(
          { knownMangaIds, mangaList, uncachedManga },
          { searchConfig, token },
          { shouldCancel, abortSignal },
          { updateProgress },
          { cachedResults, cachedComickSources, cachedMangaDexSources },
        );

        // Check for cancellation
        checkCancellation();

        // Process uncached manga using batched GraphQL queries with automatic rate limit handling
        await processMangaWithRateLimit(
          { uncachedManga, mangaList, reportedIndices },
          { token, searchConfig },
          { abortSignal, checkCancellation },
          { updateProgress },
          { cachedResults, cachedComickSources, cachedMangaDexSources },
        );

        // Check for cancellation after the batch completes
        checkCancellation();

        console.debug(
          "[MangaSearchService] 🔍 Compiling final match results...",
        );

        // Compile final results
        const finalResults = await compileMatchResults(
          mangaList,
          cachedResults,
          cachedComickSources,
          cachedMangaDexSources,
          checkCancellation,
          updateProgress,
          searchConfig.useWorkers,
        );

        console.info(
          `[MangaSearchService] ✅ Batch matching complete: ${finalResults.length} results`,
        );

        return finalResults;
      } catch (error) {
        console.error(
          "[MangaSearchService] ❌ Error in batch matching process:",
          error,
        );

        // If we got here due to cancellation, return whatever partial results we have
        if (error instanceof CancelledError) {
          console.info(
            `[MangaSearchService] Cancellation detected, returning partial results`,
          );
          // Log cancellation as info message, not an exception
          import("@sentry/electron/renderer")
            .then((Sentry) => {
              Sentry.captureMessage("Batch matching cancelled by user", "info");
            })
            .catch(() => {
              // Silently ignore Sentry import errors
            });
          // Return partial results we've gathered so far
          return handleCancellationResults(mangaList, cachedResults);
        }

        // For non-cancellation errors, capture to Sentry
        captureError(ErrorType.UNKNOWN, "Batch manga matching failed", error, {
          mangaListLength: mangaList.length,
          searchConfig: {
            confidenceThreshold: config.matchConfig?.confidenceThreshold,
          },
          stage: "batch_match",
        });

        // Otherwise rethrow the error
        throw error;
      }
    },
  );
}

/**
 * Preloads common manga titles into the cache.
 *
 * Searches and caches frequently accessed titles to reduce subsequent API calls.
 * Skips titles already in cache.
 *
 * @param titles - Array of manga titles to preload.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration overrides.
 * @returns Promise resolving when preloading is complete.
 * @source
 */
export async function preloadCommonManga(
  titles: string[],
  token?: string,
  config: Partial<SearchServiceConfig> = {},
): Promise<void> {
  console.info(
    `[MangaSearchService] 📥 Preloading ${titles.length} common manga titles...`,
  );
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

  // Process in batches to respect rate limits
  let preloadedCount = 0;

  for (let i = 0; i < titles.length; i += searchConfig.batchSize) {
    const batch = titles.slice(i, i + searchConfig.batchSize);

    // Process batch items in sequence with rate limiting
    for (const title of batch) {
      const cacheKey = generateCacheKey(title);

      // Only search if not already in cache
      if (!isCacheValid(cacheKey)) {
        await searchMangaByTitle(title, token, searchConfig);
        preloadedCount++;
      }
    }
  }

  console.info(
    `[MangaSearchService] ✅ Preloading complete: ${preloadedCount} new titles cached`,
  );
}

/**
 * Fetches multiple manga by AniList ID in batches with cancellation support.
 *
 * Processes IDs in groups of 25 (API limit) with cancellation checks between batches.
 * Continues processing even if individual batches fail.
 *
 * @param ids - Array of AniList manga IDs to fetch.
 * @param token - Optional authentication token.
 * @param shouldCancel - Optional function to check for cancellation request.
 * @param abortSignal - Optional abort signal to cancel the operation.
 * @returns Promise resolving to array of AniListManga objects.
 * @throws {CancelledError} If operation is cancelled or aborted.
 * @source
 */
export async function getBatchedMangaIds(
  ids: number[],
  token?: string,
  shouldCancel?: () => boolean,
  abortSignal?: AbortSignal,
): Promise<AniListManga[]> {
  return withGroupAsync(
    `[MangaSearchService] Fetch Batched IDs (${ids.length} IDs)`,
    async () => {
      if (!ids.length) return [];

      // Check for cancellation
      if (shouldCancel?.()) {
        throw new CancelledError("Operation cancelled by user");
      }

      // Abort if signal is aborted
      if (abortSignal?.aborted) {
        throw new CancelledError("Operation aborted by abort signal");
      }

      const results: AniListManga[] = [];
      const batchSize = 25; // AniList allows 25 ids per request

      // Process in batches to avoid overloading the API
      for (let i = 0; i < ids.length; i += batchSize) {
        // Check for cancellation between batches
        if (shouldCancel?.()) {
          throw new CancelledError("Operation cancelled by user");
        }

        // Abort if signal is aborted
        if (abortSignal?.aborted) {
          throw new CancelledError("Operation aborted by abort signal");
        }

        const batchIds = ids.slice(i, i + batchSize);
        try {
          const batchResults = await getMangaByIds(
            batchIds,
            token,
            abortSignal,
          );
          results.push(...batchResults);
        } catch (error) {
          console.error(
            `[MangaSearchService] ❌ Error fetching manga batch ${i} to ${i + batchSize}:`,
            error,
          );
          captureError(
            ErrorType.UNKNOWN,
            `Failed to fetch manga batch`,
            error,
            {
              batchNumber: Math.floor(i / batchSize),
              batchSize: batchIds.length,
              totalIds: ids.length,
              stage: "batch_fetch",
            },
          );
          // Continue with next batch even if one fails
        }
      }

      return results;
    },
  );
}

// Re-export types and utilities for convenience
export type {
  SearchServiceConfig,
  MangaSearchResponse,
  MangaMatch,
} from "./orchestration/types";
export { DEFAULT_SEARCH_CONFIG } from "./orchestration/types";
export { clearMangaCache, clearCacheForTitles, cacheDebugger } from "./cache";
export { initializeMangaService } from "./cache";
export { isOneShot } from "./normalization";
export {
  setManualMatchingPause,
  isManualMatchingPaused,
} from "./rate-limiting";
