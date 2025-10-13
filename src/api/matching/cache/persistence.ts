/**
 * localStorage persistence for cache
 * @module cache/persistence
 */

import { mangaCache } from "./storage";
import { MANGA_CACHE_KEY } from "./types";

/**
 * Save the cache to localStorage
 */
export function saveCache(): void {
  if (globalThis.window !== undefined) {
    try {
      localStorage.setItem(MANGA_CACHE_KEY, JSON.stringify(mangaCache));
    } catch (e) {
      console.error(
        "[MangaSearchService] Error saving cache to localStorage:",
        e,
      );
    }
  }
}
