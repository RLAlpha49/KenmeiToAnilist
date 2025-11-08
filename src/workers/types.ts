/**
 * Type definitions for Web Worker communication protocol.
 * Defines message types and interfaces for worker-based matching operations.
 */

import type { KenmeiManga } from "@/api/kenmei/types";
import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";

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
 */
export interface ProgressMessage {
  type: "PROGRESS";
  payload: {
    taskId: string;
    current: number;
    total: number;
    currentTitle: string;
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
 * Union type of all possible worker messages.
 */
export type WorkerMessage =
  | MatchBatchMessage
  | CancelMessage
  | ProgressMessage
  | ResultMessage
  | ErrorMessage;

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
