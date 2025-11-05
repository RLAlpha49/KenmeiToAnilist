/**
 * @packageDocumentation
 * @module retry
 * @description Centralized retry and backoff utility for consistent exponential backoff logic across the application.
 */

/**
 * Calculates exponential backoff delay with optional jitter for retry attempts.
 * Formula: min(maxBackoffMs, initialBackoffMs * 2^attempt) + jitter.
 * @param attempt - The attempt number (0-indexed).
 * @param initialBackoffMs - Initial backoff duration in milliseconds (default: 1000).
 * @param maxBackoffMs - Maximum backoff duration in milliseconds (default: 32000).
 * @param jitterFactor - Jitter as fraction of backoff (default: 0.1 = 10%).
 * @returns Calculated backoff delay in milliseconds.
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
