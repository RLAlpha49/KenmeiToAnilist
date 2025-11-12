/**
 * Shared filter predicate utilities for advanced filtering operations.
 * Used by both worker operations and worker pools to ensure consistent filtering behavior.
 * @source
 */

import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";

/**
 * Returns whether a match violates the configured confidence range.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including confidence bounds.
 * @returns True if confidence is outside the allowed range.
 * @source
 */
export function failsConfidenceFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  let confidence = 0;

  if (match.selectedMatch && match.anilistMatches) {
    const selectedEntry = match.anilistMatches.find(
      (m) => m.manga?.id === match.selectedMatch?.id,
    );
    confidence = selectedEntry?.confidence ?? 0;
  } else if (match.anilistMatches?.length) {
    confidence = match.anilistMatches[0].confidence ?? 0;
  }

  return (
    confidence < filters.confidence.min || confidence > filters.confidence.max
  );
}

/**
 * Returns whether a match violates the allowed formats filter.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including allowed formats.
 * @returns True if no acceptable format is present.
 * @source
 */
export function failsFormatFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (filters.formats.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  return !matchData?.format || !filters.formats.includes(matchData.format);
}

/**
 * Returns whether a match violates the allowed genres filter.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including required genres.
 * @returns True if no required genre is present.
 * @source
 */
export function failsGenreFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (filters.genres.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const genres = matchData?.genres || [];
  const genresLower = new Set(genres.map((g: string) => g.toLowerCase()));
  return !filters.genres.some((fg: string) =>
    genresLower.has(fg.toLowerCase()),
  );
}

/**
 * Returns whether a match violates the allowed publication statuses.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including allowed statuses.
 * @returns True if status is not permitted.
 * @source
 */
export function failsStatusFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (filters.publicationStatuses.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  return (
    !matchData?.status ||
    !filters.publicationStatuses.includes(matchData.status)
  );
}

/**
 * Returns whether a match violates the configured release year range.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including year bounds.
 * @returns True if year is outside the allowed range or missing.
 * @source
 */
export function failsYearFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (!filters.yearRange) {
    return false;
  }
  if (filters.yearRange.min === null && filters.yearRange.max === null) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const year = matchData?.startDate?.year;

  if (year === undefined) {
    return true;
  }

  if (filters.yearRange.min !== null && year < filters.yearRange.min) {
    return true;
  }

  if (filters.yearRange.max !== null && year > filters.yearRange.max) {
    return true;
  }

  return false;
}

/**
 * Returns whether a match violates the allowed tags filter.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including required tags.
 * @returns True if no required tag is present.
 * @source
 */
export function failsTagFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  if (!filters.tags || filters.tags.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const tags = matchData?.tags || [];
  const tagNamesLower = new Set(tags.map((t) => t.name.toLowerCase()));
  return !filters.tags.some((ft: string) =>
    tagNamesLower.has(ft.toLowerCase()),
  );
}

/**
 * Determines if a match should be filtered out based on all active filters.
 * @param match - The manga match result to evaluate.
 * @param filters - All active advanced filters.
 * @returns True if the match should be excluded from results.
 * @source
 */
export function shouldFilterOutMatch(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  return (
    failsConfidenceFilter(match, filters) ||
    failsFormatFilter(match, filters) ||
    failsGenreFilter(match, filters) ||
    failsStatusFilter(match, filters) ||
    failsYearFilter(match, filters) ||
    failsTagFilter(match, filters)
  );
}

/**
 * Analyzes a filtered match to determine the primary reason it was excluded.
 * @param match - The manga match result that was filtered out.
 * @param filters - All active advanced filters.
 * @returns Human-readable reason for exclusion.
 * @source
 */
export function getFilterReason(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): string {
  if (failsConfidenceFilter(match, filters)) {
    return "Confidence out of range";
  }
  if (failsFormatFilter(match, filters)) {
    return "Format not allowed";
  }
  if (failsGenreFilter(match, filters)) {
    return "Missing required genre";
  }
  if (failsStatusFilter(match, filters)) {
    return "Publication status not allowed";
  }
  if (failsYearFilter(match, filters)) {
    return "Release year out of range";
  }
  if (failsTagFilter(match, filters)) {
    return "Missing required tag";
  }
  return "Unknown filter reason";
}
