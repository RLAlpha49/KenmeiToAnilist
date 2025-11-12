import { filterByAdvancedCriteria } from "@/components/sync/filtering";
import type { MangaMatchResult } from "@/api/anilist/types";
import type {
  AdvancedFilterMessage,
  AdvancedFilterResultMessage,
} from "../../types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";
import {
  failsConfidenceFilter,
  failsFormatFilter,
  failsGenreFilter,
  failsStatusFilter,
  failsYearFilter,
  failsTagFilter,
} from "@/workers/shared/filters";

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
