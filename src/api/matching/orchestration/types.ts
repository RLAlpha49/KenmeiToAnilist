/**
 * Orchestration type definitions
 * @module matching/orchestration/types
 * @source
 */

import type { AniListManga, PageInfo } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";

/**
 * Configuration for the search service.
 * @source
 */
export interface SearchServiceConfig {
  /** Match configuration for filtering */
  matchConfig: Partial<MatchEngineConfig>;
  /** Number of manga to process in a batch */
  batchSize: number;
  /** Number of results per page */
  searchPerPage: number;
  /** Maximum number of search results to return */
  maxSearchResults: number;
  /** Use advanced search API instead of basic search */
  useAdvancedSearch: boolean;
  /** Enable pre-search for common titles */
  enablePreSearch: boolean;
  /** Use exact matching only (no fuzzy matching) */
  exactMatchingOnly: boolean;
  /** Skip cache and force fresh search */
  bypassCache?: boolean;
  /** Fetch only single page of results */
  singlePageSearch?: boolean;
  /** Enable searching via Comick source */
  enableComickSearch?: boolean;
  /** Enable searching via MangaDex source */
  enableMangaDexSearch?: boolean;
}

/**
 * Response from manga search containing matches and pagination.
 * @source
 */
export interface MangaSearchResponse {
  /** Array of manga matches with confidence scores */
  matches: MangaMatch[];
  /** Pagination information if available */
  pageInfo?: PageInfo;
}

/**
 * Single manga match with confidence and source information.
 * @source
 */
export interface MangaMatch {
  /** The matched AniList manga */
  manga: AniListManga;
  /** Confidence score (0-100) */
  confidence: number;
  /** Comick source information if found via Comick */
  comickSource?: {
    title: string;
    slug: string;
    comickId: string;
    foundViaComick: boolean;
  };
  /** MangaDex source information if found via MangaDex */
  mangaDexSource?: {
    title: string;
    slug: string;
    mangaDexId: string;
    foundViaMangaDex: boolean;
  };
  /** Unified source information */
  sourceInfo?: {
    source: "comick" | "mangadex";
    title: string;
    slug: string;
    sourceId: string;
    foundViaAlternativeSearch: boolean;
  };
}

/**
 * Result of search loop execution.
 * @source
 */
export interface SearchLoopResult {
  /** Search results from all pages */
  results: AniListManga[];
  /** Page info from last page */
  lastPageInfo?: PageInfo;
}

/**
 * Default search service configuration.
 * @source
 */
export const DEFAULT_SEARCH_CONFIG: SearchServiceConfig = {
  matchConfig: {},
  batchSize: 10,
  searchPerPage: 50,
  maxSearchResults: 50,
  useAdvancedSearch: false,
  enablePreSearch: true,
  exactMatchingOnly: false,
  bypassCache: false,
  singlePageSearch: false,
  enableComickSearch: false,
  enableMangaDexSearch: false,
};
