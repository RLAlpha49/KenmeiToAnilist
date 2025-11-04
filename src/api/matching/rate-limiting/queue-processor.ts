/**
 * Rate limit queue processing logic.
 *
 * Processes queued requests sequentially, enforcing the minimum interval between requests
 * to stay within AniList's rate limits. Respects manual pause states and coordinates
 * with the rate limit queue state.
 *
 * **RESPONSIBILITY SEPARATION:**
 * - This module: Rate limit spacing enforcement + transient error retry with backoff
 * - IPC layer (api-listeners.ts): Handles IPC-level retry logic
 * - Browser client (client.ts): Exponential backoff for direct fetch requests
 *
 * This module now handles:
 * - Rate limit spacing between retries
 * - Transient error detection and re-queuing
 * - Exponential backoff with jitter for retries
 * - Max retry cap (3 attempts) with permanent failure events
 *
 * **USAGE FOR RETRY HANDLERS:**
 * On transient failures (network errors, 5xx, 429, 408), call `retryQueueEntry(entry, error)`
 * instead of dropping the entry. The function handles backoff calculation and re-queuing.
 * Example:
 * ```
 * try {
 *   const entry = await processRequest();
 * } catch (error) {
 *   if (isTransientError(error)) {
 *     retryQueueEntry(entry, error);
 *   } else {
 *     entry.onRetryFailed?.(error);
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 * @source
 */

import {
  requestQueue,
  isProcessingQueue,
  setProcessingQueue,
  getLastRequestTime,
  setLastRequestTime,
  type QueueEntry,
} from "./queue-state";
import { waitWhileManuallyPaused } from "./manual-pause";
import { REQUEST_INTERVAL, SAFETY_DELAY } from "./config";
import { sleep } from "./utils";
import { calculateBackoff } from "@/utils/retry";

const MAX_RETRIES = 3;

/**
 * Acquire a rate limit slot. Returns a promise that resolves when safe to make a request.
 *
 * Queues the request and starts processing if not already active. Ensures compliance
 * with AniList's rate limits by enforcing minimum intervals between requests.
 *
 * @param onRetryFailed - Optional callback when retries are exhausted.
 * @returns Promise that resolves when rate limit permits the request.
 * @source
 */
export async function acquireRateLimit(
  onRetryFailed?: (error: Error) => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    // Add this request to the queue with retry tracking
    requestQueue.push({
      resolve,
      attempt: 0,
      maxAttempts: MAX_RETRIES,
      nextEligibleAt: Date.now(),
      onRetryFailed,
    });

    // If not already processing the queue, start processing
    if (!isProcessingQueue()) {
      processRateLimitQueue();
    }
  });
}

/**
 * Mark a queued request as failed and retry with backoff.
 *
 * Computes exponential backoff, re-enqueues the item with incremented attempt count,
 * and emits an event on permanent failure. Ensures the queue processor is running.
 *
 * @param entry - The queue entry that failed.
 * @param error - The error that occurred.
 * @source
 */
export function retryQueueEntry(entry: QueueEntry, error: Error): void {
  const attempt = entry.attempt ?? 0;
  const maxAttempts = entry.maxAttempts ?? MAX_RETRIES;

  if (attempt < maxAttempts) {
    // Calculate backoff and re-enqueue
    const backoffMs = calculateBackoff(attempt);
    const newEntry: QueueEntry = {
      ...entry,
      attempt: attempt + 1,
      nextEligibleAt: Date.now() + backoffMs,
    };
    requestQueue.push(newEntry);
    console.warn(
      `[RateLimitQueue] Retrying request (attempt ${attempt + 1}/${maxAttempts}) after ${backoffMs}ms`,
    );

    // Ensure the queue processor is running to handle the re-queued entry
    if (!isProcessingQueue()) {
      processRateLimitQueue();
    }
  } else {
    // Max retries exceeded - emit event and call callback
    console.error(
      `[RateLimitQueue] Request failed after ${maxAttempts} attempts:`,
      error.message,
    );
    if (entry.onRetryFailed) {
      entry.onRetryFailed(error);
    }
    if (typeof globalThis.dispatchEvent === "function") {
      globalThis.dispatchEvent(
        new CustomEvent("ratelimit:permanent-failure", {
          detail: { error: error.message, attempt: maxAttempts },
        }),
      );
    }
  }
}

/**
 * Process the rate limit queue.
 *
 * Sequentially processes queued requests, respecting rate limit intervals and retry backoff.
 * Skips items not yet eligible for processing and stops at the first unready item to prevent
 * busy loops.
 *
 * @source
 */
async function processRateLimitQueue(): Promise<void> {
  if (isProcessingQueue()) return;

  setProcessingQueue(true);

  while (requestQueue.length > 0) {
    await waitWhileManuallyPaused();
    const now = Date.now();

    // Check if next item is ready for retry
    const nextEntry = requestQueue[0];
    if (nextEntry && (nextEntry.nextEligibleAt ?? 0) > now) {
      // Item not ready yet - wait and try again
      const waitTime = (nextEntry.nextEligibleAt ?? now) - now;
      await sleep(Math.min(waitTime, 1000)); // Wait up to 1 second
      continue;
    }

    const timeSinceLastRequest = now - getLastRequestTime();

    // Enforce minimum interval between requests to stay within rate limits
    if (getLastRequestTime() > 0 && timeSinceLastRequest < REQUEST_INTERVAL) {
      const waitTime = REQUEST_INTERVAL - timeSinceLastRequest;
      await sleep(waitTime);
    }

    // Dequeue and resolve the next request
    const entry = requestQueue.shift();
    if (entry) {
      setLastRequestTime(Date.now());
      entry.resolve();
    }

    // Additional safety delay to prevent rate limit edge cases
    await sleep(SAFETY_DELAY);
  }

  setProcessingQueue(false);
}
