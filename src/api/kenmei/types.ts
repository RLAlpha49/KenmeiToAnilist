/**
 * @packageDocumentation
 * @module kenmei-types
 * @description Types for Kenmei data processing, including manga, export, parsing, and status mapping.
 */

import { MediaListStatus } from "../anilist/types";

/**
 * Kenmei reading status values.
 *
 * @source
 */
export type KenmeiStatus =
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_read";

/**
 * Represents a Kenmei manga entry.
 *
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
  anilistId?: number; // Optional AniList ID for direct fetching
}

/**
 * Represents a Kenmei export file structure.
 *
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
 * Options for parsing Kenmei data.
 *
 * @source
 */
export interface KenmeiParseOptions {
  validateStructure: boolean;
  allowPartialData: boolean;
  defaultStatus: KenmeiStatus;
}

/**
 * Default options for parsing Kenmei data.
 *
 * @source
 */
export const DEFAULT_PARSE_OPTIONS: KenmeiParseOptions = {
  validateStructure: true,
  allowPartialData: false,
  defaultStatus: "plan_to_read",
};

/**
 * Represents a match between a Kenmei manga and an AniList manga.
 *
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
 * Status mapping from Kenmei to AniList.
 *
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
 * Custom status mapping configuration.
 *
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
 * Represents a validation error for Kenmei data processing.
 *
 * @source
 */
export interface ValidationError {
  mangaTitle: string;
  field: string;
  message: string;
  index: number;
}

/**
 * Represents the result of processing Kenmei data.
 *
 * @source
 */
export interface ProcessingResult {
  processedEntries: KenmeiManga[];
  validationErrors: ValidationError[];
  totalEntries: number;
  successfulEntries: number;
}
