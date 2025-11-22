/**
 * Batched search processing for multiple manga
 * @module matching/batching/batch-search
 */

import type { AniListManga } from "@/api/anilist/types";
import type {
  UncachedMangaData,
  UncachedMangaConfig,
  UncachedMangaControl,
  UpdateProgressCallbacks,
  CachedResultsStorage,
} from "./types";
import { generateCacheKey, isCacheValid, mangaCache } from "../cache";
import { batchSearchManga } from "@/api/anilist/client";
import { withGroupAsync } from "@/utils/logging";
import { CancelledError } from "@/utils/error-handling";
import { ANILIST_RATE_LIMIT_PER_MINUTE } from "@/config/anilist";
import { executeComickFallback, executeMangaDexFallback } from "../sources";
import type { SearchServiceConfig as OrchestratorSearchServiceConfig } from "../orchestration/types";
import { performExtraSearches } from "../orchestration/search-orchestrator";
import { filterOutBlacklistedManga } from "../filtering/blacklist";

/**
 * Batch size for parallel manga searches (10 = AniList 30 req/min official limit; tuned to safe parallelism)
 * @source
 */
const BATCH_SIZE = 10;

/**
 * Time window for rate limit budget (ms in one minute).
 * @source
 */
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Minimum delay between batches (milliseconds) to ensure responsiveness.
 * @source
 */
const MIN_BATCH_DELAY_MS = 250;

/**
 * Maximum delay between batches (milliseconds) to prevent excessive waiting.
 * @source
 */
const MAX_BATCH_DELAY_MS = 1500;

/**
 * Calculate adaptive inter-batch delay based on request count.
 *
 * Determines an initial delay between batches to respect API rate limits while
 * maximizing throughput. Formula: delay = (requests × 60000) / ANILIST_RATE_LIMIT_PER_MINUTE
 * This uses a literal 60000ms per minute to clearly express the intent.
 *
 * @param requestCount - Number of API requests in this batch (1 for main query + fallback count).
 * @returns Delay in milliseconds, clamped between MIN_BATCH_DELAY_MS and MAX_BATCH_DELAY_MS.
 * @source
 */
function calculateAdaptiveBatchDelay(requestCount: number): number {
  // Start with base calculated delay
  let delayMs =
    (requestCount * RATE_LIMIT_WINDOW_MS) / ANILIST_RATE_LIMIT_PER_MINUTE;

  // Clamp to reasonable bounds to avoid excessive delays or premature throttling
  delayMs = Math.max(MIN_BATCH_DELAY_MS, Math.min(delayMs, MAX_BATCH_DELAY_MS));

  console.debug(
    `[MangaSearchService] ⏱️ Adaptive batch delay: ${Math.round(delayMs)}ms (requests: ${requestCount})`,
  );

  return delayMs;
}

/** Batch item type from uncached manga array. @source */
type BatchItem = UncachedMangaData["uncachedManga"][number];

/**
 * Generate GraphQL alias for a given manga index in a batch query.
 * Uses explicit naming to make intent clear across the codebase.
 * @param index - Manga position in batch.
 * @returns Alias string formatted as `manga_{index}`.
 * @source
 */
function generateMangaAlias(index: number): string {
  return `manga_${index}`;
}

/**
 * Validates operation is not aborted or cancelled, throws if it is.
 * @param abortSignal - Optional abort signal.
 * @param checkCancellation - Cancellation check function.
 * @throws {CancelledError} If aborted or user cancelled operation.
 * @source
 */
function ensureNotCancelled(
  abortSignal: AbortSignal | undefined,
  checkCancellation: () => void,
): void {
  if (abortSignal?.aborted) {
    throw new CancelledError("Operation aborted by abort signal");
  }

  checkCancellation();
}

/**
 * Initialize empty source maps for Comick and MangaDex at manga index.
 * @param index - Manga index.
 * @param storage - Storage object with source maps.
 * @source
 */
function initializeSourceMaps(
  index: number,
  storage: Pick<
    CachedResultsStorage,
    "cachedComickSources" | "cachedMangaDexSources"
  >,
): void {
  storage.cachedComickSources[index] = new Map();
  storage.cachedMangaDexSources[index] = new Map();
}

/**
 * Store AniList results and initialize source maps for manga index.
 * @param index - Manga index.
 * @param media - Array of AniList manga results.
 * @param storage - Storage object to update.
 * @source
 */
