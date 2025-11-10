import type {
  ReadingHistoryFilterMessage,
  ReadingHistoryFilterProgressMessage,
  ReadingHistoryFilterResultMessage,
} from "../../types";
import { getErrorDetails } from "../errorUtils";

/**
 * Normalizes a timestamp to a YYYY-MM-DD UTC date string.
 * @param timestamp - Milliseconds since epoch.
 * @returns ISO date string.
 * @source
 */
function normalizeDateToDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

/**
 * Computes the Monday (week start) for a timestamp.
 * @param timestamp - Milliseconds since epoch.
 * @returns ISO date string for the week start.
 * @source
 */
function getWeekStart(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff),
  );
  return weekStart.toISOString().split("T")[0];
}

/**
 * Filters and optionally aggregates reading history within a date range.
 * @param message - Worker message with history data and aggregation settings.
 * @param activeTasks - Set tracking active task IDs.
 * @returns Void; posts READING_HISTORY_FILTER_RESULT or ERROR.
 * @source
 */
export function handleReadingHistoryFilter(
  message: ReadingHistoryFilterMessage,
  activeTasks: Set<string>,
): void {
  const {
    taskId,
    history,
    dateRange,
    aggregationType = "none",
  } = message.payload;

  console.debug(
    `[Worker] 📚 Starting reading history filter for task ${taskId} (${history.entries.length} entries, aggregation: ${aggregationType})`,
  );

  activeTasks.add(taskId);

  try {
    const startTime = performance.now();

    const filterStartTime = performance.now();
    const filteredEntries = history.entries.filter(
      (entry) =>
        entry.timestamp >= dateRange.start && entry.timestamp <= dateRange.end,
    );

    console.debug(
      `[Worker] 🔍 Filtered ${filteredEntries.length}/${history.entries.length} entries within date range`,
    );

    const progressMsg: ReadingHistoryFilterProgressMessage = {
      type: "READING_HISTORY_FILTER_PROGRESS",
      payload: {
        taskId,
        stage: "filtering",
        progress: 50,
        message: `Filtered ${filteredEntries.length} entries`,
      },
    };
    globalThis.postMessage(progressMsg);

    const filteringTimeMs = performance.now() - filterStartTime;

    const aggregationStartTime = performance.now();

    const uniqueManga = new Set(filteredEntries.map((e) => e.mangaId));

    const totalChapters = filteredEntries.reduce(
      (sum, e) => sum + e.chaptersRead,
      0,
    );

    const activeDays = new Set(
      filteredEntries.map((e) => normalizeDateToDay(e.timestamp)),
    ).size;

    const averageChaptersPerDay =
      activeDays > 0 ? Math.round((totalChapters / activeDays) * 100) / 100 : 0;

    let aggregatedData:
      | Array<{
          date: string;
          chaptersRead: number;
          entriesCount: number;
        }>
      | undefined;

    if (aggregationType !== "none") {
      const aggregationMap = new Map<
        string,
        { chaptersRead: number; entriesCount: number }
      >();

      for (const entry of filteredEntries) {
        const key =
          aggregationType === "daily"
            ? normalizeDateToDay(entry.timestamp)
            : getWeekStart(entry.timestamp);

        const current = aggregationMap.get(key) || {
          chaptersRead: 0,
          entriesCount: 0,
        };
        aggregationMap.set(key, {
          chaptersRead: current.chaptersRead + entry.chaptersRead,
          entriesCount: current.entriesCount + 1,
        });
      }

      aggregatedData = Array.from(aggregationMap.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, data]) => ({
          date,
          chaptersRead: data.chaptersRead,
          entriesCount: data.entriesCount,
        }));

      console.debug(
        `[Worker] 📊 Aggregated ${aggregatedData.length} ${aggregationType} periods`,
      );
    }

    const aggregationTimeMs = performance.now() - aggregationStartTime;
    const totalTimeMs = performance.now() - startTime;

    const progressMsg2: ReadingHistoryFilterProgressMessage = {
      type: "READING_HISTORY_FILTER_PROGRESS",
      payload: {
        taskId,
        stage: "aggregation",
        progress: 90,
        message:
          aggregationType === "none"
            ? "Computing statistics"
            : `Aggregated data`,
      },
    };
    globalThis.postMessage(progressMsg2);

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Reading history filter task ${taskId} was cancelled before completion`,
      );
      return;
    }

    const resultMsg: ReadingHistoryFilterResultMessage = {
      type: "READING_HISTORY_FILTER_RESULT",
      payload: {
        taskId,
        filteredEntries,
        stats: {
          totalEntries: filteredEntries.length,
          totalChaptersRead: totalChapters,
          uniqueMangaCount: uniqueManga.size,
          dateRange,
          activeDays,
          averageChaptersPerDay,
        },
        aggregatedData,
        timing: {
          filteringTimeMs,
          aggregationTimeMs:
            aggregationType === "none" ? undefined : aggregationTimeMs,
          totalTimeMs,
        },
      },
    };

    console.info(
      `[Worker] ✅ Reading history filter task ${taskId} completed (${filteredEntries.length} entries, ${totalChapters} chapters in ${totalTimeMs.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in reading history filter task ${taskId}:`,
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
