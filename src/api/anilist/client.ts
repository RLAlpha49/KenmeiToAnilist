/**
 * @packageDocumentation
 * @module anilist-client
 * @description AniList API client for making GraphQL requests, including search, advanced search, user manga list, and cache utilities.
 */

import {
  AniListManga,
  AniListResponse,
  SearchResult,
  UserMediaList,
} from "./types";
import {
  SEARCH_MANGA,
  ADVANCED_SEARCH_MANGA,
  GET_MANGA_BY_IDS,
  GET_USER_MANGA_LIST,
  GET_VIEWER,
} from "./queries";

// Error interfaces
interface HttpError extends Error {
  status: number;
  statusText: string;
}

interface RateLimitError extends Error {
  status: number;
  isRateLimited: true;
  retryAfter: number;
}

// Simple in-memory cache
interface Cache<T> {
  [key: string]: {
    data: T;
    timestamp: number;
  };
}

// Cache expiration time (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;

// Local cache for the renderer process to minimize IPC calls
const searchCache: Cache<SearchResult<AniListManga>> = {};

// Flag to track if cache has been initialized
let searchCacheInitialized = false;

/**
 * Load the search cache from localStorage if available
 */
function initializeSearchCache(): void {
  // Skip if already initialized
  if (searchCacheInitialized) {
    console.log(
      "Search cache already initialized, skipping duplicate initialization",
    );
    return;
  }

  console.log("Initializing AniList search cache...");
  searchCacheInitialized = true;

  try {
    // Try to load persisted cache from localStorage
    const storageKey = "anilist_search_cache";
    const cachedData = localStorage.getItem(storageKey);

    if (cachedData) {
      const parsedCache = JSON.parse(cachedData);
      let loadedCount = 0;

      // Only use cache entries that haven't expired
      const now = Date.now();

      // Merge with our in-memory cache
      Object.keys(parsedCache).forEach((key) => {
        const entry = parsedCache[key];
        if (now - entry.timestamp < CACHE_EXPIRATION) {
          searchCache[key] = entry;
          loadedCount++;
        }
      });

      console.log(
        `Loaded ${loadedCount} cached search results from localStorage`,
      );

      // Immediately notify the manga service to sync caches
      // This needs to be done after a small delay to avoid circular dependencies
      setTimeout(() => {
        try {
          // Create a custom event that manga-search-service can listen for
          const event = new CustomEvent("anilist:search-cache-initialized", {
            detail: { count: loadedCount },
          });
          window.dispatchEvent(event);
          console.log("Dispatched cache initialization event");
        } catch (e) {
          console.error("Failed to dispatch cache event:", e);
        }
      }, 100);
    }
  } catch (error) {
    console.error("Error loading search cache from localStorage:", error);
  }
}

/**
 * Save the search cache to localStorage for persistence
 */
function persistSearchCache(): void {
  try {
    const storageKey = "anilist_search_cache";
    localStorage.setItem(storageKey, JSON.stringify(searchCache));
  } catch (error) {
    console.error("Error saving search cache to localStorage:", error);
  }
}

// Initialize the cache when the module loads
initializeSearchCache();

/**
 * Builds request options with headers and body for GraphQL requests.
 *
 * @param query - The GraphQL query string.
 * @param variables - Optional variables for the query.
 * @param token - Optional authentication token.
 * @param abortSignal - Optional abort signal.
 * @returns RequestInit object for fetch.
 */
function buildRequestOptions(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
  abortSignal?: AbortSignal,
): RequestInit {
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    signal: abortSignal,
  };

  // Add authorization header if token is provided
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return options;
}

/**
 * Handles Electron IPC requests to the main process.
 *
 * @param requestId - Unique request identifier.
 * @param query - The GraphQL query string.
 * @param variables - Optional variables for the query.
 * @param token - Optional authentication token.
 * @param bypassCache - Optional flag to bypass cache.
 * @param abortSignal - Optional abort signal.
 * @returns Promise resolving to AniListResponse.
 */
