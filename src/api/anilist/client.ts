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
import { debounce } from "@/utils/debounce";

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
    console.debug(
      "[AniListClient] 💾 Search cache already initialized, skipping duplicate initialization",
    );
    return;
  }

  console.debug("[AniListClient] 💾 Initializing AniList search cache...");
  searchCacheInitialized = true;

  try {
    const storageKey = "anilist_search_cache";
    const cachedData = localStorage.getItem(storageKey);

    if (!cachedData) {
      console.debug("[AniListClient] 💾 No cached search data found");
      return;
    }

    const parsedCache = JSON.parse(cachedData);
    let loadedCount = 0;

    // Only use cache entries that haven't expired
    const now = Date.now();

    // Merge with our in-memory cache
    for (const key of Object.keys(parsedCache)) {
      const entry = parsedCache[key];
      if (entry && now - entry.timestamp < CACHE_EXPIRATION) {
        searchCache[key] = entry;
        loadedCount++;
      }
    }

    console.debug(
      `[AniListClient] 💾 Loaded ${loadedCount} cached search results from localStorage`,
    );

    try {
      const event = new CustomEvent("anilist:search-cache-initialized", {
        detail: { count: loadedCount },
      });
      globalThis.dispatchEvent(event);
      console.debug(`[AniListClient] 📤 Dispatched cache initialization event`);
    } catch (e) {
      console.error("[AniListClient] ❌ Failed to dispatch cache event", e);
    }
  } catch (error) {
    console.error(
      "[AniListClient] ❌ Error loading search cache from localStorage:",
      error,
    );
  }
}

/**
 * Save the search cache to localStorage for persistence
 * Internal function - not debounced
 */
function persistSearchCacheInternal(): void {
  try {
    const storageKey = "anilist_search_cache";
    const serialized = JSON.stringify(searchCache);
    localStorage.setItem(storageKey, serialized);
    console.debug(
      `[AniListClient] 💾 Persisted search cache (${serialized.length} bytes)`,
    );
  } catch (error) {
    console.error(
      "[AniListClient] ❌ Error saving search cache to localStorage:",
      error,
    );
  }
}

/**
 * Debounced version of persistSearchCache to batch writes
 * Waits 2 seconds after last call before writing to localStorage
 */
const persistSearchCache = debounce(persistSearchCacheInternal, 2000);

/**
 * Immediately persist the search cache (bypasses debounce)
 * Use this for critical saves like clearing cache or app shutdown
 */
