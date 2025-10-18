/**
 * Rate limit queue processing logic.
 *
 * Processes queued requests sequentially, enforcing the minimum interval between requests
 * to stay within AniList's rate limits. Respects manual pause states and coordinates
 * with the rate limit queue state.
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
} from "./queue-state";
import { waitWhileManuallyPaused } from "./manual-pause";
import { REQUEST_INTERVAL, SAFETY_DELAY } from "./config";
import { sleep } from "./utils";

/**
 * Acquire a rate limit slot. Returns a promise that resolves when safe to make a request.
 *
 * Queues the request and starts processing if not already active. Ensures compliance
 * with AniList's rate limits by enforcing minimum intervals between requests.
 * @returns Promise that resolves when rate limit permits the request.
 * @source
 */
export async function acquireRateLimit(): Promise<void> {
  return new Promise<void>((resolve) => {
    // Add this request to the queue
    requestQueue.push({ resolve });

    // If not already processing the queue, start processing
    if (!isProcessingQueue()) {
      processRateLimitQueue();
    }
  });
}

/**
 * Process the rate limit queue.
 *
 * Sequentially processes all queued requests, waiting for minimum intervals between
 * requests and respecting manual pause states. Stops when queue is empty.
 * @source
 */
async function processRateLimitQueue(): Promise<void> {
  if (isProcessingQueue()) return;

  setProcessingQueue(true);

  while (requestQueue.length > 0) {
    await waitWhileManuallyPaused();
    const now = Date.now();
    const timeSinceLastRequest = now - getLastRequestTime();

    // Enforce minimum interval between requests to stay within rate limits
    if (getLastRequestTime() > 0 && timeSinceLastRequest < REQUEST_INTERVAL) {
      const waitTime = REQUEST_INTERVAL - timeSinceLastRequest;
      await sleep(waitTime);
    }

    // Dequeue and resolve the next request
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      setLastRequestTime(Date.now());
      nextRequest.resolve();
    }

    // Additional safety delay to prevent rate limit edge cases
    await sleep(SAFETY_DELAY);
  }

  setProcessingQueue(false);
}
