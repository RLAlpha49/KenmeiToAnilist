/**
 * @packageDocumentation
 * @module retry
 * @description Centralized retry and backoff utility for consistent exponential backoff logic across the application.
 */

/**
 * Calculates an exponential backoff delay with optional jitter.
 *
 * Uses exponential backoff to compute a delay that increases with each retry attempt,
 * helping to avoid overwhelming the server during recovery. Includes optional jitter
 * to prevent thundering herd problems when multiple clients retry simultaneously.
 *
 * Formula: min(maxBackoffMs, initialBackoffMs * 2^attempt) + jitter
 *
 * @param attempt - The attempt number (0-indexed).
 * @param initialBackoffMs - The initial backoff duration in milliseconds (default: 1000).
 * @param maxBackoffMs - The maximum backoff duration in milliseconds (default: 32000).
 * @param jitterFactor - The jitter factor as a fraction of the backoff (default: 0.1 = 10%).
 * @returns The calculated backoff delay in milliseconds.
 * @example
 * // First retry: ~1000ms
 * calculateBackoff(0);
 * // Third retry: ~4000-4400ms (with 10% jitter)
 * calculateBackoff(2);
 * @source
 */
export function calculateBackoff(
  attempt: number,
  initialBackoffMs: number = 1000,
  maxBackoffMs: number = 32000,
  jitterFactor: number = 0.1,
): number {
  const exponentialBackoff = Math.min(
    maxBackoffMs,
    initialBackoffMs * Math.pow(2, attempt),
  );
  const jitter = exponentialBackoff * jitterFactor * Math.random();
  return Math.floor(exponentialBackoff + jitter);
}