function storeAniListResults(
  index: number,
  media: AniListManga[],
  storage: CachedResultsStorage,
): AniListManga[] {
  const sanitizedMedia = filterOutBlacklistedManga(media);
  storage.cachedResults[index] = sanitizedMedia;
  storage.cachedFallbackIndices.delete(index);
  initializeSourceMaps(index, storage);
  return sanitizedMedia;
}

/**
 * Execute fallback searches on alternative sources (Comick/MangaDex) for items not found.
 * @param items - Batch items requiring fallback searches.
 * @param options - Configuration, control, callbacks, and storage.
 * @returns Promise resolving when all fallback searches complete.
 * @throws May throw if cancellation signalled.
 * @source
 */
async function performFallbackSearches(
  items: BatchItem[],
  options: {
    token?: string;
    searchConfig: UncachedMangaConfig["searchConfig"];
    abortSignal?: AbortSignal;
    checkCancellation: () => void;
    storage: CachedResultsStorage;
    updateProgress: (index: number, title?: string) => void;
  },
): Promise<void> {
  return withGroupAsync(
    `[MangaSearchService] Fallback Searches (${items.length} items)`,
    async () => {
      if (items.length === 0) {
        return;
      }

      const {
        token,
        searchConfig,
        abortSignal,
        checkCancellation,
        storage,
        updateProgress,
      } = options;

      for (const { manga, index } of items) {
        await withGroupAsync(
          `[MangaSearchService] Fallback: "${manga.title}" (Alternative Sources Only)`,
          async () => {
            try {
              ensureNotCancelled(abortSignal, checkCancellation);

              // Search ONLY alternative sources (Comick, MangaDex)
              // Skip AniList individual search since we already did batch search
              let finalResults: AniListManga[] = [];

              // Create compatible config for fallback functions
              const fallbackConfig: OrchestratorSearchServiceConfig = {
                matchConfig: {},
                batchSize: 10,
                searchPerPage: 10,
                maxSearchResults: 50,
                enablePreSearch: false,
                exactMatchingOnly: false,
                bypassCache: searchConfig.bypassCache,
                enableComickSearch: searchConfig.enableComickSearch,
                enableMangaDexSearch: searchConfig.enableMangaDexSearch,
              };

              const comickFallback = await executeComickFallback(
                manga.title,
                token,
                [],
                fallbackConfig,
              );

              const mangaDexFallback = await executeMangaDexFallback(
                manga.title,
                token,
                comickFallback.results,
                fallbackConfig,
              );

              ensureNotCancelled(abortSignal, checkCancellation);

              finalResults = mangaDexFallback.results;

              // Store combined results from alternative sources
              const sanitizedFallbackResults =
                filterOutBlacklistedManga(finalResults);
              storage.cachedResults[index] = sanitizedFallbackResults;
              storage.cachedComickSources[index] =
                comickFallback.comickSourceMap;
              storage.cachedMangaDexSources[index] =
                mangaDexFallback.mangaDexSourceMap;
              if (sanitizedFallbackResults.length > 0) {
                storage.cachedFallbackIndices.add(index);
              } else {
                storage.cachedFallbackIndices.delete(index);
              }

              console.debug(
                `[MangaSearchService] 🔁 Alternative sources found ${sanitizedFallbackResults.length} matches for "${manga.title}" (Comick: ${comickFallback.comickSourceMap.size}, MangaDex: ${mangaDexFallback.mangaDexSourceMap.size})`,
              );
            } catch (error) {
              console.error(
                `[MangaSearchService] ❌ Error in fallback search for "${manga.title}":`,
                error,
              );
              // Store empty result on error to maintain consistent state
              storage.cachedResults[index] = [];
              storage.cachedComickSources[index] = new Map();
              storage.cachedMangaDexSources[index] = new Map();
            } finally {
              // Always report progress, even on error
              updateProgress(index, manga.title);
            }
          },
        );
      }
    },
  );
}

type BatchSearchResultEntry = {
  media: AniListManga[];
  index: number;
  title: string;
};

type BatchItemProcessingContext = {
  token?: string;
  searchConfig: UncachedMangaConfig["searchConfig"];
  abortSignal?: AbortSignal;
  checkCancellation: () => void;
  storage: CachedResultsStorage;
  updateProgress: (index: number, title?: string) => void;
};

