/**
 * AniList API Configuration
 *
 * This file contains the default configuration for the AniList API.
 * Users can override these settings with their own credentials if needed.
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

// Default port for auth callback that doesn't require admin privileges
export const DEFAULT_AUTH_PORT = 8765;

// Default AniList API credentials - these would be replaced with real values in a production build
export const DEFAULT_ANILIST_CONFIG = {
  // Using placeholder values or environment variables if available
  clientId: clientId,
  clientSecret: clientSecret,
  redirectUri: `http://localhost:${DEFAULT_AUTH_PORT}/callback`,
  authorizationEndpoint: "https://anilist.co/api/v2/oauth/authorize",
  tokenEndpoint: "https://anilist.co/api/v2/oauth/token",
};

// Settings for secure storage
export const AUTH_STORAGE_CONFIG = {
  encryptionKey: "kenmei-to-anilist-auth", // This would be more secure in a real implementation
  storageKey: "anilist-auth-data",
};

// AniList API endpoints
export const ANILIST_API_ENDPOINTS = {
  graphql: "https://graphql.anilist.co",
  rateLimit: 90, // Requests per minute
};

// Rate limiting settings
export const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 85, // Keep slightly below the actual limit
  requestTimeout: 10000, // 10 seconds
  retryDelay: 60000 / 85, // Time between requests to stay under rate limit
};
