/**
 * @packageDocumentation
 * @module api_listeners
 * @description Registers IPC event listeners for AniList API requests, token exchange, cache, and shell actions in the Electron main process.
 */

import { BrowserWindow, shell } from "electron";
import { secureHandle } from "../listeners-register";
import fetch, { Response } from "node-fetch";
import { createHash } from "node:crypto";
import { getAppVersionElectron } from "../../../utils/app-version";
import { withGroupAsync } from "../../../utils/logging";
import { AniListRequest } from "./api-context";
import type { ShellOperationResult } from "../types";
import { SAFE_REQUESTS_PER_MINUTE } from "../../../config/anilist";
import type { MangaSource } from "../../../api/manga-sources/types";

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

// API request rate limiting (using safe rate from config)
const API_RATE_LIMIT = SAFE_REQUESTS_PER_MINUTE; // Safe headroom below AniList's 60 req/min
const REQUEST_INTERVAL = (60 * 1000) / API_RATE_LIMIT; // milliseconds between requests
const MAX_RETRY_ATTEMPTS = 5; // Maximum number of retry attempts for rate limited requests
const MAX_BACKOFF_MS = 60000; // 60 seconds maximum backoff to prevent long queue starvation

/**
 * Simple promise-based mutex for serializing state updates.
 * Ensures only one request can acquire the lock at a time.
 * @internal
 */
class Mutex {
  private locked = false;
  private readonly waiters: (() => void)[] = [];

  async lock(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.locked = true;
        resolve();
      });
    });
  }

  unlock(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter();
    } else {
      this.locked = false;
    }
  }
}

/**
 * Request queue item for batching and scheduling.
 * @internal
 */
interface QueuedRequest {
  execute: () => Promise<Record<string, unknown>>;
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: unknown) => void;
}

/**
 * Rate-limited request queue with proper concurrency control and spacing.
 * Ensures REQUEST_INTERVAL between dequeues and propagates retry-after signals.
 * @internal
 */
class RequestQueue {
  private readonly queue: QueuedRequest[] = [];
  private processing = false;
  private lastDequeueTime = 0;
  private rateLimitResetTime = 0;
  private readonly mutex = new Mutex();

  /**
   * Enqueue a request for execution with rate limiting.
   */
  enqueue(
    execute: () => Promise<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const wasEmpty = this.queue.length === 0;
      this.queue.push({ execute, resolve, reject });

      // If queue was empty and not processing, schedule processing
      if (wasEmpty && !this.processing) {
        this.processQueue().catch(reject);
      }
    });
  }

  /**
   * Update rate limit reset time (called when 429 response received).
   */
  updateRetryAfter(resetTime: number): void {
    this.rateLimitResetTime = Math.max(this.rateLimitResetTime, resetTime);
  }

  /**
   * Get current rate limit reset time.
   */
  getRateLimitResetTime(): number {
    return this.rateLimitResetTime;
  }

  /**
   * Get current queue size for diagnostics.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is currently processing.
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Process the queue with proper rate limiting and spacing.
   * Micro-batches requests to prevent starvation under continuous enqueue.
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    await this.mutex.lock();
    try {
      this.processing = true;

      const MAX_ITERATION_TIME_MS = 250; // Target max 250ms per iteration to allow other tasks
      const iterationStartTime = Date.now();

      while (this.queue.length > 0) {
        // Check if rate limited and wait if needed
        const now = Date.now();
        if (now < this.rateLimitResetTime) {
          const waitTime = this.rateLimitResetTime - now;
          console.warn(
            `[ApiIPC] Rate limited, waiting ${Math.round(waitTime / 1000)}s before processing queue (queue length: ${this.queue.length})`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        // Enforce REQUEST_INTERVAL spacing between dequeues
        const timeSinceLastDequeue = Date.now() - this.lastDequeueTime;
        if (
          this.lastDequeueTime > 0 &&
          timeSinceLastDequeue < REQUEST_INTERVAL
        ) {
          const waitTime = REQUEST_INTERVAL - timeSinceLastDequeue;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        const item = this.queue.shift();
        if (!item) break;

        this.lastDequeueTime = Date.now();

        try {
          const result = await item.execute();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }

        // Yield if iteration time exceeded to prevent blocking other tasks
        const elapsedTime = Date.now() - iterationStartTime;
        if (elapsedTime > MAX_ITERATION_TIME_MS && this.queue.length > 0) {
          console.debug(
            `[ApiIPC] Iteration time exceeded (${elapsedTime}ms), yielding (remaining: ${this.queue.length})`,
          );
          // Schedule next batch with a small delay (10ms) for micro-batching
          setTimeout(() => this.processQueue(), 10);
          return;
        }
      }

      // After loop, if new items arrived during processing, schedule next run
      if (this.queue.length > 0) {
        console.debug(
          `[ApiIPC] Queue has ${this.queue.length} remaining items, scheduling next batch`,
        );
        setTimeout(() => this.processQueue(), 10);
      }
    } finally {
      this.processing = false;
      this.mutex.unlock();
    }
  }
}

// Global request queue instance
const requestQueue = new RequestQueue();

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
 * Index mapping normalized search terms to their hashed cache keys.
 * Allows precise clearing of specific search queries without substring matching.
 * @internal
 */