async function handleElectronRequest<T>(
  requestId: string,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
  bypassCache?: boolean,
  abortSignal?: AbortSignal,
): Promise<AniListResponse<T>> {
  try {
    // Use the correct call format for the main process
    const response = await window.electronAPI.anilist.request(
      query,
      { ...variables, bypassCache }, // Pass bypassCache flag to main process
      token,
      // We can't pass AbortSignal through IPC, but we'll check it after
    );

    // Check for abort before returning the response
    if (abortSignal?.aborted) {
      throw new DOMException("The operation was aborted", "AbortError");
    }

    return response as AniListResponse<T>;
  } catch (error) {
    console.error(`❌ [${requestId}] Error during AniList API request:`, error);
    throw error;
  }
}

/**
 * Processes HTTP error responses and handles rate limiting.
 *
 * @param requestId - Unique request identifier.
 * @param response - The HTTP response object.
 * @returns Promise resolving to parsed error data.
 */
async function processHttpError(
  requestId: string,
  response: Response,
): Promise<never> {
  const errorText = await response.text();
  let errorData;
  try {
    errorData = JSON.parse(errorText);
  } catch {
    errorData = { raw: errorText };
  }

  console.error(`❌ [${requestId}] HTTP Error ${response.status}:`, errorData);

  // Check for rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;

    // Notify the application about rate limiting through a custom event
    try {
      window.dispatchEvent(
        new CustomEvent("anilist:rate-limited", {
          detail: {
            retryAfter: retrySeconds,
            message: `Rate limited by AniList API. Please retry after ${retrySeconds} seconds.`,
          },
        }),
      );
    } catch (e) {
      console.error("Failed to dispatch rate limit event:", e);
    }

    const error = {
      status: response.status,
      statusText: response.statusText,
      message: `Rate limit exceeded. Please retry after ${retrySeconds} seconds.`,
      retryAfter: retrySeconds,
      isRateLimited: true,
      ...errorData,
    };

    console.warn(
      `⏳ [${requestId}] Rate limited, retry after ${retrySeconds}s`,
    );
    throw error;
  }

  const error = new Error(
    `HTTP Error ${response.status}: ${response.statusText}`,
  ) as HttpError;
  error.status = response.status;
  error.statusText = response.statusText;
  Object.assign(error, errorData);
  throw error;
}

/**
 * Handles browser fetch requests directly to the AniList API.
 *
 * @param requestId - Unique request identifier.
 * @param options - Request options for fetch.
 * @returns Promise resolving to AniListResponse.
 */
async function handleBrowserRequest<T>(
  requestId: string,
  options: RequestInit,
): Promise<AniListResponse<T>> {
  try {
    const response = await fetch("https://graphql.anilist.co", options);

    if (!response.ok) {
      await processHttpError(requestId, response);
    }

    const jsonResponse = await response.json();

    // Check for GraphQL errors
    if (jsonResponse.errors) {
      console.error(`⚠️ [${requestId}] GraphQL Errors:`, jsonResponse.errors);
    }

    return jsonResponse as AniListResponse<T>;
  } catch (error) {
    console.error(`❌ [${requestId}] Error during AniList API request:`, error);
    throw error;
  }
}

/**
 * Make a request to the AniList API.
 *
 * Supports dynamic mutations where variable declarations may change based on the variables object passed. Handles both browser and Electron environments.
 *
 * @param query - The GraphQL query or mutation string.
 * @param variables - Optional variables for the query.
 * @param token - Optional authentication token.
 * @param abortSignal - Optional abort signal to cancel the request.
 * @param bypassCache - Optional flag to bypass cache.
 * @returns A promise resolving to an AniListResponse object.
 * @source
 */
