import { filterByAdvancedCriteria } from "@/components/sync/filtering";
import type { MangaMatchResult } from "@/api/anilist/types";
import type {
  AdvancedFilterMessage,
  AdvancedFilterResultMessage,
} from "../../types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";

/**
 * Returns whether a match violates the configured confidence range.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including confidence bounds.
 * @returns True if confidence is outside the allowed range.
 * @source
 */
function failsConfidenceFilter(
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
function failsFormatFilter(
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
function failsGenreFilter(
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
function failsStatusFilter(
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
function failsYearFilter(
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
  return filters.yearRange.max !== null && year > filters.yearRange.max;
}

/**
 * Returns whether a match violates the allowed tags filter.
 * @param match - The manga match result to evaluate.
 * @param filters - Advanced filters including tag constraints.
 * @returns True if no required tag is present.
 * @source
 */
function failsTagFilter(
  match: MangaMatchResult,
  filters: AdvancedMatchFilters,
): boolean {
  const tagsFilter = filters.tags ?? [];
  if (!tagsFilter || tagsFilter.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const tags = matchData?.tags || [];
  const tagNames = new Set(
    tags.map((t: { id: number; name: string; category?: string }) =>
      t.name.toLowerCase(),
    ),
  );
  return !tagsFilter.some((ft: string) => tagNames.has(ft.toLowerCase()));
}

/**
 * Computes per-criteria statistics for matches excluded by advanced filters.
 * @param matches - All matches before filtering.
 * @param filteredMatches - Matches that passed all filters.
 * @param filters - The advanced match filters applied.
 * @returns Counts per filter type and overall totals.
 * @source
 */
function computeFilterStats(
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

/**
 * Applies advanced filters in a worker and posts filtered results and stats.
 * @param message - Worker message containing matches and filter criteria.
 * @returns Void; posts result message via globalThis.postMessage.
 * @source
 */
export function handleAdvancedFilter(message: AdvancedFilterMessage): void {
  const { taskId, matches, filters } = message.payload;

  console.debug(
    `[Worker] 🔄 Starting advanced filter for task ${taskId} (${matches.length} matches)`,
  );

  try {
    const startTime = performance.now();
    const filterStartTime = performance.now();

    const filteredMatches = filterByAdvancedCriteria(matches, filters);

    const filterEndTime = performance.now();
    const totalTime = performance.now() - startTime;

    const statsRecord = computeFilterStats(matches, filteredMatches, filters);

    const stats = {
      totalMatches: statsRecord.totalMatches,
      filteredCount: statsRecord.filteredCount,
      confidenceFiltered: statsRecord.confidenceFiltered,
      formatFiltered: statsRecord.formatFiltered,
      genreFiltered: statsRecord.genreFiltered,
      statusFiltered: statsRecord.statusFiltered,
      yearFiltered: statsRecord.yearFiltered,
      tagFiltered: statsRecord.tagFiltered,
    };

    const result: AdvancedFilterResultMessage = {
      type: "ADVANCED_FILTER_RESULT",
      payload: {
        taskId,
        filteredMatches,
        stats,
        timing: {
          processingTimeMs: totalTime,
          filterApplicationTimeMs: filterEndTime - filterStartTime,
        },
      },
    };

    console.info(
      `[Worker] ✅ Advanced filter task ${taskId} completed (${filteredMatches.length}/${matches.length} matches in ${totalTime.toFixed(2)}ms)`,
    );

    globalThis.postMessage(result);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in advanced filter task ${taskId}:`,
      error,
    );
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });
  }
}
