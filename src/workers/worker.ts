/**
 * Unified Web Worker
 *
 * A single, centralized worker implementation that handles all types of worker operations:
 * - Manga matching operations (MATCH_BATCH)
 * - CSV parsing operations (CSV_START, CSV_CHUNK, CSV_COMPLETE)
 * - Advanced filter operations (ADVANCED_FILTER)
 * - Title normalization operations (TITLE_NORMALIZATION)
 * - Task cancellation (CANCEL)
 *
 * This eliminates code duplication by consolidating task tracking, error handling,
 * cancellation logic, and message dispatching into a single worker implementation.
 *
 * Message handlers are type-specific but follow a consistent pattern,
 * allowing easy addition of new message types without duplicating infrastructure code.
 *
 * @module workers/worker
 */

import { findBestMatches } from "@/api/matching/match-engine";
import { filterByAdvancedCriteria } from "@/components/sync/filtering";
import type { AniListManga } from "@/api/anilist/types";
import type {
  MatchBatchMessage,
  CSVStartMessage,
  CSVChunkMessage,
  CancelMessage,
  WorkerInboundMessage,
  AdvancedFilterMessage,
  AdvancedFilterResultMessage,
  TitleNormalizationMessage,
  TitleNormalizationProgressMessage,
  TitleNormalizationResultMessage,
} from "./types";
import type { KenmeiStatus } from "@/api/kenmei/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";

/**
 * Parser state for CSV operations
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
 * Global task tracking for cancellation support across all operation types
 */
const activeTasks = new Set<string>();

/**
 * CSV-specific task states indexed by taskId
 */
const csvParserStates = new Map<string, CSVParserState>();

/**
 * Title normalization algorithms - replicated from deleted worker file
 */
function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .replaceAll("-", "")
    .replaceAll(/[^\w\s]/g, "")
    .replaceAll(/\s+/g, " ")
    .replaceAll("_", " ")
    .trim();
}

function processTitle(title: string): string {
  const withoutParentheses = title.replaceAll(/\s*\([^()]*\)\s*/g, " ");

  return withoutParentheses
    .replaceAll("-", " ")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"')
    .replaceAll("\u201D", '"')
    .replaceAll("_", " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
}

const normalizationAlgorithmsMap: Record<string, (title: string) => string> = {
  normalizeForMatching,
  processTitle,
};

// ============================================================================
// MATCHING OPERATIONS
// ============================================================================

/**
 * Handle a batch matching operation.
 */
async function handleMatchBatch(message: MatchBatchMessage): Promise<void> {
  const { kenmeiManga, anilistCandidates, config, taskId } = message.payload;

  // Register task as active
  activeTasks.add(taskId);

  console.debug(
    `[Worker] 🔄 Starting batch match for task ${taskId} (${kenmeiManga.length} items)`,
  );

  try {
    const results = [];
    const total = kenmeiManga.length;
    const startTime = performance.now();

    // Convert candidates array back to Map
    const candidatesMap = new Map<string, AniListManga[]>(anilistCandidates);

    for (let i = 0; i < total; i++) {
      // Check for cancellation
      if (!activeTasks.has(taskId)) {
        console.warn(
          `[Worker] ⚠️ Task ${taskId} was cancelled after ${i}/${total} items`,
        );
        return; // Task was cancelled, exit silently
      }

      const manga = kenmeiManga[i];

      // Get candidates for this manga using index-based key to match results.ts
      const candidates = candidatesMap.get(String(i)) || [];

      // Find best matches using the match engine
      const matchResult = findBestMatches(
        manga,
        candidates,
        config as MatchEngineConfig,
      );

      // Add to results
      results.push(matchResult);

      // Report progress
      globalThis.postMessage({
        type: "PROGRESS",
        payload: {
          taskId,
          current: i + 1,
          total,
          currentTitle: manga.title,
        },
      });

      // Log progress at intervals
      if ((i + 1) % 50 === 0 || i === 0) {
        console.debug(`[Worker] 📊 Task ${taskId} progress: ${i + 1}/${total}`);
      }
    }

    const duration = performance.now() - startTime;
    console.info(
      `[Worker] ✅ Batch match task ${taskId} completed (${results.length} results in ${duration.toFixed(2)}ms)`,
    );

    // Send final results
    globalThis.postMessage({
      type: "RESULT",
      payload: {
        taskId,
        results,
      },
    });
  } catch (error) {
    console.error(`[Worker] ❌ Error processing task ${taskId}:`, error);
    // Post error message
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
  } finally {
    // Clean up task
    activeTasks.delete(taskId);
  }
}

// ============================================================================
// CSV OPERATIONS
// ============================================================================

/**
 * Handle CSV_START message - initialize parser state
 */
function handleCSVStart(message: CSVStartMessage): void {
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
    `[Worker] 📊 CSV progress for task ${state.taskId}: ${state.processedBytes}/${state.totalSize} bytes`,
  );
}

/**
 * Finalize CSV parsing when last chunk received - use shared parseKenmeiCsvExport
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
      `[Worker] ✅ CSV task ${state.taskId}: Parsed ${export_data.manga.length} manga in ${duration.toFixed(2)}ms`,
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
      `[Worker] Failed to parse CSV for task ${state.taskId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Handle CSV_CHUNK message - process a chunk of CSV data
 */
function handleCSVChunk(message: CSVChunkMessage): void {
  const { taskId, chunk, isLastChunk } = message.payload;
  const state = csvParserStates.get(taskId);

  if (!state) {
    // If task is not active (e.g., cancelled), don't post an error
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
              error: {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
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
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });
    activeTasks.delete(taskId);
    csvParserStates.delete(taskId);
  }
}