const searchTermIndex = new Map<string, Set<string>>();

/**
 * Normalize a search term for indexing purposes.
 * @internal
 */
function normalizeSearchTerm(term: unknown): string {
  if (typeof term === "string") {
    return term.toLowerCase().trim();
  }
  return "";
}

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
 * Consults the request queue's reset time to determine if waiting is needed.
 * @internal
 */
async function handleRateLimit(): Promise<void> {
  const now = Date.now();
  const resetTime = requestQueue.getRateLimitResetTime();

  if (now < resetTime) {
    const waitTime = resetTime - now;
    console.warn(
      `[ApiIPC] Rate limited, waiting ${Math.round(waitTime / 1000)}s before retrying`,
    );
    await sleep(waitTime);
  }
}

/**
 * Safely extract search term from variables for logging purposes.
 * @internal
 */
function getSearchTermFromVariables(
  variables: Record<string, unknown> | undefined,
): string {
  if (!variables) return "request";

  const search = variables.search;

  // Primitive values
  if (typeof search === "string") return search;
  if (typeof search === "number" || typeof search === "boolean")
    return String(search);
  if (search == null) return "request";

  // Objects/arrays: try to extract a human-friendly field first
  if (typeof search === "object") {
    try {
      const s = search as Record<string, unknown>;
      if (typeof s.query === "string") return s.query;
      if (typeof s.title === "string") return s.title;
      if (typeof s.name === "string") return s.name;

      // Fallback to JSON with safe truncation
      const json = JSON.stringify(search);
      return json.length > 200 ? `${json.slice(0, 200)}…` : json;
    } catch (err) {
      // If JSON serialization fails, log at debug level and fall back
      console.debug(
        "[ApiIPC] Failed to stringify search variable for logging:",
        err,
      );
      return "request";
    }
  }

  return String(search);
}

/**
 * Handle 429 rate limit response with retry logic.
 * Uses exponential backoff capped at MAX_BACKOFF_MS with random jitter (±10%) to reduce queue starvation.
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

  const retryAfter = response.headers.get("Retry-After");
  let waitTime: number;

  if (retryAfter && !Number.isNaN(Number(retryAfter))) {
    waitTime = Number(retryAfter) * 1000;
    console.warn(
      `[ApiIPC] Rate limited with Retry-After header: ${retryAfter}s`,
    );
  } else {
    // Exponential backoff capped at MAX_BACKOFF_MS
    const baseBackoff = 5000 * Math.pow(2, retryCount);
    waitTime = Math.min(baseBackoff, MAX_BACKOFF_MS);

    // Add jitter (±10%) to reduce thundering herd
    const jitterPercent = 0.1;
    const jitterAmount = waitTime * jitterPercent * (Math.random() * 2 - 1);
    waitTime = Math.max(1000, waitTime + jitterAmount);

    console.warn(
      `[ApiIPC] Rate limited, using exponential backoff (capped): ${waitTime / 1000}s`,
    );
  }

  // Propagate retry-after to the request queue scheduler
  const resetTime = Date.now() + waitTime;
  requestQueue.updateRetryAfter(resetTime);

  const searchTerm = getSearchTermFromVariables(variables);
  console.warn(
    `[ApiIPC] Rate limited for "${searchTerm}", waiting ${Math.round(waitTime / 1000)}s before retry #${retryCount + 1} (queue length: ${requestQueue.size()})`,
  );
  await sleep(waitTime);

  return requestAniList(query, variables, token, retryCount + 1);
}

/**
 * Handle server error response with retry logic.
 * Uses exponential backoff capped at MAX_BACKOFF_MS with jitter to prevent queue starvation.
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

  // Exponential backoff capped at MAX_BACKOFF_MS
  const baseBackoff = 3000 * Math.pow(2, retryCount);
  let waitTime = Math.min(baseBackoff, MAX_BACKOFF_MS);

  // Add jitter (±10%) to reduce thundering herd
  const jitterPercent = 0.1;
  const jitterAmount = waitTime * jitterPercent * (Math.random() * 2 - 1);
  waitTime = Math.max(1000, waitTime + jitterAmount);

  const searchTerm = getSearchTermFromVariables(variables);
  console.warn(
    `[ApiIPC] Server error ${response.status} for "${searchTerm}", waiting ${Math.round(waitTime / 1000)}s before retry #${retryCount + 1}`,
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
    console.warn(
      `[ApiIPC] Network error, retrying in ${waitTime / 1000}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
    );
    await sleep(waitTime);
    return requestAniList(query, variables, token, retryCount + 1);
  }
  throw error;
}

/**
 * Make a GraphQL request to the AniList API.
 *
 * Requests are automatically queued and rate-limited with REQUEST_INTERVAL spacing.
 * The queue handles 429 rate limit responses and propagates retry-after signals.
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
  return requestQueue.enqueue(async () =>
    withGroupAsync(
      `[ApiIPC] Request Execution (attempt ${retryCount + 1})`,
      async () => {
        // Rate limiting and request timing handled by queue
        await handleRateLimit();

        const appVersion = await getAppVersionElectron();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": `KenmeiToAniList/${appVersion}`,
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
            return handleServerError(
              response,
              variables,
              retryCount,
              query,
              token,
            );
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
            return handleNetworkError(
              error,
              retryCount,
              query,
              variables,
              token,
            );
          }
          throw error;
        }
      },
    ),
  );
}

/**
 * Generate a cache key from search parameters using stable SHA-1 hash.
 * Uses full query and variables to avoid collisions across large queries.
 *
 * @param query - The GraphQL query string.
 * @param variables - The variables for the query.
 * @returns The generated cache key string (SHA-1 hex digest).
 * @internal
 * @source
 */
