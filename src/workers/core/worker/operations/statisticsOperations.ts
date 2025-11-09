import type {
  StatisticsAggregationMessage,
  StatisticsAggregationResultMessage,
} from "../../types";
import { getErrorDetails } from "../errorUtils";

/**
 * Handle statistics aggregation message from main thread
 * Performs filtering, normalization, and aggregation of match/history data
 */
export async function handleStatisticsAggregation(
  message: StatisticsAggregationMessage,
  activeTasks: Set<string>,
): Promise<void> {
  const {
    taskId,
    matchResults,
    readingHistory,
    filters,
    comparisonMode,
    selectedTimeRange,
  } = message.payload;

  activeTasks.add(taskId);

  console.debug(
    `[Worker] 📊 Starting statistics aggregation for task ${taskId} (${matchResults.length} matches)`,
  );

  try {
    const startTime = performance.now();

    const {
      applyStatisticsFilters,
      buildComparisonDatasets,
      extractAvailableFilterOptions,
    } = await import("@/utils/statisticsAdapter");

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Statistics aggregation task ${taskId} was cancelled before filtering`,
      );
      return;
    }

    const filterStartTime = performance.now();

    const filteredData = applyStatisticsFilters(
      matchResults as unknown as import("@/utils/statisticsAdapter").NormalizedMatchForStats[],
      readingHistory as unknown as import("@/utils/storage").ReadingHistory,
      filters as unknown as import("@/types/statistics").StatisticsFilters,
    );

    const filteringTimeMs = performance.now() - filterStartTime;

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Statistics aggregation task ${taskId} was cancelled after filtering`,
      );
      return;
    }

    const aggregationStartTime = performance.now();

    const filterOptions = extractAvailableFilterOptions(
      filteredData.matchResults,
    );

    const comparisonDatasets =
      comparisonMode.enabled &&
      comparisonMode.primaryRange !== comparisonMode.secondaryRange
        ? buildComparisonDatasets(
            filteredData.readingHistory,
            comparisonMode.primaryRange as import("@/utils/statisticsAdapter").TimeRange,
            comparisonMode.secondaryRange as import("@/utils/statisticsAdapter").TimeRange,
          )
        : null;

    const aggregationTimeMs = performance.now() - aggregationStartTime;
    const totalTimeMs = performance.now() - startTime;

    const filterStr = JSON.stringify(filters);
    const comparisonStr = JSON.stringify(comparisonMode);
    const timeStr = selectedTimeRange;
    const keyStr = `stats:${filterStr}:${comparisonStr}:${timeStr}`;
    let hash = 0;
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.codePointAt(i);
      if (char === undefined) continue;
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    const cacheKey = `stats:${Math.abs(hash)}`;

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Statistics aggregation task ${taskId} was cancelled before completion`,
      );
      return;
    }

    const resultMsg: StatisticsAggregationResultMessage = {
      type: "STATISTICS_AGGREGATION_RESULT",
      payload: {
        taskId,
        filteredData: {
          matchResults: filteredData.matchResults,
          readingHistory: filteredData.readingHistory,
        },
        filterOptions,
        comparisonDatasets,
        cacheKey,
        timing: {
          filteringTimeMs,
          aggregationTimeMs,
          totalTimeMs,
        },
      },
    };

    console.info(
      `[Worker] ✅ Statistics aggregation task ${taskId} completed (${totalTimeMs.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in statistics aggregation task ${taskId}:`,
      error,
    );
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: getErrorDetails(error),
      },
    });
  } finally {
    activeTasks.delete(taskId);
  }
}
