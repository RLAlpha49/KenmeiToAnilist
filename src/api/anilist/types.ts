/**
 * @packageDocumentation
 * @module anilist-types
 * @description AniList API type definitions, including manga, user, response, and matching types.
 */

import { KenmeiManga } from "../kenmei/types";

/**
 * AniList media list status values.
 *
 * @source
 */
export type MediaListStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "DROPPED"
  | "PAUSED"
  | "REPEATING";

/**
 * Represents an AniList manga entry.
 *
 * @source
 */
export interface AniListManga {
  id: number;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  synonyms?: string[];
  description?: string;
  format: string;
  status: string;
  chapters?: number;
  volumes?: number;
  countryOfOrigin?: string;
  source?: string;
  coverImage?: {
    large?: string;
    medium?: string;
  };
  genres?: string[];
  tags?: {
    id: number;
    name: string;
    category?: string;
  }[];
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  staff?: {
    edges: {
      node: {
        id: number;
        name: {
          full: string;
        };
        role: string;
      };
    }[];
  };
}

/**
 * Represents a user's AniList media entry.
 *
 * @source
 */
export interface AniListMediaEntry {
  id?: number;
  mediaId: number;
  status: MediaListStatus;
  progress: number;
  private: boolean;
  score: number;
  previousValues: {
    status: string;
    progress: number;
    score: number;
    private: boolean;
  } | null;
  title?: string;
  coverImage?: string;
  // Metadata for incremental sync process
  syncMetadata?: {
    useIncrementalSync: boolean;
    targetProgress: number;
    progress: number;
    step?: number;
    updatedStatus?: boolean;
    updatedScore?: boolean;
    isRetry?: boolean;
    retryTimestamp?: number;
    retryCount?: number;
  } | null;
}

/**
 * Represents an AniList user.
 *
 * @source
 */
export interface AniListUser {
  id: number;
  name: string;
  avatar?: {
    large?: string;
    medium?: string;
  };
}

/**
 * GraphQL error interface.
 *
 * @source
 */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * Generic API response format.
 *
 * @source
 */
export interface AniListResponse<T> {
  data: T;
  errors?: GraphQLError[];
}

/**
 * Pagination information for AniList API responses.
 *
 * @source
 */
export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  perPage: number;
}

/**
 * Search result format for AniList API.
 *
 * @source
 */
export interface SearchResult<T> {
  Page: {
    pageInfo: PageInfo;
    media: T[];
  };
}

/**
 * Represents a manga match result with confidence score.
 *
 * @source
 */
export interface MangaMatch {
  coverImage?:
    | {
        medium?: string;
        large?: string;
      }
    | string;
  format?: string;
  status?: string;
  chapters?: number;
  title?: string;
  id?: number;
  manga: AniListManga;
  confidence: number;
}

/**
 * Search response that includes both matches and pagination info.
 *
 * @source
 */
export interface MangaSearchResponse {
  matches: MangaMatch[];
  pageInfo?: PageInfo;
}

/**
 * Status of a manga match operation.
 *
 * @source
 */
export type MatchStatus = "pending" | "matched" | "manual" | "skipped";

/**
 * Represents the result of a manga match operation.
 *
 * @source
 */
export interface MangaMatchResult {
  kenmeiManga: KenmeiManga;
  anilistMatches?: MangaMatch[];
  selectedMatch?: AniListManga;
  status: MatchStatus;
  matchDate?: Date;
}

/**
 * A simplified representation of a user's AniList media entry.
 *
 * @source
 */
export interface UserMediaEntry {
  id: number;
  mediaId: number;
  status: string;
  progress: number;
  score: number;
  private: boolean;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
}

/**
 * A map of mediaId to media entries for quick lookup.
 *
 * @source
 */
export type UserMediaList = Record<number, UserMediaEntry>;
