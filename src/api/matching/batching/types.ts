/**
 * @file Batch processing type definitions
 * @module matching/batching/types
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";

/**
 * Source information storage for Comick results
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
 * Source information storage for MangaDex results
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
 * Storage container for cached results and source information
 */
export interface CachedResultsStorage {
  cachedResults: Record<number, AniListManga[]>;
  cachedComickSources: ComickSourceStorage;
  cachedMangaDexSources: MangaDexSourceStorage;
}

/**
 * Callbacks for updating batch processing progress
 */
export interface UpdateProgressCallbacks {
  updateProgress: (index: number, title?: string) => void;
}

/**
 * Data structure for manga with known AniList IDs
 */
export interface KnownMangaData {
  knownMangaIds: { index: number; id: number }[];
  mangaList: KenmeiManga[];
  uncachedManga: { index: number; manga: KenmeiManga }[];
}

/**
 * Configuration for processing known manga IDs
 */
export interface KnownMangaConfig {
  searchConfig: SearchServiceConfig;
  token: string | undefined;
}

/**
 * Control signals for cancelling known manga processing
 */
export interface KnownMangaControl {
  shouldCancel: (() => boolean) | undefined;
  abortSignal: AbortSignal | undefined;
}

/**
 * Data structure for uncached manga processing
 */
export interface UncachedMangaData {
  uncachedManga: { index: number; manga: KenmeiManga }[];
  mangaList: KenmeiManga[];
  reportedIndices: Set<number>;
}

/**
 * Configuration for uncached manga processing
 */
export interface UncachedMangaConfig {
  token: string | undefined;
  searchConfig: SearchServiceConfig;
}

/**
 * Control signals for cancelling uncached manga processing
 */
export interface UncachedMangaControl {
  abortSignal: AbortSignal | undefined;
  checkCancellation: () => void;
}

/**
 * Search service configuration (imported from main service)
 * Will be moved to shared types module in future phase
 */
export interface SearchServiceConfig {
  bypassCache?: boolean;
  enableComickSearch?: boolean;
  enableMangaDexSearch?: boolean;
  waitForRateLimit?: boolean;
  checkCacheFirst?: boolean;
  cacheResults?: boolean;
}

/**
 * Result of categorizing manga for batch processing
 */
export interface BatchCategorizationResult {
  cachedResults: Record<number, AniListManga[]>;
  cachedComickSources: ComickSourceStorage;
  cachedMangaDexSources: MangaDexSourceStorage;
  uncachedManga: { index: number; manga: KenmeiManga }[];
  knownMangaIds: { index: number; id: number }[];
}
