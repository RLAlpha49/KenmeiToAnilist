/**
 * @packageDocumentation
 * @module SyncPage/filtering
 * @description Filtering and sorting logic for manga matches
 */

import {
  MangaMatchResult,
  UserMediaList,
  AniListManga,
} from "../../api/anilist/types";
import { SyncConfig } from "../../utils/storage";
import { getEffectiveStatus } from "./sync-utils";
import { FilterOptions, SortOption } from "./types";
import { AdvancedMatchFilters } from "../../types/matching-filters";

/**
 * Apply filters to manga matches based on status, changes, and library membership.
 * @param mangaMatches - Array of manga match results to filter.
 * @param filters - Filter options to apply.
 * @param userLibrary - User's existing AniList library.
 * @param syncConfig - Sync configuration for change detection.
 * @returns Filtered array of manga matches.
 * @source
 */
export function filterMangaMatches(
  mangaMatches: MangaMatchResult[],
  filters: FilterOptions,
  userLibrary: UserMediaList,
  syncConfig: SyncConfig,
): MangaMatchResult[] {
  const statusMap = {
    reading: "reading",
    completed: "completed",
    planned: "plan_to_read",
    paused: "on_hold",
    dropped: "dropped",
  } as const;

  const isStatusMatch = (match: MangaMatchResult) => {
    if (filters.status === "all") return true;
    const mapped = (statusMap as Record<string, string>)[filters.status];
    return mapped === match.kenmeiManga.status.toLowerCase();
  };

  const doesMatchChangeFilter = (match: MangaMatchResult) => {
    if (filters.changes === "all") return true;

    const anilist = match.selectedMatch!;
    const userEntry = userLibrary[anilist.id];

    const isCompletedAndPreserved =
      userEntry?.status === "COMPLETED" && syncConfig.preserveCompletedStatus;

    if (isCompletedAndPreserved) {
      return filters.changes !== "with-changes";
    }

    const changeCount = getChangeCount(match, userLibrary, syncConfig);
    const hasChanges = changeCount > 0;

    if (filters.changes === "with-changes") return hasChanges;
    if (filters.changes === "no-changes") return !hasChanges;
    return true;
  };

  const isLibraryMatch = (match: MangaMatchResult) => {
    if (filters.library === "all") return true;
    const anilist = match.selectedMatch!;
    const isNewEntry = !userLibrary[anilist.id];
    if (filters.library === "new") return isNewEntry;
    if (filters.library === "existing") return !isNewEntry;
    return true;
  };

  return mangaMatches
    .filter((match) => match.status === "matched" || match.status === "manual")
    .filter((match) => match.selectedMatch !== undefined)
    .filter(
      (match) =>
        isStatusMatch(match) &&
        doesMatchChangeFilter(match) &&
        isLibraryMatch(match),
    );
}

/**
 * Calculate the number of fields that will change for a manga match.
 * Returns 0 for completed (preserved) entries, 3 for new entries, else count of changed fields.
 * @param match - The manga match result.
 * @param userLibrary - User's existing AniList library.
 * @param syncConfig - Sync configuration for change detection.
 * @returns Number of fields that will change.
 * @source
 */
function getChangeCount(
  match: MangaMatchResult,
  userLibrary: UserMediaList,
  syncConfig: SyncConfig,
): number {
  const anilist = match.selectedMatch!;
  const kenmei = match.kenmeiManga;
  const userEntry = userLibrary[anilist.id];
  const isCompleted =
    userEntry?.status === "COMPLETED" && syncConfig.preserveCompletedStatus;

  if (isCompleted) return 0;
  if (!userEntry) return 3; // New entry, all fields will change

  const shouldUpdateStatus =
    !syncConfig.prioritizeAniListStatus &&
    getEffectiveStatus(kenmei, syncConfig) !== userEntry.status;

  const shouldUpdateProgress = syncConfig.prioritizeAniListProgress
    ? (kenmei.chaptersRead || 0) > (userEntry.progress || 0)
    : (kenmei.chaptersRead || 0) !== (userEntry.progress || 0);

  const anilistScore = Number(userEntry.score);
  const kenmeiScore = Number(kenmei.score || 0);

  const shouldUpdateScore =
    !syncConfig.prioritizeAniListScore &&
    kenmei.score > 0 &&
    (anilistScore === 0 || Math.abs(kenmeiScore - anilistScore) >= 0.5);

  // Check if privacy will change
  const shouldUpdatePrivacy = syncConfig.setPrivate && !userEntry.private;

  return (
    (shouldUpdateStatus ? 1 : 0) +
    (shouldUpdateProgress ? 1 : 0) +
    (shouldUpdateScore ? 1 : 0) +
    (shouldUpdatePrivacy ? 1 : 0)
  );
}