// ============================================================================
// COMMON OPERATIONS
// ============================================================================

/**
 * Handle cancellation request - works for all task types
 */
function handleCancel(message: CancelMessage): void {
  const { taskId } = message.payload;
  console.debug(`[Worker] ⏹️ Cancel requested for task ${taskId}`);
  activeTasks.delete(taskId);
  csvParserStates.delete(taskId);
}

// ============================================================================
// ADVANCED FILTER OPERATIONS
// ============================================================================

/**
 * Handle advanced filtering operation
 */
function handleAdvancedFilter(message: AdvancedFilterMessage): void {
  const { taskId, matches, filters } = message.payload;

  console.debug(
    `[Worker] 🔄 Starting advanced filter for task ${taskId} (${matches.length} matches)`,
  );

  try {
    const startTime = performance.now();
    const filterStartTime = performance.now();

    // Apply filtering using the existing function
    const filteredMatches = filterByAdvancedCriteria(matches, filters);

    const filterEndTime = performance.now();
    const totalTime = performance.now() - startTime;

    // Calculate statistics based on what was filtered out
    const stats = {
      totalMatches: matches.length,
      filteredCount: filteredMatches.length,
      confidenceFiltered: 0,
      formatFiltered: 0,
      genreFiltered: 0,
      statusFiltered: 0,
      yearFiltered: 0,
      tagFiltered: 0,
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

// ============================================================================
// TITLE NORMALIZATION OPERATIONS
// ============================================================================

/**
 * Process titles for a single normalization algorithm
 */
function normalizeForAlgorithm(
  algorithm: string,
  titles: string[],
  taskId: string,
): { cache: Record<string, string>; added: Record<string, string> } {
  const algorithmImpl = normalizationAlgorithmsMap[algorithm];
  if (!algorithmImpl) {
    throw new Error(`Unknown normalization algorithm: ${algorithm}`);
  }

  console.debug(
    `[Worker] 🔄 Processing algorithm '${algorithm}' for ${titles.length} titles`,
  );

  const cache: Record<string, string> = {};
  const added: Record<string, string> = {};

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const normalized = algorithmImpl(title);
    cache[title] = normalized;
    added[title] = normalized;

    // Report progress every 100 titles or at completion
    if ((i + 1) % 100 === 0 || i === titles.length - 1) {
      const progressMsg: TitleNormalizationProgressMessage = {
        type: "TITLE_NORMALIZATION_PROGRESS",
        payload: {
          taskId,
          algorithm,
          current: i + 1,
          total: titles.length,
        },
      };
      console.debug(
        `[Worker] 📊 Normalization progress for '${algorithm}': ${i + 1}/${titles.length}`,
      );
      globalThis.postMessage(progressMsg);
    }
  }

  console.info(
    `[Worker] ✅ Algorithm '${algorithm}' completed for ${titles.length} titles`,
  );

  return { cache, added };
}

/**
 * Handle title normalization operation
 */
function handleTitleNormalization(message: TitleNormalizationMessage): void {
  const { taskId, titles, algorithms } = message.payload;

  console.info(
    `[Worker] 📚 Starting title normalization for task ${taskId} (${titles.length} titles, algorithms: ${algorithms.join(", ")})`,
  );

  // Register task as active
  activeTasks.add(taskId);

  try {
    const startTime = performance.now();
    const caches: Record<string, Record<string, string>> = {};
    const deltas: Record<
      string,
      { added: Record<string, string>; modified: Record<string, string> }
    > = {};

    // Process each algorithm
    for (const algorithm of algorithms) {
      // Check if task was cancelled
      if (!activeTasks.has(taskId)) {
        console.warn(
          `[Worker] ⚠️ Title normalization task ${taskId} was cancelled`,
        );
        return;
      }

      const { cache, added } = normalizeForAlgorithm(algorithm, titles, taskId);

      caches[algorithm] = cache;
      deltas[algorithm] = {
        added,
        modified: {}, // First-run has no modifications, only additions
      };
    }

    // Check one final time if task was cancelled
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Title normalization task ${taskId} was cancelled before completion`,
      );
      return;
    }

    const endTime = performance.now();
    const processingTimeMs = endTime - startTime;

    const resultMsg: TitleNormalizationResultMessage = {
      type: "TITLE_NORMALIZATION_RESULT",
      payload: {
        taskId,
        caches,
        deltas,
        timing: {
          processingTimeMs,
          totalTitlesProcessed: titles.length,
        },
      },
    };

    console.info(
      `[Worker] ✅ Title normalization task ${taskId} completed (${titles.length} titles in ${processingTimeMs.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in title normalization task ${taskId}:`,
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
  } finally {
    activeTasks.delete(taskId);
  }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

/**
 * Central message handler that dispatches to specific handlers based on message type.
 * Provides unified error handling for all operation types.
 */
globalThis.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "MATCH_BATCH":
        await handleMatchBatch(message);
        break;

      case "CSV_START":
        handleCSVStart(message);
        break;

      case "CSV_CHUNK":
        handleCSVChunk(message);
        break;

      case "ADVANCED_FILTER":
        handleAdvancedFilter(message as unknown as AdvancedFilterMessage);
        break;

      case "TITLE_NORMALIZATION":
        handleTitleNormalization(
          message as unknown as TitleNormalizationMessage,
        );
        break;

      case "CANCEL":
        handleCancel(message);
        break;

      default:
        console.warn(`[Worker] Unknown message type: ${(message as any).type}`);
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
          });
        }
    }
  } catch (error) {
    console.error("[Worker] Unhandled error in worker:", error);
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