function generateCacheKey(
  query: string,
  variables: Record<string, unknown> = {},
): string {
  // Create a stable hash of full query and variables
  const cacheInput = JSON.stringify({ query, variables });
  const hash = createHash("sha1").update(cacheInput).digest("hex");
  return `cache_${hash}`;
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
 * @param mainWindow - The main application window for security validation
 * @source
 */
export function setupAniListAPI(mainWindow: BrowserWindow) {
  // Handle graphQL requests
  secureHandle(
    "anilist:request",
    async (_event: Electron.IpcMainInvokeEvent, payload: AniListRequest) => {
      const { query, variables, token, cacheControl } = payload;
      const bypassCache = cacheControl?.bypassCache ?? false;
      const searchTerm = getSearchTermFromVariables(variables);
      return withGroupAsync(
        `[ApiIPC] AniList Request: ${searchTerm}`,
        async () => {
          try {
            console.debug(
              "[ApiIPC] Handling AniList API request in main process",
            );

            // Check if it's a search request and if we should use cache
            const isSearchQuery = query.includes("Page(") && variables?.search;

            if (isSearchQuery && !bypassCache) {
              const cacheKey = generateCacheKey(query, variables);

              if (isCacheValid(searchCache, cacheKey)) {
                console.debug(
                  `[ApiIPC] Using cached search results for: ${variables.search}`,
                );
                return {
                  success: true,
                  data: searchCache[cacheKey].data,
                };
              }
            }

            if (isSearchQuery && bypassCache) {
              console.debug(
                `[ApiIPC] Bypassing cache for search: ${variables.search}`,
              );
            }

            const response = await requestAniList(query, variables, token);

            // Cache search results only if not bypassing cache
            if (isSearchQuery && response.data && !bypassCache) {
              const cacheKey = generateCacheKey(query, variables);
              searchCache[cacheKey] = {
                data: response,
                timestamp: Date.now(),
              };
              // Register the cache key in the search term index for precise clearing
              const normalizedTerm = normalizeSearchTerm(variables?.search);
              if (normalizedTerm) {
                if (!searchTermIndex.has(normalizedTerm)) {
                  searchTermIndex.set(normalizedTerm, new Set());
                }
                searchTermIndex.get(normalizedTerm)?.add(cacheKey);
              }
            }

            return {
              success: true,
              data: response,
            };
          } catch (error) {
            console.error("[ApiIPC] Error in anilist:request:", error);
            return {
              success: false,
              error,
            };
          }
        },
      );
    },
    mainWindow,
  );

  // Handle opening external links in the default browser
  secureHandle(
    "shell:openExternal",
    async (
      _event: Electron.IpcMainInvokeEvent,
      url: string,
    ): Promise<ShellOperationResult> => {
      try {
        console.debug(
          `[ApiIPC] Opening external URL in default browser: ${url}`,
        );

        // Validate URL using WHATWG URL parser
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          console.warn(`[ApiIPC] Invalid URL format: ${url}`);
          return {
            success: false,
            error: "Invalid URL format",
          };
        }

        // Enforce http: or https: schemes only
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          console.warn(
            `[ApiIPC] Rejected URL with non-HTTP(S) scheme: ${parsedUrl.protocol}//${parsedUrl.hostname}`,
          );
          return {
            success: false,
            error: "Invalid URL scheme. Only http: and https: are allowed",
          };
        }

        console.debug(
          `[ApiIPC] URL validated successfully: ${parsedUrl.hostname}`,
        );
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        console.error("[ApiIPC] Error opening external URL:", error);
        // Normalize error to string to avoid leaking raw Error objects
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    mainWindow,
  );

  // Clear search cache
  secureHandle(
    "anilist:clearCache",
    (_event: Electron.IpcMainInvokeEvent, searchQuery: string) => {
      if (searchQuery) {
        // Clear specific cache entries using the search term index for precision
        const normalizedTerm = normalizeSearchTerm(searchQuery);
        const keysToDelete = searchTermIndex.get(normalizedTerm);

        if (keysToDelete) {
          for (const key of keysToDelete) {
            delete searchCache[key];
          }
          searchTermIndex.delete(normalizedTerm);
          console.debug(
            `[ApiIPC] Cleared ${keysToDelete.size} cache entries for: "${normalizedTerm}"`,
          );
        } else {
          console.debug(
            `[ApiIPC] No cache entries found for: "${normalizedTerm}"`,
          );
        }
      } else {
        // Clear all cache
        const totalEntries = Object.keys(searchCache).length;
        for (const key of Object.keys(searchCache)) {
          delete searchCache[key];
        }
        searchTermIndex.clear();
        console.debug(
          `[ApiIPC] Cleared all cache entries (${totalEntries} total)`,
        );
      }

      return { success: true };
    },
    mainWindow,
  );

  // Get rate limit status from main process
  secureHandle(
    "anilist:getRateLimitStatus",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Electron.IpcMainInvokeEvent) => {
      const now = Date.now();
      const resetTime = requestQueue.getRateLimitResetTime();
      const isCurrentlyRateLimited = now < resetTime;

      return {
        isRateLimited: isCurrentlyRateLimited,
        retryAfter: isCurrentlyRateLimited ? resetTime : null,
        timeRemaining: isCurrentlyRateLimited
          ? Math.max(0, resetTime - now)
          : 0,
      };
    },
    mainWindow,
  );

  // Manga source API handlers (generic)
  secureHandle(
    "mangaSource:search",
    async (
      _event: Electron.IpcMainInvokeEvent,
      source: MangaSource,
      query: string,
      limit: number = 10,
    ) => {
      return withGroupAsync(
        `[ApiIPC] ${source} Search: "${query}"`,
        async () => {
          try {
            const { mangaSourceRegistry } = await import(
              "../../../api/manga-sources/registry"
            );

            console.info(
              `[ApiIPC] 🔍 ${source} API: Searching for "${query}" with limit ${limit}`,
            );

            const data = await mangaSourceRegistry.searchManga(
              source,
              query,
              limit,
            );

            console.info(
              `[ApiIPC] 📦 ${source} API: Found ${Array.isArray(data) ? data.length : 0} results for "${query}"`,
            );

            return data || [];
          } catch (error) {
            console.error(
              `[ApiIPC] ❌ ${source} search failed for "${query}":`,
              error,
            );
            throw error;
          }
        },
      );
    },
    mainWindow,
  );

  secureHandle(
    "mangaSource:getMangaDetail",
    async (
      _event: Electron.IpcMainInvokeEvent,
      source: MangaSource,
      slug: string,
    ) => {
      return withGroupAsync(
        `[ApiIPC] ${source} Detail: "${slug}"`,
        async () => {
          try {
            const { mangaSourceRegistry } = await import(
              "../../../api/manga-sources/registry"
            );

            console.info(
              `[ApiIPC] 📖 ${source} API: Getting manga details for "${slug}"`,
            );

            const data = await mangaSourceRegistry.getMangaDetail(source, slug);

            console.info(
              `[ApiIPC] 📖 ${source} API: Retrieved details for "${slug}"`,
            );

            return data || null;
          } catch (error) {
            console.error(
              `[ApiIPC] ❌ ${source} manga detail failed for "${slug}":`,
              error,
            );
            throw error;
          }
        },
      );
    },
    mainWindow,
  );
}
