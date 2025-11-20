/**
 * Normalizes unknown errors into a serializable shape with key metadata.
 * @param error - The thrown value to normalize.
 * @returns Error details including message, and optional name, stack, and cause.
 * @source
 */
import {
  collectWorkerErrorDetails,
  type WorkerErrorDetails,
} from "../shared-error-types";

export function getErrorDetails(error: unknown): WorkerErrorDetails {
  return collectWorkerErrorDetails(error);
}
