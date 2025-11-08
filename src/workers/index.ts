/**
 * Workers module - Web Worker-based parallel processing for manga matching.
 *
 * Provides a worker pool for executing CPU-intensive matching operations in parallel,
 * keeping the main thread responsive during large batch operations.
 *
 * @module workers
 */

export { MatchingWorkerPool } from "./worker-pool";
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
} from "./types";
export type { CancellableExecution } from "./utils";

// Re-export from pool module to avoid circular dependency
export { getWorkerPool, workerPool } from "./pool";
