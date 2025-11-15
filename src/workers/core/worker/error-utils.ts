/**
 * Normalizes unknown errors into a serializable shape with key metadata.
 * @param error - The thrown value to normalize.
 * @returns Error details including message, and optional name, stack, and cause.
 * @source
 */
export function getErrorDetails(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
  causeMessage?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      causeMessage:
        error.cause instanceof Error ? error.cause.message : undefined,
    };
  }
  return {
    message: String(error),
  };
}
