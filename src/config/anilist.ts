/**
 * @packageDocumentation
 * @module anilist-config
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
 * Default port for AniList auth callback (non-privileged).
 * @source
 */
export const DEFAULT_AUTH_PORT = 8765;

/**
 * AniList OAuth credentials and endpoints.
 * @property clientId - AniList application ID.
 * @property clientSecret - AniList application secret.
 * @property redirectUri - OAuth callback URI.
 * @property authorizationEndpoint - Authorization endpoint.
 * @property tokenEndpoint - Token endpoint.
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
 * Secure storage settings for AniList authentication data.
 * @property encryptionKey - Encryption key for stored data (from VITE_ANILIST_ENCRYPTION_KEY env var).
 * @property storageKey - Storage key name.
 * @source
 */
export const AUTH_STORAGE_CONFIG = {
  encryptionKey: encryptionKey,
  storageKey: "anilist-auth-data",
};

/**
 * AniList API endpoints and rate limit.
 * @property graphql - GraphQL endpoint.
 * @property rateLimit - Max requests per minute.
 * @source
 */
export const ANILIST_API_ENDPOINTS = {
  graphql: "https://graphql.anilist.co",
  rateLimit: 30, // Requests per minute
};

/**
 * AniList official rate limit: 30 requests per minute.
 * Reference: AniList GraphQL API documentation.
 * @source
 */
export const ANILIST_RATE_LIMIT_PER_MINUTE = 30;

/**
 * Safe request rate for IPC processing (28 requests per minute).
 * Provides headroom below the official limit to avoid throttling.
 * Applied in main process IPC handlers.
 * @source
 */
export const SAFE_REQUESTS_PER_MINUTE = 28;

/**
 * Rate limiting configuration for AniList API.
 * @property maxRequestsPerMinute - Max allowed requests per minute (conservative).
 * @property requestTimeout - Request timeout in milliseconds.
 * @property retryDelay - Delay between requests to stay under rate limit.
 * @source
 */
export const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 25, // Keep slightly below the actual limit
  requestTimeout: 10000, // 10 seconds
  retryDelay: 60000 / 25, // Time between requests to stay under rate limit
};
