/**
 * Shared worker communication contracts for matching, CSV, analytics and related operations.
 * @source
 */

import type { KenmeiManga, KenmeiStatus } from "@/api/kenmei/types";
import type {
  AniListManga,
  MangaMatchResult,
  AniListMediaEntry,
} from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import type { AdvancedMatchFilters } from "@/types/matching-filters";
import type { IFuseOptions } from "fuse.js";

/**
 * Inbound request to start a batch matching operation in the worker.
 * @source
 */
export interface MatchBatchMessage {
  type: "MATCH_BATCH";
  payload: {
    kenmeiManga: KenmeiManga[];
    anilistCandidates: Array<[string, AniListManga[]]>;
    config: Partial<MatchEngineConfig>;
    taskId: string;
  };
}

/**
 * Inbound request to cancel an in-progress worker task.
 * @source
 */
export interface CancelMessage {
  type: "CANCEL";
  payload: {
    taskId: string;
  };
}

/**
 * Outbound progress update from the worker for matching or CSV tasks.
 * @source
 */
export interface ProgressMessage {
  type: "PROGRESS";
  payload: {
    taskId: string;
    // For matching worker (count-based)
    current?: number;
    total?: number;
    currentTitle?: string;
    // For CSV worker (byte-based)
    processedBytes?: number;
    totalBytes?: number;
    // For CSV worker (row count progress)
    parsedRowsCount?: number;
  };
}

/**
 * Outbound result payload for a successfully completed worker task.
 * @source
 */
export interface ResultMessage {
  type: "RESULT";
  payload: {
    taskId: string;
    results: MangaMatchResult[];
  };
}

/**
 * Outbound error payload for a failed worker task.
 * @source
 */
export interface ErrorMessage {
  type: "ERROR";
  payload: {
    taskId: string;
    error: {
      message: string;
      name?: string;
      stack?: string;
      causeMessage?: string;
    };
  };
}

/**
 * Inbound request to start a CSV parsing operation.
 * @source
 */
export interface CSVStartMessage {
  type: "CSV_START";
  payload: {
    taskId: string;
    totalSize: number;
    options: {
      defaultStatus: KenmeiStatus;
    };
  };
}

/**
 * Inbound CSV data chunk for incremental parsing.
 * @source
 */
export interface CSVChunkMessage {
  type: "CSV_CHUNK";
  payload: {
    taskId: string;
    chunk: string;
    chunkIndex: number;
    isLastChunk: boolean;
  };
}

/**
 * Outbound result for completed CSV parsing, including entries and stats.
 * @source
 */
export interface CSVCompleteMessage {
  type: "CSV_COMPLETE";
  payload: {
    taskId: string;
    manga: KenmeiManga[];
    stats: {
      totalParsed: number;
      processingTimeMs: number;
      bytesProcessed: number;
    };
  };
}

/**
 * Outbound signal that a CSV parsing task was cancelled and cleaned up.
 * @source
 */
export interface CSVCancelledMessage {
  type: "CSV_CANCELLED";
  payload: {
    taskId: string;
  };
}

export interface CSVRowsMessage {
  type: "CSV_ROWS";
  payload: {
    taskId: string;
    rows: KenmeiManga[];
  };
}

/**
 * Inbound request to apply advanced match filters in the worker.
 * @source
 */
export interface AdvancedFilterMessage {
  type: "ADVANCED_FILTER";
  payload: {
    taskId: string;
    matches: MangaMatchResult[];
    filters: AdvancedMatchFilters;
  };
}

/**
 * Outbound filtered match results with stats and optional debug data.
 * @source
 */
export interface AdvancedFilterResultMessage {
  type: "ADVANCED_FILTER_RESULT";
  payload: {
    taskId: string;
    /**
     * Array of filtered match results
     */
    filteredMatches: MangaMatchResult[];
    /**
     * Count statistics for UI display
     */
    stats: {
      totalMatches: number;
      filteredCount: number;
      confidenceFiltered: number;
      formatFiltered: number;
      genreFiltered: number;
      statusFiltered: number;
      yearFiltered: number;
      tagFiltered: number;
    };
    /**
     * Performance timing information
     */
    timing: {
      processingTimeMs: number;
      filterApplicationTimeMs: number;
    };
    /**
     * Optional debug information (when debug mode enabled)
     */
    debug?: {
      mismatchReasons: Array<{
        matchId: number;
        reason: string;
      }>;
    };
  };
}

