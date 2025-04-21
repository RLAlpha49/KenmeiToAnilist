/**
 * @packageDocumentation
 * @module anilist_config
 * @description Default configuration and constants for the AniList API, including credentials, endpoints, and rate limiting.
 */

// Try to read values from environment variables, with fallbacks
// Note: We need to use runtime checks since TypeScript doesn't recognize Vite's import.meta.env
let clientId = "";
let clientSecret = "";

try {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    clientId = import.meta.env.VITE_ANILIST_CLIENT_ID || "";
    clientSecret = import.meta.env.VITE_ANILIST_CLIENT_SECRET || "";
  }
} catch (error) {
  console.warn(
    "Could not access environment variables for AniList credentials:",
    error,
  );
}

/**
 * Default port for the AniList auth callback that doesn't require admin privileges.
 *
 * @source
 */
export const DEFAULT_AUTH_PORT = 8765;

/**
 * Default AniList API credentials and endpoints. These can be overridden by user settings.
 *
 * @property clientId - The AniList client ID.
 * @property clientSecret - The AniList client secret.
 * @property redirectUri - The OAuth redirect URI.
 * @property authorizationEndpoint - The OAuth authorization endpoint.
 * @property tokenEndpoint - The OAuth token endpoint.
 * @source
 */
export const DEFAULT_ANILIST_CONFIG = {
  clientId: clientId,
  clientSecret: clientSecret,
  redirectUri: `http://localhost:${DEFAULT_AUTH_PORT}/callback`,
  authorizationEndpoint: "https://anilist.co/api/v2/oauth/authorize",
  tokenEndpoint: "https://anilist.co/api/v2/oauth/token",
};

/**
 * Settings for secure storage of AniList authentication data.
 *
 * @property encryptionKey - The key used for encrypting stored data.
 * @property storageKey - The key used for storing auth data.
 * @source
 */
export const AUTH_STORAGE_CONFIG = {
  encryptionKey: "kenmei-to-anilist-auth", // This would be more secure in a real implementation
  storageKey: "anilist-auth-data",
};

/**
 * AniList API endpoints and rate limit settings.
 *
 * @property graphql - The GraphQL API endpoint.
 * @property rateLimit - The maximum requests per minute.
 * @source
 */
export const ANILIST_API_ENDPOINTS = {
  graphql: "https://graphql.anilist.co",
  rateLimit: 90, // Requests per minute
};

/**
 * Rate limiting configuration for AniList API requests.
 *
 * @property maxRequestsPerMinute - The maximum allowed requests per minute.
 * @property requestTimeout - The request timeout in milliseconds.
 * @property retryDelay - The delay between requests to stay under the rate limit.
 * @source
 */
export const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 85, // Keep slightly below the actual limit
  requestTimeout: 10000, // 10 seconds
  retryDelay: 60000 / 85, // Time between requests to stay under rate limit
};
