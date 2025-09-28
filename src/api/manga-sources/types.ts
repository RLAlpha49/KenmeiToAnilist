import type { AniListManga } from "../anilist/types";

/**
 * @packageDocumentation
 * @module manga-source-types
 * @description Generic type definitions for manga source APIs that can be used by any manga source.
 */

/**
 * Enum for supported manga sources.
 */
export enum MangaSource {
  COMICK = "comick",
  MANGADEX = "mangadex",
}

/**
 * Base interface for manga entries from any source.
 * Each source should extend this with their specific properties.
 */
export interface BaseMangaEntry {
  /** Unique identifier for the manga in the source */
  id: string;
  /** Primary title of the manga */
  title: string;
  /** URL slug or identifier for detailed lookup */
  slug: string;
  /** Publication year (optional) */
  year?: number;
  /** Publication status (optional) */
  status?: number;
  /** Country of origin (optional) */
  country?: string;
  /** Rating information (optional) */
  rating?: string | number;
  /** Alternative titles in different languages (optional) */
  alternativeTitles?: Array<{
    title: string;
    lang: string;
  }>;
  /** Source this entry came from */
  source: MangaSource;
}

/**
 * Base interface for detailed manga information from any source.
 * Each source should extend this with their specific properties.
 */
export interface BaseMangaDetail {
  /** Basic manga information */
  id: string;
  title: string;
  slug: string;
  /** Extended information */
  description?: string;
  status?: number;
  year?: number;
  country?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Author and artist information */
  authors?: Array<{
    id: string;
    name: string;
    slug?: string;
  }>;
  artists?: Array<{
    id: string;
    name: string;
    slug?: string;
  }>;
  /** Genre information */
  genres?: Array<{
    id: string;
    name: string;
    slug?: string;
  }>;
  /** Alternative titles */
  alternativeTitles?: Array<{
    title: string;
    lang: string;
  }>;
  /** External links to other platforms */
  externalLinks?: {
    /** AniList ID */
    anilist?: string;
    /** MyAnimeList ID */
    myAnimeList?: string;
    /** MangaUpdates ID */
    mangaUpdates?: string;
    /** Other platform links */
    [key: string]: string | undefined;
  };
  /** Source this detail came from */
  source: MangaSource;
}

/**
 * Base interface for search response from any manga source.
 */
export interface BaseMangaSearchResponse<
  T extends BaseMangaEntry = BaseMangaEntry,
> {
  /** Search results */
  data: T[];
  /** Response status */
  status: string;
  /** Optional error message */
  message?: string;
  /** Source of the search results */
  source: MangaSource;
}

/**
 * Configuration interface for manga source APIs.
 */
export interface MangaSourceConfig {
  /** Human-readable name of the source */
  name: string;
  /** Source identifier */
  source: MangaSource;
  /** Base API URL */
  baseUrl: string;
  /** Search endpoint configuration */
  endpoints: {
    search: string;
    detail: string;
  };
  /** Headers to include in requests */
  headers?: Record<string, string>;
  /** Rate limiting configuration (optional) */
  rateLimit?: {
    requestsPerSecond: number;
    burstLimit: number;
  };
  /** Cache configuration (optional) */
  cache?: {
    enabled: boolean;
    ttlMinutes: number;
  };
}

/**
 * Represents a matched manga from any source with AniList info.
 */
export interface MangaMatchResult<T extends BaseMangaEntry = BaseMangaEntry> {
  /** The original manga entry from the source */
  sourceManga: T;
  /** Extracted AniList ID if found */
  anilistId?: number;
  /** AniList URL if found */
  anilistUrl?: string;
  /** Source this match came from */
  source: MangaSource;
}

/**
 * Represents an enhanced AniList manga entry that includes source info.
 */
export interface EnhancedAniListManga extends AniListManga {
  /** Information about the source where this was found */
  sourceInfo?: {
    /** Original title from the source */
    title: string;
    /** Source slug/identifier */
    slug: string;
    /** Source-specific ID */
    sourceId: string;
    /** Which source this came from */
    source: MangaSource;
    /** Whether this was found via alternative search */
    foundViaAlternativeSearch: boolean;
  };
}

/**
 * Cache entry structure for any manga source.
 */
// eslint-disable-next-line
export interface MangaSourceCacheEntry<T = any> {
  /** Cached data */
  data: T;
  /** Timestamp when cached */
  timestamp: number;
  /** Source this cache entry belongs to */
  source: MangaSource;
}

/**
 * Generic cache structure for manga sources.
 */
export interface MangaSourceCache {
  [key: string]: MangaSourceCacheEntry;
}
