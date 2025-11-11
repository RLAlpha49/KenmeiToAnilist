/**
 * Exposes shared Web Worker-based pools and utilities for CPU-intensive operations.
 * Uses a single shared pool to keep the main thread responsive.
 * @source
 */

// Core infrastructure
export { WorkerPool } from "./core/worker-pool";
export {
  executeMatchingWithWorkers,
  executeMatchingOnMainThread,
  areWorkersAvailable,
} from "./core/utils";
export { getWorkerPool, workerPool } from "./core/pool";
export { getGenericWorkerPool } from "./core/worker-pool";

// Worker initialization
export { initializeWorkerPoolsAsync } from "./init";

// Matching operations
export { MatchingWorkerPool } from "./matching/matching-worker-pool";
export { BatchSyncWorkerPool } from "./matching/batch-sync-worker-pool";

// Data processing
export {
  CSVWorkerPool,
  getCSVWorkerPool,
} from "./data-processing/csv-worker-pool";
export {
  JSONSerializationWorkerPool,
  getJSONSerializationWorkerPool,
} from "./data-processing/json-serialization-worker-pool";
export { getFilterWorkerPool } from "./data-processing/filter-worker-pool";
export type { FilterOperationResult } from "./data-processing/filter-worker-pool";

// Statistics and analysis
export {
  TitleNormalizationWorkerPool,
  getTitleNormalizationPool,
} from "./statistics/title-normalization-worker-pool";
export {
  StatisticsAggregationWorkerPool,
  getStatisticsWorkerPool,
} from "./statistics/statistics-worker-pool";
export {
  ReadingHistoryWorkerPool,
  getReadingHistoryWorkerPool,
} from "./statistics/reading-history-worker-pool";
export {
  DuplicateDetectionWorkerPool,
  getDuplicateDetectionWorkerPool,
} from "./statistics/duplicate-worker-pool";

// UI
export {
  DataTableWorkerPool,
  getDataTableWorkerPool,
} from "./ui/data-table-worker-pool";

// Type exports
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
  BatchSyncMessage,
  BatchSyncProgressMessage,
  BatchSyncResultMessage,
  PreparedSyncOperation,
} from "./core/types";

export type { StatisticsAggregationResult } from "./statistics/statistics-worker-pool";
export type { ReadingHistoryFilterResult } from "./statistics/reading-history-worker-pool";
export type { CancellableExecution } from "./core/utils";
export type { CSVWorkerPoolConfig } from "./data-processing/csv-worker-pool";
export type {
  NormalizationCacheResult,
  NormalizationProgressCallback,
} from "./statistics/title-normalization-worker-pool";
export type { JSONSerializationWorkerPoolConfig } from "./data-processing/json-serialization-worker-pool";
export type { DuplicateDetectionResult } from "./statistics/duplicate-worker-pool";
export type {
  DataTablePreparationResult,
  PreparedTableRow,
} from "./ui/data-table-worker-pool";
export type { BatchSyncExecution } from "./matching/batch-sync-worker-pool";
