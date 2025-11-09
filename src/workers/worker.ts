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
import { normalizationAlgorithmsMap } from "@/utils/normalization";
import type {
  AniListManga,
  MangaMatchResult,
  AniListMediaEntry,
} from "@/api/anilist/types";
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
  StatisticsAggregationMessage,
  StatisticsAggregationResultMessage,
  ReadingHistoryFilterMessage,
  ReadingHistoryFilterProgressMessage,
  ReadingHistoryFilterResultMessage,
  JSONSerializeMessage,
  JSONDeserializeMessage,
  DuplicateDetectionMessage,
  DuplicateDetectionProgressMessage,
  DuplicateDetectionResultMessage,
  DataTablePreparationMessage,
  DataTablePreparationProgressMessage,
  DataTablePreparationResultMessage,
  BatchSyncMessage,
  BatchSyncProgressMessage,
  BatchSyncResultMessage,
  PreparedSyncOperation,
} from "./types";
import type { KenmeiStatus } from "@/api/kenmei/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";

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
 * Extract detailed error information from an Error or unknown value
 */
function getErrorDetails(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
  causeMessage?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      causeMessage:
        error.cause instanceof Error ? error.cause.message : undefined,
    };
  }
  return {
    message: String(error),
  };
}

/**
 * CSV-specific task states indexed by taskId
 */
const csvParserStates = new Map<string, CSVParserState>();

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
        error: getErrorDetails(error),
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

// ============================================================================
// COMMON OPERATIONS
// ============================================================================

/**
 * Handle cancellation request - works for all task types
 */
function handleCancel(message: CancelMessage): void {
  const { taskId } = message.payload;
  console.debug(`[Worker] ⏹️ Cancel requested for task ${taskId}`);

  // Check if a CSV task is active for this taskId
  const csvState = csvParserStates.get(taskId);
  const hadCSVTask = !!csvState;

  activeTasks.delete(taskId);
  csvParserStates.delete(taskId);

  // If CSV task was active, send terminal event to UI
  if (hadCSVTask) {
    self.postMessage({
      type: "CSV_CANCELLED",
      payload: { taskId },
    });
  }
}

// ============================================================================
// ADVANCED FILTER OPERATIONS
// ============================================================================

/**
 * Check if a match fails the confidence filter
 */
