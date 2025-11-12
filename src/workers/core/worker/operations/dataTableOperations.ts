import type {
  DataTablePreparationMessage,
  DataTablePreparationProgressMessage,
  DataTablePreparationResultMessage,
} from "../../types";
import { getErrorDetails } from "../errorUtils";

/**
 * Prepares data table slice for virtualization with formatting, row metadata computation, and cache keys.
 * Stages: (1) formats display values, (2) computes virtualization indexes and cache keys, (3) returns result.
 * @param message - Worker message with table data, viewport, and column visibility.
 * @param activeTasks - Set tracking active task IDs.
 * @returns Void; posts progress and result messages.
 * @source
 */
export function handleDataTablePreparation(
  message: DataTablePreparationMessage,
  activeTasks: Set<string>,
): void {
  const { taskId, data, viewport, columnVisibility } = message.payload;

  activeTasks.add(taskId);

  console.debug(
    `[Worker] 📊 Starting data table preparation for task ${taskId} (${data.length} items, viewport: ${viewport.startIndex}-${viewport.endIndex})`,
  );

  const startTime = performance.now();

  try {
    const progressMsg1: DataTablePreparationProgressMessage = {
      type: "DATA_TABLE_PREPARATION_PROGRESS",
      payload: {
        taskId,
        stage: "formatting",
        progress: 25,
        message: `Formatting ${viewport.endIndex - viewport.startIndex} rows`,
      },
    };
    globalThis.postMessage(progressMsg1);

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Data table preparation task ${taskId} was cancelled before formatting`,
      );
      globalThis.postMessage({
        type: "DATA_TABLE_CANCELLED",
        payload: {
          taskId,
          stage: "formatting",
        },
      });
      return;
    }

    const formattingStartTime = performance.now();

    const slice = data.slice(viewport.startIndex, viewport.endIndex);

    const preparedData = slice.map((item) => {
      const statusDisplayValue = item.status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      let scoreDisplayValue = "-";
      if (columnVisibility.score && item.score !== undefined) {
        scoreDisplayValue = item.score > 0 ? item.score.toString() : "-";
      }

      let chaptersDisplayValue = "-";
      if (columnVisibility.chapters && item.chapters_read !== undefined) {
        chaptersDisplayValue =
          item.chapters_read > 0 ? item.chapters_read.toString() : "0";
      }

      let volumesDisplayValue = "-";
      if (columnVisibility.volumes && item.volumes_read !== undefined) {
        volumesDisplayValue =
          item.volumes_read > 0 ? item.volumes_read.toString() : "0";
      }

      const lastReadDate = item.last_read_at || item.updated_at;
      const lastReadDisplayValue =
        columnVisibility.lastRead && lastReadDate
          ? (() => {
              try {
                const date = new Date(lastReadDate);
                return date.toLocaleDateString();
              } catch {
                return "-";
              }
            })()
          : "-";

      const titleLength = item.title.length;
      const titleLines = Math.max(1, Math.ceil(titleLength / 40));
      const baseRowHeight = 40;
      const additionalHeight = (titleLines - 1) * 20;
      const rowHeight = baseRowHeight + additionalHeight;

      return {
        original: item,
        formattedValues: {
          status: statusDisplayValue,
          score: scoreDisplayValue,
          chapters: chaptersDisplayValue,
          volumes: volumesDisplayValue,
          lastRead: lastReadDisplayValue,
        },
        rowHeight,
      };
    });

    const formattingTimeMs = performance.now() - formattingStartTime;

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Data table preparation task ${taskId} was cancelled before metadata computation`,
      );
      globalThis.postMessage({
        type: "DATA_TABLE_CANCELLED",
        payload: {
          taskId,
          stage: "metadata",
        },
      });
      return;
    }

    const metadataStartTime = performance.now();

    const progressMsg2: DataTablePreparationProgressMessage = {
      type: "DATA_TABLE_PREPARATION_PROGRESS",
      payload: {
        taskId,
        stage: "computing-metadata",
        progress: 75,
        message: `Computing row metadata`,
      },
    };
    globalThis.postMessage(progressMsg2);

    // Compute virtualization indexes and cache keys for efficient rendering
    const cumulativeHeights: number[] = [];
    let cumulativeHeight = 0;
    for (const row of preparedData) {
      cumulativeHeight += row.rowHeight;
      cumulativeHeights.push(cumulativeHeight);
    }

    const totalRowHeights = cumulativeHeights.at(-1) || 0;

    const metadataComputationTimeMs = performance.now() - metadataStartTime;
    const totalTimeMs = performance.now() - startTime;

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Data table preparation task ${taskId} was cancelled before completion`,
      );
      globalThis.postMessage({
        type: "DATA_TABLE_CANCELLED",
        payload: {
          taskId,
          stage: "completion",
        },
      });
      return;
    }

    const resultMsg: DataTablePreparationResultMessage = {
      type: "DATA_TABLE_PREPARATION_RESULT",
      payload: {
        taskId,
        preparedData,
        indexInfo: {
          startIndex: viewport.startIndex,
          endIndex: viewport.endIndex,
          totalCount: data.length,
        },
        timing: {
          formattingTimeMs,
          metadataComputationTimeMs,
          totalTimeMs,
        },
      },
    };

    console.info(
      `[Worker] ✅ Data table preparation task ${taskId} completed (${slice.length} rows, avg height: ${(totalRowHeights / slice.length).toFixed(1)}px, ${totalTimeMs.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in data table preparation task ${taskId}:`,
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
