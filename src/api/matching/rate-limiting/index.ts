/**
 * Rate limiting module for AniList API requests.
 *
 * Provides queue-based rate limiting to ensure compliance with AniList's 60 requests/minute limit,
 * with additional manual pause capabilities for user control. Maintains request timing, processes
 * queued requests sequentially, and provides rate-limited wrappers for search operations.
 *
 * @packageDocumentation
 * @source
 */

// Config
export { API_RATE_LIMIT, REQUEST_INTERVAL, SAFETY_DELAY } from "./config";

// Queue state
export type { QueueEntry } from "./queue-state";
export {
  requestQueue,
  getLastRequestTime,
  setLastRequestTime,
  isProcessingQueue,
  setProcessingQueue,
} from "./queue-state";

// Manual pause
export {
  isManualPauseActive,
  isManualMatchingPaused,
  waitWhileManuallyPaused,
  setManualMatchingPause,
} from "./manual-pause";

// Utils
export { sleep } from "./utils";

// Queue processor
export { acquireRateLimit } from "./queue-processor";

// Search wrappers
export type { SearchRateLimitOptions } from "./search-wrappers";
export {
  searchWithRateLimit,
  advancedSearchWithRateLimit,
} from "./search-wrappers";
