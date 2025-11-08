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
  ApiProvider,
} from "./types";
import {
  SEARCH_MANGA,
  ADVANCED_SEARCH_MANGA,
  GET_MANGA_BY_IDS,
  GET_USER_MANGA_LIST,
  GET_VIEWER,
} from "./queries";
import { debounce } from "@/utils/debounce";
import { withGroupAsync } from "@/utils/logging";
import { storage, STORAGE_KEYS } from "@/utils/storage";
import { calculateBackoff } from "@/utils/retry";
import { isTransientError as checkIsTransientError } from "@/utils/network";
import {
  createError,
  captureError,
  ErrorType,
  ErrorRecoveryAction,
} from "@/utils/errorHandling";

/**
 * Rate limit error indicating request quota exceeded.
 * @source
 */
interface RateLimitError extends Error {
  status: number;
  isRateLimited: true;
  retryAfter: number;
}

/**
 * In-memory search result cache with timestamp tracking.
 * @source
 */
interface Cache<T> {
  [key: string]: {
    data: T;
    timestamp: number;
  };
}

/**
 * Cache expiration time in milliseconds (30 minutes).
 * @source
 */
const CACHE_EXPIRATION = 30 * 60 * 1000;

/**
 * Local search result cache for the renderer process to minimize IPC calls.
 * @source
 */
const searchCache: Cache<SearchResult<AniListManga>> = {};

/**
 * Flag indicating whether the search cache has been initialized from storage.
 * @source
 */
let searchCacheInitialized = false;

/**
 * Loads the search cache from storage if available and not yet initialized.
 * Merges only non-expired entries into the in-memory cache.
 * @source
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
    const cachedData = storage.getItem(STORAGE_KEYS.ANILIST_SEARCH_CACHE);

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
      `[AniListClient] 💾 Loaded ${loadedCount} cached search results from storage`,
    );

    try {
      const event = new CustomEvent("anilist:search-cache-initialized", {
        detail: { count: loadedCount },
      });
      globalThis.dispatchEvent(event);
      console.debug(`[AniListClient] 📤 Dispatched cache initialization event`);
    } catch (e) {
      captureError(
        ErrorType.SYSTEM,
        "Failed to dispatch cache initialization event",
        e instanceof Error ? e : new Error(String(e)),
        { count: loadedCount },
      );
    }
  } catch (error) {
    captureError(
      ErrorType.STORAGE,
      "Error loading search cache from storage",
      error instanceof Error ? error : new Error(String(error)),
      { operation: "loadSearchCache" },
    );
  }
}

/**
 * Persists the search cache to storage internally without debouncing.
 * @source
 */
function persistSearchCacheInternal(): void {
  try {
    const serialized = JSON.stringify(searchCache);
    storage.setItem(STORAGE_KEYS.ANILIST_SEARCH_CACHE, serialized);
    console.debug(
      `[AniListClient] 💾 Persisted search cache (${serialized.length} bytes)`,
    );
  } catch (error) {
    captureError(
      ErrorType.STORAGE,
      "Error saving search cache to storage",
      error instanceof Error ? error : new Error(String(error)),
      { operation: "persistSearchCache" },
    );
  }
}

/**
 * Debounced version of persistSearchCache that batches writes to storage.
 * Waits 2 seconds after the last call before persisting.
 * @source
 */
const persistSearchCache = debounce(persistSearchCacheInternal, 2000);

/**
 * Immediately persists the search cache, bypassing debounce.
 * Use for critical saves like cache clearing or app shutdown.
 * @source
 */
function persistSearchCacheImmediate(): void {
  persistSearchCacheInternal();
}

// Initialize the cache when the module loads
initializeSearchCache();

