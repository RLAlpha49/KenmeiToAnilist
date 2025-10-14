/**
 * @file Manga search service - Main public API
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
} from "./orchestration/types";
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

/**
 * Search for manga by title with rate limiting and caching
 *
 * Main entry point for searching manga on AniList. Supports:
 * - Cache-first strategy (unless bypassed)
 * - Rate-limited API calls
 * - Result ranking and filtering
 * - Fallback sources (Comick, MangaDex)
 * - Confidence scoring
 *
 * @param title - The manga title to search for
 * @param token - Optional authentication token
 * @param config - Optional search service configuration
 * @param abortSignal - Optional abort signal to cancel the search
 * @param specificPage - Optional specific page number (disables pagination)
 * @returns Promise resolving to manga search response with matches
 *
 * @example
 * ```typescript
 * const results = await searchMangaByTitle("One Piece", token);
 * console.log(`Found ${results.matches.length} matches`);
 * ```
 */
export async function searchMangaByTitle(
  title: string,
  token?: string,
  config: Partial<SearchServiceConfig> = {},
  abortSignal?: AbortSignal,
  specificPage?: number,
): Promise<MangaSearchResponse> {
  return orchestratedSearch(title, token, config, abortSignal, specificPage);
}

/**
 * Match a single Kenmei manga with AniList entries
 *
 * Searches for potential matches and uses the match engine to find
 * the best match based on title similarity and other factors.
 *
 * @param kenmeiManga - The Kenmei manga entry to match
 * @param token - Optional authentication token
 * @param config - Optional search service configuration
 * @returns Promise resolving to a MangaMatchResult object
 *
 * @example
 * ```typescript
 * const result = await matchSingleManga(kenmeiManga, token);
 * if (result.selectedMatch) {
 *   console.log(`Matched to: ${result.selectedMatch.title.romaji}`);
 * }
 * ```
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
        matchDate: new Date(),
      };
    }
  }

  // Fall back to the match engine for more complex matching or no exact matches
  return findBestMatches(
    kenmeiManga,
    potentialMatches.map((match) => match.manga),
    searchConfig.matchConfig,
  );
}

/**
 * Process matches for a batch of manga
 *
 * Efficiently matches multiple manga entries by:
 * - Using cached results when available
 * - Batch fetching manga with known IDs
 * - Sequential searching for uncached manga
 * - Supporting cancellation with partial results
 *
 * @param mangaList - List of Kenmei manga to match
 * @param token - Optional authentication token
 * @param config - Optional search service configuration
 * @param progressCallback - Optional callback to track progress
 * @param shouldCancel - Optional function to check if operation should cancel
 * @param abortSignal - Optional abort signal to cancel the operation
 * @returns Promise resolving to array of match results
 *
 * @example
 * ```typescript
 * const results = await batchMatchManga(
 *   mangaList,
 *   token,
 *   {},
 *   (current, total) => console.log(`Progress: ${current}/${total}`)
 * );
 * ```
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
  // Ensure we have the latest cache data
  syncWithClientCache();

  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

  // Create a set to track which manga have been reported in the progress
  const reportedIndices = new Set<number>();

  // Function to check if the operation should be cancelled
  const checkCancellation = () => {
    // Check the abort signal first
    if (abortSignal?.aborted) {
      console.info(
        "[MangaSearchService] Batch matching process aborted by abort signal",
      );
      throw new Error("Operation aborted by abort signal");
    }

    // Then check the cancellation function
    if (shouldCancel?.()) {
      console.info(
        "[MangaSearchService] Batch matching process cancelled by user",
      );
      throw new Error("Operation cancelled by user");
    }

    return false;
  };

  // Update progress with deduplication
  const updateProgress = (index: number, title?: string) => {
    if (progressCallback && !reportedIndices.has(index)) {
      reportedIndices.add(index);
      progressCallback(reportedIndices.size, mangaList.length, title);
    }
  };

  try {
    console.info(
      `[MangaSearchService] 🚀 Starting batch matching for ${mangaList.length} manga entries`,
    );

    // Categorize manga based on cache status
    const {
      cachedResults,
      cachedComickSources,
      cachedMangaDexSources,
      uncachedManga,
      knownMangaIds,
    } = categorizeMangaForBatching(mangaList, searchConfig, updateProgress);

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

    // Process uncached manga using batched GraphQL queries
    // This significantly reduces API calls by grouping multiple searches
    try {
      await processBatchedUncachedManga(
        { uncachedManga, mangaList, reportedIndices },
        { token, searchConfig },
        { abortSignal, checkCancellation },
        { updateProgress },
        { cachedResults, cachedComickSources, cachedMangaDexSources },
      );
    } catch (error) {
      console.warn("[MangaSearchService] Processing cancelled:", error);

      // If we got here due to cancellation, return the partial results we've managed to gather
      if (
        error instanceof Error &&
        (error.message.includes("cancelled") ||
          error.message.includes("aborted"))
      ) {
        console.info(
          `[MangaSearchService] Cancellation completed, returning partial results`,
        );

        return handleCancellationResults(mangaList, cachedResults);
      }

      // If it's a different kind of error, rethrow it
      throw error;
    }

    // Check for cancellation after the batch completes
    checkCancellation();

    console.debug("[MangaSearchService] 🔍 Compiling final match results...");

    // Compile final results
    const finalResults = compileMatchResults(
      mangaList,
      cachedResults,
      cachedComickSources,
      cachedMangaDexSources,
      checkCancellation,
      updateProgress,
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
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.message.includes("aborted"))
    ) {
      console.info(
        `[MangaSearchService] Cancellation detected, returning partial results`,
      );
      // We don't have access to the variables in this scope, so return empty array
      return [];
    }

    // Otherwise rethrow the error
    throw error;
  }
}

/**
 * Pre-search for common manga titles to populate cache
 *
 * Useful for warming up the cache with frequently searched titles.
 * Only searches titles that aren't already cached.
 *
 * @param titles - Array of manga titles to preload
 * @param token - Optional authentication token
 * @param config - Optional search service configuration
 * @returns Promise that resolves when preloading is complete
 *
 * @example
 * ```typescript
 * await preloadCommonManga(["One Piece", "Naruto", "Bleach"], token);
 * console.log("Cache preloaded!");
 * ```
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
 * Get manga by their AniList IDs in batches
 *
 * Efficiently fetches multiple manga by ID, respecting API limits
 * and supporting cancellation between batches.
 *
 * @param ids - Array of AniList manga IDs to fetch
 * @param token - Optional authentication token
 * @param shouldCancel - Optional function to check if operation should cancel
 * @param abortSignal - Optional abort signal to cancel the operation
 * @returns Promise resolving to array of manga
 *
 * @example
 * ```typescript
 * const manga = await getBatchedMangaIds([1, 2, 3, 4, 5], token);
 * console.log(`Fetched ${manga.length} manga`);
 * ```
 */
