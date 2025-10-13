/**
 * Cache types and interfaces
 * @module cache/types
 */

import type { AniListManga } from "../../anilist/types";

/**
 * Cache for manga search results
 */
export interface MangaCache {
  [key: string]: {
    manga: AniListManga[];
    timestamp: number;
  };
}

/**
 * Cache expiration time (24 hours)
 */
export const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * localStorage key for manga cache
 */
export const MANGA_CACHE_KEY = "anilist_manga_cache";

/**
 * localStorage key for search cache
 */
export const SEARCH_CACHE_KEY = "anilist_search_cache";