/**
 * Constructs request options with headers and body for GraphQL requests.
 * @param query - GraphQL query or mutation string.
 * @param variables - Optional query variables.
 * @param token - Optional Bearer token for authentication.
 * @param abortSignal - Optional AbortSignal to cancel the request.
 * @returns RequestInit object configured for GraphQL POST request.
 * @source
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
 * Handles GraphQL requests via Electron IPC to the main process.
 *
 * The IPC call automatically includes retry logic (up to 5 attempts for transient errors).
 * If we reach this point and the request fails, it means the IPC layer has already exhausted all retry attempts.
 *
 * @param requestId - Unique identifier for tracking this request in logs.
 * @param query - The GraphQL query or mutation string.
 * @param variables - Optional variables for the query.
 * @param token - Optional authentication token.
 * @param bypassCache - Optional flag to bypass the main process cache.
 * @param abortSignal - Optional signal to abort the request.
 * @param noRetry - If true, disable internal retry logic.
 * @returns Promise resolving to the API response.
 * @source
 */
async function handleElectronRequest<T>(
  requestId: string,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
  bypassCache?: boolean,
  abortSignal?: AbortSignal,
  noRetry?: boolean,
): Promise<AniListResponse<T>> {
  const startTime = performance.now();
  let succeeded = false;
  try {
    // Use the correct call format for the main process with typed AniListRequest payload
    const response = await globalThis.electronAPI.anilist.request({
      query,
      variables,
      token,
      cacheControl: { bypassCache },
      noRetry,
    });

    // Check for abort before returning the response
    if (abortSignal?.aborted) {
      throw new DOMException("The operation was aborted", "AbortError");
    }

    succeeded = true;
    return response as AniListResponse<T>;
  } catch (error) {
    // Extract operation name for context
    const endpoint = extractOperationEndpoint({
      body: JSON.stringify({ query }),
    } as RequestInit);

    // Capture error in Sentry with context
    captureError(
      ErrorType.NETWORK,
      `AniList IPC request failed: ${endpoint}`,
      error instanceof Error ? error : new Error(String(error)),
      {
        requestId,
        endpoint,
      },
    );

    throw error;
  } finally {
    const duration = performance.now() - startTime;
    if (typeof globalThis.dispatchEvent === "function") {
      // Extract operation name or root field from query for better diagnostics
      let endpoint = "unknown";

      // First try to extract named operation (e.g., "query BatchSearchManga { ... }")
      const operationRegex = /(?:query|mutation)\s+(\w+)/i;
      const operationMatch = operationRegex.exec(query);
      if (operationMatch?.[1]) {
        endpoint = operationMatch[1];
      } else {
        // Fallback: extract first root field after the opening brace
        // Handles queries like: query ($vars) { Page(...) } or query { Viewer {...} }
        const fieldRegex = /(?:query|mutation)\s*(?:\([^)]*\))?\s*\{\s*(\w+)/i;
        const fieldMatch = fieldRegex.exec(query);
        if (fieldMatch?.[1]) {
          const rootField = fieldMatch[1];
          // Map root fields to meaningful operation names
          const operationMap: Record<string, string> = {
            Viewer: "GetViewer",
            MediaListCollection: "GetUserMangaList",
            Page: "SearchManga", // Could be search or batch get
            Media: "GetMangaById",
            SaveMediaListEntry: "UpdateMangaEntry",
            DeleteMediaListEntry: "DeleteMangaEntry",
          };
          endpoint = operationMap[rootField] || rootField;
        }
      }

      globalThis.dispatchEvent(
        new CustomEvent("anilist:request:completed", {
          detail: {
            duration,
            succeeded,
            requestId,
            provider: ApiProvider.ANILIST,
            endpoint,
          },
        }),
      );
    }
  }
}

/**
 * Processes HTTP error responses, detecting and handling rate limiting.
 * Dispatches custom event on rate limit (429) status.
 * @param requestId - Unique identifier for tracking this error in logs.
 * @param response - The HTTP response object.
 * @returns Promise that never resolves (always throws).
 * @source
 */
