/**
 * CSV Parsing Worker
 *
 * Offloads CSV parsing from the main thread to a worker.
 * Accumulates chunks and delegates to the shared parseKenmeiCsvExport() function
 * to ensure consistent parsing behavior between worker and main-thread paths.
 *
 * Message Protocol:
 * - CSV_START: Initialize parser with options and total file size
 * - CSV_CHUNK: Accumulate a chunk of CSV data
 * - CANCEL: Cancel parsing task
 * - PROGRESS: Report parsing progress (sent during chunk accumulation)
 * - CSV_COMPLETE: Final results with parsed manga and stats
 * - ERROR: Error during parsing
 */

import type {
  CSVStartMessage,
  CSVChunkMessage,
  WorkerMessage,
} from "./types";
import type { KenmeiStatus } from "@/api/kenmei/types";

/**
 * Parser state for each active task
 */
interface CSVParserState {
  taskId: string;
  csvBuffer: string;
  totalSize: number;
  processedBytes: number;
  defaultStatus: KenmeiStatus;
  startTime: number;
  isComplete: boolean;
}

/**
 * Active CSV parsing tasks tracked by taskId
 */
const activeTasks = new Set<string>();

/**
 * Task states indexed by taskId
 */
const parserStates = new Map<string, CSVParserState>();

/**
 * Handle CSV_START message - initialize parser state
 */
function handleCSVStart(message: CSVStartMessage): void {
  const { taskId, totalSize, options } = message.payload;

  if (activeTasks.has(taskId)) {
    console.warn(`[CSV Worker] Task ${taskId} already active, skipping restart`);
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

  parserStates.set(taskId, state);

  console.debug(
    `[CSV Worker] 🚀 Initialized parser for task ${taskId} with defaultStatus=${state.defaultStatus}, totalSize=${totalSize}B`
  );

  // Emit initial progress signal
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
 * Process a chunk of CSV data - accumulate into buffer and report progress
 */
function processCSVChunk(chunk: string, state: CSVParserState): void {
  state.csvBuffer += chunk;
  state.processedBytes += chunk.length;

  // Send progress update  
  globalThis.postMessage({
    type: "PROGRESS",
    payload: {
      taskId: state.taskId,
      processedBytes: state.processedBytes,
      totalBytes: state.totalSize,
    },
  });

  console.debug(
    `[CSV Worker] 📊 Progress for task ${state.taskId}: ${state.processedBytes}/${state.totalSize} bytes`
  );
}

/**
 * Finalize parsing when last chunk received - use shared parseKenmeiCsvExport
 */
async function finalizeCSVParsing(state: CSVParserState): Promise<void> {
  try {
    // Dynamically import the shared parser to ensure consistency
    const { parseKenmeiCsvExport } = await import("@/api/kenmei/parser");

    // Use the shared parser - same logic for both worker and main-thread
    const export_data = parseKenmeiCsvExport(state.csvBuffer, {
      defaultStatus: state.defaultStatus,
      validateStructure: true,
      allowPartialData: false,
    });

    const duration = performance.now() - state.startTime;

    console.info(
      `[CSV Worker] ✅ Task ${state.taskId}: Parsed ${export_data.manga.length} manga in ${duration.toFixed(2)}ms`
    );

    // Send completion message with stats
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
      `[CSV Worker] Failed to parse CSV for task ${state.taskId}:`,
      error
    );
    throw error;
  }
}

/**
 * Handle CSV_CHUNK message - process a chunk of CSV data
 */
function handleCSVChunk(message: CSVChunkMessage): void {
  const { taskId, chunk, isLastChunk } = message.payload;
  const state = parserStates.get(taskId);

  if (!state) {
    // If task is not active (e.g., cancelled), don't post an error
    if (!activeTasks.has(taskId)) {
      return;
    }
    
    console.error(
      `[CSV Worker] Task ${taskId} not found - did you send CSV_START first?`
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
      finalizeCSVParsing(state).then(() => {
        activeTasks.delete(taskId);
        parserStates.delete(taskId);
      }).catch((error) => {
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
        activeTasks.delete(taskId);
        parserStates.delete(taskId);
      });
    }
  } catch (error) {
    console.error(
      `[CSV Worker] Error processing chunk for task ${taskId}:`,
      error
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
    activeTasks.delete(taskId);
    parserStates.delete(taskId);
  }
}

/**
 * Handle cancel message
 */
function handleCancel(taskId: string): void {
  activeTasks.delete(taskId);
  parserStates.delete(taskId);
  console.debug(`[CSV Worker] ⏹️ Task ${taskId} cancelled`);
}

/**
 * Worker message handler
 */
globalThis.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "CSV_START":
        handleCSVStart(message);
        break;

      case "CSV_CHUNK":
        handleCSVChunk(message);
        break;

      case "CANCEL":
        handleCancel(message.payload.taskId);
        break;

      default: {
        console.warn(
          `[CSV Worker] Unknown message type: ${(message as any).type}`
        );
        // Send error response for unknown message types
        if ("payload" in message && "taskId" in (message as any).payload) {
          globalThis.postMessage({
            type: "ERROR",
            payload: {
              taskId: (message as any).payload.taskId,
              error: {
                message: `Unknown message type: ${(message as any).type}`,
              },
            },
          } as const);
        }
      }
    }
  } catch (error) {
    console.error("[CSV Worker] Unhandled error in worker:", error);
    if ("payload" in message && "taskId" in (message as any).payload) {
      globalThis.postMessage({
        type: "ERROR",
        payload: {
          taskId: (message as any).payload.taskId,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      });
    }
  }
};
