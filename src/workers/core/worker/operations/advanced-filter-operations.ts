import { filterByAdvancedCriteria } from "@/components/sync/filtering";
import type {
  AdvancedFilterMessage,
  AdvancedFilterResultMessage,
} from "../../types";
import { computeFilterStats } from "../../pool-utils";

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
