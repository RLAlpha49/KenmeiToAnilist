/**
 * Cache types and interfaces
 * @module cache/types
 */

import type { AniListManga } from "../../anilist/types";
import type { ComickSourceInfo, MangaDexSourceInfo } from "../sources/types";

/**
 * Manga search result cache structure.
 * Maps cache keys to entries with manga data, timestamps, and optional alternative source metadata.
 * @source
 */
export interface MangaCacheSourceMetadata {
  comickSources?: Record<string, ComickSourceInfo>;
  mangaDexSources?: Record<string, MangaDexSourceInfo>;
}

export interface MangaCacheEntry {
  manga: AniListManga[];
  timestamp: number;
  sourceMetadata?: MangaCacheSourceMetadata;
}

export interface MangaCache {
  [key: string]: MangaCacheEntry;
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