export async function request<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
  abortSignal?: AbortSignal,
  bypassCache?: boolean,
): Promise<AniListResponse<T>> {
  // Generate a unique request ID for tracking this request in logs
  const requestId = Math.random().toString(36).substring(2, 8);

  // Check if we're running in a browser or Electron environment
  const isElectron = typeof window !== "undefined" && window.electronAPI;

  // Route request to appropriate handler
  if (isElectron) {
    return handleElectronRequest<T>(
      requestId,
      query,
      variables,
      token,
      bypassCache,
      abortSignal,
    );
  } else {
    const options = buildRequestOptions(query, variables, token, abortSignal);
    return handleBrowserRequest<T>(requestId, options);
  }
}

/**
 * Get the OAuth URL for AniList authentication.
 *
 * @param clientId - The OAuth client ID.
 * @param redirectUri - The redirect URI after authentication.
 * @returns The complete OAuth URL.
 * @source
 */
export function getOAuthUrl(clientId: string, redirectUri: string): string {
  return `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code`;
}

/**
 * Exchange an authorization code for an access token through the main process.
 *
 * @param clientId - The OAuth client ID.
 * @param clientSecret - The OAuth client secret.
 * @param redirectUri - The redirect URI used for authentication.
 * @param code - The authorization code to exchange.
 * @returns Promise resolving to the token response.
 * @source
 */
export async function getAccessToken(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  console.log("🔑 getAccessToken starting with:", {
    clientId: clientId.substring(0, 2) + "...",
    redirectUri,
    codeLength: code.length,
  });

  // Use the main process to exchange the token
  const result = await window.electronAPI.anilist.exchangeToken({
    clientId,
    clientSecret,
    redirectUri,
    code,
  });

  if (!result.success || !result.token) {
    throw new Error(
      `Failed to exchange code for token: ${result.error || "Unknown error"}`,
    );
  }

  return result.token;
}

/**
 * Generate a cache key from search parameters
 */
