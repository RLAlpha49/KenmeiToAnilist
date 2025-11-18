/**
 * Type definitions for statistics-specific types
 */

import type { MatchStatus } from "@/api/anilist/types";
import type {
  TimeRange,
  NormalizedMatchForStats,
} from "@/utils/statistics-adapter";
import type { ReadingHistory } from "@/utils/storage";

/**
 * Filter state structure for statistics
 */
export interface StatisticsFilters {
  /** Selected genres to filter by */
  genres: string[];
  /** Selected formats (MANGA, NOVEL, etc.) */
  formats: string[];
  /** Selected tags to filter by */
  tags: string[];
  /** Selected match statuses (matched, pending, etc.) */
  statuses: MatchStatus[];
  /** Custom date range */
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  /** Confidence score range (0-100) */
  confidenceRange: {
    min: number;
    max: number;
  };
}

/**
 * Comparison state structure
 */
export interface ComparisonMode {
  /** Whether comparison mode is active */
  enabled: boolean;
  /** First time period to compare */
  primaryRange: TimeRange;
  /** Second time period to compare */
  secondaryRange: TimeRange;
  /** Which metric to compare */
  metric: "chapters" | "velocity" | "habits";
}

/**
 * Drill-down modal data structure
 */
export interface DrillDownData {
  /** What was clicked */
  type: "genre" | "format" | "status" | "date";
  /** The specific value clicked (e.g., "Action" genre) */
  value: string;
  /** Detailed breakdown */
  data: Array<{
    title: string;
    chapters: number;
    status: string;
    confidence?: number;
    format?: string;
  }>;
}

/**
 * Filtered statistics data passed to charts
 */
export interface FilteredStatisticsData {
  /** Filtered matches */
  matchResults: NormalizedMatchForStats[];
  /** Filtered history */
  readingHistory: ReadingHistory;
  /** Active filters for display */
  appliedFilters: StatisticsFilters;
}

/**
 * Default filter values (no filtering)
 */
export const defaultStatisticsFilters: StatisticsFilters = {
  genres: [],
  formats: [],
  tags: [],
  statuses: [],
  dateRange: {
    start: null,
    end: null,
  },
  confidenceRange: {
    min: 0,
    max: 100,
  },
};
