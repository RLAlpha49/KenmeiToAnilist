/**
 * Cache types and interfaces
 * @module cache/types
 */

import type { AniListManga } from "../../anilist/types";

/**
 * Manga search result cache structure.
 * Maps cache keys to arrays of manga with associated timestamp.
 * @source
 */
export interface MangaCache {
  [key: string]: {
    manga: AniListManga[];
    timestamp: number;
  };
}

/**
 * Cache expiration time in milliseconds (24 hours).
 * @source
 */
export const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * localStorage key for manga cache data.
 * @source
 */
export const MANGA_CACHE_KEY = "anilist_manga_cache";

/**
 * localStorage key for search cache data.
 * @source
 */
export const SEARCH_CACHE_KEY = "anilist_search_cache";
