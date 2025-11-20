/**
 * Shared error metadata that can move freely between worker and renderer contexts.
 * We store a lightweight subset of Error properties plus optional cancellation details.
 */
export interface WorkerErrorDetails {
  message: string;
  name?: string;
  stack?: string;
  causeMessage?: string;
  code?: string;
  cancelReason?: string;
}

const getStringField = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Normalizes a partial payload into a complete details object with safe defaults.
 */
export function normalizeWorkerErrorDetails(
  details: Partial<WorkerErrorDetails> = {},
): WorkerErrorDetails {
  return {
    message: getStringField(details.message) ?? "Worker error",
    name: getStringField(details.name),
    stack: getStringField(details.stack),
    causeMessage: getStringField(details.causeMessage),
    code: getStringField(details.code),
    cancelReason: getStringField(details.cancelReason),
  };
}

/**
 * Extracts and normalizes error details from arbitrary values caught inside the worker.
 */
export function collectWorkerErrorDetails(error: unknown): WorkerErrorDetails {
  if (error instanceof Error) {
    const baseDetails: Partial<WorkerErrorDetails> = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      causeMessage:
        error.cause instanceof Error
          ? error.cause.message
          : getStringField((error as { cause?: unknown }).cause),
    };

    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      baseDetails.code = code;
    }

    return normalizeWorkerErrorDetails(baseDetails);
  }

  if (typeof error === "object" && error !== null) {
    const details: Partial<WorkerErrorDetails> = {
      message: getStringField((error as { message?: unknown }).message),
      name: getStringField((error as { name?: unknown }).name),
      stack: getStringField((error as { stack?: unknown }).stack),
      causeMessage: getStringField((error as { cause?: unknown }).cause),
      cancelReason: getStringField(
        (error as { cancelReason?: unknown }).cancelReason,
      ),
    };

    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      details.code = code;
    }

    return normalizeWorkerErrorDetails(details);
  }

  return normalizeWorkerErrorDetails({ message: String(error) });
}