/**
 * Cache of normalized title variants keyed by normalization algorithm.
 * @source
 */
export interface NormalizedTitleCache {
  [algorithm: string]: string;
}

/**
 * Shared manga match result structure for statistics operations.
 * @source
 */
export interface StatisticsMatchResult {
  readonly kenmeiManga: {
    id: string | number;
    title: string;
    status: string;
    score: number;
    chaptersRead: number;
    volumesRead: number;
    notes: string;
    createdAt: string;
    updatedAt: string;
    lastReadAt?: string;
  };
  readonly anilistMatches?: Array<{ confidence?: number }>;
  readonly selectedMatch?: {
    readonly format?: string;
    readonly genres: string[];
    readonly tags: string[];
    readonly confidence?: number;
  };
  readonly status: string;
  readonly matchDate?: string | number | Date;
}

/**
 * Shared reading history structure for statistics operations.
 * @source
 */
export interface ReadingHistoryData {
  entries: Array<{
    mangaId: string | number;
    chaptersRead: number;
    timestamp: number;
  }>;
  lastUpdated: number;
  version: number;
}

/**
 * Inbound request to normalize titles with one or more algorithms.
 * @source
 */
export interface TitleNormalizationMessage {
  type: "TITLE_NORMALIZATION";
  payload: {
    taskId: string;
    titles: string[];
    algorithms: Array<"normalizeForMatching" | "processTitle">;
  };
}

/**
 * Outbound progress update for title normalization work.
 * @source
 */
export interface TitleNormalizationProgressMessage {
  type: "TITLE_NORMALIZATION_PROGRESS";
  payload: {
    taskId: string;
    algorithm: string;
    current: number;
    total: number;
  };
}

/**
 * Outbound normalized title cache payload with optional deltas.
 * @source
 */
export interface TitleNormalizationResultMessage {
  type: "TITLE_NORMALIZATION_RESULT";
  payload: {
    taskId: string;
    /**
     * Cache keyed by algorithm name, each mapping original titles to normalized forms
     */
    caches: {
      [algorithm: string]: Record<string, string>;
    };
    /**
     * Performance timing information
     */
    timing: {
      processingTimeMs: number;
      totalTitlesProcessed: number;
    };
    /**
     * Optional delta information for incremental cache updates
     */
    deltas?: {
      [algorithm: string]: {
        added: Record<string, string>;
        modified: Record<string, string>;
      };
    };
  };
}

/**
 * Inbound request to aggregate statistics off-thread.
 * @source
 */
export interface StatisticsAggregationMessage {
  type: "STATISTICS_AGGREGATION";
  payload: {
    taskId: string;
    matchResults: StatisticsMatchResult[];
    readingHistory: ReadingHistoryData;
    filters: {
      genres: string[];
      formats: string[];
      tags: string[];
      statuses: string[];
      dateRange: { start: Date | null; end: Date | null };
      confidenceRange: { min: number; max: number };
    };
    comparisonMode: {
      enabled: boolean;
      primaryRange: string;
      secondaryRange: string;
      metric: string;
    };
    selectedTimeRange: "7d" | "30d" | "90d" | "all";
  };
}

/**
 * Outbound progress update for statistics aggregation stages.
 * @source
 */
export interface StatisticsAggregationProgressMessage {
  type: "STATISTICS_AGGREGATION_PROGRESS";
  payload: {
    taskId: string;
    stage: "filtering" | "comparison" | "trends" | "habits" | "complete";
    progress: number; // 0-100
    message: string;
  };
}

/**
 * Outbound aggregated statistics data with filters, charts, and timings.
 * @source
 */
