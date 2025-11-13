import type { KenmeiManga } from "@/api/kenmei/types";
import type { CSVParserState } from "../types";
import type { CSVStartMessage, CSVChunkMessage } from "../../types";
import { getErrorDetails } from "../errorUtils";

/** Maximum buffer size before flushing rows (500KB) @source */
const MAX_BUFFER_SIZE = 500 * 1024;

/** Maximum acceptable CSV file size (100MB) @source */
const MAX_CSV_SIZE = 100 * 1024 * 1024;

/** Maximum rows to accumulate before progress update (1000 rows) @source */
const ROWS_BATCH_SIZE = 1000;

/** Active CSV parser states indexed by task ID. @source */
export const csvParserStates = new Map<string, CSVParserState>();

/**
 * Splits CSV string by line, respecting quoted fields that may contain newlines.
 * Returns array of lines with incomplete trailing line preserved.
 * @source
 */
function splitCSVLines(csv: string): { lines: string[]; remainder: string } {
  const lines: string[] = [];
  let remainder = "";
  let inQuotes = false;
  let currentLine = "";
  let i = 0;

  while (i < csv.length) {
    const char = csv[i];

    // Handle quote toggling: only toggle on a quote not part of a doubled-quote escape (CSV uses "")
    if (char === '"') {
      const nextChar = csv[i + 1];
      if (nextChar === '"') {
        // This is an escaped quote (""), add both to line and skip the next one
        currentLine += '""';
        i++; // Skip the next quote
      } else {
        // This is a toggle quote (not escaped)
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === "\r" && csv[i + 1] === "\n" && !inQuotes) {
      // Handle Windows newline (\r\n) while not in quotes
      lines.push(currentLine);
      currentLine = "";
      i++; // Skip the \n
    } else if (char === "\n" && !inQuotes) {
      // Handle Unix newline (\n) while not in quotes
      lines.push(currentLine);
      currentLine = "";
    } else {
      // Regular character (including quotes inside double-quotes)
      currentLine += char;
    }

    i++;
  }

  remainder = currentLine;
  return { lines, remainder };
}

/**
 * Parses accumulated CSV text and returns parsed manga entries.
 * Uses the public parseKenmeiCsvExport API for incremental segment parsing.
 * @source
 */
async function parseCSVBufferSegment(
  csvText: string,
  defaultStatus: string,
): Promise<KenmeiManga[]> {
  try {
    const { parseKenmeiCsvExport } = await import("@/api/kenmei/parser");

    // Parse the CSV segment with the public API
    const exportData = parseKenmeiCsvExport(csvText, {
      defaultStatus: defaultStatus as import("@/api/kenmei/types").KenmeiStatus,
      validateStructure: true,
      allowPartialData: true, // Allow partial data since we're streaming
    });

    return exportData.manga;
  } catch (error) {
    console.error("[Worker] Error parsing CSV buffer segment:", error);
    throw error;
  }
}

/**
 * Initializes a new CSV parsing task with incremental/streaming parser state.
 * Tracks partial lines across chunks and accumulates parsed rows for progressive output.
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

  // Validate file size is not excessively large
  if (totalSize > MAX_CSV_SIZE) {
    console.error(
      `[Worker] CSV file too large: ${totalSize} bytes (max ${MAX_CSV_SIZE})`,
    );
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: {
          message: `CSV file size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum of ${MAX_CSV_SIZE / 1024 / 1024}MB. Please import a smaller CSV file.`,
          name: "CSVSizeExceeded",
        },
      },
    });
    return;
  }

  activeTasks.add(taskId);

  const state = {
    taskId,
    csvBuffer: "", // Buffer for incomplete lines
    totalSize,
    processedBytes: 0,
    defaultStatus: options.defaultStatus ?? "plan_to_read",
    startTime: performance.now(),
    isComplete: false,
  };

  csvParserStates.set(taskId, state);

  console.debug(
    `[Worker] 🚀 Initialized CSV parser for task ${taskId} with defaultStatus=${state.defaultStatus}, totalSize=${totalSize}B, streaming enabled`,
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
 * Processes CSV chunk with incremental/streaming parsing.
 * Accumulates complete lines in a buffer, parses them when buffer exceeds size limit,
 * and flushes parsed results to reduce memory footprint.
 * @param chunk - Text chunk of CSV data to accumulate.
 * @param state - Current parser state to update.
 * @returns Promise that resolves after parsing and flushing if needed.
 * @source
 */
async function processCSVChunkIncremental(
  chunk: string,
  state: ReturnType<typeof csvParserStates.get>,
): Promise<void> {
  if (!state) return;

  // Append chunk to buffer
  state.csvBuffer += chunk;
  state.processedBytes += chunk.length;

  // Check buffer size and parse if exceeding threshold
  const bufferSize = state.csvBuffer.length;
  if (bufferSize > MAX_BUFFER_SIZE) {
    const newlyParsedRows = await flushBufferAndParseRows(state);

    // Initialize pending batch if needed
    state.pendingBatch ??= [];

    // Track total parsed rows
    state.totalParsedRows =
      (state.totalParsedRows ?? 0) + newlyParsedRows.length;

    // Add newly parsed rows to pending batch
    state.pendingBatch.push(...newlyParsedRows);

    // Emit batch if it reaches the threshold
    if (state.pendingBatch.length >= ROWS_BATCH_SIZE) {
      const batchToEmit = state.pendingBatch.splice(0, ROWS_BATCH_SIZE);
      globalThis.postMessage({
        type: "CSV_ROWS",
        payload: {
          taskId: state.taskId,
          rows: batchToEmit,
        },
      });

      console.debug(
        `[Worker] 📤 Emitted CSV_ROWS batch of ${batchToEmit.length} rows for task ${state.taskId}`,
      );
    }
  } else if (bufferSize > 0) {
    // Post progress by processed bytes
    globalThis.postMessage({
      type: "PROGRESS",
      payload: {
        taskId: state.taskId,
        processedBytes: state.processedBytes,
        totalBytes: state.totalSize,
        parsedRowsCount:
          (state.totalParsedRows ?? 0) + (state.pendingBatch?.length ?? 0),
      },
    });

    console.debug(
      `[Worker] 📊 CSV incremental progress for task ${state.taskId}: ${state.processedBytes}/${state.totalSize} bytes (pending batch: ${state.pendingBatch?.length ?? 0}, buffer: ${(bufferSize / 1024).toFixed(1)}KB)`,
    );
  }
}

/**
 * Flushes the buffer by parsing CSV segment and accumulating results.
 * Preserves incomplete trailing lines in the buffer for the next chunk.
 * @param state - Parser state with accumulated CSV buffer.
 * @returns Promise that resolves after parsing and clearing the flushed portion.
 * @source
 */
async function flushBufferAndParseRows(
  state: ReturnType<typeof csvParserStates.get>,
): Promise<KenmeiManga[]> {
  if (!state?.csvBuffer) return [];

  try {
    // Split buffer by lines, preserving incomplete trailing line
    const { lines, remainder } = splitCSVLines(state.csvBuffer);

    let newlyParsedRows: KenmeiManga[] = [];

    if (lines.length > 0) {
      // On first flush, capture the header line
      if (!state.header && lines.length > 0) {
        state.header = lines[0];
        // Remove header from lines so we only parse data rows
        lines.shift();
      }

      // For subsequent flushes, prepend the header to ensure parseKenmeiCsvExport has it
      const csvWithHeader = state.header
        ? `${state.header}\n${lines.join("\n")}`
        : lines.join("\n");

      if (lines.length > 0) {
        // Parse the CSV segment
        const manga = await parseCSVBufferSegment(
          csvWithHeader,
          state.defaultStatus,
        );

        newlyParsedRows = manga;

        console.debug(
          `[Worker] 🔄 Flushed ${lines.length} lines, parsed ${manga.length} rows`,
        );
      }
    }

    // Keep incomplete trailing line in buffer for next chunk
    state.csvBuffer = remainder;
    return newlyParsedRows;
  } catch (error) {
    console.error(
      `[Worker] Error flushing and parsing CSV buffer for task ${state.taskId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Finalizes CSV parsing by processing any remaining buffered data and combining all parsed results.
 * @param state - Parser state containing accumulated CSV buffer and parsed rows.
 * @returns Promise that posts CSV_COMPLETE or throws on parse error.
 * @source
 */
async function finalizeCSVParsing(
  state: ReturnType<typeof csvParserStates.get>,
): Promise<void> {
  if (!state) return;

  try {
    // Flush any remaining buffer content
    if (state.csvBuffer.trim()) {
      const newlyParsedRows = await flushBufferAndParseRows(state);

      // Initialize pending batch if needed
      state.pendingBatch ??= [];

      // Track total parsed rows
      state.totalParsedRows =
        (state.totalParsedRows ?? 0) + newlyParsedRows.length;

      // Add newly parsed rows to pending batch
      state.pendingBatch.push(...newlyParsedRows);
    }

    // Emit any remaining pending batch
    if (state.pendingBatch && state.pendingBatch.length > 0) {
      globalThis.postMessage({
        type: "CSV_ROWS",
        payload: {
          taskId: state.taskId,
          rows: state.pendingBatch,
        },
      });

      console.debug(
        `[Worker] 📤 Emitted final CSV_ROWS batch of ${state.pendingBatch.length} rows for task ${state.taskId}`,
      );
    }

    const totalParsedRowsCount = state.totalParsedRows ?? 0;
    const duration = performance.now() - state.startTime;

    console.info(
      `[Worker] ✅ CSV task ${state.taskId}: Parsed ${totalParsedRowsCount} rows with incremental streaming in ${duration.toFixed(2)}ms`,
    );

    // Emit final PROGRESS at 100% to smooth UI progress bars
    globalThis.postMessage({
      type: "PROGRESS",
      payload: {
        taskId: state.taskId,
        processedBytes: state.totalSize,
        totalBytes: state.totalSize,
        parsedRowsCount: state.totalParsedRows ?? 0,
      },
    });

    // Send CSV_COMPLETE with stats only (rows are sent via CSV_ROWS batches)
    globalThis.postMessage({
      type: "CSV_COMPLETE",
      payload: {
        taskId: state.taskId,
        manga: [], // Empty array - rows sent via CSV_ROWS batches
        stats: {
          totalParsed: totalParsedRowsCount,
          processingTimeMs: duration,
          bytesProcessed: state.processedBytes,
        },
      },
    });

    state.isComplete = true;
  } catch (error) {
    console.error(
      `[Worker] Failed to finalize CSV parsing for task ${state.taskId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Handles CSV chunk messages with incremental streaming parsing.
 * Appends data to buffer, flushes when necessary, and finalizes on last chunk.
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

  // Serialize chunk processing by chaining to the existing promise
  state.processingPromise = (state.processingPromise ?? Promise.resolve())
    .then(() => processCSVChunkIncremental(chunk, state))
    .then(() => {
      if (isLastChunk) {
        // Finalize parsing and send complete results
        return finalizeCSVParsing(state);
      }
    })
    .then(() => {
      if (isLastChunk) {
        activeTasks.delete(taskId);
        csvParserStates.delete(taskId);
      }
    })
    .catch((error) => {
      console.error(
        `[Worker] Error during CSV chunk processing for task ${taskId}:`,
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
    })
    .finally(() => {
      // Clear the processing promise when the chain settles
      state.processingPromise = undefined;
    });
}