function generateCacheKey(
  search: string,
  page: number = 1,
  perPage: number = 50,
  additionalParams: Record<string, unknown> = {},
): string {
  return `${search.toLowerCase()}_${page}_${perPage}_${JSON.stringify(additionalParams)}`;
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
 * Core search logic shared between basic and advanced search.
 *
 * @param query - The GraphQL query to execute.
 * @param variables - Variables for the query.
 * @param search - Search query string for logging/caching.
 * @param cacheKey - Cache key for this search.
 * @param searchType - Type of search for logging.
 * @param token - Optional access token.
 * @param bypassCache - Optional parameter to bypass cache.
 * @param page - Page number for error handling.
 * @param perPage - Results per page for error handling.
 * @returns Promise resolving to search results.
 */
async function executeSearchQuery(
  query: string,
  variables: Record<string, unknown>,
  search: string,
  cacheKey: string,
  searchType: string,
  token?: string,
  bypassCache?: boolean,
  page: number = 1,
  perPage: number = 50,
): Promise<SearchResult<AniListManga>> {
  // Check cache first
  if (!bypassCache && isCacheValid(searchCache, cacheKey)) {
    console.log(`📋 Using cached ${searchType} results for: "${search}"`);
    return searchCache[cacheKey].data;
  }

  console.log(
    `🔍 ${searchType} for manga: "${search}"${searchType === "Advanced search" ? " with filters" : ""} (page ${page})`,
  );

  try {
    // Execute the API request
    const response = await request<{
      data?: { Page: SearchResult<AniListManga>["Page"] };
      Page?: SearchResult<AniListManga>["Page"];
    }>(query, variables, token, undefined, bypassCache);

    console.log(`🔍 ${searchType} response:`, response);

    // Validate response structure
    if (!response?.data) {
      console.error(
        `Invalid API response for ${searchType.toLowerCase()} "${search}":`,
        response,
      );
      throw new Error(`Invalid API response: missing data property`);
    }

    // Handle nested data structure
    const responseData = response.data.data ?? response.data;

    if (!responseData.Page) {
      console.error(
        `Invalid API response for ${searchType.toLowerCase()} "${search}": missing Page property`,
        responseData,
      );
      throw new Error(`Invalid API response: missing Page property`);
    }

    const result = { Page: responseData.Page };

    // Ensure media array exists
    if (!result.Page.media) {
      result.Page.media = [];
    }

    // Log results
    console.log(
      `🔍 Found ${result.Page.media.length} manga for ${searchType.toLowerCase()} "${search}" (page ${page}/${result.Page.pageInfo?.lastPage || 1})`,
    );

    // Cache results
    if (!bypassCache) {
      searchCache[cacheKey] = {
        data: result,
        timestamp: Date.now(),
      };

      persistSearchCache();
      console.log(
        `💾 Cached ${result.Page.media.length} ${searchType.toLowerCase()} results for "${search}"`,
      );
    }

    // Dispatch search results event (only for basic search to avoid duplicate events)
    if (searchType === "Searching") {
      try {
        const event = new CustomEvent("anilist:search-results-updated", {
          detail: {
            search,
            results: result.Page.media || [],
            timestamp: Date.now(),
          },
        });
        window.dispatchEvent(event);
      } catch (e) {
        console.error("Failed to dispatch search results event:", e);
      }
    }

    return result;
  } catch (error) {
    console.error(`Error in ${searchType.toLowerCase()} for: ${search}`, error);

    // Return empty result to prevent crashing
    const emptyResult: SearchResult<AniListManga> = {
      Page: {
        pageInfo: {
          total: 0,
          currentPage: page,
          lastPage: 1,
          hasNextPage: false,
          perPage,
        },
        media: [],
      },
    };

    return emptyResult;
  }
}

/**
 * Search for manga on AniList.
 *
 * @param search - Search query.
 * @param page - Page number.
 * @param perPage - Results per page.
 * @param token - Optional access token.
 * @param bypassCache - Optional parameter to bypass cache.
 * @returns Promise resolving to search results.
 * @source
 */
export async function searchManga(
  search: string,
  page: number = 1,
  perPage: number = 50,
  token?: string,
  bypassCache?: boolean,
): Promise<SearchResult<AniListManga>> {
  const cacheKey = generateCacheKey(search, page, perPage);
  const variables = { search, page, perPage };

  return executeSearchQuery(
    SEARCH_MANGA,
    variables,
    search,
    cacheKey,
    "Searching",
    token,
    bypassCache,
    page,
    perPage,
  );
}

/**
 * Advanced search for manga with additional filters.
 *
 * @param search - Search query.
 * @param filters - Filter options.
 * @param page - Page number.
 * @param perPage - Results per page.
 * @param token - Optional access token.
 * @param bypassCache - Optional parameter to bypass cache.
 * @returns Promise resolving to search results.
 * @source
 */
export async function advancedSearchManga(
  search: string,
  filters: {
    genres?: string[];
    tags?: string[];
    formats?: string[];
  } = {},
  page: number = 1,
  perPage: number = 50,
  token?: string,
  bypassCache?: boolean,
): Promise<SearchResult<AniListManga>> {
  const cacheKey = generateCacheKey(search, page, perPage, filters);
  const variables = {
    search,
    page,
    perPage,
    genre_in: filters.genres,
    tag_in: filters.tags,
    format_in: filters.formats,
  };

  return executeSearchQuery(
    ADVANCED_SEARCH_MANGA,
    variables,
    search,
    cacheKey,
    "Advanced search",
    token,
    bypassCache,
    page,
    perPage,
  );
}

/**
 * Clear the search cache.
 *
 * @param searchQuery - Optional search query to clear specific entries.
 * @source
 */
export function clearSearchCache(searchQuery?: string): void {
  if (searchQuery) {
    // Clear specific cache entries
    Object.keys(searchCache).forEach((key) => {
      if (key.includes(searchQuery.toLowerCase())) {
        delete searchCache[key];
      }
    });
    console.log(`Cleared search cache for: ${searchQuery}`);
  } else {
    // Clear all cache
    Object.keys(searchCache).forEach((key) => {
      delete searchCache[key];
    });
    console.log("Cleared all search cache");
  }

  // Update localStorage with the cleared cache
  persistSearchCache();

  // Also clear the cache in the main process
  window.electronAPI.anilist.clearCache(searchQuery).catch((error: Error) => {
    console.error("Failed to clear main process cache:", error);
  });
}

/**
 * Get multiple manga by their IDs.
 *
 * @param ids - Array of AniList manga IDs.
 * @param token - Optional access token.
 * @param abortSignal - Optional abort signal to cancel the request.
 * @returns Promise resolving to an array of AniListManga objects.
 * @source
 */
export async function getMangaByIds(
  ids: number[],
  token?: string,
  abortSignal?: AbortSignal,
): Promise<AniListManga[]> {
  if (!ids.length) {
    return [];
  }

  try {
    // Updated type parameter to handle potential nested data structure
    const response = await request<{
      data?: { Page: { media: AniListManga[] } };
      Page?: { media: AniListManga[] };
    }>(GET_MANGA_BY_IDS, { ids }, token, abortSignal);

    // Validate response structure
    if (!response?.data) {
      console.error(
        `Invalid API response when fetching manga by IDs:`,
        response,
      );
      return [];
    }

    // Check for nested data structure
    const responseData = response.data.data ?? response.data;

    // Safely access media array or return empty array if not found
    return responseData.Page?.media || [];
  } catch (error) {
    console.error(`Error fetching manga by IDs [${ids.join(", ")}]:`, error);
    throw error;
  }
}

/**
 * Creates a proper Error object for rate limit scenarios.
 *
 * @param message - Error message.
 * @param status - HTTP status code.
 * @param retryAfter - Retry after seconds.
 * @returns Error object with rate limit properties.
 */
function createRateLimitError(
  message: string,
  status: number,
  retryAfter: number,
): RateLimitError {
  const rateLimitError = new Error(message) as RateLimitError;
  rateLimitError.status = status;
  rateLimitError.isRateLimited = true;
  rateLimitError.retryAfter = retryAfter;
  return rateLimitError;
}

/**
 * Checks if an error is a rate limit error based on status code or flag.
 *
 * @param errorObj - Error object to check.
 * @returns Rate limit error if detected, null otherwise.
 */
function checkDirectRateLimitError(errorObj: {
  status?: number;
  isRateLimited?: boolean;
  retryAfter?: number;
  message?: string;
}): Error | null {
  if (errorObj.status === 429 || errorObj.isRateLimited) {
    console.warn("📛 DETECTED RATE LIMIT in getUserMangaList", {
      status: errorObj.status,
      isRateLimited: errorObj.isRateLimited,
      retryAfter: errorObj.retryAfter,
      message: errorObj.message,
    });

    return createRateLimitError(
      errorObj.message || "Rate limit exceeded",
      errorObj.status || 429,
      errorObj.retryAfter || 60,
    );
  }

  return null;
}

/**
 * Checks if an error message contains rate limit mentions and creates appropriate error.
 *
 * @param errorObj - Error object with message to check.
 * @returns Rate limit error if detected, null otherwise.
 */
function checkRateLimitInMessage(errorObj: { message?: string }): Error | null {
  if (
    !errorObj.message ||
    (!errorObj.message.toLowerCase().includes("rate limit") &&
      !errorObj.message.toLowerCase().includes("too many requests"))
  ) {
    return null;
  }

  // Try to extract retry time if present
  let retrySeconds = 60;
  const retryMatch = RegExp(/retry after (\d+)/i).exec(errorObj.message);
  if (retryMatch?.[1]) {
    retrySeconds = parseInt(retryMatch[1], 10);
  }

  console.warn(
    "📛 DETECTED RATE LIMIT MENTION in getUserMangaList error message",
    {
      message: errorObj.message,
      extractedSeconds: retrySeconds,
    },
  );

  return createRateLimitError(errorObj.message, 429, retrySeconds);
}

/**
 * Gets the current user's manga list from AniList.
 *
 * @param token - The user's access token.
 * @param abortSignal - Optional AbortSignal to cancel the request.
 * @returns The user's manga list organized by status.
 * @source
 */
export async function getUserMangaList(
  token: string,
  abortSignal?: AbortSignal,
): Promise<UserMediaList> {
  if (!token) {
    throw new Error("Access token required to fetch user manga list");
  }

  try {
    // Get the user's ID first
    const viewerId = await getAuthenticatedUserID(token, abortSignal);
    console.log("Successfully retrieved user ID:", viewerId);

    if (!viewerId) {
      throw new Error("Failed to get your AniList user ID");
    }

    // Fetch all manga lists using multiple chunks if needed
    return await fetchCompleteUserMediaList(viewerId, token, abortSignal);
  } catch (error: unknown) {
    console.error("Error fetching user manga list:", error);

    // Type guard to check if error is an object with specific properties
    if (error && typeof error === "object") {
      const errorObj = error as {
        status?: number;
        isRateLimited?: boolean;
        retryAfter?: number;
        message?: string;
      };

      // Check for direct rate limit errors
      const directRateLimitError = checkDirectRateLimitError(errorObj);
      if (directRateLimitError) {
        throw directRateLimitError;
      }

      // Check for rate limit mentions in error messages
      const messageBasisRateLimitError = checkRateLimitInMessage(errorObj);
      if (messageBasisRateLimitError) {
        throw messageBasisRateLimitError;
      }
    }

    throw error;
  }
}

/**
 * Attempts to get the authenticated user's ID through various methods
 */
async function getAuthenticatedUserID(
  token: string,
  abortSignal?: AbortSignal,
): Promise<number | undefined> {
  try {
    // First, try to get user's ID using the Viewer query
    interface ViewerResponse {
      Viewer?: {
        id: number;
        name: string;
      };
      data?: {
        Viewer?: {
          id: number;
          name: string;
        };
      };
    }

    const viewerResponse = await request<ViewerResponse>(
      GET_VIEWER,
      {},
      token,
      abortSignal,
    );

    // Handle multiple possible response formats
    let viewerId: number | undefined;

    // Try to extract the Viewer data from different potential structures
    if (viewerResponse?.data?.Viewer?.id) {
      // Standard structure
      viewerId = viewerResponse.data.Viewer.id;
    } else if (viewerResponse?.data?.data?.Viewer?.id) {
      // Nested data structure
      viewerId = viewerResponse.data.data.Viewer.id;
    }

    if (viewerId) {
      return viewerId;
    }

    // If the above approach failed, try a direct query
    console.log("First viewer query failed, trying direct query approach");
    const directViewerResponse = await request<ViewerResponse>(
      `query { Viewer { id name } }`,
      {},
      token,
      abortSignal,
    );

    console.log("Direct viewer query response:", directViewerResponse);

    // Try to extract user ID from various response formats
    if (directViewerResponse?.data?.Viewer?.id) {
      return directViewerResponse.data.Viewer.id;
    } else if (directViewerResponse?.data?.data?.Viewer?.id) {
      return directViewerResponse.data.data.Viewer.id;
    }

    console.error(
      "Could not extract user ID from any response:",
      directViewerResponse,
    );
    return undefined;
  } catch (error) {
    console.error("Error getting authenticated user ID:", error);
    throw error;
  }
}

/**
 * Interface for MediaListCollection response structure
 */
interface MediaListCollectionResponse {
  MediaListCollection?: {
    lists: Array<{
      name: string;
      entries: Array<{
        id: number;
        mediaId: number;
        status: string;
        progress: number;
        score: number;
        private: boolean;
        media: AniListManga;
      }>;
    }>;
  };
  data?: {
    MediaListCollection?: {
      lists: Array<{
        name: string;
        entries: Array<{
          id: number;
          mediaId: number;
          status: string;
          progress: number;
          score: number;
          private: boolean;
          media: AniListManga;
        }>;
      }>;
    };
    data?: {
      MediaListCollection?: {
        lists: Array<{
          name: string;
          entries: Array<{
            id: number;
            mediaId: number;
            status: string;
            progress: number;
            score: number;
            private: boolean;
            media: AniListManga;
          }>;
        }>;
      };
    };
  };
}

/**
 * Extracts MediaListCollection from response, handling nested structures.
 *
 * @param response - The API response containing MediaListCollection.
 * @returns MediaListCollection or null if not found.
 */
function extractMediaListCollection(
  response: MediaListCollectionResponse,
): MediaListCollectionResponse["MediaListCollection"] | null {
  if (response?.data?.MediaListCollection) {
    return response.data.MediaListCollection;
  } else if (response?.data?.data?.MediaListCollection) {
    return response.data.data.MediaListCollection;
  }
  return null;
}

/**
 * Handles chunk-specific errors with rate limit detection.
 *
 * @param error - The error that occurred.
 * @param currentChunk - The chunk number that failed.
 * @param mediaMap - The current media map to check if we have partial data.
 * @returns true if should continue, false if should stop.
 */
function handleChunkError(
  error: unknown,
  currentChunk: number,
  mediaMap: UserMediaList,
): boolean {
  // Type guard to check if error is an object with specific properties
  if (error && typeof error === "object") {
    const errorObj = error as {
      status?: number;
      isRateLimited?: boolean;
    };

    // Check if this was a rate limit error
    if (errorObj.status === 429 || errorObj.isRateLimited) {
      console.warn(
        `Chunk ${currentChunk} request was rate limited, propagating error`,
      );
      // Propagate rate limit error to be handled by the UI
      throw error;
    }
  }

  // For other errors, log and continue if we have some data
  console.error(`Error fetching chunk ${currentChunk}:`, error);

  // If we have some data already, we'll return it, otherwise propagate the error
  if (Object.keys(mediaMap).length === 0) {
    throw error;
  }

  // Return false to break the loop and return what we have so far
  return false;
}

/**
 * Determines if more chunks are needed based on current chunk results.
 *
 * @param chunkEntryCount - Number of entries in current chunk.
 * @param perChunk - Maximum entries per chunk.
 * @returns true if more chunks needed, false if done.
 */
function shouldFetchNextChunk(
  chunkEntryCount: number,
  perChunk: number,
): boolean {
  // If this chunk has fewer entries than the perChunk limit, we've reached the end
  if (chunkEntryCount < perChunk) {
    console.log("Reached the end of user's manga list");
    return false;
  }
  return true;
}

/**
 * Fetches and processes a single chunk of user media list.
 *
 * @param userId - The user ID.
 * @param currentChunk - The chunk number to fetch.
 * @param perChunk - Number of entries per chunk.
 * @param token - Authentication token.
 * @param abortSignal - Optional abort signal.
 * @param mediaMap - The media map to populate.
 * @returns Number of entries processed from this chunk.
 */
async function fetchAndProcessChunk(
  userId: number,
  currentChunk: number,
  perChunk: number,
  token: string,
  abortSignal: AbortSignal | undefined,
  mediaMap: UserMediaList,
): Promise<number> {
  console.log(
    `Fetching chunk ${currentChunk} (${perChunk} entries per chunk)...`,
  );

  const response = await request<MediaListCollectionResponse>(
    GET_USER_MANGA_LIST,
    { userId, chunk: currentChunk, perChunk },
    token,
    abortSignal,
  );

  // Extract media list collection, handling potential nested structure
  const mediaListCollection = extractMediaListCollection(response);

  if (!mediaListCollection?.lists) {
    console.error(
      `Invalid media list response for chunk ${currentChunk}:`,
      response,
    );
    return 0; // Return 0 to indicate no entries processed
  }

  const chunkEntryCount = processMediaListCollectionChunk(
    mediaListCollection,
    mediaMap,
  );

  console.log(
    `Processed ${chunkEntryCount} entries from chunk ${currentChunk}`,
  );

  return chunkEntryCount;
}

/**
 * Fetches the complete user media list using multiple chunks if needed
 */
async function fetchCompleteUserMediaList(
  userId: number,
  token: string,
  abortSignal?: AbortSignal,
): Promise<UserMediaList> {
  const mediaMap: UserMediaList = {};
  let hasNextChunk = true;
  let currentChunk = 1;
  const perChunk = 500;
  let totalEntriesProcessed = 0;

  try {
    // Keep fetching chunks until we've got everything
    while (hasNextChunk && !abortSignal?.aborted) {
      try {
        const chunkEntryCount = await fetchAndProcessChunk(
          userId,
          currentChunk,
          perChunk,
          token,
          abortSignal,
          mediaMap,
        );

        totalEntriesProcessed += chunkEntryCount;

        // Check if we need to fetch more chunks
        if (shouldFetchNextChunk(chunkEntryCount, perChunk)) {
          currentChunk++;
        } else {
          hasNextChunk = false;
        }
      } catch (error: unknown) {
        // Handle chunk error and determine if we should continue
        const shouldContinue = handleChunkError(error, currentChunk, mediaMap);
        if (!shouldContinue) {
          hasNextChunk = false;
        }
      }
    }

    console.log(
      `📚 Successfully mapped ${Object.keys(mediaMap).length} manga entries (processed ${totalEntriesProcessed} total entries)`,
    );
    return mediaMap;
  } catch (error) {
    console.error(`Error fetching manga list in chunks:`, error);

    // If we got any entries, return what we have
    if (Object.keys(mediaMap).length > 0) {
      console.log(
        `Returning partial manga list with ${Object.keys(mediaMap).length} entries`,
      );
      return mediaMap;
    }

    throw error;
  }
}

/**
 * Process a single chunk of MediaListCollection and add to the map
 * Returns the number of entries processed
 */
function processMediaListCollectionChunk(
  mediaListCollection: {
    lists: Array<{
      name: string;
      entries: Array<{
        id: number;
        mediaId: number;
        status: string;
        progress: number;
        score: number;
        private: boolean;
        media: AniListManga;
      }>;
    }>;
  },
  mediaMap: UserMediaList,
): number {
  let entriesProcessed = 0;

  console.log(
    `Retrieved ${mediaListCollection.lists.length} lists in this chunk`,
  );

  mediaListCollection.lists.forEach((list) => {
    if (!list.entries) {
      console.warn(`List "${list.name}" has no entries`);
      return;
    }

    entriesProcessed += list.entries.length;

    list.entries.forEach((entry) => {
      if (!entry.media || !entry.mediaId) {
        console.warn("Found entry without media data:", entry);
        return;
      }

      // Store the entry by its mediaId, potentially overwriting duplicates
      // This is fine since we want the latest data for each unique manga
      mediaMap[entry.mediaId] = {
        id: entry.id,
        mediaId: entry.mediaId,
        status: entry.status,
        progress: entry.progress,
        score: entry.score,
        private: entry.private,
        title: entry.media.title,
      };
    });
  });

  return entriesProcessed;
}

// Export internal helpers for testing
export const __test__ = {
  initializeSearchCache,
  persistSearchCache,
  generateCacheKey,
  isCacheValid,
  searchCache,
  searchCacheInitialized: () => searchCacheInitialized,
  setSearchCacheInitialized: (val: boolean) => {
    searchCacheInitialized = val;
  },
  processMediaListCollectionChunk,
  fetchCompleteUserMediaList,
  getAuthenticatedUserID,
  getUserMangaList,
};