export interface StatisticsAggregationResultMessage {
  type: "STATISTICS_AGGREGATION_RESULT";
  payload: {
    taskId: string;
    /**
     * Filtered match results and history
     */
    filteredData: {
      matchResults: StatisticsMatchResult[];
      readingHistory: ReadingHistoryData;
    };
    /**
     * Available filter options extracted from data
     */
    filterOptions: {
      genres: string[];
      formats: string[];
      statuses: string[];
      tags: string[];
    };
    /**
     * Comparison datasets if comparison mode is enabled
     */
    comparisonDatasets: {
      primary: {
        trends: Array<{ date: string; chapters: number; count: number }>;
        velocity: {
          perDay: number;
          perWeek: number;
          perMonth: number;
          totalChapters: number;
          activeDays: number;
        };
        habits: {
          byDayOfWeek: Array<{ day: string; chapters: number }>;
          byTimeOfDay: Array<{ hour: string; chapters: number }>;
          peakDay: string | null;
          peakHour: string | null;
        };
      };
      secondary: {
        trends: Array<{ date: string; chapters: number; count: number }>;
        velocity: {
          perDay: number;
          perWeek: number;
          perMonth: number;
          totalChapters: number;
          activeDays: number;
        };
        habits: {
          byDayOfWeek: Array<{ day: string; chapters: number }>;
          byTimeOfDay: Array<{ hour: string; chapters: number }>;
          peakDay: string | null;
          peakHour: string | null;
        };
      };
      primaryLabel: string;
      secondaryLabel: string;
    } | null;
    /**
     * Cache key for memoization
     */
    cacheKey: string;
    /**
     * Performance timing information
     */
    timing: {
      filteringTimeMs: number;
      aggregationTimeMs: number;
      totalTimeMs: number;
    };
  };
}

/**
 * Prepared batch sync operation description used by the API layer.
 * @source
 */
export interface PreparedSyncOperation {
  mediaId: number;
  entries: AniListMediaEntry[];
  steps: number[];
  variables: Record<string, unknown>[];
  estimatedApiCalls: number;
}

/**
 * Inbound request to build prepared batch sync operations.
 * @source
 */
export interface BatchSyncMessage {
  type: "BATCH_SYNC";
  payload: {
    taskId: string;
    entries: AniListMediaEntry[];
    rateLimitConfig?: {
      maxRequestsPerMinute: number;
      requestInterval: number;
    };
  };
}

/**
 * Outbound progress update for batch sync preparation phases.
 * @source
 */
export interface BatchSyncProgressMessage {
  type: "BATCH_SYNC_PROGRESS";
  payload: {
    taskId: string;
    phase: "organizing" | "building" | "ready";
    processed: number;
    total: number;
    currentMediaId?: number;
  };
}

/**
 * Outbound prepared batch sync operations and failure details.
 * @source
 */
export interface BatchSyncResultMessage {
  type: "BATCH_SYNC_RESULT";
  payload: {
    taskId: string;
    operations: PreparedSyncOperation[];
    totalApiCallsEstimate: number;
    failedEntries: Array<{
      mediaId: number;
      error: string;
    }>;
  };
}

/**
 * Outbound terminal cancellation message for match batch operations.
 * @source
 */
export interface MatchCancelledMessage {
  type: "MATCH_CANCELLED";
  payload: {
    taskId: string;
    itemsProcessed: number;
    totalItems: number;
  };
}

/**
 * Outbound terminal cancellation message for statistics operations.
 * Includes stage information indicating at which processing stage cancellation occurred.
 * @source
 */
export interface StatisticsAggregationCancelledMessage {
  type: "STATISTICS_AGGREGATION_CANCELLED";
  payload: {
    taskId: string;
    stage: "filtering" | "aggregation" | "completion";
  };
}

/**
 * Outbound terminal cancellation message for title normalization operations.
 * Includes algorithm and stage information indicating when cancellation occurred.
 * @source
 */
export interface TitleNormalizationCancelledMessage {
  type: "TITLE_NORMALIZATION_CANCELLED";
  payload: {
    taskId: string;
    algorithm?: string;
    stage?: "completion";
  };
}

/**
 * Outbound terminal cancellation message for batch sync operations.
 * @source
 */
export interface BatchSyncCancelledMessage {
  type: "BATCH_SYNC_CANCELLED";
  payload: {
    taskId: string;
  };
}

/**
 * Outbound terminal cancellation message for duplicate detection operations.
 * @source
 */
export interface DuplicateDetectionCancelledMessage {
  type: "DUPLICATE_DETECTION_CANCELLED";
  payload: {
    taskId: string;
  };
}

/**
 * Outbound terminal cancellation message for data table preparation operations.
 * @source
 */
export interface DataTableCancelledMessage {
  type: "DATA_TABLE_CANCELLED";
  payload: {
    taskId: string;
  };
}

/**
 * Outbound terminal cancellation message for reading history filter operations.
 * Includes stage information indicating at which processing stage cancellation occurred.
 * @source
 */
