/**
 * @file Batch processing type definitions
 * @module matching/batching/types
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";

/**
 * Storage for Comick source information indexed by manga position.
 * @source
 */
export type ComickSourceStorage = Record<
  number,
  Map<
    number,
    {
      title: string;
      slug: string;
      comickId: string;
      foundViaComick: boolean;
    }
  >
>;

/**
 * Storage for MangaDex source information indexed by manga position.
 * @source
 */
export type MangaDexSourceStorage = Record<
  number,
  Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >
>;

/**
 * Container for cached AniList results and source information.
 * @source
 */
export interface CachedResultsStorage {
  /** AniList search results indexed by manga position. */
  cachedResults: Record<number, AniListManga[]>;
  /** Comick sources indexed by position. */
  cachedComickSources: ComickSourceStorage;
  /** MangaDex sources indexed by position. */
  cachedMangaDexSources: MangaDexSourceStorage;
}

/**
 * Callbacks for batch processing progress updates.
 * @source
 */
export interface UpdateProgressCallbacks {
  /** Progress update callback with optional manga title. */
  updateProgress: (index: number, title?: string) => void;
}

/**
 * Data structure for manga with known AniList IDs.
 * @source
 */
export interface KnownMangaData {
  /** Known manga IDs with their source indices. */
  knownMangaIds: { index: number; id: number }[];
  /** Original manga list for reference. */
  mangaList: KenmeiManga[];
  /** Uncached manga fallback list. */
  uncachedManga: { index: number; manga: KenmeiManga }[];
}

/**
 * Configuration for processing known manga IDs.
 * @source
 */
export interface KnownMangaConfig {
  /** Search configuration. */
  searchConfig: SearchServiceConfig;
  /** AniList API token. */
  token: string | undefined;
}

/**
 * Control signals for cancelling known manga processing.
 * @source
 */
export interface KnownMangaControl {
  /** Cancellation check function. */
  shouldCancel: (() => boolean) | undefined;
  /** Abort signal for early termination. */
  abortSignal: AbortSignal | undefined;
}

/**
 * Data structure for uncached manga processing.
 * @source
 */
export interface UncachedMangaData {
  /** Uncached manga with their indices. */
  uncachedManga: { index: number; manga: KenmeiManga }[];
  /** Original manga list for reference. */
  mangaList: KenmeiManga[];
  /** Indices of reported manga. */
  reportedIndices: Set<number>;
}

/**
 * Configuration for uncached manga processing.
 * @source
 */
export interface UncachedMangaConfig {
  /** AniList API token. */
  token: string | undefined;
  /** Search configuration. */
  searchConfig: SearchServiceConfig;
}

/**
 * Control signals for cancelling uncached manga processing.
 * @source
 */
export interface UncachedMangaControl {
  /** Abort signal for early termination. */
  abortSignal: AbortSignal | undefined;
  /** Cancellation check function. */
  checkCancellation: () => void;
}

/**
 * Search service configuration options.
 * @source
 */
export interface SearchServiceConfig {
  /** Ignore cache and perform fresh searches. */
  bypassCache?: boolean;
  /** Enable Comick source searches. */
  enableComickSearch?: boolean;
  /** Enable MangaDex source searches. */
  enableMangaDexSearch?: boolean;
  /** Wait for rate limit reset if needed. */
  waitForRateLimit?: boolean;
  /** Check cache before performing searches. */
  checkCacheFirst?: boolean;
  /** Cache results after fetching. */
  cacheResults?: boolean;
}

/**
 * Result of categorizing manga for batch processing.
 * @source
 */
export interface BatchCategorizationResult {
  /** Cached AniList results by index. */
  cachedResults: Record<number, AniListManga[]>;
  /** Cached Comick sources by index. */
  cachedComickSources: ComickSourceStorage;
  /** Cached MangaDex sources by index. */
  cachedMangaDexSources: MangaDexSourceStorage;
  /** Uncached manga requiring title search. */
  uncachedManga: { index: number; manga: KenmeiManga }[];
  /** Manga with known IDs for batch fetch. */
  knownMangaIds: { index: number; id: number }[];
}
