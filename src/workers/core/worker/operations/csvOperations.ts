import type { CSVParserState } from "../types";
import type { CSVStartMessage, CSVChunkMessage } from "../../types";
import { getErrorDetails } from "../errorUtils";

/** Active CSV parser states indexed by task ID. @source */
export const csvParserStates = new Map<string, CSVParserState>();

/**
 * Initializes a new CSV parsing task and parser state.
 * @param message - Worker message with task metadata and CSV options.
 * @param activeTasks - Set tracking active task IDs.
 * @returns Void; posts initial PROGRESS message.
 * @source
 */
export function handleCSVStart(
  message: CSVStartMessage,
  activeTasks: Set<string>,
): void {
  const { taskId, totalSize, options } = message.payload;

  if (activeTasks.has(taskId)) {
    console.warn(`[Worker] Task ${taskId} already active, skipping restart`);
    return;
  }

  activeTasks.add(taskId);

  const state: CSVParserState = {
    taskId,
    csvBuffer: "",
    totalSize,
    processedBytes: 0,
    defaultStatus: options.defaultStatus ?? "plan_to_read",
    startTime: performance.now(),
    isComplete: false,
  };

  csvParserStates.set(taskId, state);

  console.debug(
    `[Worker] 🚀 Initialized CSV parser for task ${taskId} with defaultStatus=${state.defaultStatus}, totalSize=${totalSize}B`,
  );

  globalThis.postMessage({
    type: "PROGRESS",
    payload: {
      taskId,
      processedBytes: 0,
      totalBytes: totalSize,
    },
  });
}

/**
 * Accumulates CSV chunk data and updates progress tracking.
 * @param chunk - Text chunk of CSV data to accumulate.
 * @param state - Current parser state to update.
 * @returns Void; posts PROGRESS message.
 * @source
 */
function processCSVChunk(chunk: string, state: CSVParserState): void {
  state.csvBuffer += chunk;
  state.processedBytes += chunk.length;

  globalThis.postMessage({
    type: "PROGRESS",
    payload: {
      taskId: state.taskId,
      processedBytes: state.processedBytes,
      totalBytes: state.totalSize,
    },
  });

  console.debug(
    `[Worker] 📊 CSV progress for task ${state.taskId}: ${state.processedBytes}/${state.totalSize} bytes`,
  );
}

/**
 * Parses the complete CSV buffer and posts parsed manga data.
 * @param state - Parser state containing accumulated CSV buffer.
 * @returns Promise that posts CSV_COMPLETE or throws on parse error.
 * @source
 */
async function finalizeCSVParsing(state: CSVParserState): Promise<void> {
  try {
    const { parseKenmeiCsvExport } = await import("@/api/kenmei/parser");

    const export_data = parseKenmeiCsvExport(state.csvBuffer, {
      defaultStatus: state.defaultStatus,
      validateStructure: true,
      allowPartialData: false,
    });

    const duration = performance.now() - state.startTime;

    console.info(
      `[Worker] ✅ CSV task ${state.taskId}: Parsed ${export_data.manga.length} manga in ${duration.toFixed(2)}ms`,
    );

    globalThis.postMessage({
      type: "CSV_COMPLETE",
      payload: {
        taskId: state.taskId,
        manga: export_data.manga,
        stats: {
          totalParsed: export_data.manga.length,
          processingTimeMs: duration,
          bytesProcessed: state.processedBytes,
        },
      },
    });

    state.isComplete = true;
  } catch (error) {
    console.error(
      `[Worker] Failed to parse CSV for task ${state.taskId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Handles CSV chunk messages; appends data and finalizes on last chunk.
 * @param message - Worker message containing CSV chunk data.
 * @param activeTasks - Set tracking active task IDs.
 * @returns Void; posts PROGRESS, CSV_COMPLETE, or ERROR.
 * @source
 */
export function handleCSVChunk(
  message: CSVChunkMessage,
  activeTasks: Set<string>,
): void {
  const { taskId, chunk, isLastChunk } = message.payload;
  const state = csvParserStates.get(taskId);

  if (!state) {
    if (!activeTasks.has(taskId)) {
      return;
    }

    console.error(
      `[Worker] Task ${taskId} not found - did you send CSV_START first?`,
    );
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: {
          message: `Task ${taskId} not found. Did you send CSV_START first?`,
        },
      },
    });
    return;
  }

  try {
    processCSVChunk(chunk, state);

    if (isLastChunk) {
      finalizeCSVParsing(state)
        .then(() => {
          activeTasks.delete(taskId);
          csvParserStates.delete(taskId);
        })
        .catch((error) => {
          globalThis.postMessage({
            type: "ERROR",
            payload: {
              taskId,
              error: getErrorDetails(error),
            },
          });
          activeTasks.delete(taskId);
          csvParserStates.delete(taskId);
        });
    }
  } catch (error) {
    console.error(
      `[Worker] Error processing CSV chunk for task ${taskId}:`,
      error,
    );
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: getErrorDetails(error),
      },
    });
    activeTasks.delete(taskId);
    csvParserStates.delete(taskId);
  }
}