function persistSearchCacheImmediate(): void {
  persistSearchCacheInternal();
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
  let succeeded = false;
  try {
    // Use the correct call format for the main process
    const response = await globalThis.electronAPI.anilist.request(
      query,
      { ...variables, bypassCache }, // Pass bypassCache flag to main process
      token,
      // We can't pass AbortSignal through IPC, but we'll check it after
    );

    // Check for abort before returning the response
    if (abortSignal?.aborted) {
      throw new DOMException("The operation was aborted", "AbortError");
    }

    succeeded = true;
    return response as AniListResponse<T>;
  } catch (error) {
    console.error(
      `[AniListClient] ❌ [${requestId}] Error during AniList API request:`,
      error,
    );
    throw error;
  } finally {
    if (typeof globalThis.dispatchEvent === "function") {
      globalThis.dispatchEvent(
        new CustomEvent("anilist:request:completed", {
          detail: { succeeded },
        }),
      );
    }
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

  console.error(
    `[AniListClient] ❌ [${requestId}] HTTP Error ${response.status}:`,
    errorData,
  );

  // Check for rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retrySeconds = retryAfter ? Number.parseInt(retryAfter, 10) : 60;

    // Notify the application about rate limiting through a custom event
    try {
      globalThis.dispatchEvent(
        new CustomEvent("anilist:rate-limited", {
          detail: {
            retryAfter: retrySeconds,
            message: `Rate limited by AniList API. Please retry after ${retrySeconds} seconds.`,
          },
        }),
      );
    } catch (e) {
      console.error(
        "[AniListClient] ❌ Failed to dispatch rate limit event:",
        e,
      );
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
      console.error(
        `[AniListClient] ⚠️ [${requestId}] GraphQL Errors:`,
        jsonResponse.errors,
      );
    }

    return jsonResponse as AniListResponse<T>;
  } catch (error) {
    console.error(
      `[AniListClient] ❌ [${requestId}] Error during AniList API request:`,
      error,
    );
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
  const isElectron = globalThis.window !== undefined && globalThis.electronAPI;

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
  console.debug("[AniListClient] 🔑 getAccessToken starting with:", {
    clientIdLength: clientId.length,
    redirectUri,
    codeLength: code.length,
  });

  // Use the main process to exchange the token
  const result = await globalThis.electronAPI.anilist.exchangeToken({
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
 * Options for executing a search query.
 */
interface SearchQueryOptions {
  query: string;
  variables: Record<string, unknown>;
  search: string;
  cacheKey: string;
  searchType: string;
  token?: string;
  bypassCache?: boolean;
  page?: number;
  perPage?: number;
}

/**
 * Core search logic shared between basic and advanced search.
 *
 * @param options - Search query options.
 * @returns Promise resolving to search results.
 */
async function executeSearchQuery(
  options: SearchQueryOptions,
): Promise<SearchResult<AniListManga>> {
  const {
    query,
    variables,
    search,
    cacheKey,
    searchType,
    token,
    bypassCache = false,
    page = 1,
    perPage = 50,
  } = options;
  // Check cache first
  if (!bypassCache && isCacheValid(searchCache, cacheKey)) {
    console.debug(
      `[AniListClient] � Using cached ${searchType} results for: "${search}"`,
    );
    return searchCache[cacheKey].data;
  }

  console.info(
    `[AniListClient] 🔍 ${searchType} for manga: "${search}"${searchType === "Advanced search" ? " with filters" : ""} (page ${page})`,
  );

  try {
    // Execute the API request
    const response = await request<{
      data?: { Page: SearchResult<AniListManga>["Page"] };
      Page?: SearchResult<AniListManga>["Page"];
    }>(query, variables, token, undefined, bypassCache);

    console.debug(`[AniListClient] 🔍 ${searchType} response:`, response);

    // Validate response structure
    if (!response?.data) {
      console.error(
        `[AniListClient] ❌ Invalid API response for ${searchType.toLowerCase()} "${search}":`,
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
    console.info(
      `[AniListClient] ✅ Found ${result.Page.media.length} manga for ${searchType.toLowerCase()} "${search}" (page ${page}/${result.Page.pageInfo?.lastPage || 1})`,
    );

    // Cache results
    if (!bypassCache) {
      searchCache[cacheKey] = {
        data: result,
        timestamp: Date.now(),
      };

      persistSearchCache();
      console.debug(
        `[AniListClient] 💾 Cached ${result.Page.media.length} ${searchType.toLowerCase()} results for "${search}"`,
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
        globalThis.dispatchEvent(event);
      } catch (e) {
        console.error(
          "[AniListClient] ❌ Failed to dispatch search results event:",
          e,
        );
      }
    }

    return result;
  } catch (error) {
    console.error(
      `[AniListClient] ❌ Error in ${searchType.toLowerCase()} for: ${search}`,
      error,
    );

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

  return executeSearchQuery({
    query: SEARCH_MANGA,
    variables,
    search,
    cacheKey,
    searchType: "Searching",
    token,
    bypassCache,
    page,
    perPage,
  });
}

/**
 * Batch search for multiple manga titles in a single GraphQL request.
 *
 * @param searches - Array of search queries with metadata.
 * @param options - Optional configuration including auth token, page size, and abort signal.
 * @returns Promise resolving to map of search results keyed by alias.
 * @source
 */
export async function batchSearchManga(
  searches: Array<{ alias: string; title: string; index: number }>,
  options: {
    token?: string;
    perPage?: number;
    abortSignal?: AbortSignal;
  } = {},
): Promise<
  Map<
    string,
    {
      media: AniListManga[];
      index: number;
      title: string;
    }
  >
> {
  if (searches.length === 0) {
    return new Map();
  }

  const { token, perPage = 10, abortSignal } = options;

  console.info(
    `[AniListClient] 🚀 Batch searching ${searches.length} manga titles`,
  );

  // Build the batched query dynamically
  const queryParts: string[] = [];

  for (const { alias, title } of searches) {
    // Sanitize the title for use in GraphQL (escape quotes)
    const sanitizedTitle = JSON.stringify(title).slice(1, -1);

    queryParts.push(`
    ${alias}: Page(page: 1, perPage: ${perPage}) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: MANGA, search: "${sanitizedTitle}", format_not_in: [NOVEL]) {
        id
        title {
          romaji
          english
          native
        }
        synonyms
        format
        status
        chapters
        volumes
        coverImage {
          large
          medium
        }
        mediaListEntry {
          id
          status
          progress
          score
          private
        }
        isAdult
      }
    }`);
  }

  const batchedQuery = `
query BatchSearchManga {
${queryParts.join("\n")}
}
`;

  type BatchQueryResponse = Record<
    string,
    {
      media?: AniListManga[];
      pageInfo?: unknown;
    }
  >;

  try {
    // Execute the batched request
    const response = await request<BatchQueryResponse>(
      batchedQuery,
      {}, // No variables needed - all values are in the query
      token,
      abortSignal,
      true, // Bypass cache for batch requests
    );

    console.debug(`[AniListClient] 🔍 Batch search response:`, response);

    // Validate response structure
    if (!response?.data) {
      console.error(
        `[AniListClient] ❌ Invalid API response for batch search:`,
        response,
      );
      throw new Error(`Invalid API response: missing data property`);
    }

    // Handle nested data structure and type assertion
    const responseData = (response.data.data ??
      response.data) as unknown as BatchQueryResponse;

    // Process results into a map
    const results = new Map<
      string,
      {
        media: AniListManga[];
        index: number;
        title: string;
      }
    >();

    let totalResults = 0;
    for (const { alias, index, title } of searches) {
      const aliasData = responseData[alias];
      if (aliasData?.media?.length) {
        results.set(alias, {
          media: aliasData.media,
          index,
          title,
        });
        totalResults += aliasData.media.length;
      } else {
        // Return empty array if no results
        results.set(alias, {
          media: [],
          index,
          title,
        });
      }
    }

    console.info(
      `[AniListClient] ✅ Batch search complete: ${totalResults} total results for ${searches.length} queries`,
    );

    return results;
  } catch (error) {
    console.error(`[AniListClient] ❌ Error in batch search:`, error);

    // Return empty results for all searches on error
    const emptyResults = new Map<
      string,
      {
        media: AniListManga[];
        index: number;
        title: string;
      }
    >();

    for (const { alias, index, title } of searches) {
      emptyResults.set(alias, {
        media: [],
        index,
        title,
      });
    }

    return emptyResults;
  }
}

/**
 * Advanced search for manga using the dedicated AniList endpoint.
 *
 * @param search - Search query.
 * @param page - Page number.
 * @param perPage - Results per page.
 * @param token - Optional access token.
 * @param bypassCache - Optional parameter to bypass cache.
 * @returns Promise resolving to search results.
 * @source
 */
export async function advancedSearchManga(
  search: string,
  page: number = 1,
  perPage: number = 50,
  token?: string,
  bypassCache?: boolean,
): Promise<SearchResult<AniListManga>> {
  const cacheKey = generateCacheKey(search, page, perPage);
  const variables = {
    search,
    page,
    perPage,
  };

  return executeSearchQuery({
    query: ADVANCED_SEARCH_MANGA,
    variables,
    search,
    cacheKey,
    searchType: "Advanced search",
    token,
    bypassCache,
    page,
    perPage,
  });
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
    for (const key of Object.keys(searchCache)) {
      if (key.includes(searchQuery.toLowerCase())) {
        delete searchCache[key];
      }
    }
    console.info(`[AniListClient] 🗑️ Cleared search cache for: ${searchQuery}`);
  } else {
    // Clear all cache
    for (const key of Object.keys(searchCache)) {
      delete searchCache[key];
    }
    console.info("[AniListClient] 🗑️ Cleared all search cache");
  }

  // Update localStorage with the cleared cache immediately (critical operation)
  persistSearchCacheImmediate();

  // Also clear the cache in the main process
  globalThis.electronAPI.anilist
    .clearCache(searchQuery)
    .catch((error: Error) => {
      console.error(
        "[AniListClient] ❌ Failed to clear main process cache:",
        error,
      );
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
    console.error(
      `[AniListClient] ❌ Error fetching manga by IDs [${ids.join(", ")}]:`,
      error,
    );
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
  if (errorObj.status !== 429 && !errorObj.isRateLimited) {
    return null;
  }

  console.warn("[AniListClient] 📛 DETECTED RATE LIMIT in getUserMangaList", {
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

/**
 * Checks if an error message contains rate limit mentions and creates appropriate error.
 *
 * @param errorObj - Error object with message to check.
 * @returns Rate limit error if detected, null otherwise.
 */
function checkRateLimitInMessage(errorObj: { message?: string }): Error | null {
  if (!errorObj.message) {
    return null;
  }

  const lowerMessage = errorObj.message.toLowerCase();
  if (
    !lowerMessage.includes("rate limit") &&
    !lowerMessage.includes("too many requests")
  ) {
    return null;
  }

  // Try to extract retry time if present
  let retrySeconds = 60;
  const retryMatch = new RegExp(/retry after (\d+)/i).exec(errorObj.message);
  if (retryMatch?.[1]) {
    retrySeconds = Number.parseInt(retryMatch[1], 10);
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
    console.debug(
      "[AniListClient] ✅ Successfully retrieved user ID:",
      viewerId,
    );

    if (!viewerId) {
      throw new Error("Failed to get your AniList user ID");
    }

    // Fetch all manga lists using multiple chunks if needed
    return await fetchCompleteUserMediaList(viewerId, token, abortSignal);
  } catch (error: unknown) {
    console.error("[AniListClient] ❌ Error fetching user manga list:", error);

    // Early return if error is not an object
    if (!error || typeof error !== "object") {
      throw error;
    }

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

    // Try to extract the Viewer data from different potential structures
    // Standard structure
    if (viewerResponse?.data?.Viewer?.id) {
      return viewerResponse.data.Viewer.id;
    }

    // Nested data structure
    if (viewerResponse?.data?.data?.Viewer?.id) {
      return viewerResponse.data.data.Viewer.id;
    }

    // If the above approach failed, try a direct query
    console.debug(
      "[AniListClient] 🔄 First viewer query failed, trying direct query approach",
    );
    const directViewerResponse = await request<ViewerResponse>(
      `query { Viewer { id name } }`,
      {},
      token,
      abortSignal,
    );

    console.debug(
      "[AniListClient] 📥 Direct viewer query response:",
      directViewerResponse,
    );

    // Try to extract user ID from various response formats
    if (directViewerResponse?.data?.Viewer?.id) {
      return directViewerResponse.data.Viewer.id;
    }

    if (directViewerResponse?.data?.data?.Viewer?.id) {
      return directViewerResponse.data.data.Viewer.id;
    }

    console.error(
      "[AniListClient] ❌ Could not extract user ID from any response:",
      directViewerResponse,
    );
    return undefined;
  } catch (error) {
    console.error(
      "[AniListClient] ❌ Error getting authenticated user ID:",
      error,
    );
    throw error;
  }
}

/**
 * Interface for a single media list entry
 */
interface MediaListEntry {
  id: number;
  mediaId: number;
  status: string;
  progress: number;
  score: number;
  private: boolean;
  media: AniListManga;
}

/**
 * Interface for media list collection structure
 */
interface MediaListCollection {
  lists: Array<{
    name: string;
    entries: Array<MediaListEntry>;
  }>;
}

/**
 * Interface for MediaListCollection response structure with potential nesting
 */
interface MediaListCollectionResponse {
  MediaListCollection?: MediaListCollection;
  data?: {
    MediaListCollection?: MediaListCollection;
    data?: {
      MediaListCollection?: MediaListCollection;
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
): MediaListCollection | null {
  if (response?.data?.MediaListCollection) {
    return response.data.MediaListCollection;
  }

  // Check nested data structure
  if (response?.data?.data?.MediaListCollection) {
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
  console.error(
    `[AniListClient] ❌ Error fetching chunk ${currentChunk}:`,
    error,
  );

  // If we have no data, propagate the error
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
    console.debug("[AniListClient] ✅ Reached the end of user's manga list");
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
  console.debug(
    `[AniListClient] 📥 Fetching chunk ${currentChunk} (${perChunk} entries per chunk)...`,
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
      `[AniListClient] ❌ Invalid media list response for chunk ${currentChunk}:`,
      response,
    );
    return 0; // Return 0 to indicate no entries processed
  }

  const chunkEntryCount = processMediaListCollectionChunk(
    mediaListCollection,
    mediaMap,
  );

  console.debug(
    `[AniListClient] ✅ Processed ${chunkEntryCount} entries from chunk ${currentChunk}`,
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
        if (!shouldFetchNextChunk(chunkEntryCount, perChunk)) {
          break;
        }

        currentChunk++;
      } catch (error: unknown) {
        // Handle chunk error and determine if we should continue
        const shouldContinue = handleChunkError(error, currentChunk, mediaMap);
        if (!shouldContinue) {
          hasNextChunk = false;
        }
      }
    }

    console.info(
      `[AniListClient] 📚 Successfully mapped ${Object.keys(mediaMap).length} manga entries (processed ${totalEntriesProcessed} total entries)`,
    );
    return mediaMap;
  } catch (error) {
    console.error(
      `[AniListClient] ❌ Error fetching manga list in chunks:`,
      error,
    );

    // If we got any entries, return what we have
    if (Object.keys(mediaMap).length > 0) {
      console.warn(
        `[AniListClient] ⚠️ Returning partial manga list with ${Object.keys(mediaMap).length} entries`,
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
  mediaListCollection: MediaListCollection,
  mediaMap: UserMediaList,
): number {
  let entriesProcessed = 0;

  console.debug(
    `[AniListClient] 📦 Retrieved ${mediaListCollection.lists.length} lists in this chunk`,
  );

  for (const list of mediaListCollection.lists) {
    if (!list.entries) {
      console.warn(`[AniListClient] ⚠️ List "${list.name}" has no entries`);
      continue;
    }

    entriesProcessed += list.entries.length;

    for (const entry of list.entries) {
      if (!entry.media || !entry.mediaId) {
        console.warn(
          "[AniListClient] ⚠️ Found entry without media data:",
          entry,
        );
        continue;
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
    }
  }

  return entriesProcessed;
}

// Export internal helpers for testing
export const __test__ = {
  initializeSearchCache,
  persistSearchCache,
  persistSearchCacheImmediate,
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
