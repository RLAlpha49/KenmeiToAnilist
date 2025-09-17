/**
 * @packageDocumentation
 * @module api_listeners
 * @description Registers IPC event listeners for AniList API requests, token exchange, cache, and shell actions in the Electron main process.
 */

import { ipcMain, shell } from "electron";
import fetch, { Response } from "node-fetch";
import type { ComickManga, ComickMangaDetail } from "../../../api/comick/types";

/**
 * Extended Error interface for GraphQL API errors.
 * @internal
 */
interface GraphQLError extends Error {
  status?: number;
  statusText?: string;
  errors?: unknown[];
}

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

/**
 * Simple in-memory cache for API responses.
 *
 * @template T - The type of cached data.
 * @property data - The cached data.
 * @property timestamp - The time the data was cached.
 * @source
 */
interface Cache<T> {
  [key: string]: {
    data: T;
    timestamp: number;
  };
}

// Search cache
const searchCache: Cache<Record<string, unknown>> = {};

/**
 * Sleep for the specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified time.
 * @internal
 * @source
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handle rate limit checking and waiting.
 * @internal
 */
async function handleRateLimit(): Promise<void> {
  if (!isRateLimited) return;

  const now = Date.now();
  if (now < rateLimitResetTime) {
    const waitTime = rateLimitResetTime - now;
    console.log(
      `Rate limited, waiting ${Math.round(waitTime / 1000)}s before retrying`,
    );
    await sleep(waitTime);
  }
  isRateLimited = false;
}

/**
 * Handle request timing and rate limiting.
 * @internal
 */
async function handleRequestTiming(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (lastRequestTime > 0 && timeSinceLastRequest < REQUEST_INTERVAL) {
    const waitTime = REQUEST_INTERVAL - timeSinceLastRequest;
    await sleep(waitTime);
  }

  lastRequestTime = Date.now();
}

/**
 * Safely extract search term from variables for logging purposes.
 * @internal
 */
function getSearchTermFromVariables(
  variables: Record<string, unknown> | undefined,
): string {
  if (!variables || typeof variables.search === "undefined") {
    return "request";
  }

  const search = variables.search;
  if (typeof search === "string") {
    return search;
  }

  if (
    search !== null &&
    typeof search === "object" &&
    "toString" in search &&
    typeof search.toString === "function"
  ) {
    return search.toString();
  }

  return String(search);
}

/**
 * Handle 429 rate limit response with retry logic.
 * @internal
 */
async function handleRateLimitResponse(
  response: Response,
  variables: Record<string, unknown> | undefined,
  retryCount: number,
  query: string,
  token?: string,
): Promise<Record<string, unknown>> {
  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    const error = new Error(
      `Rate limit exceeded after ${MAX_RETRY_ATTEMPTS} attempts`,
    ) as GraphQLError;
    error.status = 429;
    error.statusText = "Rate Limit Exceeded";
    error.errors = [
      {
        message: `Rate limit exceeded after ${MAX_RETRY_ATTEMPTS} attempts`,
      },
    ];
    throw error;
  }

  isRateLimited = true;
  const retryAfter = response.headers.get("Retry-After");
  let waitTime: number;

  if (retryAfter && !isNaN(Number(retryAfter))) {
    waitTime = Number(retryAfter) * 1000;
    console.log(`Rate limited with Retry-After header: ${retryAfter}s`);
  } else {
    waitTime = 5000 * Math.pow(2, retryCount);
    console.log(`Rate limited, using exponential backoff: ${waitTime / 1000}s`);
  }

  rateLimitResetTime = Date.now() + waitTime;
  const searchTerm = getSearchTermFromVariables(variables);
  console.log(
    `Rate limited for "${searchTerm}", waiting ${Math.round(waitTime / 1000)}s before retry #${retryCount + 1}`,
  );
  await sleep(waitTime);

  return requestAniList(query, variables, token, retryCount + 1);
}

/**
 * Handle server error response with retry logic.
 * @internal
 */
async function handleServerError(
  response: Response,
  variables: Record<string, unknown> | undefined,
  retryCount: number,
  query: string,
  token?: string,
): Promise<Record<string, unknown>> {
  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    const errorData = (await response.json().catch(() => ({}))) as {
      errors?: unknown[];
    };
    const error = new Error(
      `Server error ${response.status} after ${MAX_RETRY_ATTEMPTS} retry attempts`,
    ) as GraphQLError;
    error.status = response.status;
    error.statusText = response.statusText;
    error.errors = (errorData as { errors?: unknown[] }).errors;
    throw error;
  }

  const waitTime = 3000 * Math.pow(2, retryCount);
  const searchTerm = getSearchTermFromVariables(variables);
  console.log(
    `Server error ${response.status} for "${searchTerm}", waiting ${Math.round(waitTime / 1000)}s before retry #${retryCount + 1}`,
  );

  await sleep(waitTime);
  return requestAniList(query, variables, token, retryCount + 1);
}

