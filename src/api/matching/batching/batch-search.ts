/**
 * @file Batched search processing for multiple manga
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
import type { MangaMatch } from "../orchestration/types";
import { generateCacheKey, isCacheValid, mangaCache } from "../cache";
import { batchSearchManga } from "@/api/anilist/client";

/**
 * Default batch size for parallel manga searches (AniList rate limit: 60 req/min).
 */
const BATCH_SIZE = 15;

/** Delay (in ms) between batches to respect AniList rate limiting. */
const BATCH_DELAY_MS = 1000;

type BatchItem = UncachedMangaData["uncachedManga"][number];

const toAlias = (index: number) => `manga_${index}`;

function ensureNotCancelled(
  abortSignal: AbortSignal | undefined,
  checkCancellation: () => void,
): void {
  if (abortSignal?.aborted) {
    throw new Error("Operation aborted by abort signal");
  }

  checkCancellation();
}

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

function storeAniListResults(
  index: number,
  media: AniListManga[],
  storage: CachedResultsStorage,
): void {
  storage.cachedResults[index] = media;
  initializeSourceMaps(index, storage);
}

function collectAlternativeSources(matches: MangaMatch[]): {
  comick: Map<
    number,
    {
      title: string;
      slug: string;
      comickId: string;
      foundViaComick: boolean;
    }
  >;
  mangaDex: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >;
} {
  const comick = new Map<
    number,
    {
      title: string;
      slug: string;
      comickId: string;
      foundViaComick: boolean;
    }
  >();

  const mangaDex = new Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >();

  for (const match of matches) {
    if (match.comickSource) {
      comick.set(match.manga.id, match.comickSource);
    }

    if (match.mangaDexSource) {
      mangaDex.set(match.manga.id, match.mangaDexSource);
    }

    if (!comick.has(match.manga.id) && match.sourceInfo?.source === "comick") {
      comick.set(match.manga.id, {
        title: match.sourceInfo.title,
        slug: match.sourceInfo.slug,
        comickId: match.sourceInfo.sourceId,
        foundViaComick: match.sourceInfo.foundViaAlternativeSearch,
      });
    }

    if (
      !mangaDex.has(match.manga.id) &&
      match.sourceInfo?.source === "mangadex"
    ) {
      mangaDex.set(match.manga.id, {
        title: match.sourceInfo.title,
        slug: match.sourceInfo.slug,
        mangaDexId: match.sourceInfo.sourceId,
        foundViaMangaDex: match.sourceInfo.foundViaAlternativeSearch,
      });
    }
  }

  return { comick, mangaDex };
}

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

  const { searchMangaByTitle } = await import("../search-service");

  for (const { manga, index } of items) {
    ensureNotCancelled(abortSignal, checkCancellation);

    const response = await searchMangaByTitle(
      manga.title,
      token,
      searchConfig,
      abortSignal,
    );

    ensureNotCancelled(abortSignal, checkCancellation);

    const matches = response.matches ?? [];
    storage.cachedResults[index] = matches.map((match) => match.manga);

    const { comick, mangaDex } = collectAlternativeSources(matches);
    storage.cachedComickSources[index] = comick;
    storage.cachedMangaDexSources[index] = mangaDex;

    updateProgress(index, manga.title);

    console.debug(
      `[MangaSearchService] 🔁 Alternative search produced ${matches.length} matches for "${manga.title}"`,
    );
  }
}

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

async function processBatch(
  batch: BatchItem[],
  context: BatchProcessingContext,
): Promise<void> {
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
        alias: toAlias(index),
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

    for (const { manga, index } of batch) {
      ensureNotCancelled(abortSignal, checkCancellation);

      const alias = toAlias(index);
      const result = batchResults.get(alias);

      if (result?.media?.length) {
        storeAniListResults(index, result.media, storage);
        updateProgress(index, manga.title);
        console.debug(
          `[MangaSearchService] ✅ Batch search found ${result.media.length} matches for "${manga.title}"`,
        );
      } else {
        fallbackCandidates.push({ manga, index });
        storeAniListResults(index, [], storage);
        console.debug(
          `[MangaSearchService] ⚠️ Batch search returned no results for "${manga.title}"`,
        );
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

    if (hasMoreBatches) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  } catch (error) {
    console.error(
      `[MangaSearchService] ❌ Error processing batch ${batchNumber}:`,
      error,
    );

    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.message.includes("aborted"))
    ) {
      throw error;
    }

    for (const { index } of batch) {
      storage.cachedResults[index] = [];
      initializeSourceMaps(index, storage);
    }

    console.warn(
      `[MangaSearchService] ⚠️ Continuing with next batch after error`,
    );
  }
}

/**
 * Process uncached manga using batched GraphQL queries with fallback searches.
 */
export async function processBatchedUncachedManga(
  data: UncachedMangaData,
  config: UncachedMangaConfig,
  control: UncachedMangaControl,
  callbacks: UpdateProgressCallbacks,
  storage: CachedResultsStorage,
): Promise<void> {
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
}
