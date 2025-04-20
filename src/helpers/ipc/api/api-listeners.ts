import { ipcMain, shell } from "electron";
import fetch from "node-fetch";

const API_URL = "https://graphql.anilist.co";

// Cache settings
const CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes

// API request rate limiting
const API_RATE_LIMIT = 28; // 30 requests per minute is the AniList limit, use 28 to be safe
const REQUEST_INTERVAL = (60 * 1000) / API_RATE_LIMIT; // milliseconds between requests
const MAX_RETRY_ATTEMPTS = 5; // Maximum number of retry attempts for rate limited requests

// Rate limiting state
let lastRequestTime = 0;
let isRateLimited = false;
let rateLimitResetTime = 0;

// Simple in-memory cache
interface Cache<T> {
  [key: string]: {
    data: T;
    timestamp: number;
  };
}

// Search cache
const searchCache: Cache<Record<string, unknown>> = {};

/**
 * Sleep for the specified number of milliseconds
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Make a GraphQL request to the AniList API
 * @param query GraphQL query or mutation
 * @param variables Variables for the query
 * @param token Optional access token for authenticated requests
 * @param retryCount Current retry attempt (for internal use)
 * @returns Promise resolving to the response data
 */
async function requestAniList(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
  retryCount: number = 0,
): Promise<Record<string, unknown>> {
  // Check if we're currently rate limited
  if (isRateLimited) {
    const now = Date.now();
    if (now < rateLimitResetTime) {
      const waitTime = rateLimitResetTime - now;
      console.log(
        `Rate limited, waiting ${Math.round(waitTime / 1000)}s before retrying`,
      );
      await sleep(waitTime);
      isRateLimited = false;
    } else {
      isRateLimited = false;
    }
  }

  // Implement rate limiting based on time since last request
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (lastRequestTime > 0 && timeSinceLastRequest < REQUEST_INTERVAL) {
    const waitTime = REQUEST_INTERVAL - timeSinceLastRequest;
    await sleep(waitTime);
  }

  // Update last request time
  lastRequestTime = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    // Handle rate limiting (status code 429)
    if (response.status === 429) {
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw {
          status: 429,
          statusText: "Rate Limit Exceeded",
          errors: [
            {
              message: `Rate limit exceeded after ${MAX_RETRY_ATTEMPTS} attempts`,
            },
          ],
          message: `Rate limit exceeded after ${MAX_RETRY_ATTEMPTS} attempts`,
        };
      }

      // Set rate limited flag
      isRateLimited = true;

      // Check for Retry-After header (in seconds)
      const retryAfter = response.headers.get("Retry-After");
      let waitTime: number;

      if (retryAfter && !isNaN(Number(retryAfter))) {
        // Use server-provided retry time
        waitTime = Number(retryAfter) * 1000;
        console.log(`Rate limited with Retry-After header: ${retryAfter}s`);
      } else {
        // Use exponential backoff if no header (starting with 5s, then 10s, 20s, etc.)
        waitTime = 5000 * Math.pow(2, retryCount);
        console.log(
          `Rate limited, using exponential backoff: ${waitTime / 1000}s`,
        );
      }

      // Set the reset time
      rateLimitResetTime = Date.now() + waitTime;

      console.log(
        `Rate limited for "${variables?.search || "request"}", waiting ${Math.round(waitTime / 1000)}s before retry #${retryCount + 1}`,
      );
      await sleep(waitTime);

      // Try again recursively with incremented retry count
      return requestAniList(query, variables, token, retryCount + 1);
    }

    // Handle server errors (500, 502, 503, 504, etc.)
    if (response.status >= 500 && response.status < 600) {
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        // If we've reached max retries, throw the error
        const errorData = await response.json().catch(() => ({}));
        throw {
          status: response.status,
          statusText: response.statusText,
          errors: errorData.errors,
          message: `Server error ${response.status} after ${MAX_RETRY_ATTEMPTS} retry attempts`,
        };
      }

      // Use exponential backoff starting with 3 seconds
      const waitTime = 3000 * Math.pow(2, retryCount);
      console.log(
        `Server error ${response.status} for "${variables?.search || "request"}", waiting ${Math.round(waitTime / 1000)}s before retry #${retryCount + 1}`,
      );

      await sleep(waitTime);

      // Try again recursively with incremented retry count
      return requestAniList(query, variables, token, retryCount + 1);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw {
        status: response.status,
        statusText: response.statusText,
        errors: errorData.errors,
        message: errorData.errors?.[0]?.message || response.statusText,
      };
    }

    return await response.json();
  } catch (error) {
    // Handle network errors with retry
    if (
      error instanceof Error &&
      error.name === "FetchError" &&
      retryCount < MAX_RETRY_ATTEMPTS
    ) {
      const waitTime = 1000 * Math.pow(2, retryCount);
      console.log(
        `Network error, retrying in ${waitTime / 1000}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
      );
      await sleep(waitTime);
      return requestAniList(query, variables, token, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Generate a cache key from search parameters
 */
function generateCacheKey(
  query: string,
  variables: Record<string, unknown> = {},
): string {
  return `${query.substr(0, 50)}_${JSON.stringify(variables)}`;
}

/**
 * Check if a cache entry is valid
 */
function isCacheValid<T>(cache: Cache<T>, key: string): boolean {
  const entry = cache[key];
  if (!entry) return false;

  const now = Date.now();
  return now - entry.timestamp < CACHE_EXPIRATION;
}

/**
 * Setup IPC handlers for AniList API requests
 */
export function setupAniListAPI() {
  // Handle graphQL requests
  ipcMain.handle("anilist:request", async (_, query, variables, token) => {
    try {
      console.log("Handling AniList API request in main process");

      // Extract and remove bypassCache from variables to avoid sending it to the API
      const bypassCache = variables?.bypassCache;
      if (variables && "bypassCache" in variables) {
        // Create a copy without the bypassCache property
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { bypassCache: removed, ...cleanVariables } = variables;
        variables = cleanVariables;
      }

      // Check if it's a search request and if we should use cache
      const isSearchQuery = query.includes("Page(") && variables?.search;

      if (isSearchQuery && !bypassCache) {
        const cacheKey = generateCacheKey(query, variables);

        if (isCacheValid(searchCache, cacheKey)) {
          console.log(`Using cached search results for: ${variables.search}`);
          return {
            success: true,
            data: searchCache[cacheKey].data,
          };
        }
      }

      if (isSearchQuery && bypassCache) {
        console.log(`Bypassing cache for search: ${variables.search}`);
      }

      const response = await requestAniList(query, variables, token);

      // Cache search results only if not bypassing cache
      if (isSearchQuery && response.data && !bypassCache) {
        const cacheKey = generateCacheKey(query, variables);
        searchCache[cacheKey] = {
          data: response,
          timestamp: Date.now(),
        };
      }

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      console.error("Error in anilist:request:", error);
      return {
        success: false,
        error,
      };
    }
  });

  // Handle token exchange
  ipcMain.handle("anilist:exchangeToken", async (_, params) => {
    try {
      const { clientId, clientSecret, redirectUri, code } = params;

      // Format the request body
      const tokenRequestBody = {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      };

      const response = await fetch("https://anilist.co/api/v2/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(tokenRequestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();

      return {
        success: true,
        token: data,
      };
    } catch (error) {
      console.error("Error in anilist:exchangeToken:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Handle opening external links in the default browser
  ipcMain.handle("shell:openExternal", async (_, url) => {
    try {
      console.log(`Opening external URL in default browser: ${url}`);
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Error opening external URL:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Clear search cache
  ipcMain.handle("anilist:clearCache", (_, searchQuery) => {
    if (searchQuery) {
      // Clear specific cache entries
      Object.keys(searchCache).forEach((key) => {
        if (key.includes(searchQuery)) {
          delete searchCache[key];
        }
      });
    } else {
      // Clear all cache
      Object.keys(searchCache).forEach((key) => {
        delete searchCache[key];
      });
    }

    return { success: true };
  });

  // Get rate limit status from main process
  ipcMain.handle("anilist:getRateLimitStatus", () => {
    const now = Date.now();
    return {
      isRateLimited,
      retryAfter: isRateLimited ? rateLimitResetTime : null,
      timeRemaining: isRateLimited ? Math.max(0, rateLimitResetTime - now) : 0,
    };
  });
}
