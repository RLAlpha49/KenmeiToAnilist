/**
 * @packageDocumentation
 * @module kenmei-types
 * @description Types for Kenmei data processing, including manga, export, parsing, and status mapping.
 */

import { MediaListStatus } from "../anilist/types";

/**
 * Kenmei media list status enum values.
 * @source
 */
export type KenmeiStatus =
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_read";

/**
 * Kenmei manga library entry with reading progress, metadata, and timestamps.
 * @source
 */
export interface KenmeiManga {
  id: number;
  title: string;
  status: KenmeiStatus;
  score: number;
  url: string;
  cover_url?: string;
  chapters_read: number;
  total_chapters?: number;
  volumes_read?: number;
  total_volumes?: number;
  notes?: string;
  last_read_at?: string;
  created_at: string;
  updated_at: string;
  author?: string;
  alternative_titles?: string[];
  anilistId?: number; // Optional AniList ID for direct matching
}

/**
 * Kenmei export file structure containing user info and manga library.
 * @source
 */
export interface KenmeiExport {
  export_date: string;
  user: {
    username: string;
    id: number;
  };
  manga: KenmeiManga[];
}

/**
 * Configuration options for parsing Kenmei export data with validation and normalization.
 * @source
 */
export interface KenmeiParseOptions {
  validateStructure: boolean;
  allowPartialData: boolean;
  defaultStatus: KenmeiStatus;
}

/**
 * Default parsing options with structure validation enabled and plan_to_read as fallback status.
 * @source
 */
export const DEFAULT_PARSE_OPTIONS: KenmeiParseOptions = {
  validateStructure: true,
  allowPartialData: false,
  defaultStatus: "plan_to_read",
};

/**
 * Matching result between a Kenmei manga entry and an AniList manga entry.
 * @source
 */
export interface MangaMatch {
  kenmei: KenmeiManga;
  anilist: {
    id: number;
    title: {
      romaji: string;
      english: string | null;
      native: string | null;
    };
    matchConfidence: number;
  } | null;
}

/**
 * Bidirectional Kenmei-to-AniList status mapping constant.
 * @source
 */
export const STATUS_MAPPING: Record<KenmeiStatus, MediaListStatus> = {
  reading: "CURRENT",
  completed: "COMPLETED",
  on_hold: "PAUSED",
  dropped: "DROPPED",
  plan_to_read: "PLANNING",
};

/**
 * Custom status mapping configuration for Kenmei-to-AniList conversion.
 * @source
 */
export interface StatusMappingConfig {
  reading: MediaListStatus;
  completed: MediaListStatus;
  on_hold: MediaListStatus;
  dropped: MediaListStatus;
  plan_to_read: MediaListStatus;
}

/**
 * Validation error occurring during Kenmei data processing.
 * @source
 */
export interface ValidationError {
  mangaTitle: string;
  field: string;
  message: string;
  index: number;
}

/**
 * Result of processing a Kenmei export file, including processed entries, validation errors, and statistics.
 * @source
 */
export interface ProcessingResult {
  processedEntries: KenmeiManga[];
  validationErrors: ValidationError[];
  totalEntries: number;
  successfulEntries: number;
}
