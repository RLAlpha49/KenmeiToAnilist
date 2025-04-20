/**
 * Types for Kenmei data processing
 */

import { MediaListStatus } from "../anilist/types";

export type KenmeiStatus =
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_read";

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
  created_at: string;
  updated_at: string;
  author?: string;
  alternative_titles?: string[];
  anilistId?: number; // Optional AniList ID for direct fetching
}

export interface KenmeiExport {
  export_date: string;
  user: {
    username: string;
    id: number;
  };
  manga: KenmeiManga[];
}

// Parse options for more flexible parsing
export interface KenmeiParseOptions {
  validateStructure: boolean;
  allowPartialData: boolean;
  defaultStatus: KenmeiStatus;
}

export const DEFAULT_PARSE_OPTIONS: KenmeiParseOptions = {
  validateStructure: true,
  allowPartialData: false,
  defaultStatus: "plan_to_read",
};

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

// Status mapping from Kenmei to AniList
export const STATUS_MAPPING: Record<KenmeiStatus, MediaListStatus> = {
  reading: "CURRENT",
  completed: "COMPLETED",
  on_hold: "PAUSED",
  dropped: "DROPPED",
  plan_to_read: "PLANNING",
};

// Custom status mapping configuration
export interface StatusMappingConfig {
  reading: MediaListStatus;
  completed: MediaListStatus;
  on_hold: MediaListStatus;
  dropped: MediaListStatus;
  plan_to_read: MediaListStatus;
}

// Validation errors
export interface ValidationError {
  mangaTitle: string;
  field: string;
  message: string;
  index: number;
}

// Processing result
export interface ProcessingResult {
  processedEntries: KenmeiManga[];
  validationErrors: ValidationError[];
  totalEntries: number;
  successfulEntries: number;
}
