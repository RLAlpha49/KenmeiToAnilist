/**
 * @packageDocumentation
 * @module network
 * @description Network error utilities for centralized error handling and detection, including retry logic determination.
 */

/**
 * Determines if error is transient and safe to retry; detects network failures, rate limits, and timeouts.
 * @param error - The error to check.
 * @returns True if error is transient and should be retried; false otherwise.
 * @source
 */
export function isTransientError(error: unknown): boolean {
  // Handle Response objects (from fetch API)
  if (error instanceof Response) {
    const status = error.status;
    // 5xx server errors, 429 (rate limit), and 408 (timeout) are transient
    return status >= 500 || status === 429 || status === 408;
  }

  // TypeError for network errors (includes "Failed to fetch" and other network issues)
  if (error instanceof TypeError) {
    return true;
  }

  // Network error string patterns
  if (error instanceof Error) {
    const errorLower = (error.message || "").toLowerCase();
    if (
      errorLower.includes("failed to fetch") ||
      errorLower.includes("network") ||
      errorLower.includes("econnreset") ||
      errorLower.includes("timeout")
    ) {
      return true;
    }
  }

  // Check error object properties for HTTP status codes
  const errorObj = error as Record<string, unknown>;

  // Direct status property
  let status = errorObj?.status;

  // Nested response.status pattern
  if (!status && typeof errorObj?.response === "object" && errorObj.response) {
    const responseObj = errorObj.response as Record<string, unknown>;
    status = responseObj?.status;
  }

  const message = errorObj?.message;

  // Also check string representation of error message for network keywords
  if (message && typeof message === "string") {
    const errorLower = message.toLowerCase();
    if (
      errorLower.includes("failed to fetch") ||
      errorLower.includes("network") ||
      errorLower.includes("econnreset") ||
      errorLower.includes("timeout")
    ) {
      return true;
    }
  }

  if (!status || typeof status !== "number") return false;

  // 5xx server errors, 429 (rate limit), and 408 (timeout) are transient
  return status >= 500 || status === 429 || status === 408;
}