/**
 * Sort filtered manga matches by the selected field and direction.
 * @param filteredMatches - Array of manga matches to sort.
 * @param sortOption - Sort field and direction.
 * @param userLibrary - User's existing AniList library for change counting.
 * @param syncConfig - Sync configuration for change detection.
 * @returns Sorted array of manga matches.
 * @source
 */
export function sortMangaMatches(
  filteredMatches: MangaMatchResult[],
  sortOption: SortOption,
  userLibrary: UserMediaList,
  syncConfig: SyncConfig,
): MangaMatchResult[] {
  return [...filteredMatches].sort((a, b) => {
    const anilistA = a.selectedMatch!;
    const anilistB = b.selectedMatch!;
    const kenmeiA = a.kenmeiManga;
    const kenmeiB = b.kenmeiManga;

    // Sort based on the selected field
    let comparison = 0;

    switch (sortOption.field) {
      case "title":
        comparison = (anilistA.title.romaji || kenmeiA.title).localeCompare(
          anilistB.title.romaji || kenmeiB.title,
        );
        break;
      case "status":
        comparison = kenmeiA.status.localeCompare(kenmeiB.status);
        break;
      case "progress":
        comparison = (kenmeiA.chaptersRead || 0) - (kenmeiB.chaptersRead || 0);
        break;
      case "score":
        comparison = (kenmeiA.score || 0) - (kenmeiB.score || 0);
        break;
      case "changes":
        comparison =
          getChangeCount(b, userLibrary, syncConfig) -
          getChangeCount(a, userLibrary, syncConfig);
        break;
    }

    // Apply sort direction
    return sortOption.direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Computes the confidence score for a manga match.
 * @param match - The manga match result
 * @returns The confidence score (0 if not found)
 */
function computeMatchConfidence(match: MangaMatchResult): number {
  if (match.selectedMatch && match.anilistMatches) {
    const selectedEntry = match.anilistMatches.find(
      (m) => m.manga?.id === match.selectedMatch?.id,
    );
    return selectedEntry?.confidence ?? 0;
  }
  return match.anilistMatches?.length
    ? (match.anilistMatches[0].confidence ?? 0)
    : 0;
}

/**
 * Checks if a manga match confidence score is within the configured range.
 * @param confidence - The match confidence score
 * @param confidenceRange - The acceptable confidence range
 * @returns True if the confidence value falls inside the acceptable range
 */
function isConfidenceWithinRange(
  confidence: number,
  confidenceRange: { min: number; max: number },
): boolean {
  return confidence >= confidenceRange.min && confidence <= confidenceRange.max;
}

/**
 * Checks if a manga match format is allowed by the filters.
 * @param matchData - The manga data to check
 * @param formats - Array of acceptable formats
 * @returns True if the manga format is listed or no formats are configured
 */
function isFormatAllowed(
  matchData: AniListManga | undefined,
  formats: string[],
): boolean {
  if (formats.length === 0) return true;
  return !!(matchData?.format && formats.includes(matchData.format));
}

/**
 * Checks if a manga match genres contain at least one configured genre.
 * @param matchData - The manga data to check
 * @param genres - Array of acceptable genres
 * @returns True if any filter genres appear in the match data
 */
function isGenreAllowed(
  matchData: AniListManga | undefined,
  genres: string[],
): boolean {
  if (genres.length === 0) return true;
  const matchGenres = matchData?.genres || [];
  const genresLower = new Set(matchGenres.map((g: string) => g.toLowerCase()));
  return genres.some((filterGenre) =>
    genresLower.has(filterGenre.toLowerCase()),
  );
}

/**
 * Checks if the publication status of the match is part of the configured list.
 * @param matchData - The manga data to check
 * @param statuses - Array of acceptable statuses
 * @returns True if the match status matches one of the filter statuses
 */
function isStatusAllowed(
  matchData: AniListManga | undefined,
  statuses: string[],
): boolean {
  if (statuses.length === 0) return true;
  return !!(matchData?.status && statuses.includes(matchData.status));
}

/**
 * Checks if a manga match start year is within the configured bounds.
 * @param matchData - The manga data to check
 * @param yearRange - The acceptable year range
 * @returns True if the manga start year falls between the configured minimum and maximum
 */
function isYearWithinRange(
  matchData: AniListManga | undefined,
  yearRange: { min: number | null; max: number | null } | undefined,
): boolean {
  if (!yearRange || (yearRange.min === null && yearRange.max === null)) {
    return true;
  }

  const year = matchData?.startDate?.year;
  if (!year) return false;

  if (yearRange.min !== null && year < yearRange.min) return false;
  if (yearRange.max !== null && year > yearRange.max) return false;

  return true;
}

/**
 * Checks if a manga match contains at least one of the configured tags.
 * @param matchData - The manga data to check
 * @param tags - Array of acceptable tags
 * @returns True if any filter tag is present on the match
 */
function isTagAllowed(
  matchData: AniListManga | undefined,
  tags: string[] | undefined,
): boolean {
  if (!tags || tags.length === 0) return true;
  const matchTags = matchData?.tags || [];
  const tagNamesLower = new Set(
    matchTags.map((t: { name: string }) => t.name.toLowerCase()),
  );
  return tags.some((filterTag) => tagNamesLower.has(filterTag.toLowerCase()));
}

/**
 * Filter manga matches by advanced criteria (confidence, format, genres, publication status).
 * @param matches - Array of manga match results to filter.
 * @param filters - Advanced filter options to apply.
 * @returns Filtered array of manga matches.
 */
export function filterByAdvancedCriteria(
  matches: MangaMatchResult[],
  filters: AdvancedMatchFilters,
): MangaMatchResult[] {
  return matches.filter((match) => {
    // Get the match data (prefer selectedMatch, fallback to first anilistMatch)
    const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;

    // Compute and check confidence
    const confidence = computeMatchConfidence(match);
    if (!isConfidenceWithinRange(confidence, filters.confidence)) {
      return false;
    }

    // Check all filters
    return (
      isFormatAllowed(matchData, filters.formats) &&
      isGenreAllowed(matchData, filters.genres) &&
      isStatusAllowed(matchData, filters.publicationStatuses) &&
      isYearWithinRange(matchData, filters.yearRange) &&
      isTagAllowed(matchData, filters.tags)
    );
  });
}

/**
 * Extract unique genres from manga match results for filter options.
 * @param matches - Array of manga match results.
 * @returns Sorted array of unique genre strings.
 */
export function extractUniqueGenres(matches: MangaMatchResult[]): string[] {
  const genreSet = new Set<string>();

  for (const match of matches) {
    const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
    const genres = matchData?.genres || [];

    for (const genre of genres) {
      if (genre?.trim()) {
        genreSet.add(genre.trim());
      }
    }
  }

  return Array.from(genreSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract unique formats from manga match results for filter options.
 * @param matches - Array of manga match results.
 * @returns Array of unique format strings.
 */
export function extractUniqueFormats(matches: MangaMatchResult[]): string[] {
  const formatSet = new Set<string>();

  for (const match of matches) {
    const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
    const format = matchData?.format;

    if (format) {
      formatSet.add(format);
    }
  }

  return Array.from(formatSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract unique publication statuses from manga match results for filter options.
 * @param matches - Array of manga match results.
 * @returns Array of unique status strings.
 */
export function extractUniqueStatuses(matches: MangaMatchResult[]): string[] {
  const statusSet = new Set<string>();

  for (const match of matches) {
    const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
    const status = matchData?.status;

    if (status) {
      statusSet.add(status);
    }
  }

  return Array.from(statusSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract unique tags from manga match results for filter options.
 * Limits to top 100 most common tags for performance, but always includes selected tags.
 * @param matches - Array of manga match results.
 * @param selectedTags - Array of currently selected tags to ensure they remain visible.
 * @returns Array of unique tag names, sorted alphabetically.
 */
export function extractUniqueTags(
  matches: MangaMatchResult[],
  selectedTags?: string[],
): string[] {
  const tagCountMap = new Map<string, number>();

  for (const match of matches) {
    const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
    const tags = matchData?.tags || [];

    for (const tag of tags) {
      if (tag.name) {
        tagCountMap.set(tag.name, (tagCountMap.get(tag.name) || 0) + 1);
      }
    }
  }

  // Sort by frequency (most common first), then alphabetically
  const sortedTags = Array.from(tagCountMap.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1]; // Sort by frequency descending
      }
      return a[0].localeCompare(b[0]); // Then alphabetically
    })
    .map((entry) => entry[0]);

  // Return top 100 tags, but ensure selected tags are always included
  const top100 = sortedTags.slice(0, 100);
  const selectedTagsSet = new Set(selectedTags || []);
  const missingSelectedTags = top100
    .filter((tag) => !selectedTagsSet.has(tag))
    .concat(Array.from(selectedTagsSet).filter((tag) => !top100.includes(tag)))
    .sort((a, b) => a.localeCompare(b));

  // Combine top 100 with any missing selected tags
  return Array.from(new Set([...top100, ...missingSelectedTags]));
}

/**
 * Extract year range from manga match results.
 * @param matches - Array of manga match results.
 * @returns Object with min and max years found, or null if no years found.
 */
export function extractYearRange(matches: MangaMatchResult[]): {
  min: number | null;
  max: number | null;
} {
  let minYear: number | null = null;
  let maxYear: number | null = null;

  for (const match of matches) {
    const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
    const year = matchData?.startDate?.year;

    if (year) {
      if (minYear === null || year < minYear) {
        minYear = year;
      }
      if (maxYear === null || year > maxYear) {
        maxYear = year;
      }
    }
  }

  return { min: minYear, max: maxYear };
}
