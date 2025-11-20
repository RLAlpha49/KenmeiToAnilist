/**
 * Internal worker primitives intended solely for other worker infrastructure modules.
 * This module is not meant for UI layers – pages, components, or hooks should import the
 * public-facing APIs exported by `./index.ts` (e.g. `@/workers`).
 * @source
 */

export { WorkerPool } from "./core/worker-pool";
export { getWorkerPool, workerPool } from "./core/pool";
export { getGenericWorkerPool } from "./core/worker-pool";

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
  FuzzySearchMessage,
  FuzzySearchResultMessage,
  PreparedTableRow,
} from "./core/types";

export type { CancellableExecution } from "./core/utils";
export type { BatchSyncExecution } from "./matching/batch-sync-worker-pool";
