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
export {
  TitleNormalizationWorkerPool,
  getTitleNormalizationPool,
} from "./title-normalization-worker-pool";
export {
  StatisticsAggregationWorkerPool,
  getStatisticsWorkerPool,
} from "./statistics-worker-pool";
export {
  ReadingHistoryWorkerPool,
  getReadingHistoryWorkerPool,
} from "./reading-history-worker-pool";
export {
  JSONSerializationWorkerPool,
  getJSONSerializationWorkerPool,
} from "./json-serialization-worker-pool";
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
  TitleNormalizationMessage,
  TitleNormalizationProgressMessage,
  TitleNormalizationResultMessage,
  ReadingHistoryFilterMessage,
  ReadingHistoryFilterProgressMessage,
  ReadingHistoryFilterResultMessage,
  JSONSerializeMessage,
  JSONDeserializeMessage,
  JSONSerializeResultMessage,
  JSONDeserializeResultMessage,
} from "./types";
export type { StatisticsAggregationResult } from "./statistics-worker-pool";
export type { ReadingHistoryFilterResult } from "./reading-history-worker-pool";
export type { CancellableExecution } from "./utils";
export type { CSVWorkerPoolConfig } from "./csv-worker-pool";
export type {
  NormalizationCacheResult,
  NormalizationProgressCallback,
} from "./title-normalization-worker-pool";
export type { JSONSerializationWorkerPoolConfig } from "./json-serialization-worker-pool";

// Re-export from pool module to avoid circular dependency
export { getWorkerPool, workerPool } from "./pool";

// Re-export generic pool for internal use by specialized pools
export { getGenericWorkerPool } from "./worker-pool";