async function processHttpError(
  requestId: string,
  response: Response,
): Promise<never> {
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
      const rateLimitError = new Error(
        `Failed to dispatch rate limit event: ${String(e)}`,
      );
      captureError(
        ErrorType.SYSTEM,
        "Failed to dispatch rate limit event",
        rateLimitError,
        { requestId, status: response.status },
      );
    }

    const message = `Rate limit exceeded. Please retry after ${retrySeconds} seconds.`;
    const error = createError(
      ErrorType.NETWORK,
      message,
      new Error(message),
      "RATE_LIMIT_EXCEEDED",
      ErrorRecoveryAction.WAIT_RATE_LIMIT,
      `Retry after ${retrySeconds} seconds`,
    );

    captureError(ErrorType.NETWORK, message, new Error(message), {
      requestId,
      status: 429,
      retryAfter: retrySeconds,
    });

    throw error;
  }

  // Map HTTP status codes to ErrorType
  let errorType: ErrorType;
  if (response.status === 401 || response.status === 403) {
    errorType = ErrorType.AUTH;
  } else if (response.status >= 500) {
    errorType = ErrorType.SERVER;
  } else if (response.status >= 400) {
    errorType = ErrorType.CLIENT;
  } else {
    errorType = ErrorType.NETWORK;
  }

  const message = `HTTP Error ${response.status}: ${response.statusText}`;
  const error = createError(
    errorType,
    message,
    new Error(message),
    `HTTP_${response.status}`,
  );

  captureError(errorType, message, new Error(message), {
    requestId,
    status: response.status,
    statusText: response.statusText,
  });

  throw error;
}

/**
 * Extract operation endpoint name from GraphQL query for telemetry.
 * Maps GraphQL operation names to user-friendly endpoint names.
 * @param options - RequestInit containing the GraphQL query in body.
 * @returns Normalized endpoint name or "unknown".
 * @source
 */
function extractOperationEndpoint(options: RequestInit): string {
  let endpoint = "unknown";
  if (options.body && typeof options.body === "string") {
    try {
      const body = JSON.parse(options.body);
      const query = body.query || "";
      const operationRegex = /(?:query|mutation)\s+(\w+)/i;
      const operationMatch = operationRegex.exec(query);
      if (operationMatch?.[1]) {
        endpoint = operationMatch[1];
      } else {
        const fieldRegex = /(?:query|mutation)\s*(?:\([^)]*\))?\s*\{\s*(\w+)/i;
        const fieldMatch = fieldRegex.exec(query);
        if (fieldMatch?.[1]) {
          const operationMap: Record<string, string> = {
            Viewer: "GetViewer",
            MediaListCollection: "GetUserMangaList",
            Page: "SearchManga",
            Media: "GetMangaById",
            SaveMediaListEntry: "UpdateMangaEntry",
            DeleteMediaListEntry: "DeleteMangaEntry",
          };
          endpoint = operationMap[fieldMatch[1]] || fieldMatch[1];
        }
      }
    } catch {
      // Silently fail
    }
  }
  return endpoint;
}

/**
 * Get retry delay from Retry-After header if present, otherwise returns null.
 * Handles both delay-in-seconds and HTTP-date formats per RFC 9110.
 * @param response - HTTP response object potentially containing Retry-After header.
 * @returns Delay in milliseconds or null if header absent.
 * @source
 */
function getRetryAfterDelay(response: Response): number | null {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) {
    return null;
  }
  const seconds = Number.parseInt(retryAfter, 10);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }
  const retryDate = new Date(retryAfter);
  if (!Number.isNaN(retryDate.getTime())) {
    return Math.max(0, retryDate.getTime() - Date.now());
  }
  return null;
}

/**
 * Handle a successful browser response and dispatch telemetry event.
 * Logs GraphQL errors if present in response despite successful HTTP status.
 * @param requestId - Unique identifier for tracking this request in logs.
 * @param jsonResponse - Parsed JSON response from AniList API.
 * @param options - Original RequestInit for extracting operation endpoint.
 * @param duration - Request duration in milliseconds.
 * @returns The response object unchanged.
 * @source
 */
