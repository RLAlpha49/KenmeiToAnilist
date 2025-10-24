/**
 * @packageDocumentation
 * @module anilist-types
 * @description AniList API type definitions, including manga, user, response, and matching types.
 */

import { KenmeiManga } from "../kenmei/types";

/**
 * Valid media list status values for AniList collection entries.
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
 * Complete AniList manga entry with metadata, staff, and user list information.
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
  mediaListEntry?: {
    id: number;
    status: MediaListStatus;
    progress: number;
    score: number;
    private: boolean;
  } | null;
  isAdult?: boolean;
}

/**
 * User's AniList media entry with change tracking and incremental sync metadata.
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
    resumeFromStep?: number;
  } | null;
}

/**
 * AniList user profile information.
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
 * GraphQL error object from AniList API response.
 * @source
 */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * Generic GraphQL API response with optional errors.
 * @source
 */
export interface AniListResponse<T> {
  data: T;
  errors?: GraphQLError[];
}

/**
 * Pagination metadata for AniList paginated API responses.
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
 * Paginated search result format from AniList API.
 * @source
 */
export interface SearchResult<T> {
  Page: {
    pageInfo: PageInfo;
    media: T[];
  };
}

/**
 * Manga match result with confidence score and optional alternative source information.
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
  // Optional source information for matches found via alternative methods
  sourceInfo?: {
    title: string;
    slug: string;
    sourceId: string;
    source: string;
    foundViaAlternativeSearch: boolean;
  };
  // @deprecated Use sourceInfo instead
  comickSource?: {
    title: string;
    slug: string;
    comickId: string;
    foundViaComick: boolean;
  };
  mangaDexSource?: {
    title: string;
    slug: string;
    mangaDexId: string;
    foundViaMangaDex: boolean;
  };
}

/**
 * Search response containing matched manga results and pagination information.
 * @source
 */
export interface MangaSearchResponse {
  matches: MangaMatch[];
  pageInfo?: PageInfo;
}

/**
 * Status values for manga matching operations in the import workflow.
 * @source
 */
export type MatchStatus = "pending" | "matched" | "manual" | "skipped";

/**
 * Result of a manga matching operation linking Kenmei to AniList entry.
 * @source
 */
export interface MangaMatchResult {
  kenmeiManga: KenmeiManga;
  anilistMatches?: MangaMatch[];
  selectedMatch?: AniListManga;
  status: MatchStatus;
  /** ISO 8601 string timestamp of when match was created or updated. Persisted as string in storage and should be parsed to Date when needed for comparisons or display. */
  matchDate?: Date;
}

/**
 * Simplified user's AniList media entry with title information for list display.
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
 * Mapping of media ID to user's media entry for O(1) lookup by ID.
 * @source
 */
export type UserMediaList = Record<number, UserMediaEntry>;
