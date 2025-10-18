import type { AniListManga } from "../anilist/types";

/**
 * @packageDocumentation
 * @module manga-source-types
 * @description Generic type definitions for manga source APIs used by all sources.
 */

/**
 * Enum for supported manga sources.
 * @source
 */
export enum MangaSource {
  COMICK = "comick",
  MANGADEX = "mangadex",
}

/**
 * Base interface for manga entries from any source.
 * Each source extends this with platform-specific properties.
 * @source
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
 * Each source extends this with platform-specific properties.
 * @source
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
 * @template T - The manga entry type returned in results.
 * @source
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
 * Defines endpoints, headers, rate limits, and cache settings.
 * @source
 */
export interface MangaSourceConfig {
  /** Human-readable name of the source */
  name: string;
  /** Source identifier */
  source: MangaSource;
  /** Base API URL */
  baseUrl: string;
  /** Search and detail endpoint configuration */
  endpoints: {
    search: string;
    detail: string;
  };
  /** Headers to include in API requests */
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
 * Represents a matched manga from any source with AniList information.
 * @template T - The manga entry type from the source.
 * @source
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
 * Used when a manga is found via alternative source search and enriched with AniList data.
 * @source
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
 * Stores cached data with timestamp and source information.
 * @template T - The type of cached data.
 * @source
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
 * Maps cache keys to their entries for efficient lookup and expiration.
 * @source
 */
export interface MangaSourceCache {
  [key: string]: MangaSourceCacheEntry;
}
