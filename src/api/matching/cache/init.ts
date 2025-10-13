/**
 * Cache initialization and event listener setup
 * @module cache/init
 */

import type { AniListManga } from "../../anilist/types";
import {
  getServiceInitialized,
  setServiceInitialized,
  getListenersRegistered,
  setListenersRegistered,
  mangaCache,
} from "./storage";
import { syncWithClientCache } from "./sync";
import { generateCacheKey } from "./utils";
import { saveCache } from "./persistence";

/**
 * Initialize the manga search service
 * This will only run once regardless of how many times it's imported
 */
export function initializeMangaService(): void {
  // Skip if already initialized
  if (getServiceInitialized()) {
    console.debug(
      "[MangaSearchService] Manga search service already initialized, skipping duplicate initialization",
    );
    return;
  }

  console.info("[MangaSearchService] Initializing manga search service...");
  setServiceInitialized(true);

  // Sync with client cache on initialization
  syncWithClientCache();

  // Set up event listeners
  if (globalThis.window !== undefined && !getListenersRegistered()) {
    setListenersRegistered(true);

    globalThis.addEventListener("anilist:search-cache-initialized", () => {
      console.debug(
        "[MangaSearchService] Received search cache initialization event, syncing caches...",
      );
      syncWithClientCache();
    });

    // Listen for new search results to directly update our cache
    globalThis.addEventListener(
      "anilist:search-results-updated",
      (event: Event) => {
        if (!(event instanceof CustomEvent)) return;

        const { results, timestamp } =
          (event.detail as {
            search?: string;
            results?: AniListManga[];
            timestamp?: number;
          }) ?? {};

        if (!Array.isArray(results) || results.length === 0) return;

        const ts = timestamp ?? Date.now();

        const cacheByTitle = (
          title: string | null | undefined,
          manga: AniListManga,
        ) => {
          if (!title) return;
          const key = generateCacheKey(title);
          mangaCache[key] = { manga: [manga], timestamp: ts };
        };

        for (const manga of results) {
          if (!manga?.title) continue;
          cacheByTitle(manga.title.romaji, manga);
          cacheByTitle(manga.title.english, manga);
        }

        saveCache();
      },
    );
  }
}