function handleBatchSearchMatches(
  index: number,
  title: string,
  media: AniListManga[],
  storage: CachedResultsStorage,
  updateProgress: (index: number, title?: string) => void,
): boolean {
  const sanitizedMatches = storeAniListResults(index, media, storage);

  if (sanitizedMatches.length > 0) {
    updateProgress(index, title);
    console.debug(
      `[MangaSearchService] ✅ Batch search found ${sanitizedMatches.length} matches for "${title}"`,
    );
    return true;
  }

  console.debug(
    `[MangaSearchService] ⚠️ Batch search filtered out all ${media.length} AniList matches for "${title}" due to blacklist`,
  );
  return false;
}

async function attemptExtraTitleSearches(
  item: BatchItem,
  context: BatchItemProcessingContext,
): Promise<boolean> {
  if (!context.searchConfig.matchConfig?.enableExtraTitleSearches) {
    return false;
  }

  const { manga, index } = item;
  const {
    abortSignal,
    checkCancellation,
    storage,
    updateProgress,
    searchConfig,
    token,
  } = context;

  try {
    ensureNotCancelled(abortSignal, checkCancellation);

    const extraResults = await performExtraSearches(
      manga.title,
      searchConfig,
      token,
      abortSignal,
      undefined,
      manga,
      [],
    );

    if (extraResults.length === 0) {
      return false;
    }

    const sanitizedMatches = storeAniListResults(index, extraResults, storage);

    if (sanitizedMatches.length > 0) {
      updateProgress(index, manga.title);
      console.debug(
        `[MangaSearchService] ✅ Extra search found ${sanitizedMatches.length} matches for "${manga.title}"`,
      );
      return true;
    }
  } catch (error) {
    console.warn(
      `[MangaSearchService] ⚠️ Extra search failed for "${manga.title}":`,
      error,
    );
  }

  return false;
}

async function processBatchItem(
  item: BatchItem,
  batchResults: Map<string, BatchSearchResultEntry>,
  context: BatchItemProcessingContext,
): Promise<boolean> {
  ensureNotCancelled(context.abortSignal, context.checkCancellation);

  const { manga, index } = item;
  const alias = generateMangaAlias(index);
  const result = batchResults.get(alias);

  if (result?.media?.length) {
    const hasMatches = handleBatchSearchMatches(
      index,
      manga.title,
      result.media,
      context.storage,
      context.updateProgress,
    );

    if (hasMatches) {
      return true;
    }
  } else {
    console.debug(
      `[MangaSearchService] ⚠️ Batch search returned no results for "${manga.title}"`,
    );
  }

  return attemptExtraTitleSearches(item, context);
}

/**
 * Context object for batch processing operations.
 * @source
 */
type BatchProcessingContext = {
  token?: string;
  searchConfig: UncachedMangaConfig["searchConfig"];
  abortSignal?: AbortSignal;
  checkCancellation: () => void;
  updateProgress: (index: number, title?: string) => void;
  storage: CachedResultsStorage;
  batchNumber: number;
  totalBatches: number;
  hasMoreBatches: boolean;
};

/**
 * Process single batch via batched GraphQL queries with fallback support.
 * @param batch - Items with manga and indices.
 * @param context - Processing context with config, callbacks, storage.
 * @returns Promise resolving when batch processing completes.
 * @throws May throw if cancellation signalled or API requests fail.
 * @source
 */
