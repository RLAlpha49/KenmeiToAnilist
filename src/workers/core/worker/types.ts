import type { KenmeiStatus, KenmeiManga } from "@/api/kenmei/types";

/**
 * Tracks CSV parsing progress and metadata for a single worker task.
 * @source
 */
export interface CSVParserState {
  taskId: string;
  csvBuffer: string;
  totalSize: number;
  processedBytes: number;
  defaultStatus: KenmeiStatus;
  startTime: number;
  isComplete: boolean;
  header?: string;
  pendingBatch?: KenmeiManga[];
  totalParsedRows?: number;
  processingPromise?: Promise<void>;
}
