/**
 * @file Process manga with known AniList IDs via batch fetching
 * @module matching/batching/known-ids
 */

import type { AniListManga } from "@/api/anilist/types";
import type {
  KnownMangaData,
  KnownMangaConfig,
  KnownMangaControl,
  UpdateProgressCallbacks,
  CachedResultsStorage,
} from "./types";
import { generateCacheKey, mangaCache } from "../cache";

/**
 * Fetch manga with known AniList IDs in batches.
 *
 * For manga entries with anilistId already set, fetches them via batched queries,
 * which is more efficient than individual searches. Unfound IDs fall back to title search.
 *
 * @param data - Known manga IDs and related data.
 * @param config - Search configuration and AniList token.
 * @param control - Abort signal and cancellation checks.
 * @param callbacks - Progress update callbacks.
 * @param storage - Storage for results and source maps.
 * @source
 */
export async function processKnownMangaIds(
  data: KnownMangaData,
  config: KnownMangaConfig,
  control: KnownMangaControl,
  callbacks: UpdateProgressCallbacks,
  storage: CachedResultsStorage,
): Promise<void> {
  const { knownMangaIds, mangaList, uncachedManga } = data;
  const { searchConfig, token } = config;
  const { shouldCancel, abortSignal } = control;
  const { updateProgress } = callbacks;
  const { cachedResults, cachedComickSources, cachedMangaDexSources } = storage;

  if (knownMangaIds.length === 0 || searchConfig.bypassCache) {
    return;
  }

  const ids = knownMangaIds.map((item) => item.id);
  console.info(
    `[MangaSearchService] Fetching ${ids.length} manga with known IDs...`,
  );

  // Import getBatchedMangaIds from main service (temporary until Phase 8/9 refactor)
  const { getBatchedMangaIds } = await import("../search-service");

  // Get manga by IDs in batches, passing the abort signal
  const batchedManga = await getBatchedMangaIds(
    ids,
    token,
    shouldCancel,
    abortSignal,
  );

  // Create a map of ID to manga for easier lookup
  const mangaMap = new Map<number, AniListManga>();
  for (const manga of batchedManga) {
    mangaMap.set(manga.id, manga);
  }

  // Store the results in cachedResults by their original index
  for (const item of knownMangaIds) {
    const manga = mangaMap.get(item.id);
    if (manga) {
      cachedResults[item.index] = [manga]; // Store as array of one manga for consistency
      cachedComickSources[item.index] = new Map(); // Known IDs don't have Comick source info
      cachedMangaDexSources[item.index] = new Map();

      // Also store in the general cache to help future searches
      const title = mangaList[item.index].title;
      const cacheKey = generateCacheKey(title);
      mangaCache[cacheKey] = {
        manga: [manga],
        timestamp: Date.now(),
      };

      // Update progress for each found manga
      updateProgress(item.index, title);
    } else {
      // Manga ID was not found, add to uncached list for title search
      uncachedManga.push({
        index: item.index,
        manga: mangaList[item.index],
      });
    }
  }
}