/**
 * Handle network error with retry logic.
 * @internal
 */
async function handleNetworkError(
  error: Error,
  retryCount: number,
  query: string,
  variables: Record<string, unknown> | undefined,
  token?: string,
): Promise<Record<string, unknown>> {
  if (error.name === "FetchError" && retryCount < MAX_RETRY_ATTEMPTS) {
    const waitTime = 1000 * Math.pow(2, retryCount);
    console.log(
      `Network error, retrying in ${waitTime / 1000}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
    );
    await sleep(waitTime);
    return requestAniList(query, variables, token, retryCount + 1);
  }
  throw error;
}

/**
 * Make a GraphQL request to the AniList API.
 *
 * @param query - GraphQL query or mutation.
 * @param variables - Variables for the query.
 * @param token - Optional access token for authenticated requests.
 * @param retryCount - Current retry attempt (for internal use).
 * @returns Promise resolving to the response data.
 * @internal
 * @source
 */
async function requestAniList(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
  retryCount: number = 0,
): Promise<Record<string, unknown>> {
  await handleRateLimit();
  await handleRequestTiming();

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

    if (response.status === 429) {
      return handleRateLimitResponse(
        response,
        variables,
        retryCount,
        query,
        token,
      );
    }

    if (response.status >= 500 && response.status < 600) {
      return handleServerError(response, variables, retryCount, query, token);
    }

    if (!response.ok) {
      const errorData = (await response.json()) as { errors?: unknown[] };
      const firstError = errorData.errors?.[0] as
        | { message?: string }
        | undefined;
      const error = new Error(
        firstError?.message || response.statusText,
      ) as GraphQLError;
      error.status = response.status;
      error.statusText = response.statusText;
      error.errors = errorData.errors;
      throw error;
    }

    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error) {
      return handleNetworkError(error, retryCount, query, variables, token);
    }
    throw error;
  }
}

/**
 * Generate a cache key from search parameters.
 *
 * @param query - The GraphQL query string.
 * @param variables - The variables for the query.
 * @returns The generated cache key string.
 * @internal
 * @source
 */
function generateCacheKey(
  query: string,
  variables: Record<string, unknown> = {},
): string {
  return `${query.slice(0, 50)}_${JSON.stringify(variables)}`;
}

/**
 * Check if a cache entry is valid.
 *
 * @param cache - The cache object.
 * @param key - The cache key to check.
 * @returns True if the cache entry is valid, false otherwise.
 * @internal
 * @source
 */
function isCacheValid<T>(cache: Cache<T>, key: string): boolean {
  const entry = cache[key];
  if (!entry) return false;

  const now = Date.now();
  return now - entry.timestamp < CACHE_EXPIRATION;
}

/**
 * Setup IPC handlers for AniList API requests, token exchange, cache, and shell actions.
 *
 * @source
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

  // Comick API handlers
  ipcMain.handle(
    "comick:search",
    async (_, query: string, limit: number = 10) => {
      try {
        console.log(
          `🔍 Comick API: Searching for "${query}" with limit ${limit}`,
        );

        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(
          `https://api.comick.fun/v1.0/search?q=${encodedQuery}&limit=${limit}&t=false`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "User-Agent": "KenmeiToAniList/1.0",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as ComickManga[];
        console.log(
          `📦 Comick API: Found ${Array.isArray(data) ? data.length : 0} results for "${query}"`,
        );

        return data || [];
      } catch (error) {
        console.error(`❌ Comick search failed for "${query}":`, error);
        throw error;
      }
    },
  );

  ipcMain.handle("comick:getMangaDetail", async (_, slug: string) => {
    try {
      console.log(`📖 Comick API: Getting manga details for "${slug}"`);

      const response = await fetch(`https://api.comick.fun/comic/${slug}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "KenmeiToAniList/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ComickMangaDetail;
      console.log(`📖 Comick API: Retrieved details for "${slug}"`);

      return data || null;
    } catch (error) {
      console.error(`❌ Comick manga detail failed for "${slug}":`, error);
      throw error;
    }
  });
}