export interface ReadingHistoryCancelledMessage {
  type: "READING_HISTORY_CANCELLED";
  payload: {
    taskId: string;
    stage: "completion";
  };
}

/**
 * Inbound request to perform fuzzy search on manga matches.
 * @source
 */
export interface FuzzySearchMessage {
  type: "FUZZY_SEARCH";
  payload: {
    taskId: string;
    matches: MangaMatchResult[];
    query: string;
    keys: (string | { name: string; weight?: number })[];
    options?: Partial<IFuseOptions<MangaMatchResult>>;
    maxResults?: number;
  };
}

/**
 * Outbound result for fuzzy search operation with timing metrics.
 * @source
 */
export interface FuzzySearchResultMessage {
  type: "FUZZY_SEARCH_RESULT";
  payload: {
    taskId: string;
    results: MangaMatchResult[];
    timing: {
      indexingTimeMs: number;
      searchTimeMs: number;
      totalTimeMs: number;
    };
  };
}

/**
 * Discriminated union of all supported worker message variants.
 * @source
 */
export type WorkerMessage =
  | MatchBatchMessage
  | CancelMessage
  | ProgressMessage
  | ResultMessage
  | ErrorMessage
  | CSVStartMessage
  | CSVChunkMessage
  | CSVCompleteMessage
  | CSVRowsMessage
  | CSVCancelledMessage
  | AdvancedFilterMessage
  | AdvancedFilterResultMessage
  | TitleNormalizationProgressMessage
  | TitleNormalizationResultMessage
  | StatisticsAggregationProgressMessage
  | StatisticsAggregationResultMessage
  | ReadingHistoryFilterProgressMessage
  | ReadingHistoryFilterResultMessage
  | JSONSerializeResultMessage
  | JSONDeserializeResultMessage
  | DuplicateDetectionProgressMessage
  | DuplicateDetectionResultMessage
  | DataTablePreparationProgressMessage
  | DataTablePreparationResultMessage
  | BatchSyncProgressMessage
  | BatchSyncResultMessage
  | FuzzySearchMessage
  | FuzzySearchResultMessage
  | MatchCancelledMessage
  | StatisticsAggregationCancelledMessage
  | TitleNormalizationCancelledMessage
  | BatchSyncCancelledMessage
  | DuplicateDetectionCancelledMessage
  | DataTableCancelledMessage
  | ReadingHistoryCancelledMessage;

/**
 * Inbound request to filter and aggregate reading history.
 * @source
 */
export interface ReadingHistoryFilterMessage {
  type: "READING_HISTORY_FILTER";
  payload: {
    taskId: string;
    history: {
      entries: Array<{
        timestamp: number;
        mangaId: string | number;
        title: string;
        chaptersRead: number;
        status: string;
        anilistId?: number;
      }>;
      lastUpdated: number;
      version: number;
    };
    dateRange: {
      start: number; // Unix timestamp in milliseconds
      end: number; // Unix timestamp in milliseconds
    };
    aggregationType?: "daily" | "weekly" | "none"; // Optional aggregation (default: "none")
  };
}

/**
 * Outbound progress update for reading history filtering.
 * @source
 */
export interface ReadingHistoryFilterProgressMessage {
  type: "READING_HISTORY_FILTER_PROGRESS";
  payload: {
    taskId: string;
    stage: "filtering" | "aggregation" | "complete";
    progress: number; // 0-100
    message: string;
  };
}

/**
 * Outbound filtered reading history, summary stats, and timings.
 * @source
 */
export interface ReadingHistoryFilterResultMessage {
  type: "READING_HISTORY_FILTER_RESULT";
  payload: {
    taskId: string;
    /**
     * Filtered history entries within the date range
     */
    filteredEntries: Array<{
      timestamp: number;
      mangaId: string | number;
      title: string;
      chaptersRead: number;
      status: string;
      anilistId?: number;
    }>;
    /**
     * Summary statistics for the filtered period
     */
    stats: {
      totalEntries: number;
      totalChaptersRead: number;
      uniqueMangaCount: number;
      dateRange: {
        start: number;
        end: number;
      };
      activeDays: number;
      averageChaptersPerDay: number;
    };
    /**
     * Optional aggregated data (when aggregationType specified)
     */
    aggregatedData?: Array<{
      date: string; // ISO date string
      chaptersRead: number;
      entriesCount: number;
    }>;
    /**
     * Performance timing information
     */
    timing: {
      filteringTimeMs: number;
      aggregationTimeMs?: number;
      totalTimeMs: number;
    };
  };
}

