/**
 * @packageDocumentation
 * @module anilist_config
 * @description Default configuration and constants for the AniList API, including credentials, endpoints, and rate limiting.
 */

// Load credentials from environment variables at module initialization
let clientId = "";
let clientSecret = "";
let encryptionKey = "";

try {
  if (import.meta?.env) {
    clientId = import.meta.env.VITE_ANILIST_CLIENT_ID || "";
    clientSecret = import.meta.env.VITE_ANILIST_CLIENT_SECRET || "";
    encryptionKey =
      (import.meta.env.VITE_ANILIST_ENCRYPTION_KEY as string) || "";
    if (!encryptionKey) {
      console.warn(
        "AniList encryption key is not set in environment variables (VITE_ANILIST_ENCRYPTION_KEY). Using empty string as fallback.",
      );
    }
  }
} catch (error) {
  console.warn(
    "Could not access environment variables for AniList credentials and encryption key:",
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
 * @property encryptionKey - The key used for encrypting stored data, loaded from the environment variable VITE_ANILIST_ENCRYPTION_KEY.
 * @property storageKey - The key used for storing auth data.
 * @source
 */
export const AUTH_STORAGE_CONFIG = {
  encryptionKey: encryptionKey,
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
  rateLimit: 30, // Requests per minute
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
  maxRequestsPerMinute: 18, // Keep slightly below the actual limit
  requestTimeout: 10000, // 10 seconds
  retryDelay: 60000 / 18, // Time between requests to stay under rate limit
};