function failsConfidenceFilter(match: MangaMatchResult, filters: AdvancedMatchFilters): boolean {
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
 * Check if a match fails the format filter
 */
function failsFormatFilter(match: MangaMatchResult, filters: AdvancedMatchFilters): boolean {
  if (filters.formats.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  return !matchData?.format || !filters.formats.includes(matchData.format);
}

/**
 * Check if a match fails the genre filter
 */
function failsGenreFilter(match: MangaMatchResult, filters: AdvancedMatchFilters): boolean {
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
 * Check if a match fails the publication status filter
 */
function failsStatusFilter(match: MangaMatchResult, filters: AdvancedMatchFilters): boolean {
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
 * Check if a match fails the year filter
 */
function failsYearFilter(match: MangaMatchResult, filters: AdvancedMatchFilters): boolean {
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
  if ((filters.yearRange.min) !== null && year < (filters.yearRange.min)) {
    return true;
  }
  return (filters.yearRange.max) !== null && year > (filters.yearRange.max);
}

/**
 * Check if a match fails the tag filter
 */
function failsTagFilter(match: MangaMatchResult, filters: AdvancedMatchFilters): boolean {
  const tagsFilter = filters.tags ?? [];
  if (!tagsFilter || tagsFilter.length === 0) {
    return false;
  }
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;
  const tags = matchData?.tags || [];
  const tagNames = new Set(tags.map((t: { id: number; name: string; category?: string }) => t.name.toLowerCase()));
  return !tagsFilter.some((ft: string) => tagNames.has(ft.toLowerCase()));
}

/**
 * Compute filter statistics by analyzing excluded matches
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
        error: getErrorDetails(error),
      },
    });
  } finally {
    activeTasks.delete(taskId);
  }
}

// ============================================================================
// READING HISTORY FILTERING OPERATIONS
// ============================================================================

/**
 * Normalize a date to midnight UTC (for daily aggregation)
 */
function normalizeDateToDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Get week start date (Monday) for weekly aggregation
 */
function getWeekStart(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff),
  );
  return weekStart.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Filter and aggregate reading history by date range
 */
function handleReadingHistoryFilter(
  message: ReadingHistoryFilterMessage,
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

  // Register task as active
  activeTasks.add(taskId);

  try {
    const startTime = performance.now();

    // Filter entries by date range
    const filterStartTime = performance.now();
    const filteredEntries = history.entries.filter(
      (entry) =>
        entry.timestamp >= dateRange.start && entry.timestamp <= dateRange.end,
    );

    console.debug(
      `[Worker] 🔍 Filtered ${filteredEntries.length}/${history.entries.length} entries within date range`,
    );

    // Report progress
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

    // Compute statistics
    const aggregationStartTime = performance.now();

    // Count unique manga
    const uniqueManga = new Set(filteredEntries.map((e) => e.mangaId));

    // Count total chapters
    const totalChapters = filteredEntries.reduce(
      (sum, e) => sum + e.chaptersRead,
      0,
    );

    // Count active days
    const activeDays = new Set(
      filteredEntries.map((e) => normalizeDateToDay(e.timestamp)),
    ).size;

    // Calculate average chapters per day
    const averageChaptersPerDay =
      activeDays > 0 ? Math.round((totalChapters / activeDays) * 100) / 100 : 0;

    // Aggregate data if requested
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

      // Convert to sorted array
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

    // Report aggregation complete
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

    // Check for cancellation before sending final result
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

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

/**
 * Handle statistics aggregation message from main thread
 * Performs filtering, normalization, and aggregation of match/history data
 */
async function handleStatisticsAggregation(
  message: StatisticsAggregationMessage,
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

    // Dynamically import statistics adapter functions
    const {
      applyStatisticsFilters,
      buildComparisonDatasets,
      extractAvailableFilterOptions,
    } = await import("@/utils/statisticsAdapter");

    // Check for cancellation
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Statistics aggregation task ${taskId} was cancelled before filtering`,
      );
      return;
    }

    const filterStartTime = performance.now();

    // Apply filters
    // Type assertion needed because message payload structure differs from NormalizedMatchForStats
    // but is compatible at runtime
    const filteredData = applyStatisticsFilters(
      matchResults as unknown as import("@/utils/statisticsAdapter").NormalizedMatchForStats[],
      readingHistory as unknown as import("@/utils/storage").ReadingHistory,
      filters as unknown as import("@/types/statistics").StatisticsFilters,
    );

    const filteringTimeMs = performance.now() - filterStartTime;

    // Check for cancellation
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Statistics aggregation task ${taskId} was cancelled after filtering`,
      );
      return;
    }

    const aggregationStartTime = performance.now();

    // Extract available filter options
    const filterOptions = extractAvailableFilterOptions(
      filteredData.matchResults,
    );

    // Build comparison datasets if enabled
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

    // Generate cache key (browser compatible string hashing)
    const filterStr = JSON.stringify(filters);
    const comparisonStr = JSON.stringify(comparisonMode);
    const timeStr = selectedTimeRange;
    const keyStr = `stats:${filterStr}:${comparisonStr}:${timeStr}`;
    let hash = 0;
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.codePointAt(i);
      if (char === undefined) continue;
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const cacheKey = `stats:${Math.abs(hash)}`;

    // Check for cancellation one final time
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

// ============================================================================
// JSON SERIALIZATION OPERATIONS
// ============================================================================

/**
 * Handle JSON serialization operation.
 * Offloads JSON.stringify to worker thread for heavy payloads.
 */
function handleJsonSerialize(message: JSONSerializeMessage): void {
  const { taskId, data, replacerKeys, space } = message.payload;

  // Register task as active
  activeTasks.add(taskId);

  try {
    console.info(`[Worker] 📝 Starting JSON serialization for task ${taskId}`);
    const startTime = performance.now();

    // Create replacer function if keys are provided
    const replacer = replacerKeys
      ? (key: string, value: unknown) => {
          if (key === "" || replacerKeys.includes(key)) {
            return value;
          }
          return undefined;
        }
      : undefined;

    // Perform serialization
    const json = JSON.stringify(data, replacer, space);
    const serializationTimeMs = performance.now() - startTime;
    const sizeBytes = new Blob([json]).size;

    // Send result
    globalThis.postMessage({
      type: "JSON_SERIALIZE_RESULT",
      payload: {
        taskId,
        json,
        sizeBytes,
        timing: {
          serializationTimeMs,
        },
      },
    });

    console.info(
      `[Worker] ✅ JSON serialization task ${taskId} completed (${serializationTimeMs.toFixed(2)}ms, ${sizeBytes} bytes)`,
    );
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in JSON serialization task ${taskId}:`,
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

/**
 * Handle JSON deserialization operation.
 * Offloads JSON.parse to worker thread for heavy payloads.
 */
function handleJsonDeserialize(message: JSONDeserializeMessage): void {
  const { taskId, json, reviverKeys } = message.payload;

  // Register task as active
  activeTasks.add(taskId);

  try {
    console.info(
      `[Worker] 📝 Starting JSON deserialization for task ${taskId}`,
    );
    const startTime = performance.now();

    // Create reviver function if keys are provided
    const reviver = reviverKeys
      ? (key: string, value: unknown) => {
          if (key === "" || reviverKeys.includes(key)) {
            return value;
          }
          return undefined;
        }
      : undefined;

    // Perform deserialization
    const data = JSON.parse(json, reviver);
    const deserializationTimeMs = performance.now() - startTime;

    // Send result
    globalThis.postMessage({
      type: "JSON_DESERIALIZE_RESULT",
      payload: {
        taskId,
        data,
        timing: {
          deserializationTimeMs,
        },
      },
    });

    console.info(
      `[Worker] ✅ JSON deserialization task ${taskId} completed (${deserializationTimeMs.toFixed(2)}ms)`,
    );
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in JSON deserialization task ${taskId}:`,
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

// ============================================================================
// DUPLICATE DETECTION OPERATIONS
// ============================================================================

/**
 * Build a map of AniList IDs to their associated match information
 */
function buildAniListIdMap(
  matches: MangaMatchResult[],
  taskId: string,
): {
  map: Map<
    number,
    { title: string; matchIndices: number[]; kenmeiTitles: string[] }
  >;
  comparisonCount: number;
} {
  const anilistIdMap = new Map<
    number,
    { title: string; matchIndices: number[]; kenmeiTitles: string[] }
  >();
  let comparisonCount = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    comparisonCount++;

    // Check for cancellation periodically
    if (comparisonCount % 100 === 0 && !activeTasks.has(taskId)) {
      return { map: anilistIdMap, comparisonCount };
    }

    if (
      (match.status === "matched" || match.status === "manual") &&
      match.selectedMatch
    ) {
      const anilistId = match.selectedMatch.id;
      const anilistTitle =
        match.selectedMatch.title.romaji ||
        match.selectedMatch.title.english ||
        "Unknown Title";
      const kenmeiTitle = match.kenmeiManga.title;

      if (anilistIdMap.has(anilistId)) {
        const existing = anilistIdMap.get(anilistId)!;
        existing.matchIndices.push(i);
        existing.kenmeiTitles.push(kenmeiTitle);
      } else {
        anilistIdMap.set(anilistId, {
          title: anilistTitle,
          matchIndices: [i],
          kenmeiTitles: [kenmeiTitle],
        });
      }
    }
  }

  return { map: anilistIdMap, comparisonCount };
}

/**
 * Extract duplicate entries from the AniList ID map
 */
function extractDuplicates(
  anilistIdMap: Map<
    number,
    { title: string; matchIndices: number[]; kenmeiTitles: string[] }
  >,
  ignoredIds: Set<number>,
) {
  const duplicates = [];
  for (const [anilistId, value] of anilistIdMap) {
    if (value.kenmeiTitles.length > 1 && !ignoredIds.has(anilistId)) {
      duplicates.push({
        anilistId,
        anilistTitle: value.title,
        matchIndices: value.matchIndices,
        kenmeiTitles: value.kenmeiTitles,
      });
    }
  }
  return duplicates;
}

/**
 * Handle duplicate detection on matches
 * Identifies when a single AniList ID is mapped to multiple Kenmei manga titles
 */
function handleDuplicateDetection(message: DuplicateDetectionMessage): void {
  const { taskId, matches, ignoredDuplicateIds } = message.payload;

  // Register task as active
  activeTasks.add(taskId);

  console.debug(
    `[Worker] 🔍 Starting duplicate detection for task ${taskId} (${matches.length} matches)`,
  );

  const startTime = performance.now();

  try {
    const ignoredIds = new Set(ignoredDuplicateIds);

    // Build map of AniList IDs
    const { map: anilistIdMap, comparisonCount } = buildAniListIdMap(
      matches,
      taskId,
    );

    // Check for cancellation after building map
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Duplicate detection task ${taskId} was cancelled after ${comparisonCount} comparisons`,
      );
      return;
    }

    // Send progress update
    const progressMsg: DuplicateDetectionProgressMessage = {
      type: "DUPLICATE_DETECTION_PROGRESS",
      payload: {
        taskId,
        current: comparisonCount,
        total: matches.length,
        message: "Identifying duplicate groups",
      },
    };
    globalThis.postMessage(progressMsg);

    // Extract duplicates
    const duplicates = extractDuplicates(anilistIdMap, ignoredIds);

    // Check for cancellation before sending result
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Duplicate detection task ${taskId} was cancelled before completion`,
      );
      return;
    }

    const processingTimeMs = performance.now() - startTime;

    const resultMsg: DuplicateDetectionResultMessage = {
      type: "DUPLICATE_DETECTION_RESULT",
      payload: {
        taskId,
        duplicates,
        timing: {
          processingTimeMs,
          comparisonCount,
        },
      },
    };

    console.info(
      `[Worker] ✅ Duplicate detection task ${taskId} completed (${duplicates.length} groups found, ${comparisonCount} comparisons, ${processingTimeMs.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in duplicate detection task ${taskId}:`,
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

// ============================================================================
// DATA TABLE PREPARATION OPERATIONS
// ============================================================================

/**
 * Handle data table preparation message from main thread.
 * Precomputes formatted values and row metadata for efficient virtualization.
 */
function handleDataTablePreparation(
  message: DataTablePreparationMessage,
): void {
  const { taskId, data, viewport, columnVisibility } = message.payload;

  // Register task as active
  activeTasks.add(taskId);

  console.debug(
    `[Worker] 📊 Starting data table preparation for task ${taskId} (${data.length} items, viewport: ${viewport.startIndex}-${viewport.endIndex})`,
  );

  const startTime = performance.now();

  try {
    // Report progress
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

    // Check for cancellation
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Data table preparation task ${taskId} was cancelled before formatting`,
      );
      return;
    }

    const formattingStartTime = performance.now();

    // Extract and format the viewport slice
    const slice = data.slice(viewport.startIndex, viewport.endIndex);

    // Precompute formatted values for all visible rows
    const preparedData = slice.map((item) => {
      // Format status
      const statusDisplayValue = item.status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // Format score (only if visible and present)
      let scoreDisplayValue = "-";
      if (columnVisibility.score && item.score !== undefined) {
        scoreDisplayValue = item.score > 0 ? item.score.toString() : "-";
      }

      // Format chapters (only if visible and present)
      let chaptersDisplayValue = "-";
      if (columnVisibility.chapters && item.chapters_read !== undefined) {
        chaptersDisplayValue =
          item.chapters_read > 0 ? item.chapters_read.toString() : "0";
      }

      // Format volumes (only if visible and present)
      let volumesDisplayValue = "-";
      if (columnVisibility.volumes && item.volumes_read !== undefined) {
        volumesDisplayValue =
          item.volumes_read > 0 ? item.volumes_read.toString() : "0";
      }

      // Format last read date (only if visible)
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

      // Calculate approximate row height based on content
      // Base height of 40px plus additional height for multi-line titles
      const titleLength = item.title.length;
      const titleLines = Math.max(1, Math.ceil(titleLength / 40)); // ~40 chars per line at typical width
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

    // Report metadata computation progress
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

    // Check for cancellation
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Data table preparation task ${taskId} was cancelled before metadata computation`,
      );
      return;
    }

    const metadataStartTime = performance.now();

    // Compute total row heights for all data (needed for virtual scroller)
    const totalRowHeights = preparedData.reduce(
      (sum, row) => sum + row.rowHeight,
      0,
    );

    const metadataComputationTimeMs = performance.now() - metadataStartTime;
    const totalTimeMs = performance.now() - startTime;

    // Check for cancellation one final time
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Data table preparation task ${taskId} was cancelled before completion`,
      );
      return;
    }

    // Send result
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

// ============================================================================
// BATCH SYNC OPERATIONS
// ============================================================================

/**
 * Determine incremental steps needed for an entry based on what changed.
 * Follows 3-step incremental process:
 * Step 1: Update progress (chapters/episodes read)
 * Step 2: Update score/status
 * Step 3: Update notes/metadata
 */
function getIncrementalStepsForEntry(entry: AniListMediaEntry): number[] {
  const steps: number[] = [];

  // Check if this is a new entry (no previous values) or if progress changed
  if (
    !entry.previousValues ||
    entry.progress !== entry.previousValues.progress
  ) {
    steps.push(1); // Step 1: Update progress
  }

  // Check if status or score changed
  if (
    !entry.previousValues ||
    entry.status !== entry.previousValues.status ||
    entry.score !== entry.previousValues.score
  ) {
    steps.push(2); // Step 2: Update status/score
  }

  // For notes (would need notes field in entry - placeholder)
  // steps.push(3); // Step 3: Update notes

  // If no changes detected, return Step 1 anyway for new entries
  return steps.length > 0 ? steps : [1];
}

/**
 * Organize entries by media ID and expand with incremental steps.
 * Returns a map of mediaId -> array of entries with step metadata.
 */
function organizeEntriesByMediaIdForWorker(
  entries: AniListMediaEntry[],
): Record<number, AniListMediaEntry[]> {
  const entriesByMediaId: Record<number, AniListMediaEntry[]> = {};

  for (const entry of entries) {
    if (!entriesByMediaId[entry.mediaId]) {
      entriesByMediaId[entry.mediaId] = [];
    }

    if (entry.syncMetadata?.useIncrementalSync) {
      const steps = getIncrementalStepsForEntry(entry);
      for (const step of steps) {
        const stepEntry = { ...entry };
        stepEntry.syncMetadata = {
          ...entry.syncMetadata,
          step,
        };
        entriesByMediaId[entry.mediaId].push(stepEntry);
      }
    } else {
      entriesByMediaId[entry.mediaId].push(entry);
    }
  }

  return entriesByMediaId;
}

/**
 * Build GraphQL variables for an entry and step.
 * Simplified version for worker - delegates to step-specific builders.
 */
function buildGraphQLVariablesForEntry(
  entry: AniListMediaEntry,
  step: number,
): Record<string, unknown> {
  const baseVariables = {
    mediaId: entry.mediaId,
    status: entry.status,
  };

  if (step === 1) {
    // Update progress
    return {
      ...baseVariables,
      progress: entry.progress,
    };
  } else if (step === 2) {
    // Update score/status
    return {
      ...baseVariables,
      score: entry.score,
      private: entry.private,
    };
  }

  return baseVariables;
}

/**
 * Handle batch sync pre-processing in worker.
 * Organizes entries, calculates steps, and builds GraphQL variables.
 */
async function handleBatchSync(message: BatchSyncMessage): Promise<void> {
  const { taskId, entries } = message.payload;

  try {
    activeTasks.add(taskId);

    console.info(
      `[Worker] 📦 Starting batch sync pre-processing for ${entries.length} entries`,
    );

    const startTime = performance.now();

    // Phase 1: Organizing entries by media ID
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Batch sync task ${taskId} was cancelled during organizing`,
      );
      return;
    }

    const progressMsg1: BatchSyncProgressMessage = {
      type: "BATCH_SYNC_PROGRESS",
      payload: {
        taskId,
        phase: "organizing",
        processed: 0,
        total: entries.length,
      },
    };
    globalThis.postMessage(progressMsg1);

    const entriesByMediaId = organizeEntriesByMediaIdForWorker(entries);
    const mediaIds = Object.keys(entriesByMediaId)
      .map(Number)
      .sort((a, b) => a - b);

    // Phase 2: Building variables and calculating API calls
    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Batch sync task ${taskId} was cancelled during building`,
      );
      return;
    }

    const progressMsg2: BatchSyncProgressMessage = {
      type: "BATCH_SYNC_PROGRESS",
      payload: {
        taskId,
        phase: "building",
        processed: 0,
        total: mediaIds.length,
      },
    };
    globalThis.postMessage(progressMsg2);

    const operations: PreparedSyncOperation[] = [];
    const failedEntries: Array<{ mediaId: number; error: string }> = [];
    let totalApiCallsEstimate = 0;

    for (let i = 0; i < mediaIds.length; i++) {
      if (!activeTasks.has(taskId)) {
        console.warn(
          `[Worker] ⚠️ Batch sync task ${taskId} was cancelled during building`,
        );
        return;
      }

      const mediaId = mediaIds[i];
      const mediaEntries = entriesByMediaId[mediaId];

      try {
        const steps = mediaEntries
          .map((e) => e.syncMetadata?.step || 1)
          .filter((step, idx, arr) => arr.indexOf(step) === idx)
          .sort((a, b) => a - b);

        const variables = mediaEntries.map((entry) =>
          buildGraphQLVariablesForEntry(entry, entry.syncMetadata?.step || 1),
        );

        const operation: PreparedSyncOperation = {
          mediaId,
          entries: mediaEntries,
          steps,
          variables,
          estimatedApiCalls: steps.length,
        };

        operations.push(operation);
        totalApiCallsEstimate += steps.length;

        // Send progress update
        if ((i + 1) % 10 === 0) {
          const progressMsg: BatchSyncProgressMessage = {
            type: "BATCH_SYNC_PROGRESS",
            payload: {
              taskId,
              phase: "building",
              processed: i + 1,
              total: mediaIds.length,
              currentMediaId: mediaId,
            },
          };
          globalThis.postMessage(progressMsg);
        }
      } catch (error) {
        failedEntries.push({
          mediaId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Batch sync task ${taskId} was cancelled before completion`,
      );
      return;
    }

    // Final progress message
    const progressMsg3: BatchSyncProgressMessage = {
      type: "BATCH_SYNC_PROGRESS",
      payload: {
        taskId,
        phase: "ready",
        processed: mediaIds.length,
        total: mediaIds.length,
      },
    };
    globalThis.postMessage(progressMsg3);

    const totalTime = performance.now() - startTime;

    // Send result
    const resultMsg: BatchSyncResultMessage = {
      type: "BATCH_SYNC_RESULT",
      payload: {
        taskId,
        operations,
        totalApiCallsEstimate,
        failedEntries,
      },
    };

    console.info(
      `[Worker] ✅ Batch sync pre-processing completed: ${operations.length} operations, ${totalApiCallsEstimate} estimated API calls, ${failedEntries.length} failures (${totalTime.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(`[Worker] ❌ Error in batch sync task ${taskId}:`, error);
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

      case "BATCH_SYNC":
        await handleBatchSync(message);
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

      case "STATISTICS_AGGREGATION":
        await handleStatisticsAggregation(
          message as unknown as StatisticsAggregationMessage,
        );
        break;

      case "READING_HISTORY_FILTER":
        handleReadingHistoryFilter(
          message as unknown as ReadingHistoryFilterMessage,
        );
        break;

      case "JSON_SERIALIZE":
        handleJsonSerialize(message as unknown as JSONSerializeMessage);
        break;

      case "JSON_DESERIALIZE":
        handleJsonDeserialize(message as unknown as JSONDeserializeMessage);
        break;

      case "DUPLICATE_DETECTION":
        handleDuplicateDetection(
          message as unknown as DuplicateDetectionMessage,
        );
        break;

      case "DATA_TABLE_PREPARATION":
        handleDataTablePreparation(
          message as unknown as DataTablePreparationMessage,
        );
        break;

      case "CANCEL":
        handleCancel(message);
        break;

      default: {
        console.warn(`[Worker] Unknown message type: ${(message as unknown as Record<string, unknown>).type}`);
        // Send error response for unknown message types
        const msg = message as unknown as Record<string, unknown>;
        if ("payload" in msg && typeof msg.payload === "object" && msg.payload !== null && "taskId" in msg.payload) {
          const payload = msg.payload as Record<string, unknown>;
          globalThis.postMessage({
            type: "ERROR",
            payload: {
              taskId: payload.taskId,
              error: {
                message: `Unknown message type: ${msg.type}`,
              },
            },
          });
        }
        break;
      }
    }
  } catch (error) {
    console.error("[Worker] Unhandled error in worker:", error);
    const msg = message as unknown as Record<string, unknown>;
    if ("payload" in msg && typeof msg.payload === "object" && msg.payload !== null && "taskId" in msg.payload) {
      const payload = msg.payload as Record<string, unknown>;
      globalThis.postMessage({
        type: "ERROR",
        payload: {
          taskId: payload.taskId,
          error: getErrorDetails(error),
        },
      });
    }
  }
};