function handleSuccessResponse<T>(
  requestId: string,
  jsonResponse: AniListResponse<T>,
  options: RequestInit,
  duration: number,
): AniListResponse<T> {
  // Check for GraphQL errors
  if (jsonResponse.errors) {
    console.error(
      `[AniListClient] ⚠️ [${requestId}] GraphQL Errors:`,
      jsonResponse.errors,
    );
  }

  // Dispatch completion event
  if (typeof globalThis.dispatchEvent === "function") {
    const endpoint = extractOperationEndpoint(options);
    globalThis.dispatchEvent(
      new CustomEvent("anilist:request:completed", {
        detail: {
          duration,
          succeeded: true,
          requestId,
          provider: ApiProvider.ANILIST,
          endpoint,
        },
      }),
    );
  }

  return jsonResponse;
}

/**
 * Handle a failed browser response and dispatch telemetry event.
 * Always throws an error; never returns normally.
 * @param requestId - Unique identifier for tracking this request in logs.
 * @param options - Original RequestInit for extracting operation endpoint.
 * @param duration - Request duration in milliseconds.
 * @param error - The error that caused the failure.
 * @throws {Error} Always re-throws the provided error after logging.
 * @source
 */
function handleFailureResponse(
  requestId: string,
  options: RequestInit,
  duration: number,
  error: unknown,
): never {
  const endpoint = extractOperationEndpoint(options);

  if (typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(
      new CustomEvent("anilist:request:completed", {
        detail: {
          duration,
          succeeded: false,
          requestId,
          provider: ApiProvider.ANILIST,
          endpoint,
        },
      }),
    );
  }

  captureError(
    ErrorType.NETWORK,
    `AniList API request failed: ${endpoint}`,
    error instanceof Error ? error : new Error(String(error)),
    {
      requestId,
      endpoint,
      durationMs: duration,
    },
  );

  throw error;
}

