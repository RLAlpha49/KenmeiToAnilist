/**
 * Rate limiting constants and configuration
 * @module rate-limiting/config
 */

/**
 * AniList API rate limit (requests per minute)
 * Using 28 instead of 30 to provide safety margin
 */
export const API_RATE_LIMIT = 28;

/**
 * Minimum interval between requests (milliseconds)
 * Calculated from API_RATE_LIMIT to stay within rate limit
 */
export const REQUEST_INTERVAL = (60 * 1000) / API_RATE_LIMIT;

/**
 * Additional safety delay after each request (milliseconds)
 */
export const SAFETY_DELAY = 50;
