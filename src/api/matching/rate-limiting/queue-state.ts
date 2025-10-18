/**
 * Rate limiting queue state management.
 *
 * Maintains the state of the request queue, processing flag, and last request timestamp.
 * Provides accessors for queue coordination between the processor and other modules.
 *
 * @packageDocumentation
 * @source
 */

/**
 * Request queue entry with a resolve callback.
 * @source
 */
export interface QueueEntry {
  resolve: (value: void) => void;
}

/**
 * Last request timestamp for rate limiting calculations (milliseconds).
 * @source
 */
let _lastRequestTime = 0;

/**
 * Get the last request timestamp.
 * @returns Timestamp of the last request in milliseconds.
 * @source
 */
export function getLastRequestTime(): number {
  return _lastRequestTime;
}

/**
 * Set the last request timestamp.
 * @param time - Timestamp in milliseconds.
 * @source
 */
export function setLastRequestTime(time: number): void {
  _lastRequestTime = time;
}

/**
 * Request queue for storing pending rate limit requests.
 * @source
 */
export const requestQueue: QueueEntry[] = [];

/**
 * Flag indicating if the queue is currently being processed.
 * @source
 */
let _processingQueue = false;

/**
 * Check if the queue is currently being processed.
 * @returns True if queue processing is active.
 * @source
 */
export function isProcessingQueue(): boolean {
  return _processingQueue;
}

/**
 * Set the queue processing flag.
 * @param value - New processing state.
 * @source
 */
export function setProcessingQueue(value: boolean): void {
  _processingQueue = value;
}