/**
 * Inbound request to serialize data to JSON in the worker.
 * @source
 */
export interface JSONSerializeMessage {
  type: "JSON_SERIALIZE";
  payload: {
    taskId: string;
    data: unknown;
    /**
     * Optional replacer function to filter properties during serialization
     */
    replacerKeys?: string[];
    /**
     * Optional space parameter for pretty-printing (0-10)
     */
    space?: number;
  };
}

/**
 * Outbound serialized JSON result and timing metrics.
 * @source
 */
export interface JSONSerializeResultMessage {
  type: "JSON_SERIALIZE_RESULT";
  payload: {
    taskId: string;
    /**
     * The serialized JSON string
     */
    json: string;
    /**
     * Size in bytes of the serialized data
     */
    sizeBytes: number;
    /**
     * Performance timing information
     */
    timing: {
      serializationTimeMs: number;
    };
  };
}

/**
 * Inbound request to deserialize JSON in the worker.
 * @source
 */
export interface JSONDeserializeMessage {
  type: "JSON_DESERIALIZE";
  payload: {
    taskId: string;
    json: string;
    /**
     * Optional reviver function to transform parsed values
     */
    reviverKeys?: string[];
  };
}

/**
 * Outbound deserialized data result and timing metrics.
 * @source
 */
export interface JSONDeserializeResultMessage {
  type: "JSON_DESERIALIZE_RESULT";
  payload: {
    taskId: string;
    /**
     * The deserialized data
     */
    data: unknown;
    /**
     * Performance timing information
     */
    timing: {
      deserializationTimeMs: number;
    };
  };
}

/**
 * Description of a detected duplicate AniList mapping.
 * @source
 */
export interface DuplicateDetectionEntry {
  anilistId: number;
  anilistTitle: string;
  matchIndices: number[];
  kenmeiTitles: string[];
}

/**
 * Inbound request to detect duplicate AniList IDs across matches.
 * @source
 */
export interface DuplicateDetectionMessage {
  type: "DUPLICATE_DETECTION";
  payload: {
    taskId: string;
    matches: MangaMatchResult[];
    ignoredDuplicateIds: number[];
    chunkSize?: number;
  };
}

/**
 * Outbound progress update for duplicate detection comparisons.
 * @source
 */
export interface DuplicateDetectionProgressMessage {
  type: "DUPLICATE_DETECTION_PROGRESS";
  payload: {
    taskId: string;
    current: number;
    total: number;
    message: string;
  };
}

/**
 * Outbound duplicate detection results with groups and timings.
 * @source
 */
export interface DuplicateDetectionResultMessage {
  type: "DUPLICATE_DETECTION_RESULT";
  payload: {
    taskId: string;
    /**
     * Array of detected duplicate groups
     */
    duplicates: DuplicateDetectionEntry[];
    /**
     * Performance timing information
     */
    timing: {
      processingTimeMs: number;
      comparisonCount: number;
    };
  };
}

/**
 * Precomputed table cell metadata for a single row.
 * @source
 */
export interface DataTableCellData {
  /**
   * Raw value from the manga item
   */
  value: string | number | undefined;

  /**
   * Formatted/displayed value
   */
  displayValue: string;

  /**
   * Computed row height in pixels for virtualization
   */
  rowHeight: number;
}

/**
 * Prepared table row with precomputed display values for UI virtualization.
 * This interface is shared between the worker and main thread so both can agree on
 * the shape of rows produced by the data table preparation operation.
 */
export interface PreparedTableRow<TOriginal = unknown> {
  original: TOriginal;
  formattedValues: {
    status: string;
    score: string;
    chapters: string;
    volumes: string;
    lastRead: string;
  };
  rowHeight: number;
}

/**
 * Inbound request to prepare paged/virtualized table data.
 * @source
 */
