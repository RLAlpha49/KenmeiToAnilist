/**
 * Workers module - Web Worker-based parallel processing for manga matching and CSV parsing.
 *
 * Provides worker pools for executing CPU-intensive operations in parallel:
 * - Matching worker pool for manga matching operations
 * - CSV worker pool for CSV parsing and processing
 *
 * Both keep the main thread responsive during large batch operations.
 *
 * @module workers
 */

export { MatchingWorkerPool } from "./matching-worker-pool";
export { CSVWorkerPool, getCSVWorkerPool } from "./csv-worker-pool";
export {
  executeMatchingWithWorkers,
  executeMatchingOnMainThread,
  areWorkersAvailable,
} from "./utils";
export type {
  WorkerMessage,
  MatchBatchMessage,
  CancelMessage,
  ProgressMessage,
  ResultMessage,
  ErrorMessage,
  WorkerTask,
  WorkerPoolConfig,
  MatchBatchExecution,
  CSVStartMessage,
  CSVChunkMessage,
  CSVCompleteMessage,
} from "./types";
export type { CancellableExecution } from "./utils";
export type { CSVWorkerPoolConfig } from "./csv-worker-pool";

// Re-export from pool module to avoid circular dependency
export { getWorkerPool, workerPool } from "./pool";
