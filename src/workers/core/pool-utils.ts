/**
 * Shared utilities for worker pool implementations.
 * Provides common ID generation, statistics computation, and task helpers.
 * @source
 */

import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matching-filters";
import {
  failsConfidenceFilter,
  failsFormatFilter,
  failsGenreFilter,
  failsStatusFilter,
  failsYearFilter,
  failsTagFilter,
} from "../shared/filters";

/**
 * Generates a unique task ID using timestamp and random string.
 * Format: `prefix_timestamp_randomstring`
 * @param prefix - Prefix for the task ID (e.g., 'filter', 'duplicate', 'fuzzy_search')
 * @returns Unique task ID string
 * @source
 */
export function generateTaskId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generates a RFC4122-like UUID for task identification.
 * @returns UUID string
 * @source
 */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(
    /[xy]/g,
    function (c) {
      const r = Math.trunc(Math.random() * 16);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
}

/**
 * Computes aggregated statistics explaining how filters affected the result set.
 * Used by both filter-worker-pool and duplicate-worker-pool to track
 * which filter criteria excluded which matches.
 * @param matches - All matches before filtering
 * @param filteredMatches - Matches that passed all filters
 * @param filters - The advanced match filters applied
 * @returns Counts per filter type and overall totals
 * @source
 */
export function computeFilterStats(
  matches: MangaMatchResult[],
  filteredMatches: MangaMatchResult[],
  filters: AdvancedMatchFilters,
): Record<string, number> {
  const filteredMatchIds = new Set(
    filteredMatches.map((m) => m.kenmeiManga.id),
  );
  const excludedMatches = matches.filter(
    (m) => !filteredMatchIds.has(m.kenmeiManga.id),
  );

  let confidenceFiltered = 0;
  let formatFiltered = 0;
  let genreFiltered = 0;
  let statusFiltered = 0;
  let yearFiltered = 0;
  let tagFiltered = 0;

  for (const match of excludedMatches) {
    if (failsConfidenceFilter(match, filters)) {
      confidenceFiltered++;
    }
    if (failsFormatFilter(match, filters)) {
      formatFiltered++;
    }
    if (failsGenreFilter(match, filters)) {
      genreFiltered++;
    }
    if (failsStatusFilter(match, filters)) {
      statusFiltered++;
    }
    if (failsYearFilter(match, filters)) {
      yearFiltered++;
    }
    if (failsTagFilter(match, filters)) {
      tagFiltered++;
    }
  }

  return {
    totalMatches: matches.length,
    filteredCount: filteredMatches.length,
    confidenceFiltered,
    formatFiltered,
    genreFiltered,
    statusFiltered,
    yearFiltered,
    tagFiltered,
  };
}