export interface DataTablePreparationMessage {
  type: "DATA_TABLE_PREPARATION";
  payload: {
    taskId: string;
    /**
     * The manga data to prepare
     */
    data: Array<{
      title: string;
      status: string;
      score?: number;
      chaptersRead?: number;
      volumesRead?: number;
      url?: string;
      source?: string;
      notes?: string;
      lastReadAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
    /**
     * Viewport parameters for slicing
     */
    viewport: {
      /**
       * Starting index for the slice
       */
      startIndex: number;

      /**
       * Ending index for the slice
       */
      endIndex: number;

      /**
       * Items per page (for pagination context)
       */
      itemsPerPage: number;
    };
    /**
     * Which columns are currently displayed
     */
    columnVisibility: {
      score: boolean;
      chapters: boolean;
      volumes: boolean;
      lastRead: boolean;
    };
    /**
     * Current sort state
     */
    sortState?: {
      column: string;
      direction: "asc" | "desc";
    };
  };
}

/**
 * Outbound progress update for data table preparation.
 * @source
 */
export interface DataTablePreparationProgressMessage {
  type: "DATA_TABLE_PREPARATION_PROGRESS";
  payload: {
    taskId: string;
    stage: "formatting" | "computing-metadata" | "complete";
    progress: number; // 0-100
    message: string;
  };
}

/**
 * Outbound prepared table data including metadata and timings.
 * @source
 */
export interface DataTablePreparationResultMessage {
  type: "DATA_TABLE_PREPARATION_RESULT";
  payload: {
    taskId: string;
    /**
     * Virtualized data slice with precomputed values
     */
    preparedData: PreparedTableRow<
      DataTablePreparationMessage["payload"]["data"][number]
    >[];
    /**
     * Index information
     */
    indexInfo: {
      startIndex: number;
      endIndex: number;
      totalCount: number;
    };
    /**
     * Performance timing information
     */
    timing: {
      formattingTimeMs: number;
      metadataComputationTimeMs: number;
      totalTimeMs: number;
    };
  };
}

/**
 * Discriminated union of all messages accepted by the worker.
 * @source
 */
export type WorkerInboundMessage =
  | MatchBatchMessage
  | CancelMessage
  | CSVStartMessage
  | CSVChunkMessage
  | AdvancedFilterMessage
  | TitleNormalizationMessage
  | StatisticsAggregationMessage
  | ReadingHistoryFilterMessage
  | JSONSerializeMessage
  | JSONDeserializeMessage
  | DuplicateDetectionMessage
  | DataTablePreparationMessage
  | BatchSyncMessage
  | FuzzySearchMessage;

/**
 * Configuration options controlling worker pool capacity and fallbacks.
 * Unified definition used by all worker pool implementations.
 * @source
 */
export interface WorkerPoolConfig {
  /**
   * Maximum number of workers to spawn.
   * Default: Math.min(navigator.hardwareConcurrency || 2, 4)
   */
  maxWorkers: number;

  /**
   * Whether to enable worker-based execution.
   * If false, all operations fall back to main thread.
   * Default: true
   */
  enableWorkers: boolean;

  /**
   * Whether to fall back to main thread execution if workers fail.
   * Default: true
   */
  fallbackToMainThread: boolean;
}

/**
 * Unified internal task tracking structure for all worker pool operations.
 * Supports multiple task types (matching, csv, statistics, etc.) with optional
 * fields for task-specific metadata and progress handling.
 * @source
 */
export interface WorkerTask {
  // Core task identification and control
  taskId: string;
  resolve: (result: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  isCancelled: boolean;

  // Worker assignment
  workerIndex?: number;

  // Progress and cancellation handling
  onProgress?: (message: WorkerMessage) => void;
  cancelTimeoutHandle?: NodeJS.Timeout;

  // Matching-specific fields (optional for other pools)
  kenmeiManga?: KenmeiManga[];
  anilistCandidates?: Array<[string, AniListManga[]]>;
  config?: Partial<MatchEngineConfig>;
  progressCallback?: (
    current: number,
    total: number,
    currentTitle?: string,
  ) => void;
  totalItems?: number;
  processedItems?: number;
  chunkProgress?: Map<number, { current: number; total: number }>;
}

/**
 * Return value of executeMatchBatch, including task IDs and result promise.
 * @source
 */
export interface MatchBatchExecution {
  /**
   * Main task ID for tracking and cancellation
   */
  taskId: string;

  /**
   * Array of chunk task IDs for multi-chunk operations
   */
  chunkTaskIds: string[];

  /**
   * Promise that resolves to match results
   */
  promise: Promise<MangaMatchResult[]>;
}
