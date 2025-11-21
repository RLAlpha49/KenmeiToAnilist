/**
 * Process uncached manga with concurrency control
 * @module matching/batching/uncached
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type {
  UncachedMangaData,
  UncachedMangaConfig,
  UncachedMangaControl,
  UpdateProgressCallbacks,
  CachedResultsStorage,
  SearchServiceConfig,
} from "./types";
import { generateCacheKey, isCacheValid, mangaCache } from "../cache";
import { filterOutBlacklistedManga } from "../filtering/blacklist";

/**
 * Maximum concurrent manga searches (1 = sequential for rate limit compliance).
 * Renamed to be explicit about its purpose.
 * @source
 */
const MAX_CONCURRENT_SEARCHES = 1;

/**
 * Search uncached manga sequentially with concurrency control.
 *
 * Processes manga not found in cache using queue-based approach with
 * cancellation support and rate limit compliance (1 concurrent search).
 *
 * @param data - Uncached manga data and tracking info.
 * @param config - AniList token and search configuration.
 * @param control - Abort signal and cancellation check.
 * @param callbacks - Progress update callbacks.
 * @param storage - Storage for results and source maps.
 * @source
 */
export async function processUncachedManga(
  data: UncachedMangaData,
  config: UncachedMangaConfig,
  control: UncachedMangaControl,
  callbacks: UpdateProgressCallbacks,
  storage: CachedResultsStorage,
): Promise<void> {
  const { uncachedManga, mangaList, reportedIndices } = data;
  const { token, searchConfig } = config;
  const { abortSignal, checkCancellation } = control;
  const { updateProgress } = callbacks;
  const { cachedResults, cachedComickSources, cachedMangaDexSources } = storage;

  if (uncachedManga.length === 0) {
    return;
  }

  // Create a semaphore to strictly limit concurrency - process one manga at a time
  let activeCount = 0;

  // Track processed manga indices to prevent duplicates
  const processedIndices = new Set<number>();

  // Create a queue that will be processed one by one
  const queue = [...uncachedManga];

  // Create a promise that we can use to wait for all processing to complete
  let resolve: (value: void | PromiseLike<void>) => void;
  let reject: (reason?: unknown) => void;
  const completionPromise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Track if we've been cancelled
  let isCancelled = false;

  /**
   * Check if all manga have been processed and resolve completion promise if done.
   * @source
   */
  const checkIfDone = () => {
    if ((queue.length === 0 && activeCount === 0) || isCancelled) {
      resolve();
    }
  };

  /**
   * Search for manga by title and store results with Comick/MangaDex source information.
   * @param index - Manga position in original list.
   * @param manga - Kenmei manga to search for.
   * @param options - Search configuration, callbacks, and storage.
   * @throws May throw if cancellation signalled.
   * @source
   */
  const searchAndStoreManga = async (
    index: number,
    manga: KenmeiManga,
    options: {
      token: string | undefined;
      searchConfig: SearchServiceConfig;
      abortSignal: AbortSignal | undefined;
      checkCancellation: () => void;
      updateProgress: (index: number, title: string) => void;
      cachedResults: { [key: number]: AniListManga[] };
      cachedComickSources: CachedResultsStorage["cachedComickSources"];
      cachedMangaDexSources: CachedResultsStorage["cachedMangaDexSources"];
    },
  ): Promise<void> => {
    const {
      token,
      searchConfig,
      abortSignal,
      checkCancellation,
      updateProgress,
      cachedResults,
      cachedComickSources,
      cachedMangaDexSources,
    } = options;

    // Double-check cache one more time before searching
    const cacheKey = generateCacheKey(manga.title);
    if (!searchConfig.bypassCache && isCacheValid(cacheKey)) {
      cachedResults[index] = mangaCache[cacheKey].manga;
      cachedComickSources[index] = new Map(); // Cached results don't have Comick source info
      cachedMangaDexSources[index] = new Map();
      console.debug(
        `[MangaSearchService] Using cache for ${manga.title} (found during processing)`,
      );
      // Update progress for this manga
      updateProgress(index, manga.title);
      return;
    }

    // Search for this manga
    console.debug(
      `[MangaSearchService] Searching for manga: ${manga.title} (${reportedIndices.size}/${mangaList.length})`,
    );

    // Update progress for this manga before search
    updateProgress(index, manga.title);

    // Check cancellation again before making the API call
    checkCancellation();

    // Import searchMangaByTitle from main service (temporary until Phase 8 refactor)
    const { searchMangaByTitle } = await import("../search-service");

    const searchResponse = await searchMangaByTitle(
      manga.title,
      token,
      searchConfig,
      abortSignal,
      undefined,
      manga,
    );

    // Store the results, preserving both manga and Comick source info
    const sanitizedMangas = filterOutBlacklistedManga(
      searchResponse.matches.map((match) => match.manga),
    );
    cachedResults[index] = sanitizedMangas;

    // Store alternative source information separately
    const comickSourceMap = new Map<
      number,
      {
        title: string;
        slug: string;
        comickId: string;
        isFoundViaComick: boolean;
      }
    >();
    const mangaDexSourceMap = new Map<
      number,
      {
        title: string;
        slug: string;
        mangaDexId: string;
        isFoundViaMangaDex: boolean;
      }
    >();
    const sanitizedMatchIds = new Set(sanitizedMangas.map((manga) => manga.id));
    const sanitizedMatches = searchResponse.matches.filter((match) =>
      sanitizedMatchIds.has(match.manga.id),
    );

    for (const match of sanitizedMatches) {
      if (match.comickSource) {
        comickSourceMap.set(match.manga.id, match.comickSource);
      }
      if (match.mangaDexSource) {
        mangaDexSourceMap.set(match.manga.id, match.mangaDexSource);
      }

      if (
        !comickSourceMap.has(match.manga.id) &&
        match.sourceInfo?.source === "comick"
      ) {
        comickSourceMap.set(match.manga.id, {
          title: match.sourceInfo.title,
          slug: match.sourceInfo.slug,
          comickId: match.sourceInfo.sourceId,
          isFoundViaComick: match.sourceInfo.isFoundViaAlternativeSearch,
        });
      }

      if (
        !mangaDexSourceMap.has(match.manga.id) &&
        match.sourceInfo?.source === "mangadex"
      ) {
        mangaDexSourceMap.set(match.manga.id, {
          title: match.sourceInfo.title,
          slug: match.sourceInfo.slug,
          mangaDexId: match.sourceInfo.sourceId,
          isFoundViaMangaDex: match.sourceInfo.isFoundViaAlternativeSearch,
        });
      }
    }
    cachedComickSources[index] = comickSourceMap;
    cachedMangaDexSources[index] = mangaDexSourceMap;
  };

  /**
   * Handle errors during manga processing with cancellation detection.
   * @param error - Error thrown during processing.
   * @param manga - Kenmei manga being processed.
   * @param index - Manga position in original list.
   * @param cachedResults - Storage for search results.
   * @param cachedComickSources - Storage for Comick source info.
   * @param cachedMangaDexSources - Storage for MangaDex source info.
   * @param onCancellation - Callback to invoke if cancellation detected.
   * @returns True if error was due to cancellation, false for regular errors.
   * @source
   */
  const handleMangaProcessingError = (
    error: unknown,
    manga: KenmeiManga,
    index: number,
    cachedResults: { [key: number]: AniListManga[] },
    cachedComickSources: CachedResultsStorage["cachedComickSources"],
    cachedMangaDexSources: CachedResultsStorage["cachedMangaDexSources"],
    onCancellation: () => void,
  ): boolean => {
    // Check if this was a cancellation
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.message.includes("aborted"))
    ) {
      console.error(`Search cancelled for manga: ${manga.title}`);
      onCancellation();
      return true; // Indicates cancellation
    }

    console.error(`Error searching for manga: ${manga.title}`, error);
    // Store empty result on error
    cachedResults[index] = [];
    cachedComickSources[index] = new Map();
    cachedMangaDexSources[index] = new Map();
    return false; // Indicates regular error, not cancellation
  };

  // Function to start processing the next manga in the queue
  /**
   * Process next manga in queue, enforcing MAX_CONCURRENT_SEARCHES concurrency limit.
   * @returns Promise resolving when next item is processed or queue is empty.
   * @source
   */
  const processNext = async () => {
    // Check for cancellation
    try {
      checkCancellation();
    } catch (error) {
      isCancelled = true;
      reject(error);
      return;
    }

    // If the queue is empty or we're cancelled, we're done
    if (queue.length === 0 || isCancelled) {
      checkIfDone();
      return;
    }

    // If we're at max concurrency, wait
    if (activeCount >= MAX_CONCURRENT_SEARCHES) {
      return;
    }

    // Get the next manga from the queue
    const { index, manga } = queue.shift()!;

    // Skip if this manga has already been processed
    if (processedIndices.has(index)) {
      processNext();
      return;
    }

    // Mark this manga as being processed
    processedIndices.add(index);
    activeCount++;

    try {
      // Check cancellation again before searching
      checkCancellation();

      await searchAndStoreManga(index, manga, {
        token,
        searchConfig,
        abortSignal,
        checkCancellation,
        updateProgress,
        cachedResults,
        cachedComickSources,
        cachedMangaDexSources,
      });
    } catch (error) {
      const wasCancelled = handleMangaProcessingError(
        error,
        manga,
        index,
        cachedResults,
        cachedComickSources,
        cachedMangaDexSources,
        () => {
          isCancelled = true;
          reject(error);
        },
      );

      if (wasCancelled) {
        return;
      }
    } finally {
      // Decrement the active count and process the next manga
      activeCount--;

      // Don't try to process more if we've been cancelled
      if (!isCancelled) {
        processNext();
      }

      // Check if we're done
      checkIfDone();
    }
  };

  // Start processing up to MAX_CONCURRENT_SEARCHES manga
  for (
    let i = 0;
    i < Math.min(MAX_CONCURRENT_SEARCHES, uncachedManga.length);
    i++
  ) {
    processNext();
  }

  try {
    // Wait for all processing to complete
    await completionPromise;
  } catch (error) {
    console.warn("[MangaSearchService] Processing cancelled:", error);

    // If this is a cancellation, we need to propagate it
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.message.includes("aborted"))
    ) {
      throw error; // Propagate the cancellation error
    }

    // If it's a different kind of error, rethrow it
    throw error;
  }
}
