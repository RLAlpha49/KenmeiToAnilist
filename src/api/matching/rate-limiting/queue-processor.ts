/**
 * Rate limit queue processing and retry logic.
 *
 * Sequentially processes queued requests with enforced intervals to comply with AniList's
 * rate limits. Respects manual pause states and implements exponential backoff for transient errors.
 *
 * **RESPONSIBILITY SEPARATION:**
 * - This module: Rate limit spacing enforcement + transient error retry with backoff
 * - IPC layer (api-listeners.ts): Handles IPC-level retry logic
 * - Browser client (client.ts): Exponential backoff for direct fetch requests
 *
 * **RETRY FLOW:** On transient failures (network errors, 5xx, 429, 408), call `retryQueueEntry()`
 * to re-queue with exponential backoff. Max retries: 3 attempts. Permanent failures trigger
 * event emissions and optional callbacks.
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

/** Maximum number of retry attempts per queued request. @source */
const MAX_RETRIES = 3;

/**
 * Acquire a rate limit slot for making a request.
 *
 * Queues the request and starts the processor if inactive. Blocks until it's safe to make
 * the request based on rate limit intervals.
 *
 * @param onRetryFailed - Optional callback invoked if retries are exhausted after transient errors.
 * @returns Promise that resolves when rate limit permits the request.
 * @source
 */
export async function acquireRateLimit(
  onRetryFailed?: (error: Error) => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    // Queue this request with initial retry tracking
    requestQueue.push({
      resolve,
      attempt: 0,
      maxAttempts: MAX_RETRIES,
      nextEligibleAt: Date.now(),
      onRetryFailed,
    });

    // Start processing if not already active
    if (!isProcessingQueue()) {
      processRateLimitQueue();
    }
  });
}

/**
 * Re-queue a failed request with exponential backoff.
 *
 * Computes backoff based on attempt count, increments the attempt counter, and re-enqueues
 * the entry. Emits permanent failure event when max retries are exceeded.
 *
 * @param entry - The queue entry that failed.
 * @param error - The error that triggered the retry.
 * @source
 */
export function retryQueueEntry(entry: QueueEntry, error: Error): void {
  const attempt = entry.attempt ?? 0;
  const maxAttempts = entry.maxAttempts ?? MAX_RETRIES;

  if (attempt < maxAttempts) {
    // Calculate backoff and re-enqueue with incremented attempt
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

    // Ensure processor is running to handle the re-queued entry
    if (!isProcessingQueue()) {
      processRateLimitQueue();
    }
  } else {
    // Max retries exceeded - notify listeners and emit event
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
 * Process the rate limit queue sequentially.
 *
 * Dequeues requests and waits for rate limit intervals between them. Respects retry
 * eligibility times (backoff) and manual pause states. Stops processing when queue is empty.
 *
 * @source
 */
async function processRateLimitQueue(): Promise<void> {
  if (isProcessingQueue()) return;

  setProcessingQueue(true);

  while (requestQueue.length > 0) {
    // Wait for manual pause to be lifted
    await waitWhileManuallyPaused();
    const now = Date.now();

    // Check if the next entry is ready for retry
    const nextEntry = requestQueue[0];
    if (nextEntry && (nextEntry.nextEligibleAt ?? 0) > now) {
      // Not ready yet - wait and retry
      const waitTime = (nextEntry.nextEligibleAt ?? now) - now;
      await sleep(Math.min(waitTime, 1000)); // Cap wait at 1 second to remain responsive
      continue;
    }

    const timeSinceLastRequest = now - getLastRequestTime();

    // Enforce minimum interval between requests for rate limit compliance
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
