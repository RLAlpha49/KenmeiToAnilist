/**
 * Rate limiting module for AniList API requests
 * @module rate-limiting
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
