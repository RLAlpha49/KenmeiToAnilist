/**
 * Workers module - Web Worker-based parallel processing for manga matching and CSV parsing.
 *
 * Provides a worker pool that efficiently handles CPU-intensive operations:
 *
 * The single shared worker pool (4 workers by default) serves all operations,
 * maximizing resource utilization and keeping the main thread responsive.
 *
 * @module workers
 */

export { MatchingWorkerPool } from "./matching-worker-pool";
export { CSVWorkerPool, getCSVWorkerPool } from "./csv-worker-pool";
export { WorkerPool } from "./worker-pool";
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
