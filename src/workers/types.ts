/**
 * Type definitions for Web Worker communication protocol.
 * Defines message types and interfaces for worker-based matching operations.
 */

import type { KenmeiManga, KenmeiStatus } from "@/api/kenmei/types";
import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";

/**
 * Message sent to worker to initiate a batch matching operation.
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
 * Message sent to worker to cancel an in-progress task.
 */
export interface CancelMessage {
  type: "CANCEL";
  payload: {
    taskId: string;
  };
}

/**
 * Message sent from worker to report progress on a task.
 * Supports both count-based progress (for matching) and byte-based progress (for CSV).
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
  };
}

/**
 * Message sent from worker when a task completes successfully.
 */
export interface ResultMessage {
  type: "RESULT";
  payload: {
    taskId: string;
    results: MangaMatchResult[];
  };
}

/**
 * Message sent from worker when a task encounters an error.
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
 * Message sent to worker to start a CSV parsing operation.
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
 * Message sent to worker containing a chunk of CSV data to parse.
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
 * Message sent from worker when CSV parsing completes successfully.
 * Includes parsed manga entries and parsing statistics.
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
 * Message sent from worker when a CSV parsing operation is cancelled.
 * Signals that the CSV task state has been cleaned up and parsing has stopped.
 */
export interface CSVCancelledMessage {
  type: "CSV_CANCELLED";
  payload: {
    taskId: string;
  };
}

/**
 * Message sent to worker to apply advanced filters to matches.
 * Worker will efficiently filter the match array based on the provided criteria.
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
 * Message sent from worker containing filtered match results and metadata.
 * Includes performance timing and optional debugging information.
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
 * Represents a cached normalization result for a title string.
 * Includes the normalized form and the algorithm that produced it.
 */
export interface NormalizedTitleCache {
  [algorithm: string]: string;
}

/**
 * Message sent to worker to normalize title strings across multiple algorithms.
 * Seeds similarity caches off-thread for large manga libraries.
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
 * Progress message for title normalization, sent from worker.
 * Reports progress by algorithm for UI feedback.
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
 * Message sent from worker containing normalized title cache results.
 * Includes per-algorithm cache payloads and optional delta information.
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
 * Message sent to worker to aggregate statistics data.
 * Worker will perform filtering, normalization, and aggregation off-thread.
 */
export interface StatisticsAggregationMessage {
  type: "STATISTICS_AGGREGATION";
  payload: {
    taskId: string;
    matchResults: Array<{
      readonly kenmeiManga: {
        id: string | number;
        title: string;
        status: string;
        score: number;
        chapters_read: number;
        volumes_read: number;
        notes: string;
        created_at: string;
        updated_at: string;
        last_read_at?: string;
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
    }>;
    readingHistory: {
      entries: Array<{
        mangaId: string | number;
        chaptersRead: number;
        timestamp: number;
      }>;
      lastUpdated: number;
      version: number;
    };
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
 * Progress message for statistics aggregation, sent from worker.
 * Reports progress by aggregation stage for UI feedback.
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
 * Message sent from worker containing aggregated statistics results.
 * Includes all chart data, filter options, and performance metrics.
 */
export interface StatisticsAggregationResultMessage {
  type: "STATISTICS_AGGREGATION_RESULT";
  payload: {
    taskId: string;
    /**
     * Filtered match results and history
     */
    filteredData: {
      matchResults: Array<{
        readonly kenmeiManga: {
          id: string | number;
          title: string;
          status: string;
          score: number;
          chapters_read: number;
          volumes_read: number;
          notes: string;
          created_at: string;
          updated_at: string;
          last_read_at?: string;
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
      }>;
      readingHistory: {
        entries: Array<{
          mangaId: string | number;
          chaptersRead: number;
          timestamp: number;
        }>;
        lastUpdated: number;
        version: number;
      };
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
 * Union type of all possible worker messages.
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
  | JSONDeserializeResultMessage;

/**
 * Message sent to worker to filter and aggregate reading history.
 * Worker will apply time range filters and compute summary statistics.
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
 * Progress message for reading history filtering, sent from worker.
 * Reports progress by stage for UI feedback.
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
 * Message sent from worker containing filtered reading history and statistics.
 * Includes filtered entries, summary stats, and performance metrics.
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
 * Message sent to worker to serialize data to JSON string.
 * Offloads heavy JSON.stringify operations to worker thread.
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
 * Message sent from worker containing serialized JSON string.
 * Includes performance timing and optional compression metadata.
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
 * Message sent to worker to deserialize JSON string.
 * Offloads heavy JSON.parse operations to worker thread.
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
 * Message sent from worker containing deserialized data.
 * Includes performance timing and optional validation metadata.
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
 * Union type of all possible messages sent TO the worker.
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
  | JSONDeserializeMessage;

/**
 * Internal task tracking structure for the worker pool.
 */
export interface WorkerTask {
  taskId: string;
  kenmeiManga: KenmeiManga[];
  anilistCandidates: Map<string, AniListManga[]>;
  config: Partial<MatchEngineConfig>;
  resolve: (results: MangaMatchResult[]) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
  progressCallback?: (
    current: number,
    total: number,
    currentTitle?: string,
  ) => void;
  workerIndex?: number;
  totalItems?: number;
  processedItems?: number;
  chunkProgress?: Map<number, { current: number; total: number }>;
}

/**
 * Configuration options for the worker pool.
 */
export interface WorkerPoolConfig {
  /**
   * Maximum number of workers to spawn.
   * Default: Math.min(navigator.hardwareConcurrency || 2, 4)
   */
  maxWorkers: number;

  /**
   * Whether to enable worker-based matching.
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
 * Return value of executeMatchBatch operation.
 * Includes the main task ID, associated chunk task IDs, and result promise.
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
