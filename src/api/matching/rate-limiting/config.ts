/**
 * Rate limiting configuration for AniList API compliance.
 * @module rate-limiting/config
 * @source
 */

/**
 * Target requests per minute for AniList API rate limiting. Set to 28 (not 30) for safety margin.
 * @source
 */
export const API_RATE_LIMIT = 28;

/**
 * Minimum milliseconds between requests to stay within rate limits.
 * @source
 */
export const REQUEST_INTERVAL = (60 * 1000) / API_RATE_LIMIT;

/**
 * Additional safety delay (ms) after each request to prevent rate limit edge cases.
 * @source
 */
export const SAFETY_DELAY = 50;
