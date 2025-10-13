/**
 * Rate limiting queue state management
 * @module rate-limiting/queue-state
 */

/**
 * Request queue entry
 */
export interface QueueEntry {
  resolve: (value: void) => void;
}

/**
 * Last request timestamp for rate limiting calculations
 */
let _lastRequestTime = 0;

/**
 * Get the last request timestamp
 * @returns Timestamp of the last request (milliseconds)
 */
export function getLastRequestTime(): number {
  return _lastRequestTime;
}

/**
 * Set the last request timestamp
 * @param time - Timestamp to set (milliseconds)
 */
export function setLastRequestTime(time: number): void {
  _lastRequestTime = time;
}

/**
 * Request queue for rate limiting
 */
export const requestQueue: QueueEntry[] = [];

/**
 * Flag indicating if the queue is currently being processed
 */
let _processingQueue = false;

/**
 * Check if the queue is currently being processed
 * @returns True if processing is active
 */
export function isProcessingQueue(): boolean {
  return _processingQueue;
}

/**
 * Set the queue processing flag
 * @param value - New value for the flag
 */
export function setProcessingQueue(value: boolean): void {
  _processingQueue = value;
}