export async function getBatchedMangaIds(
  ids: number[],
  token?: string,
  shouldCancel?: () => boolean,
  abortSignal?: AbortSignal,
): Promise<AniListManga[]> {
  if (!ids.length) return [];

  // Check for cancellation
  if (shouldCancel?.()) {
    throw new Error("Operation cancelled by user");
  }

  // Abort if signal is aborted
  if (abortSignal?.aborted) {
    throw new Error("Operation aborted by abort signal");
  }

  const results: AniListManga[] = [];
  const batchSize = 25; // AniList allows 25 ids per request

  // Process in batches to avoid overloading the API
  for (let i = 0; i < ids.length; i += batchSize) {
    // Check for cancellation between batches
    if (shouldCancel?.()) {
      throw new Error("Operation cancelled by user");
    }

    // Abort if signal is aborted
    if (abortSignal?.aborted) {
      throw new Error("Operation aborted by abort signal");
    }

    const batchIds = ids.slice(i, i + batchSize);
    try {
      const batchResults = await getMangaByIds(batchIds, token, abortSignal);
      results.push(...batchResults);
    } catch (error) {
      console.error(
        `[MangaSearchService] Error fetching manga batch ${i} to ${i + batchSize}:`,
        error,
      );
      // Continue with next batch even if one fails
    }
  }

  return results;
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
