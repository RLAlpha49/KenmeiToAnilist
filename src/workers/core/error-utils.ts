/**
 * Utilities for reconstructing worker-side errors into structured objects.
 * @source
 */
import {
  normalizeWorkerErrorDetails,
  type WorkerErrorDetails,
} from "./shared-error-types";

export type WorkerErrorMeta = WorkerErrorDetails;

export function createWorkerError(
  payload: Partial<WorkerErrorDetails> = {},
): Error & { meta?: WorkerErrorMeta } {
  const meta = normalizeWorkerErrorDetails(payload);
  const error = new Error(meta.message);
  if (meta.name) {
    error.name = meta.name;
  }
  if (meta.stack) {
    error.stack = meta.stack;
  }
  (error as Error & { meta?: WorkerErrorMeta }).meta = meta;
  return error;
}