async function processBatch(
  batch: BatchItem[],
  context: BatchProcessingContext,
): Promise<void> {
  return withGroupAsync(
    `[MangaSearchService] Batch ${context.batchNumber}/${context.totalBatches}`,
    async () => {
      const {
        token,
        searchConfig,
        abortSignal,
        checkCancellation,
        updateProgress,
        storage,
        batchNumber,
        totalBatches,
        hasMoreBatches,
      } = context;

      console.debug(
        `[MangaSearchService] 📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} manga)`,
      );

      try {
        const batchResults = await batchSearchManga(
          batch.map(({ manga, index }) => ({
            alias: generateMangaAlias(index),
            title: manga.title,
            index,
          })),
          {
            token,
            perPage: 10,
            abortSignal,
          },
        );

        const fallbackCandidates: BatchItem[] = [];
        const batchItemContext: BatchItemProcessingContext = {
          token,
          searchConfig,
          abortSignal,
          checkCancellation,
          storage,
          updateProgress,
        };

        for (const item of batch) {
          const foundMatches = await processBatchItem(
            item,
            batchResults,
            batchItemContext,
          );

          if (!foundMatches) {
            fallbackCandidates.push(item);
            storeAniListResults(item.index, [], storage);
          }
        }

        await performFallbackSearches(fallbackCandidates, {
          token,
          searchConfig,
          abortSignal,
          checkCancellation,
          storage,
          updateProgress,
        });

        console.info(
          `[MangaSearchService] ✅ Batch ${batchNumber}/${totalBatches} processed`,
        );
        console.debug(fallbackCandidates);

        if (hasMoreBatches) {
          // Track requests in this batch: 1 main batched query + fallback searches
          const requestsInBatch = 1 + fallbackCandidates.length;

          // Calculate adaptive delay based on request count and rate limit budget
          const delayMs = calculateAdaptiveBatchDelay(requestsInBatch);

          console.debug(
            `[MangaSearchService] Waiting ${Math.round(delayMs)}ms before next batch...`,
          );

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(
          `[MangaSearchService] ❌ Error processing batch ${batchNumber}:`,
          error,
        );

        if (error instanceof CancelledError) {
          throw error;
        }

        // Report progress for all items in failed batch
        for (const { manga, index } of batch) {
          storage.cachedResults[index] = [];
          initializeSourceMaps(index, storage);
          updateProgress(index, manga.title);
        }

        console.warn(
          `[MangaSearchService] ⚠️ Continuing with next batch after error`,
        );
      }
    },
  );
}

/**
 * Process uncached manga using batched GraphQL queries with fallback searches.
 *
 * Divides uncached manga into batches (per batch size controlled by BATCH_SIZE) respecting AniList's rate limits.
 * Performs batched GraphQL queries and fallback searches on Comick/MangaDex for misses.
 * Supports early termination, abort signals, and cancellation checks.
 *
 * @param data - Uncached manga items with indices.
 * @param config - AniList token and search config.
 * @param control - Abort signal and cancellation check.
 * @param callbacks - Progress update callbacks.
 * @param storage - Results, source maps, and cache storage.
 * @throws May throw on API failures or cancellation.
 * @source
 */
export async function processBatchedUncachedManga(
  data: UncachedMangaData,
  config: UncachedMangaConfig,
  control: UncachedMangaControl,
  callbacks: UpdateProgressCallbacks,
  storage: CachedResultsStorage,
): Promise<void> {
  return withGroupAsync(
    `[MangaSearchService] Batched Search (${data.uncachedManga.length} manga, ${Math.ceil(data.uncachedManga.length / BATCH_SIZE)} batches)`,
    async () => {
      const { uncachedManga } = data;
      const { token, searchConfig } = config;
      const { abortSignal, checkCancellation } = control;
      const { updateProgress } = callbacks;

      if (uncachedManga.length === 0) {
        return;
      }

      console.info(
        `[MangaSearchService] 🚀 Processing ${uncachedManga.length} uncached manga with batched queries (batch size: ${BATCH_SIZE})`,
      );

      // Filter out anything that became cached since categorization ran.
      const trulyUncachedManga = uncachedManga.filter(({ manga, index }) => {
        const cacheKey = generateCacheKey(manga.title);

        if (!searchConfig.bypassCache && isCacheValid(cacheKey)) {
          storage.cachedResults[index] = mangaCache[cacheKey].manga;
          initializeSourceMaps(index, storage);
          updateProgress(index, manga.title);
          return false;
        }

        return true;
      });

      if (trulyUncachedManga.length === 0) {
        console.info(
          `[MangaSearchService] ✅ All uncached manga were found in cache, skipping batch search`,
        );
        return;
      }

      console.info(
        `[MangaSearchService] 🔍 ${trulyUncachedManga.length} manga need AniList queries`,
      );

      const totalBatches = Math.ceil(trulyUncachedManga.length / BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        ensureNotCancelled(abortSignal, checkCancellation);

        const start = batchIndex * BATCH_SIZE;
        const batch = trulyUncachedManga.slice(start, start + BATCH_SIZE);

        await processBatch(batch, {
          token,
          searchConfig,
          abortSignal,
          checkCancellation,
          updateProgress,
          storage,
          batchNumber: batchIndex + 1,
          totalBatches,
          hasMoreBatches: batchIndex + 1 < totalBatches,
        });
      }

      console.info(
        `[MangaSearchService] ✅ Batched processing complete for ${trulyUncachedManga.length} manga`,
      );
    },
  );
}
