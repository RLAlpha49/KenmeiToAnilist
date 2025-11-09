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
      stack?: string;
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
  | AdvancedFilterMessage
  | AdvancedFilterResultMessage
  | TitleNormalizationProgressMessage
  | TitleNormalizationResultMessage;

/**
 * Union type of all possible messages sent TO the worker.
 */
export type WorkerInboundMessage =
  | MatchBatchMessage
  | CancelMessage
  | CSVStartMessage
  | CSVChunkMessage
  | AdvancedFilterMessage
  | TitleNormalizationMessage;

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
