/**
 * Rate limit queue processing logic
 * @module rate-limiting/queue-processor
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
 * Request rate limiting queue handler
 * Ensures we don't exceed AniList's rate limits
 * @returns Promise that resolves when rate limit permits the request
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
 * Process the rate limit queue
 * Handles timing between requests to stay within rate limits
 */
async function processRateLimitQueue(): Promise<void> {
  if (isProcessingQueue()) return;

  setProcessingQueue(true);

  while (requestQueue.length > 0) {
    await waitWhileManuallyPaused();
    const now = Date.now();
    const timeSinceLastRequest = now - getLastRequestTime();

    // If we need to wait for the rate limit, do so
    if (getLastRequestTime() > 0 && timeSinceLastRequest < REQUEST_INTERVAL) {
      const waitTime = REQUEST_INTERVAL - timeSinceLastRequest;
      await sleep(waitTime);
    }

    // Get the next request from the queue and resolve it
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      setLastRequestTime(Date.now());
      nextRequest.resolve();
    }

    // Small additional delay to be extra safe
    await sleep(SAFETY_DELAY);
  }

  setProcessingQueue(false);
}
