/**
 * Rate limit queue state management.
 *
 * Maintains the request queue, processing flag, and last request timestamp.
 * Provides atomic accessors for state coordination between processor and other modules.
 *
 * @packageDocumentation
 * @source
 */

/**
 * A queued rate limit request with retry support.
 * @source
 */
export interface QueueEntry {
  /** Function to call when the request is ready to proceed. */
  resolve: (value: void) => void;
  /** Current attempt number (0-based). */
  attempt?: number;
  /** Maximum number of attempts allowed. */
  maxAttempts?: number;
  /** Timestamp (ms) when this entry is eligible to be processed (for backoff). */
  nextEligibleAt?: number;
  /** Optional callback invoked if all retries are exhausted. */
  onRetryFailed?: (error: Error) => void;
}

/**
 * Timestamp of the last API request in milliseconds.
 * @source
 */
let lastRequestTime = 0;

/**
 * Get the timestamp of the last request.
 * @returns Milliseconds since epoch of the last request, or 0 if never requested.
 * @source
 */
export function getLastRequestTime(): number {
  return lastRequestTime;
}

/**
 * Set the timestamp of the last request.
 * @param time - Milliseconds since epoch.
 * @source
 */
export function setLastRequestTime(time: number): void {
  lastRequestTime = time;
}

/**
 * Queue of pending rate limit requests.
 * @source
 */
export const requestQueue: QueueEntry[] = [];

/**
 * Flag indicating whether the queue processor is currently running.
 * @source
 */
let processingQueueActive = false;

/**
 * Check if the queue is currently being processed.
 * @returns True if the queue processor is active.
 * @source
 */
export function isProcessingQueue(): boolean {
  return processingQueueActive;
}

/**
 * Set the queue processing flag.
 * @param value - Whether the processor is running.
 * @source
 */
export function setProcessingQueue(value: boolean): void {
  processingQueueActive = value;
}