async function handleBrowserRequest<T>(
  requestId: string,
  options: RequestInit,
): Promise<AniListResponse<T>> {
  /**
   * Maximum retry attempts for transient failures.
   */
  const MAX_RETRIES = 5;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startTime = performance.now();

    try {
      const response = await fetch("https://graphql.anilist.co", options);

      // Handle transient errors with retry
      if (
        !response.ok &&
        checkIsTransientError(response) &&
        attempt < MAX_RETRIES
      ) {
        const retryAfterDelay = getRetryAfterDelay(response);
        const delayMs = retryAfterDelay ?? calculateBackoff(attempt);

        // Emit event for rate-limit coordination if 429
        if (
          response.status === 429 &&
          typeof globalThis.dispatchEvent === "function"
        ) {
          globalThis.dispatchEvent(
            new CustomEvent("ratelimit:retry-after", {
              detail: {
                retryAfterMs: delayMs,
                retryAfterSeconds: Math.ceil(delayMs / 1000),
              },
            }),
          );
        }

        console.warn(
          `[AniListClient] ⚠️ [${requestId}] Transient error (HTTP ${response.status}), retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // Unrecoverable HTTP error
      if (!response.ok) {
        await processHttpError(requestId, response);
      }

      const jsonResponse = await response.json();
      const duration = performance.now() - startTime;
      return handleSuccessResponse(requestId, jsonResponse, options, duration);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = performance.now() - startTime;

      // Retry transient errors unless last attempt
      if (checkIsTransientError(error) && attempt < MAX_RETRIES) {
        const delayMs = calculateBackoff(attempt);
        console.warn(
          `[AniListClient] ⚠️ [${requestId}] Network error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`,
          lastError.message,
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      handleFailureResponse(requestId, options, duration, error);
    }
  }

  throw lastError || new Error("[AniListClient] Unknown error during request");
}

/**
 * Make a request to the AniList API.
 *
 * Supports dynamic mutations where variable declarations may change based on the variables object passed. Handles both browser and Electron environments.
 *
 * @remarks
 * Retry logic is handled automatically by the IPC layer for Electron environments. Transient errors (network failures, 5xx responses, rate limits) are automatically retried with exponential backoff. Maximum 5 retry attempts with jitter to prevent thundering herd. Rate limits are respected via retry-after headers.
 *
 * @param query - The GraphQL query or mutation string.
 * @param variables - Optional variables for the query.
 * @param token - Optional authentication token.
 * @param abortSignal - Optional abort signal to cancel the request.
 * @param bypassCache - Optional flag to bypass cache.
 * @param noRetry - If true, disable internal retry logic (external retry layer will handle retries).
 * @returns A promise resolving to an AniListResponse object.
 * See api-listeners.ts for retry implementation
 * @source
 */
export async function request<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
  abortSignal?: AbortSignal,
  bypassCache?: boolean,
  noRetry?: boolean,
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
      noRetry,
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
 * Generates a unique cache key from search parameters and options.
 * @param search - Search query string.
 * @param page - Page number (default: 1).
 * @param perPage - Results per page (default: 50).
 * @param additionalParams - Optional additional parameters for key generation.
 * @returns Cache key string.
 * @source
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
 * Checks if a cache entry exists and has not expired.
 * @param cache - The cache object to check.
 * @param key - Cache key to validate.
 * @returns true if entry exists and is not expired, false otherwise.
 * @source
 */
function isCacheValid<T>(cache: Cache<T>, key: string): boolean {
  const entry = cache[key];
  if (!entry) return false;

  const now = Date.now();
  return now - entry.timestamp < CACHE_EXPIRATION;
}

/**
 * Options for executing a search query with cache control.
 * @source
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
  noRetry?: boolean;
}

/**
 * Executes a search query with caching and error handling.
 * Shared logic for both basic and advanced search operations.
 * @param options - Search query configuration including query, variables, and cache settings.
 * @returns Promise resolving to search results with pagination.
 * @source
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
    noRetry = false,
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
    }>(query, variables, token, undefined, bypassCache, noRetry);

    console.debug(`[AniListClient] 🔍 ${searchType} response:`, response);

    // Validate response structure
    if (!response?.data) {
      const error = createError(
        ErrorType.VALIDATION,
        `Invalid API response for ${searchType.toLowerCase()} "${search}": missing data property`,
        new Error("Missing data property in API response"),
      );
      captureError(
        ErrorType.VALIDATION,
        `Invalid API response for ${searchType.toLowerCase()}`,
        new Error("Missing data property in API response"),
        { searchType, search },
      );
      throw error;
    }

    // Handle nested data structure
    const responseData = response.data.data ?? response.data;

    if (!responseData.Page) {
      const error = createError(
        ErrorType.VALIDATION,
        `Invalid API response for ${searchType.toLowerCase()} "${search}": missing Page property`,
        new Error("Missing Page property in API response"),
      );
      captureError(
        ErrorType.VALIDATION,
        `Invalid API response for ${searchType.toLowerCase()}`,
        new Error("Missing Page property in API response"),
        { searchType, search },
      );
      throw error;
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
 * Search for manga on AniList by title.
 * Results are cached for 30 minutes to minimize API calls.
 * @param search - Search query string.
 * @param page - Results page number (default: 1).
 * @param perPage - Results per page (default: 50).
 * @param token - Optional access token for authenticated requests.
 * @param bypassCache - Skip cache and fetch from API (default: false).
 * @param noRetry - Disable automatic retry logic (default: false).
 * @returns Promise resolving to paginated search results.
 * @source
 */
export async function searchManga(
  search: string,
  page: number = 1,
  perPage: number = 50,
  token?: string,
  bypassCache?: boolean,
  noRetry?: boolean,
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
    noRetry,
  });
}

/**
 * Batch search for multiple manga titles in a single GraphQL request.
 * More efficient than individual searches when matching multiple titles.
 * @param searches - Array of search queries with alias, title, and index.
 * @param options - Configuration including auth token, page size, abort signal.
 * @returns Promise resolving to map of search results keyed by alias.
 * @source
 */
export async function batchSearchManga(
  searches: Array<{ alias: string; title: string; index: number }>,
  options: {
    token?: string;
    perPage?: number;
    abortSignal?: AbortSignal;
    noRetry?: boolean;
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
  return withGroupAsync(
    `[AniListClient] Batch Search (${searches.length} queries)`,
    async () => {
      if (searches.length === 0) {
        return new Map();
      }

      const { token, perPage = 10, abortSignal, noRetry } = options;

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
        description
        genres
        tags {
          id
          name
          category
        }
        countryOfOrigin
        source
        staff {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
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
          noRetry,
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
        captureError(
          ErrorType.NETWORK,
          `Error in batch search for ${searches.length} queries`,
          error instanceof Error ? error : new Error(String(error)),
          { queryCount: searches.length },
        );

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
    },
  );
}

/**
 * Advanced search for manga using the AniList dedicated search endpoint.
 * Results are cached for 30 minutes to minimize API calls.
 * @param search - Search query string.
 * @param page - Results page number (default: 1).
 * @param perPage - Results per page (default: 50).
 * @param token - Optional access token for authenticated requests.
 * @param bypassCache - Skip cache and fetch from API (default: false).
 * @param noRetry - Disable automatic retry logic (default: false).
 * @returns Promise resolving to paginated search results.
 * @source
 */
export async function advancedSearchManga(
  search: string,
  page: number = 1,
  perPage: number = 50,
  token?: string,
  bypassCache?: boolean,
  noRetry?: boolean,
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
    noRetry,
  });
}

/**
 * Clear the search cache entirely or for specific queries.
 * Persists the cleared cache to storage and notifies main process.
 * @param searchQuery - Optional query to clear only matching entries; clears all if omitted.
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

  // Update storage with the cleared cache immediately (critical operation)
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
 * Get multiple manga by their AniList media IDs.
 * Returns results in original order matching input array.
 * @param ids - Array of AniList manga media IDs.
 * @param token - Optional access token for authenticated requests.
 * @param abortSignal - Optional AbortSignal to cancel the request.
 * @param noRetry - Disable automatic retry logic (default: false).
 * @returns Promise resolving to array of AniListManga objects.
 * @source
 */
export async function getMangaByIds(
  ids: number[],
  token?: string,
  abortSignal?: AbortSignal,
  noRetry?: boolean,
): Promise<AniListManga[]> {
  return withGroupAsync(
    `[AniListClient] Get Manga (${ids.length} IDs)`,
    async () => {
      if (!ids.length) {
        return [];
      }

      try {
        // Updated type parameter to handle potential nested data structure
        const response = await request<{
          data?: { Page: { media: AniListManga[] } };
          Page?: { media: AniListManga[] };
        }>(GET_MANGA_BY_IDS, { ids }, token, abortSignal, undefined, noRetry);

        // Validate response structure
        if (!response?.data) {
          console.error(
            `[AniListClient] ❌ Invalid API response when fetching manga by IDs:`,
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
    },
  );
}

/**
 * Constructs a RateLimitError with retry metadata.
 * Used internally to standardize rate limit error creation.
 * @param message - Error message describing the rate limit.
 * @param status - HTTP status code (typically 429).
 * @param retryAfter - Seconds to wait before retrying.
 * @returns RateLimitError object.
 * @source
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
 * Detects rate limit errors from HTTP status and error object flags.
 * Returns null if no rate limit detected.
 * @param errorObj - Error object with optional status, isRateLimited, retryAfter properties.
 * @returns RateLimitError if detected, null otherwise.
 * @source
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
 * Detects rate limit errors from error message text patterns.
 * Extracts retry duration from message if present.
 * @param errorObj - Error object with message property.
 * @returns RateLimitError if rate limit detected in message, null otherwise.
 * @source
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
 * Gets the current authenticated user's manga list from AniList.
 * Fetches the complete collection in chunks if needed.
 * Detects and propagates rate limit errors to the caller.
 * @param token - The user's access token.
 * @param abortSignal - Optional AbortSignal to cancel the request.
 * @param noRetry - Disable automatic retry logic (default: false).
 * @returns Promise resolving to user's manga list keyed by media ID.
 * @throws {Error} On network failure, auth failure, or rate limiting.
 * @source
 */
export async function getUserMangaList(
  token: string,
  abortSignal?: AbortSignal,
  noRetry?: boolean,
): Promise<UserMediaList> {
  return withGroupAsync(`[AniListClient] Get User Manga List`, async () => {
    if (!token) {
      const error = createError(
        ErrorType.AUTH,
        "Access token required to fetch user manga list",
        new Error("Missing access token"),
      );
      captureError(
        ErrorType.AUTH,
        "Access token required to fetch user manga list",
        new Error("Missing access token"),
      );
      throw error;
    }

    try {
      // Get the user's ID first
      const viewerId = await getAuthenticatedUserID(token, abortSignal);
      console.debug(
        "[AniListClient] ✅ Successfully retrieved user ID:",
        viewerId,
      );

      if (!viewerId) {
        const error = createError(
          ErrorType.VALIDATION,
          "Failed to get your AniList user ID",
          new Error("User ID resolution failed"),
        );
        captureError(
          ErrorType.VALIDATION,
          "Failed to get AniList user ID",
          new Error("User ID resolution failed"),
        );
        throw error;
      }

      // Fetch all manga lists using multiple chunks if needed
      return await fetchCompleteUserMediaList(
        viewerId,
        token,
        abortSignal,
        noRetry,
      );
    } catch (error: unknown) {
      // Early return if error is not an object
      if (!error || typeof error !== "object") {
        captureError(
          ErrorType.UNKNOWN,
          "Unknown error fetching user manga list",
          error instanceof Error ? error : new Error(String(error)),
        );
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
  });
}

/**
 * Retrieves the authenticated user's AniList user ID.
 * Tries multiple approaches to extract ID from different response formats.
 * @param token - User's access token.
 * @param abortSignal - Optional signal to abort the request.
 * @returns Promise resolving to user's AniList ID or undefined if not found.
 * @throws {Error} On network failure or auth error.
 * @source
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
 * Single user media entry with metadata for display.
 * Contains ID, status, progress, and score information.
 * @source
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
 * Collection of media lists organized by status categories.
 * Contains arrays of entries grouped by collection status.
 * @source
 */
interface MediaListCollection {
  lists: Array<{
    name: string;
    entries: Array<MediaListEntry>;
  }>;
}

/**
 * API response structure for MediaListCollection queries.
 * Handles multiple nesting levels from different response formats.
 * @source
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
 * Extracts MediaListCollection from potentially nested API response.
 * Handles multiple nesting levels from different response formats.
 * @param response - API response potentially containing MediaListCollection.
 * @returns MediaListCollection if found, null otherwise.
 * @source
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
 * Handles errors during chunk fetching, detecting rate limits.
 * Returns control if partial data exists; re-throws for rate limits.
 * @param error - Error that occurred during fetch.
 * @param currentChunk - Chunk number that failed.
 * @param mediaMap - Accumulated media map to check for partial data.
 * @returns false to stop fetching, true to continue.
 * @throws {Error} For rate limits or if no partial data available.
 * @source
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
      captureError(
        ErrorType.NETWORK,
        `Rate limit encountered on chunk ${currentChunk}`,
        error instanceof Error ? error : new Error(String(error)),
        { chunk: currentChunk, isRateLimit: true },
      );
      // Propagate rate limit error to be handled by the UI
      throw error;
    }
  }

  // For other errors, log and continue if we have some data
  captureError(
    ErrorType.NETWORK,
    `Error fetching chunk ${currentChunk}`,
    error instanceof Error ? error : new Error(String(error)),
    { chunk: currentChunk, hasData: Object.keys(mediaMap).length > 0 },
  );

  // If we have no data, propagate the error
  if (Object.keys(mediaMap).length === 0) {
    throw error;
  }

  // Return false to break the loop and return what we have so far
  return false;
}

/**
 * Determines if additional chunks should be fetched based on current chunk size.
 * Returns false when chunk size is below the per-chunk limit (indicating last page).
 * @param chunkEntryCount - Number of entries returned in current chunk.
 * @param perChunk - Maximum entries expected per chunk.
 * @returns true if more chunks needed, false if reached the end.
 * @source
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
 * Fetches and processes a single page of the user's media list.
 * Updates mediaMap with entries from the fetched chunk.
 * @param userId - The user's AniList ID.
 * @param currentChunk - Chunk number to fetch (1-indexed).
 * @param perChunk - Maximum entries per chunk.
 * @param token - User's access token.
 * @param abortSignal - Optional signal to abort the request.
 * @param mediaMap - Map to populate with entries from this chunk.
 * @param noRetry - Disable automatic retry logic (default: false).
 * @returns Number of entries processed from this chunk.
 * @source
 */
async function fetchAndProcessChunk(
  userId: number,
  currentChunk: number,
  perChunk: number,
  token: string,
  abortSignal: AbortSignal | undefined,
  mediaMap: UserMediaList,
  noRetry?: boolean,
): Promise<number> {
  console.debug(
    `[AniListClient] 📥 Fetching chunk ${currentChunk} (${perChunk} entries per chunk)...`,
  );

  const response = await request<MediaListCollectionResponse>(
    GET_USER_MANGA_LIST,
    { userId, chunk: currentChunk, perChunk },
    token,
    abortSignal,
    undefined,
    noRetry,
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
 * Fetches the complete user media list using pagination with multiple chunks.
 * Returns partial results if errors occur after some data is fetched.
 * @param userId - The user's AniList ID.
 * @param token - User's access token.
 * @param abortSignal - Optional signal to abort the request.
 * @param noRetry - Disable automatic retry logic (default: false).
 * @returns Promise resolving to map of mediaId to UserMediaEntry.
 * @source
 */
async function fetchCompleteUserMediaList(
  userId: number,
  token: string,
  abortSignal?: AbortSignal,
  noRetry?: boolean,
): Promise<UserMediaList> {
  return withGroupAsync(
    `[AniListClient] Fetch Complete User Media List`,
    async () => {
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
              noRetry,
            );

            totalEntriesProcessed += chunkEntryCount;

            // Check if we need to fetch more chunks
            if (!shouldFetchNextChunk(chunkEntryCount, perChunk)) {
              break;
            }

            currentChunk++;
          } catch (error: unknown) {
            // Handle chunk error and determine if we should continue
            const shouldContinue = handleChunkError(
              error,
              currentChunk,
              mediaMap,
            );
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
        captureError(
          ErrorType.NETWORK,
          `Error fetching manga list in chunks (processed ${totalEntriesProcessed} entries so far)`,
          error instanceof Error ? error : new Error(String(error)),
          {
            userId,
            processedEntries: totalEntriesProcessed,
            lastChunk: currentChunk,
          },
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
    },
  );
}

/**
 * Processes a chunk of MediaListCollection entries into the media map.
 * Entries are keyed by mediaId for O(1) lookup.
 * @param mediaListCollection - The media list collection to process.
 * @param mediaMap - Map to populate with entries from this chunk.
 * @returns Number of entries successfully processed.
 * @source
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

/**
 * Test utilities for internal cache and fetch functions.
 * @source
 */
export const __test__ = {
  initializeSearchCache,
  persistSearchCache: persistSearchCache as unknown,
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
