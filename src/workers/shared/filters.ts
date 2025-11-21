/**
 * Shared filter predicate utilities for advanced filtering operations.
 * Used by both worker operations and worker pools to ensure consistent filtering behavior.
 * @source
 */

import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matching-filters";

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
  const selectedEntry = match.selectedMatch
    ? match.anilistMatches?.find((m) => m.manga?.id === match.selectedMatch?.id)
    : match.anilistMatches?.[0];

  const matchConfidence = selectedEntry?.confidence;

  if (matchConfidence == null) {
    return false;
  }

  return (
    matchConfidence < filters.confidence.min ||
    matchConfidence > filters.confidence.max
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
  const matchManga = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  if (!matchManga?.format) {
    return false;
  }
  return !filters.formats.includes(matchManga.format);
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
  const matchManga = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const genres = matchManga?.genres;
  if (!genres?.length) {
    return false;
  }
  const genresLower = new Set(
    genres.map((genre: string) => genre.toLowerCase()),
  );
  return !filters.genres.some((filterGenre: string) =>
    genresLower.has(filterGenre.toLowerCase()),
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
  const matchManga = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  if (!matchManga?.status) {
    return false;
  }
  return !filters.publicationStatuses.includes(matchManga.status);
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
  const matchManga = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const year = matchManga?.startDate?.year;

  if (year == null) {
    return false;
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
  const matchManga = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const tags = matchManga?.tags;
  if (!tags?.length) {
    return false;
  }
  const tagNamesLower = new Set(tags.map((tag) => tag.name.toLowerCase()));
  return !filters.tags.some((filterTag: string) =>
    tagNamesLower.has(filterTag.toLowerCase()),
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
