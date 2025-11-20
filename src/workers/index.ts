/**
 * Public worker API surface used by renderer components, hooks, and services.
 * Low-level primitives such as WorkerPool, WorkerMessage, and WorkerTask live in
 * `./internal.ts` to avoid unnecessary coupling with UI-facing modules.
 * @source
 */

// Core utilities that orchestrate worker execution from the renderer
export {
  executeMatchingWithWorkers,
  executeMatchingOnMainThread,
  areWorkersAvailable,
} from "./core/utils";
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

// Search
export {
  FuzzySearchWorkerPool,
  getFuzzySearchWorkerPool,
} from "./search/fuzzy-search-worker-pool";
export type { FuzzySearchResult } from "./search/fuzzy-search-worker-pool";

// Maintenance
export { recalculateConfidenceScores } from "./maintenance/confidence-recalculation-worker";
export type {
  ConfidenceRecalculationExecution,
  ConfidenceRecalculationMetadata,
  ConfidenceRecalculationOptions,
  ConfidenceRecalculationResult,
} from "./maintenance/confidence-recalculation-worker";

// Type exports for UI-facing result shapes
export type { StatisticsAggregationResult } from "./statistics/statistics-worker-pool";
export type { ReadingHistoryFilterResult } from "./statistics/reading-history-worker-pool";
export type { CSVWorkerPoolConfig } from "./data-processing/csv-worker-pool";
export type {
  NormalizationCacheResult,
  NormalizationProgressCallback,
} from "./statistics/title-normalization-worker-pool";
export type { JSONSerializationWorkerPoolConfig } from "./data-processing/json-serialization-worker-pool";
export type { DuplicateDetectionResult } from "./statistics/duplicate-worker-pool";
