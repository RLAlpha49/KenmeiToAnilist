/**
 * @packageDocumentation
 * @module manga-search-service
 * @description Manga search service for finding AniList matches for Kenmei manga. Handles searching, caching, and batch processing to optimize AniList API usage.
 */

import { KenmeiManga } from "../kenmei/types";
import {
  AniListManga,
  MangaMatchResult,
  MangaSearchResponse,
  SearchResult,
  PageInfo,
} from "../anilist/types";
import type { EnhancedAniListManga } from "../manga-sources/types";
import {
  searchManga,
  advancedSearchManga,
  getMangaByIds,
} from "../anilist/client";
import {
  normalizeString,
  findBestMatches,
  MatchEngineConfig,
  DEFAULT_MATCH_CONFIG,
} from "./match-engine";
import { calculateEnhancedSimilarity } from "../../utils/enhanced-similarity";
import { getMatchConfig } from "../../utils/storage";

// Titles to ignore during automatic matching (but allow in manual searches)
const IGNORED_AUTOMATIC_MATCH_TITLES = new Set([
  "watashi, isekai de dorei ni sarechaimashita (naki) shikamo goshujinsama wa seikaku no warui elf no joousama (demo chou bijin ← koko daiji) munou sugite nonoshiraremakuru kedo douryou no orc ga iyashi-kei da shi sato no elf wa kawaii shi",
]);

// Cache for manga search results
interface MangaCache {
  [key: string]: {
    manga: AniListManga[];
    timestamp: number;
  };
}

// Cache settings
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const mangaCache: MangaCache = {};

// Flag to prevent duplicate event listeners
let listenersRegistered = false;

// Track initialization status
let serviceInitialized = false;

/**
 * Initialize the manga search service
 * This will only run once regardless of how many times it's imported
 */
function initializeMangaService(): void {
  // Skip if already initialized
  if (serviceInitialized) {
    console.log(
      "Manga search service already initialized, skipping duplicate initialization",
    );
    return;
  }

  console.log("Initializing manga search service...");
  serviceInitialized = true;

  // Sync with client cache on initialization
  syncWithClientCache();

  // Set up event listeners
  if (globalThis.window !== undefined && !listenersRegistered) {
    listenersRegistered = true;

    globalThis.addEventListener("anilist:search-cache-initialized", () => {
      console.log(
        "Received search cache initialization event, syncing caches...",
      );
      syncWithClientCache();
    });

    // Listen for new search results to directly update our cache
    globalThis.addEventListener(
      "anilist:search-results-updated",
      (event: Event) => {
        if (event instanceof CustomEvent) {
          const { search, results, timestamp } = event.detail;

          if (search && results && Array.isArray(results)) {
            // Add each individual manga to our manga cache
            for (const manga of results) {
              if (manga.title) {
                // Cache by romaji title
                if (manga.title.romaji) {
                  const mangaKey = generateCacheKey(manga.title.romaji);
                  mangaCache[mangaKey] = {
                    manga: [manga],
                    timestamp: timestamp || Date.now(),
                  };
                }

                // Also cache by English title if available
                if (manga.title.english) {
                  const engKey = generateCacheKey(manga.title.english);
                  mangaCache[engKey] = {
                    manga: [manga],
                    timestamp: timestamp || Date.now(),
                  };
                }
              }
            }

            // Save the updated cache
            saveCache();
          }
        }
      },
    );
  }

  // Make the cache debugger available globally for troubleshooting
  if (globalThis.window !== undefined) {
    try {
      // Only define the property if it doesn't already exist
      if (!Object.hasOwn(globalThis, "__anilistCacheDebug")) {
        Object.defineProperty(globalThis, "__anilistCacheDebug", {
          value: cacheDebugger,
          writable: false,
          enumerable: false,
        });
        console.log(
          "AniList cache debugger available at globalThis.__anilistCacheDebug",
        );
      }
    } catch (e) {
      console.error("Error setting up cache debugger:", e);
    }
  }
}

// Initialize the service when this module is imported
initializeMangaService();

/**
 * Process and merge manga cache data from localStorage
 * @param cachedMangaData - JSON string containing cached manga data
 * @returns Number of manga entries loaded from cache
 */
function processMangaCache(cachedMangaData: string): number {
  try {
    const parsedCache = JSON.parse(cachedMangaData);
    let loadedCount = 0;

    // Merge with our in-memory cache and filter out Light Novels
    for (const key of Object.keys(parsedCache)) {
      if (
        !mangaCache[key] ||
        parsedCache[key].timestamp > mangaCache[key].timestamp
      ) {
        // Filter out Light Novels from the cached data
        const filteredManga = parsedCache[key].manga.filter(
          (manga: AniListManga) =>
            manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
        );

        mangaCache[key] = {
          manga: filteredManga,
          timestamp: parsedCache[key].timestamp,
        };
        loadedCount++;
      }
    }

    console.log(
      `Loaded ${Object.keys(parsedCache).length} cached manga from localStorage`,
    );
    return loadedCount;
  } catch (e) {
    console.error("Error parsing cached manga data:", e);
    return 0;
  }
}

/**
 * Process search cache entries and extract manga data
 * @param searchEntry - Search cache entry containing manga data and timestamp
 * @returns Number of manga entries imported from the search cache entry
 */
function processSearchCacheEntry(searchEntry: {
  data?: {
    Page?: {
      media?: AniListManga[];
    };
  };
  timestamp: number;
}): number {
  let importedCount = 0;

  // Only process valid entries
  if (!searchEntry?.data?.Page?.media?.length) {
    return 0;
  }

  const media = searchEntry.data.Page.media;

  // Generate a proper cache key for each manga title
  for (const manga of media) {
    if (!manga.title?.romaji) continue;

    const mangaKey = generateCacheKey(manga.title.romaji);

    // If we don't have this manga in cache, or it's newer, add it
    if (
      !mangaCache[mangaKey] ||
      searchEntry.timestamp > mangaCache[mangaKey].timestamp
    ) {
      mangaCache[mangaKey] = {
        manga: [manga],
        timestamp: searchEntry.timestamp,
      };
      importedCount++;
    }

    // Also try with English title if available
    if (manga.title.english) {
      const engKey = generateCacheKey(manga.title.english);
      if (
        !mangaCache[engKey] ||
        searchEntry.timestamp > mangaCache[engKey].timestamp
      ) {
        mangaCache[engKey] = {
          manga: [manga],
          timestamp: searchEntry.timestamp,
        };
        importedCount++;
      }
    }
  }

  return importedCount;
}

/**
 * Process search cache data from localStorage
 * @param cachedSearchData - JSON string containing cached search data
 */
function processSearchCache(cachedSearchData: string): void {
  try {
    const parsedSearchCache = JSON.parse(cachedSearchData);
    let totalImportedCount = 0;

    // Extract manga from search results and add to manga cache
    for (const key of Object.keys(parsedSearchCache)) {
      const searchEntry = parsedSearchCache[key];
      totalImportedCount += processSearchCacheEntry(searchEntry);
    }

    if (totalImportedCount > 0) {
      console.log(
        `Imported ${totalImportedCount} manga entries from search cache to manga cache`,
      );
      // Save the updated cache
      saveCache();
    }
  } catch (e) {
    console.error("Error processing search cache:", e);
  }
}

/**
 * Sync the manga-search-service cache with the client search cache
 * This ensures we don't miss cached results from previous searches
 */
function syncWithClientCache(): void {
  // Check localStorage cache first
  if (globalThis.window === undefined) {
    return;
  }

  try {
    // Process manga cache
    const mangaCacheKey = "anilist_manga_cache";
    const cachedMangaData = localStorage.getItem(mangaCacheKey);
    if (cachedMangaData) {
      processMangaCache(cachedMangaData);
    }

    // Process search cache to extract manga
    const searchCacheKey = "anilist_search_cache";
    const cachedSearchData = localStorage.getItem(searchCacheKey);
    if (cachedSearchData) {
      processSearchCache(cachedSearchData);
    }
  } catch (e) {
    console.error("Error accessing localStorage:", e);
  }
}

// Save the cache to localStorage when it's updated
function saveCache(): void {
  if (globalThis.window !== undefined) {
    try {
      localStorage.setItem("anilist_manga_cache", JSON.stringify(mangaCache));
    } catch (e) {
      console.error("Error saving cache to localStorage:", e);
    }
  }
}

// API request rate limiting
const API_RATE_LIMIT = 28; // 30 requests per minute is the AniList limit, use 28 to be safe
const REQUEST_INTERVAL = (60 * 1000) / API_RATE_LIMIT; // milliseconds between requests

// Global rate limiting state
let lastRequestTime = 0;
const requestQueue: { resolve: (value: void) => void }[] = [];
let processingQueue = false;

/**
 * Options for rate-limited search functions
 */
interface SearchRateLimitOptions {
  page?: number;
  perPage?: number;
  token?: string;
  acquireLimit?: boolean;
  retryCount?: number;
  bypassCache?: boolean;
}

/**
 * Search service configuration for manga search and matching.
 *
 * @source
 */
export interface SearchServiceConfig {
  matchConfig: Partial<MatchEngineConfig>;
  batchSize: number;
  searchPerPage: number;
  maxSearchResults: number;
  useAdvancedSearch: boolean;
  enablePreSearch: boolean;
  exactMatchingOnly: boolean;
  bypassCache?: boolean;
  singlePageSearch?: boolean;
}

/**
 * Default configuration for the manga search service.
 *
 * @source
 */
export const DEFAULT_SEARCH_CONFIG: SearchServiceConfig = {
  matchConfig: DEFAULT_MATCH_CONFIG,
  batchSize: 10,
  searchPerPage: 50,
  maxSearchResults: 50,
  useAdvancedSearch: false,
  enablePreSearch: true,
  exactMatchingOnly: false,
  bypassCache: false,
  singlePageSearch: false,
};

/**
 * Generate a cache key for a manga title
 * @param title - The manga title to generate a cache key for
 * @returns Normalized and truncated cache key
 */
function generateCacheKey(title: string): string {
  return normalizeString(title).substring(0, 30);
}

/**
 * Check if a cache entry is valid
 * @param key - Cache key to check
 * @returns True if the cache entry exists and is not expired
 */
function isCacheValid(key: string): boolean {
  const entry = mangaCache[key];
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_EXPIRY;
}

/**
 * Sleep for a specified duration to respect rate limits
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a manga is a one-shot
 * @param manga - The manga to check
 * @returns True if the manga is classified as a one-shot
 */
function isOneShot(manga: AniListManga): boolean {
  // Check format is ONE_SHOT
  if (manga.format === "ONE_SHOT") {
    return true;
  }

  return false;
}

/**
 * Request rate limiting queue handler
 * Ensures we don't exceed AniList's rate limits
 * @returns Promise that resolves when rate limit permits the request
 */
async function acquireRateLimit(): Promise<void> {
  return new Promise<void>((resolve) => {
    // Add this request to the queue
    requestQueue.push({ resolve });

    // If not already processing the queue, start processing
    if (!processingQueue) {
      processRateLimitQueue();
    }
  });
}

/**
 * Process the rate limit queue
 */
async function processRateLimitQueue(): Promise<void> {
  if (processingQueue) return;

  processingQueue = true;

  while (requestQueue.length > 0) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    // If we need to wait for the rate limit, do so
    if (lastRequestTime > 0 && timeSinceLastRequest < REQUEST_INTERVAL) {
      const waitTime = REQUEST_INTERVAL - timeSinceLastRequest;
      await sleep(waitTime);
    }

    // Get the next request from the queue and resolve it
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      lastRequestTime = Date.now();
      nextRequest.resolve();
    }

    // Small additional delay to be extra safe
    await sleep(50);
  }

  processingQueue = false;
}

/**
 * Make a search with rate limiting
 * @param query - Search query string
 * @param page - Page number for pagination (default: 1)
 * @param perPage - Number of results per page (default: 50)
 * @param token - Optional authentication token
 * @param acquireLimit - Whether to acquire rate limit before request (default: true)
 * @param retryCount - Current retry attempt count (default: 0)
 * @param bypassCache - Whether to bypass the cache (default: false)
 * @returns Promise resolving to search results
 */
async function searchWithRateLimit(
  query: string,
  page: number = 1,
  perPage: number = 50,
  token?: string,
  acquireLimit: boolean = true,
  retryCount: number = 0,
  bypassCache: boolean = false,
): Promise<SearchResult<AniListManga>> {
  // Only wait for rate limit if requested (first request in a batch should wait, subsequent ones should not)
  if (acquireLimit) {
    await acquireRateLimit();
  }

  try {
    // Call the AniList client search function - this will handle caching in the client
    return await searchManga(query, page, perPage, token, bypassCache);
  } catch (error: unknown) {
    // Retry logic for transient errors
    if (retryCount < 3) {
      console.warn(`Search error, retrying (${retryCount + 1}/3): ${query}`);
      await sleep(1000 * (retryCount + 1)); // Exponential backoff

      // Retry with incremented retry count
      return searchWithRateLimit(
        query,
        page,
        perPage,
        token,
        true,
        retryCount + 1,
        bypassCache,
      );
    }

    // After all retries, propagate the error
    throw error;
  }
}

/**
 * Make an advanced search with rate limiting
 * @param query - Search query string
 * @param filters - Search filters for genres, tags, and formats
 * @param options - Additional search options including pagination and caching settings
 * @returns Promise resolving to search results
 */
async function advancedSearchWithRateLimit(
  query: string,
  filters: {
    genres?: string[];
    tags?: string[];
    formats?: string[];
  } = {},
  options: SearchRateLimitOptions = {},
): Promise<SearchResult<AniListManga>> {
  const {
    page = 1,
    perPage = 50,
    token,
    acquireLimit = true,
    retryCount = 0,
    bypassCache = false,
  } = options;

  // Only wait for rate limit if requested
  if (acquireLimit) {
    await acquireRateLimit();
  }

  try {
    // Call the AniList client search function - this will handle caching in the client
    return await advancedSearchManga(
      query,
      filters,
      page,
      perPage,
      token,
      bypassCache,
    );
  } catch (error: unknown) {
    // Retry logic for transient errors
    if (retryCount < 3) {
      console.warn(
        `Advanced search error, retrying (${retryCount + 1}/3): ${query}`,
      );
      await sleep(1000 * (retryCount + 1)); // Exponential backoff

      // Retry with incremented retry count
      return advancedSearchWithRateLimit(query, filters, {
        ...options,
        acquireLimit: true,
        retryCount: retryCount + 1,
      });
    }

    // After all retries, propagate the error
    throw error;
  }
}

/**
 * Remove punctuation from a string
 * @param str - Input string to process
 * @returns String with punctuation removed
 */
function removePunctuation(str: string): string {
  // Replace all non-word and non-space characters with empty string
  return str.replaceAll(/[^\w\s]/g, "");
}

/**
 * Check if words from search term appear in title with consideration for word order and proximity
 * Returns true if there's a good match, with stricter criteria than before
 * @param title - Title to check against
 * @param searchName - Search term to match
 * @returns True if the title matches the search criteria
 */
function checkTitleMatch(title: string, searchName: string): boolean {
  // Remove punctuation from the title and the search name
  const cleanTitle = removePunctuation(title);
  const cleanSearchName = removePunctuation(searchName);

  // Split into words
  const titleWordsArray = cleanTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  const searchWordsArray = cleanSearchName
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  // If search is a single word, just check if it exists in the title
  if (searchWordsArray.length === 1) {
    return titleWordsArray.includes(searchWordsArray[0]);
  }

  // For multi-word searches, check if all words are present
  const allWordsPresent = searchWordsArray.every((word) =>
    titleWordsArray.includes(word),
  );
  if (!allWordsPresent) return false;

  // If all words are present, check for order preservation and proximity
  // Find indexes of search words in the title
  const indexes = searchWordsArray.map((word) => titleWordsArray.indexOf(word));

  // Check if the words appear in the same order (indexes should be increasing)
  const sameOrder = indexes.every(
    (index, i) => i === 0 || index > indexes[i - 1],
  );

  // Count how many words are adjacent (index difference of 1)
  let adjacentCount = 0;
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] - indexes[i - 1] === 1) {
      adjacentCount++;
    }
  }

  // Calculate proximity score (what percentage of words are adjacent)
  const proximityScore = adjacentCount / (searchWordsArray.length - 1);

  // Return true if words are in same order OR if at least 50% are adjacent
  return sameOrder || proximityScore >= 0.5;
}

/**
 * Process manga title by replacing hyphens, apostrophes, etc.
 * @param title - Title to process
 * @returns Processed title with normalized characters
 */
function processTitle(title: string): string {
  const withoutParentheses = title.replaceAll(/\s*\([^()]*\)\s*/g, " ");

  return withoutParentheses
    .replaceAll("-", " ")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"')
    .replaceAll("\u201D", '"')
    .replaceAll("_", " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
}

/**
 * Replace special characters that might cause matching issues
 * @param str - Input string to process
 * @returns String with special characters replaced
 */
function replaceSpecialChars(str: string): string {
  // Replace common problematic characters
  return str
    .replaceAll("о", "o")
    .replaceAll("О", "o")
    .replaceAll("а", "a")
    .replaceAll("А", "a")
    .replaceAll("е", "e")
    .replaceAll("Е", "e")
    .replaceAll("р", "p")
    .replaceAll("Р", "p")
    .replaceAll("с", "c")
    .replaceAll("С", "c");
}

/**
 * Collect all available titles from a manga entry
 * @param manga - AniList manga object
 * @returns Array of all available titles (English, Romaji, Native, Synonyms)
 */
function collectMangaTitles(manga: AniListManga): string[] {
  const titles: string[] = [];

  if (manga.title.english) {
    titles.push(manga.title.english);
  }
  if (manga.title.romaji) {
    titles.push(manga.title.romaji);
  }
  if (manga.title.native) {
    titles.push(manga.title.native);
  }
  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const synonym of manga.synonyms) {
      if (synonym) {
        titles.push(synonym);
      }
    }
  }

  return titles;
}

/**
 * Create normalized title entries for matching
 */
function createNormalizedTitles(
  manga: AniListManga,
): { text: string; source: string }[] {
  const allTitles: { text: string; source: string }[] = [];

  if (manga.title.english) {
    const processedTitle = normalizeForMatching(
      processTitle(manga.title.english),
    );
    allTitles.push({ text: processedTitle, source: "english" });
  }

  if (manga.title.romaji) {
    const processedTitle = normalizeForMatching(
      processTitle(manga.title.romaji),
    );
    allTitles.push({ text: processedTitle, source: "romaji" });
  }

  if (manga.title.native) {
    const processedTitle = normalizeForMatching(
      processTitle(manga.title.native),
    );
    allTitles.push({ text: processedTitle, source: "native" });
  }

  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const [index, synonym] of manga.synonyms.entries()) {
      if (synonym) {
        allTitles.push({
          text: normalizeForMatching(processTitle(synonym)),
          source: `synonym_${index}`,
        });
      }
    }
  }

  return allTitles;
}

/**
 * Check for direct and substantial partial matches
 */
function checkDirectMatches(
  normalizedTitles: { text: string; source: string }[],
  normalizedSearchTitle: string,
  searchTitle: string,
  manga: AniListManga,
): number {
  for (const { text, source } of normalizedTitles) {
    // Perfect match
    if (text === normalizedSearchTitle) {
      console.log(`💯 Perfect match found for title: "${text}" (${source})`);
      return 1;
    }

    // Search title is substantial part of manga title
    if (
      text.includes(normalizedSearchTitle) &&
      normalizedSearchTitle.length > 6
    ) {
      if (
        isDifferenceOnlyArticles(
          searchTitle,
          manga.title.english || manga.title.romaji || "",
        )
      ) {
        console.log(
          `⭐ Article-only difference detected between "${normalizedSearchTitle}" and "${text}" (${source}) - very high score`,
        );
        return 0.97;
      }
      console.log(
        `✅ Search title "${searchTitle}" is a substantial part of "${text}" (${source})`,
      );
      return 0.85;
    }

    // Manga title is substantial part of search title
    if (normalizedSearchTitle.includes(text) && text.length > 6) {
      if (
        isDifferenceOnlyArticles(
          searchTitle,
          manga.title.english || manga.title.romaji || "",
        )
      ) {
        console.log(
          `⭐ Article-only difference detected between "${text}" and "${searchTitle}" (${source}) - very high score`,
        );
        return 0.97;
      }
      console.log(
        `✅ Title "${text}" is a substantial part of search "${searchTitle}" (${source})`,
      );
      return 0.8;
    }
  }

  return -1; // No direct match found
}

/**
 * Calculate word matching score between title and search words
 * @param titleWords - Array of words from the manga title
 * @param searchWords - Array of words from the search query
 * @returns Word matching score or -1 if no sufficient match
 */
function calculateWordMatchScore(
  titleWords: string[],
  searchWords: string[],
): number {
  let matchingWords = 0;

  for (const word of titleWords) {
    if (word.length <= 2) continue;

    if (searchWords.includes(word)) {
      matchingWords++;
    } else {
      for (const searchWord of searchWords) {
        if (
          (word.startsWith(searchWord) || searchWord.startsWith(word)) &&
          Math.min(word.length, searchWord.length) >= 4
        ) {
          matchingWords += 0.5;
          break;
        }
      }
    }
  }

  const matchRatio =
    matchingWords /
    Math.max(2, Math.min(titleWords.length, searchWords.length));
  return matchRatio >= 0.75 ? 0.75 + (matchRatio - 0.75) * 0.6 : -1;
}

/**
 * Check enhanced similarity between normalized titles
 */
function checkEnhancedSimilarityScore(
  text: string,
  normalizedSearchTitle: string,
  searchTitle: string,
  source: string,
): number {
  const similarity =
    calculateEnhancedSimilarity(text, normalizedSearchTitle) / 100;
  const similarityThreshold = normalizedSearchTitle.length < 10 ? 0.6 : 0.5;

  if (similarity > similarityThreshold) {
    console.log(
      `🔍 High text similarity (${similarity.toFixed(2)}) between "${text}" and "${searchTitle}" (${source})`,
    );
    return Math.max(0.6, similarity * 0.95);
  }

  return -1;
}

/**
 * Check word-based matching between titles
 */
function checkWordMatching(
  normalizedTitles: { text: string; source: string }[],
  normalizedSearchTitle: string,
  searchTitle: string,
): number {
  let bestScore = -1;
  const searchWords = normalizedSearchTitle.split(/\s+/);

  for (const { text, source } of normalizedTitles) {
    const titleWords = text.split(/\s+/);

    // Calculate word matching score
    const wordMatchScore = calculateWordMatchScore(titleWords, searchWords);
    if (wordMatchScore > 0) {
      console.log(
        `✅ High word match ratio (${((wordMatchScore - 0.75) / 0.6 + 0.75).toFixed(2)}) between "${text}" and "${searchTitle}" (${source}) - score: ${wordMatchScore.toFixed(2)}`,
      );

      if (wordMatchScore > 0.9) {
        return wordMatchScore;
      }
      bestScore = Math.max(bestScore, wordMatchScore);
    }

    // Check enhanced similarity
    const similarityScore = checkEnhancedSimilarityScore(
      text,
      normalizedSearchTitle,
      searchTitle,
      source,
    );
    if (similarityScore > 0) {
      bestScore = Math.max(bestScore, similarityScore);
    }
  }

  return bestScore;
}

/**
 * Check legacy matching approaches for backward compatibility
 */
function checkLegacyMatching(
  titles: string[],
  normalizedSearchTitle: string,
  searchTitle: string,
  importantWords: string[],
): number {
  let bestScore = -1;

  for (const title of titles) {
    if (!title) continue;

    const processedTitle = processTitle(title);
    const normalizedTitle = normalizeForMatching(processedTitle);
    const specialCharTitle = replaceSpecialChars(normalizedTitle);
    const specialCharSearchTitle = replaceSpecialChars(normalizedSearchTitle);

    // Log special character replacements if they differ
    if (
      specialCharTitle !== normalizedTitle ||
      specialCharSearchTitle !== normalizedSearchTitle
    ) {
      console.log(
        `🔡 Special character replacement: "${normalizedTitle}" → "${specialCharTitle}"`,
      );
      console.log(
        `🔡 Special character replacement: "${normalizedSearchTitle}" → "${specialCharSearchTitle}"`,
      );
    }

    // Check various matching approaches
    const approaches = [
      () =>
        checkExactTitleMatch(
          normalizedTitle,
          specialCharTitle,
          normalizedSearchTitle,
          specialCharSearchTitle,
          title,
        ),
      () =>
        checkPartialTitleMatch(
          normalizedTitle,
          specialCharTitle,
          normalizedSearchTitle,
          specialCharSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkWordSimilarity(
          specialCharTitle,
          specialCharSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkContainedTitle(
          normalizedTitle,
          normalizedSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkEnhancedSimilarity(
          normalizedTitle,
          normalizedSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkSeasonPatterns(
          normalizedTitle,
          normalizedSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkSubsetMatch(
          processedTitle,
          searchTitle,
          normalizedTitle,
          normalizedSearchTitle,
          importantWords,
        ),
    ];

    for (const approach of approaches) {
      const score = approach();
      if (score > 0) {
        bestScore = Math.max(bestScore, score);
        if (score >= 0.95) return score; // Early return for very high scores
      }
    }
  }

  return bestScore;
}

/**
 * Check exact title matching
 */
function checkExactTitleMatch(
  normalizedTitle: string,
  specialCharTitle: string,
  normalizedSearchTitle: string,
  specialCharSearchTitle: string,
  title: string,
): number {
  if (
    normalizedTitle === normalizedSearchTitle ||
    specialCharTitle === specialCharSearchTitle
  ) {
    console.log(`💯 Perfect match found for "${title}"`);
    return 1;
  }

  const titleWithoutSuffix = normalizedTitle
    .replace(/@\w+$|[@(（][^)）]*[)）]$/, "")
    .trim();
  if (titleWithoutSuffix === normalizedSearchTitle) {
    console.log(`💯 Perfect match found after removing suffix: "${title}"`);
    return 0.95;
  }

  const specialCharTitleWithoutSuffix = specialCharTitle
    .replace(/@\w+$|[@(（][^)）]*[)）]$/, "")
    .trim();
  if (specialCharTitleWithoutSuffix === specialCharSearchTitle) {
    console.log(
      `💯 Perfect match found after removing suffix and fixing special chars: "${title}"`,
    );
    return 0.95;
  }

  return -1;
}

/**
 * Check partial title matching
 */
function checkPartialTitleMatch(
  normalizedTitle: string,
  specialCharTitle: string,
  normalizedSearchTitle: string,
  specialCharSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  if (
    (normalizedTitle.includes(normalizedSearchTitle) ||
      specialCharTitle.includes(specialCharSearchTitle)) &&
    normalizedSearchTitle.length > 6
  ) {
    console.log(
      `✅ Found search title as substantial part of full title: "${title}" contains "${searchTitle}"`,
    );
    return 0.85;
  }
  return -1;
}

/**
 * Check word similarity matching
 */
function checkWordSimilarity(
  specialCharTitle: string,
  specialCharSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  const titleWords = specialCharTitle.split(/\s+/);
  const searchWords = specialCharSearchTitle.split(/\s+/);

  let matchingWordCount = 0;
  const totalWords = Math.max(titleWords.length, searchWords.length);

  for (const word of titleWords) {
    if (searchWords.includes(word) && word.length > 1) {
      matchingWordCount++;
    }
  }

  const wordMatchRatio = matchingWordCount / totalWords;
  if (wordMatchRatio >= 0.75) {
    console.log(
      `🔤 High word match ratio (${wordMatchRatio.toFixed(2)}) between "${title}" and "${searchTitle}"`,
    );
    return 0.8 + (wordMatchRatio - 0.75) * 0.8;
  }

  return -1;
}

/**
 * Check contained title matching
 */
function checkContainedTitle(
  normalizedTitle: string,
  normalizedSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  const completeTitleBonus = containsCompleteTitle(
    normalizedTitle,
    normalizedSearchTitle,
  );
  if (completeTitleBonus > 0) {
    const containedScore = 0.85 + completeTitleBonus * 0.1;
    console.log(
      `🔍 Search title "${searchTitle}" completely contained in "${title}" with score ${containedScore.toFixed(2)}`,
    );
    return containedScore;
  }
  return -1;
}

/**
 * Check enhanced similarity matching
 */
function checkEnhancedSimilarity(
  normalizedTitle: string,
  normalizedSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  const similarity =
    calculateEnhancedSimilarity(normalizedTitle, normalizedSearchTitle) / 100;
  const similarityThreshold = normalizedSearchTitle.length < 10 ? 0.6 : 0.45;

  if (similarity > similarityThreshold) {
    console.log(
      `🔍 High similarity (${similarity.toFixed(2)}) between "${title}" and "${searchTitle}"`,
    );
    return Math.max(0.8, similarity);
  }

  return -1;
}

/**
 * Check season pattern matching
 */
function checkSeasonPatterns(
  normalizedTitle: string,
  normalizedSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  const seasonMatchScore = checkSeasonPattern(
    normalizedTitle,
    normalizedSearchTitle,
  );
  if (seasonMatchScore > 0) {
    console.log(
      `🔍 Season pattern match found between "${title}" and "${searchTitle}" with score ${seasonMatchScore.toFixed(2)}`,
    );
    return seasonMatchScore;
  }
  return -1;
}

/**
 * Check subset matching (word coverage and order)
 */
function checkSubsetMatch(
  processedTitle: string,
  searchTitle: string,
  normalizedTitle: string,
  normalizedSearchTitle: string,
  importantWords: string[],
): number {
  if (checkTitleMatch(processedTitle, searchTitle)) {
    const lengthDiff =
      Math.abs(processedTitle.length - searchTitle.length) /
      Math.max(processedTitle.length, searchTitle.length);

    const matchedWords = importantWords.filter((word) =>
      normalizedTitle.includes(word),
    ).length;
    const wordCoverage =
      importantWords.length > 0 ? matchedWords / importantWords.length : 0;

    const orderSimilarity = calculateWordOrderSimilarity(
      normalizedTitle.split(/\s+/),
      normalizedSearchTitle.split(/\s+/),
    );

    const baseScore = 0.5;
    const lengthFactor = (1 - lengthDiff) * 0.1;
    const coverageFactor = wordCoverage * 0.1;
    const orderFactor = orderSimilarity * 0.1;

    const wordMatchScore =
      baseScore + lengthFactor + coverageFactor + orderFactor;

    console.log(
      `🔍 Word match for "${processedTitle}" with composite score ${wordMatchScore.toFixed(2)} ` +
        `(length: ${lengthFactor.toFixed(2)}, coverage: ${coverageFactor.toFixed(2)}, order: ${orderFactor.toFixed(2)})`,
    );

    return wordMatchScore;
  }
  return -1;
}

/**
 * Calculate match score between a manga title and search query
 * Returns 0-1 score where 1 is perfect match, or -1 if no match
 * @param manga - The manga to calculate match score for
 * @param searchTitle - The search title to match against
 * @returns Match score between 0-1 (or -1 if no match)
 */
function calculateMatchScore(manga: AniListManga, searchTitle: string): number {
  // Handle empty search title
  if (!searchTitle || searchTitle.trim() === "") {
    console.log(`⚠️ Empty search title provided for manga ID ${manga.id}`);
    return -1;
  }

  // Log for debugging
  console.log(
    `🔍 Calculating match score for "${searchTitle}" against manga ID ${manga.id}, titles:`,
    {
      english: manga.title.english,
      romaji: manga.title.romaji,
      native: manga.title.native,
      synonyms: manga.synonyms?.slice(0, 3), // Limit to first 3 for cleaner logs
    },
  );

  // If we have synonyms, log them explicitly for better debugging
  if (manga.synonyms && manga.synonyms.length > 0) {
    console.log(`📚 Synonyms for manga ID ${manga.id}:`, manga.synonyms);
  }

  // Collect all manga titles
  const titles = collectMangaTitles(manga);

  // Create normalized titles for matching
  const normalizedTitles = createNormalizedTitles(manga);

  // Normalize the search title for better matching
  const normalizedSearchTitle = normalizeForMatching(searchTitle);
  const searchWords = normalizedSearchTitle.split(/\s+/);
  const importantWords = searchWords.filter((word) => word.length > 2);

  // Check for direct matches first (highest confidence)
  const directMatch = checkDirectMatches(
    normalizedTitles,
    normalizedSearchTitle,
    searchTitle,
    manga,
  );
  if (directMatch > 0) {
    return directMatch;
  }

  // Try word-based matching approaches
  const wordMatch = checkWordMatching(
    normalizedTitles,
    normalizedSearchTitle,
    searchTitle,
  );
  if (wordMatch > 0) {
    return wordMatch;
  }

  // Finally try legacy matching approaches for comprehensive coverage
  const legacyMatch = checkLegacyMatching(
    titles,
    normalizedSearchTitle,
    searchTitle,
    importantWords,
  );

  console.log(
    `🔍 Final match score for "${searchTitle}": ${legacyMatch.toFixed(2)}`,
  );
  return legacyMatch;
}

/**
 * Check if a title contains the complete search term as a unit
 * Returns a score from 0-1 based on how significant the contained title is
 * @param normalizedTitle - The normalized manga title
 * @param normalizedSearchTitle - The normalized search title
 * @returns Significance score (0-1) of how much of the title the search represents
 */
function containsCompleteTitle(
  normalizedTitle: string,
  normalizedSearchTitle: string,
): number {
  if (normalizedTitle.includes(normalizedSearchTitle)) {
    // Calculate how significant the contained title is compared to the full title
    // (Higher score when the search term represents more of the full title)
    return normalizedSearchTitle.length / normalizedTitle.length;
  }
  return 0;
}

/**
 * Check for common season patterns in manga/anime titles
 * Returns a score from 0-0.9 if it looks like different seasons of the same title
 * @param normalizedTitle - The normalized manga title
 * @param normalizedSearchTitle - The normalized search title
 * @returns Season pattern match score (0-0.9) or 0 if no pattern match
 */
function checkSeasonPattern(
  normalizedTitle: string,
  normalizedSearchTitle: string,
): number {
  // Check for common patterns indicating different seasons of the same series
  const seasonPatterns = [
    /\s+season\s+\d+/i, // "Title Season 2"
    /\s+\d+nd\s+season/i, // "Title 2nd Season"
    /\s+\d+rd\s+season/i, // "Title 3rd Season"
    /\s+\d+th\s+season/i, // "Title 4th Season"
    /\s+s\d+/i, // "Title S2"
    /\s+part\s+\d+/i, // "Title Part 2"
    /\s+ii+$/i, // "Title II" or "Title III"
    /\s+\d+$/i, // "Title 2" or "Title 3"
  ];

  // Check if one title has a season marker and the other doesn't
  let title1HasSeason = false;
  let title2HasSeason = false;

  for (const pattern of seasonPatterns) {
    if (pattern.test(normalizedTitle)) title1HasSeason = true;
    if (pattern.test(normalizedSearchTitle)) title2HasSeason = true;
  }

  if (title1HasSeason || title2HasSeason) {
    // Remove the season parts from both titles
    let cleanTitle1 = normalizedTitle;
    let cleanTitle2 = normalizedSearchTitle;

    for (const pattern of seasonPatterns) {
      cleanTitle1 = cleanTitle1.replace(pattern, "");
      cleanTitle2 = cleanTitle2.replace(pattern, "");
    }

    // Clean up any remaining artifacts
    cleanTitle1 = cleanTitle1.trim();
    cleanTitle2 = cleanTitle2.trim();

    // Calculate similarity between the core titles (without season markers)
    const coreSimilarity =
      calculateEnhancedSimilarity(cleanTitle1, cleanTitle2) / 100;

    // If core titles are very similar, it's likely different seasons of the same series
    if (coreSimilarity > 0.85) {
      return 0.8 + (coreSimilarity - 0.85) * 0.66; // Score between 0.8-0.9 based on core similarity
    }
  }

  return 0;
}

/**
 * Calculate similarity in word order between two word arrays
 * Returns a value between 0-1 where 1 means perfect order match
 * @param words1 - First array of words to compare
 * @param words2 - Second array of words to compare
 * @returns Order similarity score between 0-1
 */
function calculateWordOrderSimilarity(
  words1: string[],
  words2: string[],
): number {
  // If either array is empty, no match
  if (words1.length === 0 || words2.length === 0) return 0;

  // Filter for words that appear in both arrays
  const commonWords1 = words1.filter((word) => words2.includes(word));

  // If no common words, no order similarity
  if (commonWords1.length === 0) return 0;

  // Calculate the positions of common words in each array
  const positions1 = commonWords1.map((word) => words1.indexOf(word));
  const positions2 = commonWords1.map((word) => words2.indexOf(word));

  // Check if order is preserved (all words in same relative order)
  let orderPreserved = true;

  for (let i = 1; i < positions1.length; i++) {
    const prevDiff1 = positions1[i] - positions1[i - 1];
    const prevDiff2 = positions2[i] - positions2[i - 1];

    // If signs differ, order is not preserved
    if (
      (prevDiff1 > 0 && prevDiff2 <= 0) ||
      (prevDiff1 <= 0 && prevDiff2 > 0)
    ) {
      orderPreserved = false;
      break;
    }
  }

  // Calculate how many words are in the same relative position
  const commonWordCount = commonWords1.length;

  // Return a score based on common words and if order is preserved
  return (
    (commonWordCount / Math.max(words1.length, words2.length)) *
    (orderPreserved ? 1 : 0.7)
  ); // Penalty if order differs
}

/**
 * Check if the difference between two titles is only articles
 * Returns true if the longer title contains the shorter one plus only common articles
 * @param title1 - First title to compare
 * @param title2 - Second title to compare
 * @returns True if the difference is only due to articles
 */
function isDifferenceOnlyArticles(title1: string, title2: string): boolean {
  const articles = new Set(["a", "an", "the"]);

  // Normalize both titles
  const norm1 = normalizeForMatching(title1)
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const norm2 = normalizeForMatching(title2)
    .split(/\s+/)
    .filter((word) => word.length > 0);

  console.log(
    `🔍 Checking article difference between "${title1}" and "${title2}"`,
  );
  console.log(
    `  Normalized: ["${norm1.join('", "')}"] vs ["${norm2.join('", "')}"]`,
  );

  // Find the longer and shorter word arrays
  const [longer, shorter] =
    norm1.length >= norm2.length ? [norm1, norm2] : [norm2, norm1];

  // If they have the same number of words, they're not article-different
  if (longer.length === shorter.length) {
    console.log(`  Same length, not article difference`);
    return false;
  }

  // Remove all articles from both arrays and compare
  const longerWithoutArticles = longer.filter((word) => !articles.has(word));
  const shorterWithoutArticles = shorter.filter((word) => !articles.has(word));

  console.log(
    `  Without articles: ["${longerWithoutArticles.join('", "')}"] vs ["${shorterWithoutArticles.join('", "')}"]`,
  );

  // If after removing articles, they're identical, then the difference was only articles
  const isArticleOnly =
    longerWithoutArticles.length === shorterWithoutArticles.length &&
    longerWithoutArticles.every(
      (word, index) => word === shorterWithoutArticles[index],
    );

  console.log(`  Article-only difference: ${isArticleOnly}`);
  return isArticleOnly;
}

/**
 * Calculate similarity score between a title and normalized search term
 * @param title - The title to calculate similarity for (can be null/undefined)
 * @param normalizedSearch - The normalized search term
 * @returns Object containing similarity score and title type
 */
function calculateTitleSimilarity(
  title: string | null | undefined,
  normalizedSearch: string,
): { similarity: number; titleType: string } {
  if (!title) {
    return { similarity: 0, titleType: "unknown" };
  }

  const similarity = calculateEnhancedSimilarity(
    normalizeForMatching(title),
    normalizedSearch,
  );

  return { similarity, titleType: "title" };
}

/**
 * Calculate title type priority for sorting when confidence scores are equal
 * Returns a priority score where higher numbers indicate higher priority
 * English/Romaji main titles get highest priority, synonyms get lowest priority
 * @param manga - The manga to calculate priority for
 * @param searchTitle - The search title used for matching
 * @returns Priority score (higher = more important title type)
 */
function calculateTitleTypePriority(
  manga: AniListManga,
  searchTitle: string,
): number {
  const normalizedSearch = normalizeForMatching(searchTitle);

  // Define title types with their priority scores
  const titleTypes = [
    { title: manga.title?.english, type: "english" },
    { title: manga.title?.romaji, type: "romaji" },
    { title: manga.title?.native, type: "native" },
  ];

  let bestMatchType = "synonym"; // Default to lowest priority
  let bestSimilarity = 0;

  // Check main titles (English, Romaji, Native)
  for (const { title, type } of titleTypes) {
    const { similarity } = calculateTitleSimilarity(title, normalizedSearch);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatchType = type;
    }
  }

  // Check synonyms (lowest priority)
  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const synonym of manga.synonyms) {
      const { similarity } = calculateTitleSimilarity(
        synonym,
        normalizedSearch,
      );
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatchType = "synonym";
      }
    }
  }

  // Return priority score based on title type
  const priorityMap: Record<string, number> = {
    english: 100,
    romaji: 90,
    native: 80,
    synonym: 70,
  };

  return priorityMap[bestMatchType] ?? 60;
}

/**
 * Normalize a string for matching by removing punctuation and standardizing case
 * Preserves word boundaries to maintain distinction between separate words
 * @param str - The string to normalize
 * @returns Normalized string suitable for matching
 */
function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .replaceAll("-", "") // Remove dashes consistently with processTitle logic
    .replaceAll(/[^\w\s]/g, "") // Remove remaining punctuation
    .replaceAll(/\s+/g, " ") // Normalize spaces (replace multiple spaces with a single space)
    .replaceAll("_", " ") // Replace underscores with spaces
    .trim();
}

/**
 * Check if a manga should be ignored during automatic matching
 * @param manga - The manga to check
 * @returns True if the manga should be ignored during automatic matching
 */
function shouldIgnoreForAutomaticMatching(manga: AniListManga): boolean {
  // Get all titles to check (main titles + synonyms)
  const titlesToCheck = [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
  ].filter(Boolean) as string[];

  // Check if any title matches ignored titles (case-insensitive)
  return titlesToCheck.some((title) =>
    IGNORED_AUTOMATIC_MATCH_TITLES.has(title.toLowerCase()),
  );
}

/**
 * Check if a manga should be skipped during ranking
 * @param manga - The manga to check
 * @param isManualSearch - Whether this is a manual search operation
 * @returns True if the manga should be skipped
 */
function shouldSkipManga(
  manga: AniListManga,
  isManualSearch: boolean,
): boolean {
  // Skip Light Novels
  if (manga.format === "NOVEL" || manga.format === "LIGHT_NOVEL") {
    console.log(
      `⏭️ Skipping light novel: ${manga.title?.romaji || manga.title?.english || "unknown"}`,
    );
    return true;
  }

  // Skip ignored titles for automatic matching (but allow for manual searches)
  if (!isManualSearch && shouldIgnoreForAutomaticMatching(manga)) {
    console.log(
      `⏭️ Skipping ignored title for automatic matching: ${manga.title?.romaji || manga.title?.english || "unknown"}`,
    );
    return true;
  }

  return false;
}

/**
 * Check if a title matches in exact matching mode
 */
function checkExactMatch(manga: AniListManga, searchTitle: string): boolean {
  // Check all titles directly
  const titlesToCheck = [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
  ].filter(Boolean);

  for (const title of titlesToCheck) {
    if (!title) continue;

    // Check different variations of the title against the search
    // This catches cases where normalization might miss things
    const normalSearch = normalizeForMatching(searchTitle);
    const normalTitle = normalizeForMatching(title);

    // Check if titles are very similar after normalization
    // Increased threshold from 0.85 to 0.88 for stricter matching
    if (
      normalTitle === normalSearch ||
      calculateEnhancedSimilarity(normalTitle, normalSearch) > 88
    ) {
      console.log(`✅ Found good title match: "${title}" for "${searchTitle}"`);
      return true;
    }

    // Check each word in the search query against the title
    const searchWords = searchTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);
    const titleLower = title.toLowerCase();

    // If all important words from search are in the title, consider it a match
    const allWordsFound = searchWords.every((word) =>
      titleLower.includes(word),
    );
    // Require at least 2 words for this to be valid, otherwise matches might be too loose
    if (allWordsFound && searchWords.length >= 2) {
      console.log(`✅ All search words found in title: "${title}"`);
      return true;
    }
  }

  return false;
}

/**
 * Evaluate if a manga should be included based on its score in exact matching mode
 */
function shouldIncludeMangaExact(
  manga: AniListManga,
  score: number,
  searchTitle: string,
  results: AniListManga[],
): { include: boolean; adjustedScore: number } {
  console.log(`🔍 Checking titles for exact match against "${searchTitle}"`);

  // In exact matching mode, do a thorough check of all titles
  // This ensures we don't miss matches due to normalization differences
  const foundGoodMatch = checkExactMatch(manga, searchTitle);

  // If this is an exact match run and we have a good score or manually found a good match
  // Increased threshold from 0.5 to 0.6 for stricter inclusion
  if (score > 0.6 || foundGoodMatch || results.length <= 2) {
    console.log(
      `✅ Including manga "${manga.title?.romaji || manga.title?.english}" with score: ${score}`,
    );
    return {
      include: true,
      adjustedScore: foundGoodMatch ? Math.max(score, 0.75) : score,
    };
  } else {
    console.log(
      `❌ Excluding manga "${manga.title?.romaji || manga.title?.english}" with score: ${score} (below threshold)`,
    );
    return { include: false, adjustedScore: score };
  }
}

/**
 * Evaluate if a manga should be included based on its score in regular matching mode
 */
function shouldIncludeMangaRegular(
  manga: AniListManga,
  score: number,
  results: AniListManga[],
): { include: boolean; adjustedScore: number } {
  if (score > 0.15 || results.length <= 2) {
    console.log(
      `✅ Including manga "${manga.title?.romaji || manga.title?.english}" with score: ${score}`,
    );
    return { include: true, adjustedScore: score };
  } else {
    console.log(
      `❌ Excluding manga "${manga.title?.romaji || manga.title?.english}" with score: ${score} (below threshold)`,
    );
    return { include: false, adjustedScore: score };
  }
}

/**
 * Core ranking logic shared between exact and regular ranking
 */
function rankMangaCore(
  results: AniListManga[],
  searchTitle: string,
  isManualSearch: boolean,
  includeMangaFn: (
    manga: AniListManga,
    score: number,
  ) => { include: boolean; adjustedScore: number },
): AniListManga[] {
  const scoredResults: Array<{ manga: AniListManga; score: number }> = [];

  // Score each manga result
  for (const manga of results) {
    // Check if manga should be skipped
    if (shouldSkipManga(manga, isManualSearch)) {
      continue;
    }

    const score = calculateMatchScore(manga, searchTitle);

    // Evaluate if manga should be included using the provided function
    const { include, adjustedScore } = includeMangaFn(manga, score);

    if (include) {
      scoredResults.push({ manga, score: adjustedScore });
    }
  }

  // Sort by score (descending)
  scoredResults.sort((a, b) => b.score - a.score);

  // Always include at least one result if available, even with low score
  if (scoredResults.length === 0 && results.length > 0) {
    console.log(
      `🔄 No results matched score threshold but including top result anyway`,
    );
    const bestGuess = results[0];
    scoredResults.push({
      manga: bestGuess,
      score: 0.1, // Very low confidence
    });
  }

  console.log(
    `🏆 Ranked results: ${scoredResults.length} manga after filtering and ranking`,
  );

  // Return just the manga objects, preserving the new order
  return scoredResults.map((item) => item.manga);
}

/**
 * Filter and rank manga results by match quality
 */
function rankMangaResults(
  results: AniListManga[],
  searchTitle: string,
  exactMatchingOnly: boolean,
  isManualSearch: boolean = false,
): AniListManga[] {
  const includeMangaFn = exactMatchingOnly
    ? (manga: AniListManga, score: number) =>
        shouldIncludeMangaExact(manga, score, searchTitle, results)
    : (manga: AniListManga, score: number) =>
        shouldIncludeMangaRegular(manga, score, results);

  return rankMangaCore(results, searchTitle, isManualSearch, includeMangaFn);
}

/**
 * Handle cache bypass by clearing existing cache entries
 * @param title - The manga title to clear from cache
 * @param cacheKey - The cache key for the title
 */
function handleCacheBypass(title: string, cacheKey: string): void {
  console.log(`🔥 Fresh search: Explicitly clearing cache for "${title}"`);

  if (mangaCache[cacheKey]) {
    delete mangaCache[cacheKey];
    console.log(`🧹 Removed existing cache entry for "${title}"`);
    saveCache();
  } else {
    console.log(`🔍 No existing cache entry found for "${title}" to clear`);
  }
}

/**
 * Process cached manga results with filtering and scoring
 * @param title - The manga title to process cached results for
 * @param cacheKey - The cache key to retrieve results from
 * @returns Manga search response with cached results or null if no valid cache
 */
function processCachedResults(
  title: string,
  cacheKey: string,
): MangaSearchResponse | null {
  if (!isCacheValid(cacheKey)) return null;

  console.log(`Using cache for ${title}`);
  let filteredManga = mangaCache[cacheKey].manga.filter(
    (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
  );

  const matchConfig = getMatchConfig();

  // Filter one-shots if enabled
  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredManga.length;
    filteredManga = filteredManga.filter((manga) => !isOneShot(manga));
    const afterFilter = filteredManga.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) from cached results for "${title}"`,
      );
    }
  }

  // Filter adult content if enabled
  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredManga.length;
    filteredManga = filteredManga.filter((manga) => !manga.isAdult);
    const afterFilter = filteredManga.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} adult content manga from cached results for "${title}"`,
      );
    }
  }

  console.log(
    `⚖️ Calculating fresh confidence scores for ${filteredManga.length} cached matches`,
  );

  const matches = filteredManga.map((manga) => {
    const confidence = calculateConfidence(title, manga);
    const titleTypePriority = calculateTitleTypePriority(manga, title);

    console.log(
      `⚖️ Cached match confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (priority: ${titleTypePriority})`,
    );

    return { manga, confidence, titleTypePriority };
  });

  // Sort by confidence and priority
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  const finalMatches = matches.map(({ manga, confidence }) => ({
    manga,
    confidence,
    comickSource: undefined,
  }));

  return {
    matches: finalMatches,
    pageInfo: undefined,
  };
}

/**
 * Handle search loop errors with appropriate logging
 * @param error - The error that occurred during search
 * @param searchQuery - The search query that caused the error
 */
function handleSearchError(error: unknown, searchQuery: string): void {
  if (error instanceof Error) {
    console.error(
      `Error searching for manga "${searchQuery}": ${error.message}`,
      error,
    );
  } else {
    console.error(`Error searching for manga "${searchQuery}"`, error);
  }
}

/**
 * Check if pagination should continue based on current state
 * @param pageInfo - Page information from the current search result
 * @param currentPage - Current page number
 * @param resultsLength - Current number of results collected
 * @param maxResults - Maximum number of results allowed
 * @param singlePageMode - Whether operating in single page mode
 * @returns True if pagination should continue
 */
function shouldContinuePagination(
  pageInfo: PageInfo,
  currentPage: number,
  resultsLength: number,
  maxResults: number,
  singlePageMode: boolean,
): boolean {
  if (singlePageMode) {
    console.log(
      `🔍 Single page mode: Fetched page ${currentPage}, stopping search`,
    );
    return false;
  }

  return (
    pageInfo.hasNextPage &&
    currentPage < pageInfo.lastPage &&
    resultsLength < maxResults
  );
}

/**
 * Validate and normalize search result structure
 * @param searchResult - The search result to validate
 * @param searchQuery - The search query that generated this result
 * @returns True if the search result is valid and properly structured
 */
function validateSearchResult(
  searchResult: SearchResult<AniListManga>,
  searchQuery: string,
): boolean {
  if (!searchResult?.Page) {
    console.error(`Invalid search result for "${searchQuery}":`, searchResult);
    return false;
  }

  if (!searchResult.Page.media) {
    console.error(
      `Search result for "${searchQuery}" missing media array:`,
      searchResult,
    );
    searchResult.Page.media = [];
  }

  if (!searchResult.Page.pageInfo) {
    console.error(
      `Search result for "${searchQuery}" missing pageInfo:`,
      searchResult,
    );
    return false;
  }

  return true;
}

/**
 * Execute a single search request with the appropriate method
 * @param searchQuery - The search query to execute
 * @param currentPage - Current page number for pagination
 * @param searchConfig - Configuration for the search service
 * @param token - Optional authentication token
 * @returns Promise resolving to search results
 */
async function executeSingleSearch(
  searchQuery: string,
  currentPage: number,
  searchConfig: SearchServiceConfig,
  token: string | undefined,
): Promise<SearchResult<AniListManga>> {
  let searchResult: SearchResult<AniListManga>;

  if (searchConfig.useAdvancedSearch) {
    searchResult = await advancedSearchWithRateLimit(
      searchQuery,
      {},
      {
        page: currentPage,
        perPage: searchConfig.searchPerPage,
        token,
        acquireLimit: false,
        retryCount: 0,
        bypassCache: searchConfig.bypassCache,
      },
    );
  } else {
    searchResult = await searchWithRateLimit(
      searchQuery,
      currentPage,
      searchConfig.searchPerPage,
      token,
      false,
      0,
      searchConfig.bypassCache,
    );
  }

  return searchResult;
}

/**
 * Execute the main search loop with pagination
 */
async function executeSearchLoop(
  searchQuery: string,
  searchConfig: SearchServiceConfig,
  token: string | undefined,
  abortSignal: AbortSignal | undefined,
  specificPage?: number,
): Promise<{ results: AniListManga[]; lastPageInfo?: PageInfo }> {
  let results: AniListManga[] = [];
  let currentPage = specificPage || 1;
  let hasNextPage = true;
  let lastPageInfo: PageInfo | undefined = undefined;
  const singlePageMode = specificPage !== undefined;

  console.log(
    `🌐 Making network request to AniList API for "${searchQuery}" - bypassCache=${searchConfig.bypassCache}`,
  );

  while (hasNextPage && results.length < searchConfig.maxSearchResults) {
    try {
      if (abortSignal?.aborted) {
        throw new Error("Search aborted by abort signal");
      }

      // Execute the search request
      const searchResult = await executeSingleSearch(
        searchQuery,
        currentPage,
        searchConfig,
        token,
      );

      console.log(
        `🔍 Search response for "${searchQuery}" page ${currentPage}: ${searchResult?.Page?.media?.length || 0} results`,
      );

      // Log detailed results if cache is bypassed
      if (searchConfig.bypassCache && searchResult?.Page?.media?.length > 0) {
        console.log(
          `🔍 Titles received from API:`,
          searchResult.Page.media.map((m) => ({
            id: m.id,
            romaji: m.title?.romaji,
            english: m.title?.english,
            native: m.title?.native,
            synonyms: m.synonyms?.length,
          })),
        );
      }

      // Validate search result structure
      if (!validateSearchResult(searchResult, searchQuery)) {
        break;
      }

      // Add results to collection
      results = [...results, ...searchResult.Page.media];
      lastPageInfo = searchResult.Page.pageInfo;

      // Check if pagination should continue
      hasNextPage = shouldContinuePagination(
        searchResult.Page.pageInfo,
        currentPage,
        results.length,
        searchConfig.maxSearchResults,
        singlePageMode,
      );

      currentPage++;

      if (hasNextPage) {
        await acquireRateLimit();
      }
    } catch (error: unknown) {
      handleSearchError(error, searchQuery);
      break;
    }
  }

  return { results, lastPageInfo };
}

/**
 * Process and filter search results
 */
function processSearchResults(
  results: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  console.log(
    `🔍 Found ${results.length} raw results for "${title}" before filtering/ranking`,
  );

  let exactMatchMode = searchConfig.exactMatchingOnly;

  if ((searchConfig.bypassCache && results.length > 0) || results.length <= 3) {
    exactMatchMode = false;
  }

  const rankedResults = rankMangaResults(
    results,
    title,
    exactMatchMode,
    searchConfig.bypassCache,
  );

  console.log(
    `🔍 Search complete for "${title}": Found ${results.length} results, ranked to ${rankedResults.length} relevant matches`,
  );

  // Cache results if not bypassing cache
  if (searchConfig.bypassCache) {
    console.log(`🔍 MANUAL SEARCH: Skipping cache save for "${title}"`);
  } else {
    const cacheKey = generateCacheKey(title);
    mangaCache[cacheKey] = {
      manga: rankedResults,
      timestamp: Date.now(),
    };
    saveCache();
  }

  return rankedResults;
}

/**
 * Apply content filtering based on match configuration
 */
function applyContentFiltering(
  results: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  let filteredResults = results.filter(
    (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
  );

  if (!searchConfig.bypassCache) {
    const matchConfig = getMatchConfig();

    if (matchConfig.ignoreOneShots) {
      const beforeFilter = filteredResults.length;
      filteredResults = filteredResults.filter((manga) => !isOneShot(manga));
      const afterFilter = filteredResults.length;

      if (beforeFilter > afterFilter) {
        console.log(
          `🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) during automatic matching for "${title}"`,
        );
      }
    }

    if (matchConfig.ignoreAdultContent) {
      const beforeFilter = filteredResults.length;
      filteredResults = filteredResults.filter((manga) => !manga.isAdult);
      const afterFilter = filteredResults.length;

      if (beforeFilter > afterFilter) {
        console.log(
          `🚫 Filtered out ${beforeFilter - afterFilter} adult content manga during automatic matching for "${title}"`,
        );
      }
    }
  }

  return filteredResults;
}

/**
 * Handle fallback when no results are found after filtering
 */
function handleNoResultsFallback(
  filteredResults: AniListManga[],
  originalResults: AniListManga[],
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  if (filteredResults.length === 0 && originalResults.length > 0) {
    console.log(
      `⚠️ No matches passed filtering, but including raw API results anyway`,
    );

    const fallbackResults = originalResults
      .slice(0, 3)
      .filter(
        (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
      );

    console.log(
      `🔍 Including these API results:`,
      fallbackResults.map((m) => ({
        id: m.id,
        romaji: m.title?.romaji,
        english: m.title?.english,
      })),
    );

    return fallbackResults;
  }

  if (
    searchConfig.bypassCache &&
    filteredResults.length === 0 &&
    originalResults.length > 0
  ) {
    console.log(
      `⚠️ MANUAL SEARCH with no ranked results - forcing inclusion of API results`,
    );
    return originalResults.filter(
      (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
    );
  }

  return filteredResults;
}

/**
 * Process Comick search results and return sorted manga with confidence scores
 */
function processComickResults(
  comickResults: EnhancedAniListManga[],
  title: string,
  comickSourceMap: Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >,
): AniListManga[] {
  const processedResults = comickResults.map((enhancedManga) => {
    if (enhancedManga.sourceInfo) {
      comickSourceMap.set(enhancedManga.id, {
        title: enhancedManga.sourceInfo.title,
        slug: enhancedManga.sourceInfo.slug,
        comickId: enhancedManga.sourceInfo.sourceId,
        foundViaComick: enhancedManga.sourceInfo.foundViaAlternativeSearch,
      });
    }

    const manga = convertEnhancedMangaToAniList(enhancedManga);
    const confidence = calculateConfidence(title, manga);
    const titleTypePriority = calculateTitleTypePriority(manga, title);

    console.log(
      `⚖️ Comick result confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (found via Comick: ${enhancedManga.sourceInfo?.title || "unknown"})`,
    );

    return { manga, confidence, titleTypePriority };
  });

  // Sort by confidence and priority
  processedResults.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  return processedResults.map((match) => match.manga);
}

/**
 * Apply content filtering to manga results based on match configuration
 */
function applyComickFiltering(
  comickResults: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  if (searchConfig.bypassCache) {
    return comickResults;
  }

  const matchConfig = getMatchConfig();
  let filteredResults = comickResults;

  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !isOneShot(manga));
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) from Comick results for "${title}"`,
      );
    }
  }

  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !manga.isAdult);
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} adult content from Comick results for "${title}"`,
      );
    }
  }

  return filteredResults;
}

/**
 * Process MangaDex results for display
 */
function processMangaDexResults(
  mangaDexResults: EnhancedAniListManga[],
  title: string,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >,
): AniListManga[] {
  const processedResults = mangaDexResults.map((enhancedManga) => {
    if (enhancedManga.sourceInfo) {
      mangaDexSourceMap.set(enhancedManga.id, {
        title: enhancedManga.sourceInfo.title,
        slug: enhancedManga.sourceInfo.slug,
        mangaDexId: enhancedManga.sourceInfo.sourceId,
        foundViaMangaDex: enhancedManga.sourceInfo.foundViaAlternativeSearch,
      });
    }

    const manga = convertEnhancedMangaToAniList(enhancedManga);
    const confidence = calculateConfidence(title, manga);
    const titleTypePriority = calculateTitleTypePriority(manga, title);

    console.log(
      `⚖️ MangaDex result confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (found via MangaDex: ${enhancedManga.sourceInfo?.title || "unknown"})`,
    );

    return { manga, confidence, titleTypePriority };
  });

  // Sort by confidence and priority
  processedResults.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  return processedResults.map((match) => match.manga);
}

/**
 * Apply content filtering to MangaDex results based on match configuration
 */
function applyMangaDexFiltering(
  mangaDexResults: AniListManga[],
  title: string,
  searchConfig: SearchServiceConfig,
): AniListManga[] {
  if (searchConfig.bypassCache) {
    return mangaDexResults;
  }

  const matchConfig = getMatchConfig();
  let filteredResults = mangaDexResults;

  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !isOneShot(manga));
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) from MangaDex results for "${title}"`,
      );
    }
  }

  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !manga.isAdult);
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} adult content from MangaDex results for "${title}"`,
      );
    }
  }

  return filteredResults;
}

/**
 * Convert enhanced manga to AniListManga format
 */
function convertEnhancedMangaToAniList(
  enhancedManga: EnhancedAniListManga,
): AniListManga {
  return {
    id: enhancedManga.id,
    title: enhancedManga.title,
    synonyms: enhancedManga.synonyms,
    description: enhancedManga.description,
    format: enhancedManga.format,
    status: enhancedManga.status,
    chapters: enhancedManga.chapters,
    volumes: enhancedManga.volumes,
    countryOfOrigin: enhancedManga.countryOfOrigin,
    source: enhancedManga.source,
    coverImage: enhancedManga.coverImage,
    genres: enhancedManga.genres,
    tags: enhancedManga.tags,
    startDate: enhancedManga.startDate,
    staff: enhancedManga.staff,
    mediaListEntry: enhancedManga.mediaListEntry
      ? {
          ...enhancedManga.mediaListEntry,
          status: enhancedManga.mediaListEntry.status,
        }
      : enhancedManga.mediaListEntry,
    isAdult: enhancedManga.isAdult,
  };
}

/**
 * Execute Comick fallback search when no AniList results found
 */
async function executeComickFallback(
  title: string,
  token: string | undefined,
  finalResults: AniListManga[],
  searchConfig: SearchServiceConfig,
): Promise<{
  results: AniListManga[];
  comickSourceMap: Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >;
}> {
  const comickSourceMap = new Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >();

  const matchConfig = getMatchConfig();

  // Early return if conditions not met for Comick search
  if (!token) {
    return { results: finalResults, comickSourceMap };
  }

  if (!matchConfig.enableComickSearch) {
    return { results: finalResults, comickSourceMap };
  }

  console.log(
    `🎯 No AniList results found for "${title}", trying Comick fallback...`,
  );

  try {
    const { mangaSourceRegistry, MangaSource } = await import(
      "../manga-sources"
    );
    const comickLimit = 1;

    console.log(`🔍 Searching Comick with limit ${comickLimit} for "${title}"`);

    const comickResults = await mangaSourceRegistry.searchAndGetAniListManga(
      MangaSource.COMICK,
      title,
      token,
      comickLimit,
    );

    if (comickResults.length === 0) {
      console.log(`📦 No Comick results found for "${title}"`);
      return { results: finalResults, comickSourceMap };
    }

    console.log(
      `✅ Comick found ${comickResults.length} results for "${title}"`,
    );

    // Process the Comick results
    let processedResults = processComickResults(
      comickResults,
      title,
      comickSourceMap,
    );

    console.log(
      `🎯 Using ${processedResults.length} Comick results as fallback for "${title}"`,
    );

    // Apply filtering to Comick results
    processedResults = applyComickFiltering(
      processedResults,
      title,
      searchConfig,
    );

    return { results: processedResults, comickSourceMap };
  } catch (error) {
    console.error(`❌ Comick fallback failed for "${title}":`, error);
    return { results: finalResults, comickSourceMap };
  }
}

/**
 * Execute MangaDex fallback search when no AniList results found
 */
async function executeMangaDexFallback(
  title: string,
  token: string | undefined,
  finalResults: AniListManga[],
  searchConfig: SearchServiceConfig,
): Promise<{
  results: AniListManga[];
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >;
}> {
  const mangaDexSourceMap = new Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >();

  const matchConfig = getMatchConfig();

  // Early return if conditions not met for MangaDex search
  if (!token) {
    return { results: finalResults, mangaDexSourceMap };
  }

  if (!matchConfig.enableMangaDexSearch) {
    return { results: finalResults, mangaDexSourceMap };
  }

  console.log(
    `🎯 No AniList results found for "${title}", trying MangaDex fallback...`,
  );

  try {
    const { mangaSourceRegistry, MangaSource } = await import(
      "../manga-sources"
    );
    const mangaDexLimit = 1;

    console.log(
      `🔍 Searching MangaDex with limit ${mangaDexLimit} for "${title}"`,
    );

    const mangaDexResults = await mangaSourceRegistry.searchAndGetAniListManga(
      MangaSource.MANGADEX,
      title,
      token,
      mangaDexLimit,
    );

    if (mangaDexResults.length === 0) {
      console.log(`📦 No MangaDex results found for "${title}"`);
      return { results: finalResults, mangaDexSourceMap };
    }

    console.log(
      `✅ MangaDex found ${mangaDexResults.length} results for "${title}"`,
    );

    // Process the MangaDex results
    let processedResults = processMangaDexResults(
      mangaDexResults,
      title,
      mangaDexSourceMap,
    );

    console.log(
      `🎯 Using ${processedResults.length} MangaDex results as fallback for "${title}"`,
    );

    // Apply filtering to MangaDex results
    processedResults = applyMangaDexFiltering(
      processedResults,
      title,
      searchConfig,
    );

    return { results: processedResults, mangaDexSourceMap };
  } catch (error) {
    console.error(`❌ MangaDex fallback failed for "${title}":`, error);
    return { results: finalResults, mangaDexSourceMap };
  }
}

/**
 * Merge results from original search, Comick, and MangaDex while handling duplicates
 */
function mergeSourceResults(
  originalResults: AniListManga[],
  comickResults: AniListManga[],
  mangaDexResults: AniListManga[],
  comickSourceMap: Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >,
): {
  mergedResults: AniListManga[];
  comickSourceMap: Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >;
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >;
} {
  const seenIds = new Set<number>();
  const mergedResults: AniListManga[] = [];
  const finalComickSourceMap = new Map(comickSourceMap);
  const finalMangaDexSourceMap = new Map(mangaDexSourceMap);

  // Add original results first
  for (const manga of originalResults) {
    if (!seenIds.has(manga.id)) {
      seenIds.add(manga.id);
      mergedResults.push(manga);
    }
  }

  // Add Comick results, checking for duplicates
  for (const manga of comickResults) {
    if (seenIds.has(manga.id)) {
      // If duplicate, keep the Comick source info
      console.log(
        `🔄 Found duplicate manga ID ${manga.id} from Comick, keeping source info`,
      );
    } else {
      seenIds.add(manga.id);
      mergedResults.push(manga);
    }
  }

  // Add MangaDex results, checking for duplicates
  for (const manga of mangaDexResults) {
    if (seenIds.has(manga.id)) {
      // If duplicate, keep the MangaDex source info
      console.log(
        `🔄 Found duplicate manga ID ${manga.id} from MangaDex, keeping source info`,
      );
    } else {
      seenIds.add(manga.id);
      mergedResults.push(manga);
    }
  }

  console.log(
    `🔗 Merged results: ${originalResults.length} original + ${comickResults.length} Comick + ${mangaDexResults.length} MangaDex = ${mergedResults.length} unique results`,
  );

  return {
    mergedResults,
    comickSourceMap: finalComickSourceMap,
    mangaDexSourceMap: finalMangaDexSourceMap,
  };
}

/**
 * Get source info for a manga from either Comick or MangaDex source maps
 */
function getSourceInfo(
  mangaId: number,
  comickSourceMap: Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >,
) {
  if (comickSourceMap.has(mangaId)) {
    const comickInfo = comickSourceMap.get(mangaId)!;
    return {
      title: comickInfo.title,
      slug: comickInfo.slug,
      sourceId: comickInfo.comickId,
      source: "comick",
      foundViaAlternativeSearch: comickInfo.foundViaComick,
    };
  }

  if (mangaDexSourceMap.has(mangaId)) {
    const mangaDexInfo = mangaDexSourceMap.get(mangaId)!;
    return {
      title: mangaDexInfo.title,
      slug: mangaDexInfo.slug,
      sourceId: mangaDexInfo.mangaDexId,
      source: "mangadex",
      foundViaAlternativeSearch: mangaDexInfo.foundViaMangaDex,
    };
  }

  return undefined;
}

/**
 * Build final response with confidence scoring
 */
function buildFinalResponse(
  finalResults: AniListManga[],
  title: string,
  comickSourceMap: Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >,
  lastPageInfo?: PageInfo,
): MangaSearchResponse {
  console.log(`🔍 Final result count: ${finalResults.length} manga`);

  console.log(
    `⚖️ Calculating fresh confidence scores for ${finalResults.length} matches`,
  );

  const matches = finalResults.map((manga) => {
    const confidence = calculateConfidence(
      typeof title === "string" ? title : "",
      manga,
    );

    const titleTypePriority = calculateTitleTypePriority(
      manga,
      typeof title === "string" ? title : "",
    );

    console.log(
      `⚖️ Confidence for "${manga.title?.english || manga.title?.romaji}": ${confidence}% (priority: ${titleTypePriority})`,
    );

    return {
      manga,
      confidence,
      titleTypePriority,
      comickSource: comickSourceMap.has(manga.id)
        ? comickSourceMap.get(manga.id)
        : undefined,
      mangaDexSource: mangaDexSourceMap.has(manga.id)
        ? mangaDexSourceMap.get(manga.id)
        : undefined,
      sourceInfo: getSourceInfo(manga.id, comickSourceMap, mangaDexSourceMap),
    };
  });

  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  const finalMatches = matches.map(
    ({ manga, confidence, comickSource, mangaDexSource, sourceInfo }) => ({
      manga,
      confidence,
      comickSource,
      mangaDexSource,
      sourceInfo,
    }),
  );

  return {
    matches: finalMatches,
    pageInfo: lastPageInfo,
  };
}

/**
 * Search for manga by title with rate limiting and caching.
 *
 * @param title - The manga title to search for.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration.
 * @param abortSignal - Optional abort signal to cancel the search.
 * @returns A promise resolving to an array of MangaMatch objects.
 * @source
 */
export async function searchMangaByTitle(
  title: string,
  token?: string,
  config: Partial<SearchServiceConfig> = {},
  abortSignal?: AbortSignal,
  specificPage?: number,
): Promise<MangaSearchResponse> {
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };
  const cacheKey = generateCacheKey(title);

  // Handle cache operations
  if (searchConfig.bypassCache && cacheKey) {
    handleCacheBypass(title, cacheKey);
  } else if (!searchConfig.bypassCache) {
    const cachedResult = processCachedResults(title, cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  } else if (searchConfig.exactMatchingOnly) {
    console.log(
      `🔍 MANUAL SEARCH: Ensuring exact matching is correctly configured`,
    );
    searchConfig.exactMatchingOnly = true;
  }

  // Execute the search
  const searchQuery = title;
  await acquireRateLimit();

  const { results, lastPageInfo } = await executeSearchLoop(
    searchQuery,
    searchConfig,
    token,
    abortSignal,
    specificPage,
  );

  // Process and filter results
  const rankedResults = processSearchResults(results, title, searchConfig);
  let filteredResults = applyContentFiltering(
    rankedResults,
    title,
    searchConfig,
  );
  filteredResults = handleNoResultsFallback(
    filteredResults,
    results,
    searchConfig,
  );

  // Handle fallback sources only if no original AniList results were found
  let finalResults = filteredResults;
  let comickSourceMap = new Map<
    number,
    { title: string; slug: string; comickId: string; foundViaComick: boolean }
  >();
  let mangaDexSourceMap = new Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >();

  // Only use fallback sources if no AniList results were found
  if (filteredResults.length === 0) {
    console.log(
      `🎯 No AniList results found for "${title}", trying fallback sources...`,
    );

    // Try both fallback sources when enabled
    const comickFallback = await executeComickFallback(
      title,
      token,
      finalResults,
      searchConfig,
    );
    const mangaDexFallback = await executeMangaDexFallback(
      title,
      token,
      finalResults,
      searchConfig,
    );

    // Merge results and handle duplicates
    const mergedResults = mergeSourceResults(
      finalResults,
      comickFallback.results,
      mangaDexFallback.results,
      comickFallback.comickSourceMap,
      mangaDexFallback.mangaDexSourceMap,
    );

    finalResults = mergedResults.mergedResults;
    comickSourceMap = mergedResults.comickSourceMap;
    mangaDexSourceMap = mergedResults.mangaDexSourceMap;
  } else {
    console.log(
      `✅ Found ${filteredResults.length} AniList results for "${title}", skipping fallback sources`,
    );
  }

  // Build and return final response
  return buildFinalResponse(
    finalResults,
    title,
    comickSourceMap,
    mangaDexSourceMap,
    lastPageInfo,
  );
}

/**
 * Match a single Kenmei manga with AniList entries.
 *
 * @param kenmeiManga - The Kenmei manga entry to match.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration.
 * @returns A promise resolving to a MangaMatchResult object.
 * @source
 */
export async function matchSingleManga(
  kenmeiManga: KenmeiManga,
  token?: string,
  config: Partial<SearchServiceConfig> = {},
): Promise<MangaMatchResult> {
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

  // Search for potential matches
  const searchResponse = await searchMangaByTitle(
    kenmeiManga.title,
    token,
    searchConfig,
  );

  const potentialMatches = searchResponse.matches;

  // If using exact matching and we have matches, just use the top match
  if (searchConfig.exactMatchingOnly && potentialMatches.length > 0) {
    // Calculate a match score for the top result
    const score = calculateMatchScore(
      potentialMatches[0].manga,
      kenmeiManga.title,
    );

    // If we have a good match, return it directly
    if (score > 0.7) {
      return {
        kenmeiManga,
        anilistMatches: [
          { manga: potentialMatches[0].manga, confidence: score * 100 },
        ],
        selectedMatch: potentialMatches[0].manga,
        status: "matched",
        matchDate: new Date(),
      };
    }
  }

  // Fall back to the match engine for more complex matching or no exact matches
  return findBestMatches(
    kenmeiManga,
    potentialMatches.map((match) => match.manga),
    searchConfig.matchConfig,
  );
}

/**
 * Categorize manga list based on cache status and known IDs
 *
 * @param mangaList - List of KenmeiManga to categorize
 * @param searchConfig - Search service configuration
 * @param updateProgress - Callback to update progress
 * @returns Categorized manga lists for processing
 * @source
 */
function categorizeMangaForBatching(
  mangaList: KenmeiManga[],
  searchConfig: SearchServiceConfig,
  updateProgress: (index: number, title?: string) => void,
): {
  cachedResults: Record<number, AniListManga[]>;
  cachedComickSources: Record<
    number,
    Map<
      number,
      {
        title: string;
        slug: string;
        comickId: string;
        foundViaComick: boolean;
      }
    >
  >;
  cachedMangaDexSources: Record<
    number,
    Map<
      number,
      {
        title: string;
        slug: string;
        mangaDexId: string;
        foundViaMangaDex: boolean;
      }
    >
  >;
  uncachedManga: { index: number; manga: KenmeiManga }[];
  knownMangaIds: { index: number; id: number }[];
} {
  const cachedResults: Record<number, AniListManga[]> = {};
  const cachedComickSources: Record<
    number,
    Map<
      number,
      {
        title: string;
        slug: string;
        comickId: string;
        foundViaComick: boolean;
      }
    >
  > = {};
  const cachedMangaDexSources: Record<
    number,
    Map<
      number,
      {
        title: string;
        slug: string;
        mangaDexId: string;
        foundViaMangaDex: boolean;
      }
    >
  > = {};
  const uncachedManga: { index: number; manga: KenmeiManga }[] = [];
  const knownMangaIds: { index: number; id: number }[] = [];

  // If we're bypassing cache, treat all manga as uncached
  if (searchConfig.bypassCache) {
    console.log(
      `🚨 FRESH SEARCH: Bypassing cache for all ${mangaList.length} manga titles`,
    );

    // Put all manga in the uncached list
    for (const [index, manga] of mangaList.entries()) {
      uncachedManga.push({ index, manga });
    }
  } else {
    console.log(`Checking cache for ${mangaList.length} manga titles...`);

    // Check cache for all manga first
    for (const [index, manga] of mangaList.entries()) {
      const cacheKey = generateCacheKey(manga.title);

      // If manga has a known AniList ID, we can batch fetch it
      if (manga.anilistId && Number.isInteger(manga.anilistId)) {
        knownMangaIds.push({ index, id: manga.anilistId });
      }
      // Otherwise check the cache
      else if (isCacheValid(cacheKey)) {
        // This manga is in cache
        cachedResults[index] = mangaCache[cacheKey].manga;
        cachedComickSources[index] = new Map(); // Cached results from direct AniList cache don't have Comick source info
        cachedMangaDexSources[index] = new Map();
        console.log(`Found cached results for: ${manga.title}`);

        // Immediately update progress for cached manga
        updateProgress(index, manga.title);
      } else {
        // This manga needs to be fetched by search
        uncachedManga.push({ index, manga });
      }
    }

    console.log(
      `Found ${Object.keys(cachedResults).length} cached manga, ${knownMangaIds.length} have known IDs, ${uncachedManga.length} require searching`,
    );
  }

  return {
    cachedResults,
    cachedComickSources,
    cachedMangaDexSources,
    uncachedManga,
    knownMangaIds,
  };
}

/**
 * Process manga with known IDs by fetching them in batches
 */
async function processKnownMangaIds(
  data: {
    knownMangaIds: { index: number; id: number }[];
    mangaList: KenmeiManga[];
    uncachedManga: { index: number; manga: KenmeiManga }[];
  },
  config: {
    searchConfig: SearchServiceConfig;
    token: string | undefined;
  },
  control: {
    shouldCancel: (() => boolean) | undefined;
    abortSignal: AbortSignal | undefined;
  },
  callbacks: {
    updateProgress: (index: number, title?: string) => void;
  },
  storage: {
    cachedResults: Record<number, AniListManga[]>;
    cachedComickSources: Record<
      number,
      Map<
        number,
        {
          title: string;
          slug: string;
          comickId: string;
          foundViaComick: boolean;
        }
      >
    >;
    cachedMangaDexSources: Record<
      number,
      Map<
        number,
        {
          title: string;
          slug: string;
          mangaDexId: string;
          foundViaMangaDex: boolean;
        }
      >
    >;
  },
): Promise<void> {
  const { knownMangaIds, mangaList, uncachedManga } = data;
  const { searchConfig, token } = config;
  const { shouldCancel, abortSignal } = control;
  const { updateProgress } = callbacks;
  const { cachedResults, cachedComickSources, cachedMangaDexSources } = storage;

  if (knownMangaIds.length === 0 || searchConfig.bypassCache) {
    return;
  }

  const ids = knownMangaIds.map((item) => item.id);
  console.log(`Fetching ${ids.length} manga with known IDs...`);

  // Get manga by IDs in batches, passing the abort signal
  const batchedManga = await getBatchedMangaIds(
    ids,
    token,
    shouldCancel,
    abortSignal,
  );

  // Create a map of ID to manga for easier lookup
  const mangaMap = new Map<number, AniListManga>();
  for (const manga of batchedManga) {
    mangaMap.set(manga.id, manga);
  }

  // Store the results in cachedResults by their original index
  for (const item of knownMangaIds) {
    const manga = mangaMap.get(item.id);
    if (manga) {
      cachedResults[item.index] = [manga]; // Store as array of one manga for consistency
      cachedComickSources[item.index] = new Map(); // Known IDs don't have Comick source info
      cachedMangaDexSources[item.index] = new Map();

      // Also store in the general cache to help future searches
      const title = mangaList[item.index].title;
      const cacheKey = generateCacheKey(title);
      mangaCache[cacheKey] = {
        manga: [manga],
        timestamp: Date.now(),
      };

      // Update progress for each found manga
      updateProgress(item.index, title);
    } else {
      // Manga ID was not found, add to uncached list for title search
      uncachedManga.push({
        index: item.index,
        manga: mangaList[item.index],
      });
    }
  }
}

/**
 * Process uncached manga with concurrency control
 */
async function processUncachedManga(
  data: {
    uncachedManga: { index: number; manga: KenmeiManga }[];
    mangaList: KenmeiManga[];
    reportedIndices: Set<number>;
  },
  config: {
    token: string | undefined;
    searchConfig: SearchServiceConfig;
  },
  control: {
    abortSignal: AbortSignal | undefined;
    checkCancellation: () => void;
  },
  callbacks: {
    updateProgress: (index: number, title?: string) => void;
  },
  storage: {
    cachedResults: Record<number, AniListManga[]>;
    cachedComickSources: Record<
      number,
      Map<
        number,
        {
          title: string;
          slug: string;
          comickId: string;
          foundViaComick: boolean;
        }
      >
    >;
    cachedMangaDexSources: Record<
      number,
      Map<
        number,
        {
          title: string;
          slug: string;
          mangaDexId: string;
          foundViaMangaDex: boolean;
        }
      >
    >;
  },
): Promise<void> {
  const { uncachedManga, mangaList, reportedIndices } = data;
  const { token, searchConfig } = config;
  const { abortSignal, checkCancellation } = control;
  const { updateProgress } = callbacks;
  const { cachedResults, cachedComickSources, cachedMangaDexSources } = storage;

  if (uncachedManga.length === 0) {
    return;
  }

  // Create a semaphore to strictly limit concurrency - process one manga at a time
  const MAX_CONCURRENT = 1;
  let activeCount = 0;

  // Track processed manga to prevent duplicates
  const processedMangas = new Set<number>();

  // Create a queue that will be processed one by one
  const queue = [...uncachedManga];

  // Create a promise that we can use to wait for all processing to complete
  let resolve: (value: void | PromiseLike<void>) => void;
  let reject: (reason?: unknown) => void;
  const completionPromise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Track if we've been cancelled
  let isCancelled = false;

  // Function to check if we're done processing all manga
  const checkIfDone = () => {
    if ((queue.length === 0 && activeCount === 0) || isCancelled) {
      resolve();
    }
  };

  /**
   * Search for manga and store results with alternative source information
   */
  const searchAndStoreManga = async (
    index: number,
    manga: KenmeiManga,
    options: {
      token: string | undefined;
      searchConfig: SearchServiceConfig;
      abortSignal: AbortSignal | undefined;
      checkCancellation: () => void;
      updateProgress: (index: number, title: string) => void;
      cachedResults: { [key: number]: AniListManga[] };
      cachedComickSources: {
        [key: number]: Map<
          number,
          {
            title: string;
            slug: string;
            comickId: string;
            foundViaComick: boolean;
          }
        >;
      };
      cachedMangaDexSources: {
        [key: number]: Map<
          number,
          {
            title: string;
            slug: string;
            mangaDexId: string;
            foundViaMangaDex: boolean;
          }
        >;
      };
    },
  ): Promise<void> => {
    const {
      token,
      searchConfig,
      abortSignal,
      checkCancellation,
      updateProgress,
      cachedResults,
      cachedComickSources,
      cachedMangaDexSources,
    } = options;

    // Double-check cache one more time before searching
    const cacheKey = generateCacheKey(manga.title);
    if (!searchConfig.bypassCache && isCacheValid(cacheKey)) {
      cachedResults[index] = mangaCache[cacheKey].manga;
      cachedComickSources[index] = new Map(); // Cached results don't have Comick source info
      cachedMangaDexSources[index] = new Map();
      console.log(`Using cache for ${manga.title} (found during processing)`);
      // Update progress for this manga
      updateProgress(index, manga.title);
      return;
    }

    // Search for this manga
    console.log(
      `Searching for manga: ${manga.title} (${reportedIndices.size}/${mangaList.length})`,
    );

    // Update progress for this manga before search
    updateProgress(index, manga.title);

    // Check cancellation again before making the API call
    checkCancellation();

    const searchResponse = await searchMangaByTitle(
      manga.title,
      token,
      searchConfig,
      abortSignal, // Pass the abort signal to the search function
    );

    // Store the results, preserving both manga and Comick source info
    cachedResults[index] = searchResponse.matches.map((match) => match.manga);

    // Store alternative source information separately
    const comickSourceMap = new Map<
      number,
      {
        title: string;
        slug: string;
        comickId: string;
        foundViaComick: boolean;
      }
    >();
    const mangaDexSourceMap = new Map<
      number,
      {
        title: string;
        slug: string;
        mangaDexId: string;
        foundViaMangaDex: boolean;
      }
    >();
    for (const match of searchResponse.matches) {
      if (match.comickSource) {
        comickSourceMap.set(match.manga.id, match.comickSource);
      }
      if (match.mangaDexSource) {
        mangaDexSourceMap.set(match.manga.id, match.mangaDexSource);
      }

      if (
        !comickSourceMap.has(match.manga.id) &&
        match.sourceInfo?.source === "comick"
      ) {
        comickSourceMap.set(match.manga.id, {
          title: match.sourceInfo.title,
          slug: match.sourceInfo.slug,
          comickId: match.sourceInfo.sourceId,
          foundViaComick: match.sourceInfo.foundViaAlternativeSearch,
        });
      }

      if (
        !mangaDexSourceMap.has(match.manga.id) &&
        match.sourceInfo?.source === "mangadex"
      ) {
        mangaDexSourceMap.set(match.manga.id, {
          title: match.sourceInfo.title,
          slug: match.sourceInfo.slug,
          mangaDexId: match.sourceInfo.sourceId,
          foundViaMangaDex: match.sourceInfo.foundViaAlternativeSearch,
        });
      }
    }
    cachedComickSources[index] = comickSourceMap;
    cachedMangaDexSources[index] = mangaDexSourceMap;
  };

  /**
   * Handle errors during manga processing
   */
  const handleMangaProcessingError = (
    error: unknown,
    manga: KenmeiManga,
    index: number,
    cachedResults: { [key: number]: AniListManga[] },
    cachedComickSources: {
      [key: number]: Map<
        number,
        {
          title: string;
          slug: string;
          comickId: string;
          foundViaComick: boolean;
        }
      >;
    },
    cachedMangaDexSources: {
      [key: number]: Map<
        number,
        {
          title: string;
          slug: string;
          mangaDexId: string;
          foundViaMangaDex: boolean;
        }
      >;
    },
    onCancellation: () => void,
  ): boolean => {
    // Check if this was a cancellation
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.message.includes("aborted"))
    ) {
      console.error(`Search cancelled for manga: ${manga.title}`);
      onCancellation();
      return true; // Indicates cancellation
    }

    console.error(`Error searching for manga: ${manga.title}`, error);
    // Store empty result on error
    cachedResults[index] = [];
    cachedComickSources[index] = new Map();
    cachedMangaDexSources[index] = new Map();
    return false; // Indicates regular error, not cancellation
  };

  // Function to start processing the next manga in the queue
  const processNext = async () => {
    // Check for cancellation
    try {
      checkCancellation();
    } catch (error) {
      isCancelled = true;
      reject(error);
      return;
    }

    // If the queue is empty or we're cancelled, we're done
    if (queue.length === 0 || isCancelled) {
      checkIfDone();
      return;
    }

    // If we're at max concurrency, wait
    if (activeCount >= MAX_CONCURRENT) {
      return;
    }

    // Get the next manga from the queue
    const { index, manga } = queue.shift()!;

    // Skip if this manga has already been processed
    if (processedMangas.has(index)) {
      processNext();
      return;
    }

    // Mark this manga as being processed
    processedMangas.add(index);
    activeCount++;

    try {
      // Check cancellation again before searching
      checkCancellation();

      await searchAndStoreManga(index, manga, {
        token,
        searchConfig,
        abortSignal,
        checkCancellation,
        updateProgress,
        cachedResults,
        cachedComickSources,
        cachedMangaDexSources,
      });
    } catch (error) {
      const wasCancelled = handleMangaProcessingError(
        error,
        manga,
        index,
        cachedResults,
        cachedComickSources,
        cachedMangaDexSources,
        () => {
          isCancelled = true;
          reject(error);
        },
      );

      if (wasCancelled) {
        return;
      }
    } finally {
      // Decrement the active count and process the next manga
      activeCount--;

      // Don't try to process more if we've been cancelled
      if (!isCancelled) {
        processNext();
      }

      // Check if we're done
      checkIfDone();
    }
  };

  // Start processing up to MAX_CONCURRENT manga
  for (let i = 0; i < Math.min(MAX_CONCURRENT, uncachedManga.length); i++) {
    processNext();
  }

  try {
    // Wait for all processing to complete
    await completionPromise;
  } catch (error) {
    console.log("Processing cancelled:", error);

    // If this is a cancellation, we need to propagate it
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.message.includes("aborted"))
    ) {
      throw error; // Propagate the cancellation error
    }

    // If it's a different kind of error, rethrow it
    throw error;
  }
}

/**
 * Apply filtering rules to potential matches based on match configuration
 */
function applyMatchFiltering(
  potentialMatches: AniListManga[],
  mangaTitle: string,
  matchConfig: { ignoreOneShots?: boolean; ignoreAdultContent?: boolean },
): AniListManga[] {
  let filteredMatches = potentialMatches;

  // Filter out one-shots if the setting is enabled (for automatic matching)
  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredMatches.length;
    filteredMatches = filteredMatches.filter((match) => !isOneShot(match));
    const afterFilter = filteredMatches.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) for "${mangaTitle}" during batch matching`,
      );
    }
  }

  // Filter out adult content if the setting is enabled (for automatic matching)
  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredMatches.length;
    filteredMatches = filteredMatches.filter((match) => !match.isAdult);
    const afterFilter = filteredMatches.length;

    if (beforeFilter > afterFilter) {
      console.log(
        `🚫 Filtered out ${beforeFilter - afterFilter} adult content manga for "${mangaTitle}" during batch matching`,
      );
    }
  }

  return filteredMatches;
}

/**
 * Create MangaMatchResult for a single manga entry
 */
function createMangaMatchResult(
  manga: KenmeiManga,
  potentialMatches: AniListManga[],
  comickSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      comickId: string;
      foundViaComick: boolean;
    }
  >,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >,
): MangaMatchResult {
  // Fix mapping to create proper MangaMatch objects with Comick source info
  const potentialMatchesFixed = potentialMatches.map((match) => {
    const sourceInfo = getSourceInfo(
      match.id,
      comickSourceMap,
      mangaDexSourceMap,
    );

    return {
      manga: match,
      confidence: calculateConfidence(manga.title, match),
      comickSource: comickSourceMap.get(match.id), // Include Comick source if available
      mangaDexSource: mangaDexSourceMap.get(match.id),
      sourceInfo,
    };
  });

  return {
    kenmeiManga: manga,
    anilistMatches: potentialMatchesFixed,
    selectedMatch:
      potentialMatchesFixed.length > 0
        ? potentialMatchesFixed[0].manga
        : undefined,
    status: "pending",
  };
}

/**
 * Compile final results from cached data and create MangaMatchResult objects
 */
function compileMatchResults(
  mangaList: KenmeiManga[],
  cachedResults: Record<number, AniListManga[]>,
  cachedComickSources: Record<
    number,
    Map<
      number,
      {
        title: string;
        slug: string;
        comickId: string;
        foundViaComick: boolean;
      }
    >
  >,
  cachedMangaDexSources: Record<
    number,
    Map<
      number,
      {
        title: string;
        slug: string;
        mangaDexId: string;
        foundViaMangaDex: boolean;
      }
    >
  >,
  checkCancellation: () => void,
  updateProgress: (index: number, title?: string) => void,
): MangaMatchResult[] {
  const results: MangaMatchResult[] = [];

  // First fill in the results array to match the mangaList length
  for (let i = 0; i < mangaList.length; i++) {
    results[i] = {
      kenmeiManga: mangaList[i],
      anilistMatches: [],
      status: "pending",
    } as MangaMatchResult; // Use empty arrays instead of null

    // Initialize empty Comick source maps for missing entries
    if (!cachedComickSources[i]) {
      cachedComickSources[i] = new Map();
    }
    if (!cachedMangaDexSources[i]) {
      cachedMangaDexSources[i] = new Map();
    }
  }

  // Fill in the results for manga we have matches for
  const matchConfig = getMatchConfig();
  for (let i = 0; i < mangaList.length; i++) {
    // Check for cancellation periodically
    if (i % 10 === 0) {
      checkCancellation();
    }

    const manga = mangaList[i];
    let potentialMatches = cachedResults[i] || [];

    // Apply filtering rules based on match configuration
    potentialMatches = applyMatchFiltering(
      potentialMatches,
      manga.title,
      matchConfig,
    );

    // Update progress for any remaining manga
    updateProgress(i, manga.title);

    // Create match result for this manga
    const comickSourceMap = cachedComickSources[i] || new Map();
    const mangaDexSourceMap = cachedMangaDexSources[i] || new Map();
    results[i] = createMangaMatchResult(
      manga,
      potentialMatches,
      comickSourceMap,
      mangaDexSourceMap,
    );
  }

  // Filter out any null entries (though there shouldn't be any)
  return results.filter((result) => result !== null);
}

/**
 * Handle partial results in case of cancellation during processing
 */
function handleCancellationResults(
  mangaList: KenmeiManga[],
  cachedResults: Record<number, AniListManga[]>,
): MangaMatchResult[] {
  const results: MangaMatchResult[] = [];

  // Process whatever results we have so far
  for (let i = 0; i < mangaList.length; i++) {
    if (cachedResults[i]) {
      const manga = mangaList[i];
      const potentialMatches = cachedResults[i].map((anilistManga) => ({
        manga: anilistManga,
        confidence: calculateConfidence(manga.title, anilistManga),
      }));

      results.push({
        kenmeiManga: manga,
        anilistMatches: potentialMatches,
        selectedMatch:
          potentialMatches.length > 0 ? potentialMatches[0].manga : undefined,
        status: "pending",
      });
    }
  }

  return results;
}

/**
 * Process matches for a batch of manga.
 *
 * @param mangaList - The list of Kenmei manga entries to match.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration.
 * @param progressCallback - Optional callback for progress updates.
 * @param shouldCancel - Optional function to check for cancellation.
 * @param abortSignal - Optional abort signal to cancel the batch process.
 * @returns A promise resolving to an array of MangaMatchResult objects.
 * @source
 */
export async function batchMatchManga(
  mangaList: KenmeiManga[],
  token?: string,
  config: Partial<SearchServiceConfig> = {},
  progressCallback?: (
    current: number,
    total: number,
    currentTitle?: string,
  ) => void,
  shouldCancel?: () => boolean,
  abortSignal?: AbortSignal,
): Promise<MangaMatchResult[]> {
  // Ensure we have the latest cache data
  syncWithClientCache();

  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

  // Create a set to track which manga have been reported in the progress
  const reportedIndices = new Set<number>();

  // Function to check if the operation should be cancelled
  const checkCancellation = () => {
    // Check the abort signal first
    if (abortSignal?.aborted) {
      console.log("Batch matching process aborted by abort signal");
      throw new Error("Operation aborted by abort signal");
    }

    // Then check the cancellation function
    if (shouldCancel?.()) {
      console.log("Batch matching process cancelled by user");
      throw new Error("Operation cancelled by user");
    }

    return false;
  };

  // Update progress with deduplication
  const updateProgress = (index: number, title?: string) => {
    if (progressCallback && !reportedIndices.has(index)) {
      reportedIndices.add(index);
      progressCallback(reportedIndices.size, mangaList.length, title);
    }
  };

  try {
    // Categorize manga based on cache status
    const {
      cachedResults,
      cachedComickSources,
      cachedMangaDexSources,
      uncachedManga,
      knownMangaIds,
    } = categorizeMangaForBatching(mangaList, searchConfig, updateProgress);

    // Check for cancellation
    checkCancellation();

    // Process manga with known IDs first
    await processKnownMangaIds(
      { knownMangaIds, mangaList, uncachedManga },
      { searchConfig, token },
      { shouldCancel, abortSignal },
      { updateProgress },
      { cachedResults, cachedComickSources, cachedMangaDexSources },
    );

    // Check for cancellation
    checkCancellation();

    // Process uncached manga
    try {
      await processUncachedManga(
        { uncachedManga, mangaList, reportedIndices },
        { token, searchConfig },
        { abortSignal, checkCancellation },
        { updateProgress },
        { cachedResults, cachedComickSources, cachedMangaDexSources },
      );
    } catch (error) {
      console.log("Processing cancelled:", error);

      // If we got here due to cancellation, return the partial results we've managed to gather
      if (
        error instanceof Error &&
        (error.message.includes("cancelled") ||
          error.message.includes("aborted"))
      ) {
        console.log(`Cancellation completed, returning partial results`);

        return handleCancellationResults(mangaList, cachedResults);
      }

      // If it's a different kind of error, rethrow it
      throw error;
    }

    // Check for cancellation after the batch completes
    checkCancellation();

    // Compile final results
    return compileMatchResults(
      mangaList,
      cachedResults,
      cachedComickSources,
      cachedMangaDexSources,
      checkCancellation,
      updateProgress,
    );
  } catch (error) {
    console.error("Error in batch matching process:", error);

    // If we got here due to cancellation, return whatever partial results we have
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.message.includes("aborted"))
    ) {
      console.log(`Cancellation detected, returning partial results`);
      // We don't have access to the variables in this scope, so return empty array
      return [];
    }

    // Otherwise rethrow the error
    throw error;
  }
}

/**
 * Pre-search for common manga titles to populate cache.
 *
 * @param titles - Array of manga titles to preload.
 * @param token - Optional authentication token.
 * @param config - Optional search service configuration.
 * @returns A promise that resolves when preloading is complete.
 * @source
 */
export async function preloadCommonManga(
  titles: string[],
  token?: string,
  config: Partial<SearchServiceConfig> = {},
): Promise<void> {
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

  // Process in batches to respect rate limits
  for (let i = 0; i < titles.length; i += searchConfig.batchSize) {
    const batch = titles.slice(i, i + searchConfig.batchSize);

    // Process batch items in sequence with rate limiting
    for (const title of batch) {
      const cacheKey = generateCacheKey(title);

      // Only search if not already in cache
      if (!isCacheValid(cacheKey)) {
        await searchMangaByTitle(title, token, searchConfig);
      }
    }
  }
}

/**
 * Clear the manga cache.
 *
 * @source
 */
export function clearMangaCache(): void {
  for (const key of Object.keys(mangaCache)) {
    delete mangaCache[key];
  }
}

/**
 * Get cache statistics.
 *
 * @returns An object containing cache size, entries, and age information.
 * @source
 */
export function getCacheStats(): {
  size: number;
  entries: number;
  oldestEntry: number;
  newestEntry: number;
} {
  const keys = Object.keys(mangaCache);

  if (keys.length === 0) {
    return {
      size: 0,
      entries: 0,
      oldestEntry: 0,
      newestEntry: 0,
    };
  }

  // Calculate total cached manga entries
  let totalEntries = 0;
  let oldestTimestamp = Date.now();
  let newestTimestamp = 0;

  for (const key of keys) {
    const entry = mangaCache[key];
    totalEntries += entry.manga.length;

    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }

    if (entry.timestamp > newestTimestamp) {
      newestTimestamp = entry.timestamp;
    }
  }

  return {
    size: keys.length,
    entries: totalEntries,
    oldestEntry: Math.floor((Date.now() - oldestTimestamp) / 1000 / 60), // minutes ago
    newestEntry: Math.floor((Date.now() - newestTimestamp) / 1000 / 60), // minutes ago
  };
}

/**
 * Debug and troubleshoot the cache status. Exposes functions to check and diagnose cache issues.
 *
 * @source
 */
export const cacheDebugger = {
  /**
   * Get a summary of the current cache status
   */
  getCacheStatus(): {
    inMemoryCache: number;
    localStorage: {
      mangaCache: number;
      searchCache: number;
    };
  } {
    // Check in-memory cache
    const inMemoryCount = Object.keys(mangaCache).length;

    // Check localStorage
    let storedMangaCount = 0;
    let storedSearchCount = 0;

    if (globalThis.window !== undefined) {
      try {
        const mangaCacheData = localStorage.getItem("anilist_manga_cache");
        if (mangaCacheData) {
          const parsed = JSON.parse(mangaCacheData);
          storedMangaCount = Object.keys(parsed).length;
        }

        const searchCacheData = localStorage.getItem("anilist_search_cache");
        if (searchCacheData) {
          const parsed = JSON.parse(searchCacheData);
          storedSearchCount = Object.keys(parsed).length;
        }
      } catch (e) {
        console.error("Error checking localStorage cache:", e);
      }
    }

    return {
      inMemoryCache: inMemoryCount,
      localStorage: {
        mangaCache: storedMangaCount,
        searchCache: storedSearchCount,
      },
    };
  },

  /**
   * Check if a specific manga title is in cache
   */
  checkMangaInCache(title: string): {
    found: boolean;
    cacheKey: string;
    entry?: {
      mangaCount: number;
      timestamp: number;
      age: string;
    };
  } {
    const cacheKey = generateCacheKey(title);
    const entry = mangaCache[cacheKey];

    if (!entry) {
      return { found: false, cacheKey };
    }

    // Calculate age
    const ageMs = Date.now() - entry.timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);

    let age: string;
    if (ageMinutes < 60) {
      age = `${ageMinutes} minute(s)`;
    } else if (ageMinutes < 1440) {
      age = `${Math.floor(ageMinutes / 60)} hour(s)`;
    } else {
      age = `${Math.floor(ageMinutes / 1440)} day(s)`;
    }

    return {
      found: true,
      cacheKey,
      entry: {
        mangaCount: entry.manga.length,
        timestamp: entry.timestamp,
        age,
      },
    };
  },

  /**
   * Force a sync of the caches
   */
  forceSyncCaches(): void {
    syncWithClientCache();
    console.log("Cache sync forced, current status:");
    console.log(this.getCacheStatus());
  },

  /**
   * Reset all caches (both in-memory and localStorage)
   */
  resetAllCaches(): void {
    // Clear in-memory cache
    clearMangaCache();

    // Clear localStorage caches
    if (globalThis.window !== undefined) {
      try {
        localStorage.removeItem("anilist_manga_cache");
        localStorage.removeItem("anilist_search_cache");
        console.log("All AniList caches have been cleared");
      } catch (e) {
        console.error("Error clearing localStorage caches:", e);
      }
    }
  },

  /**
   * Clear cache entry for a specific manga title
   * @param title The manga title to clear from cache
   * @returns boolean True if an entry was cleared, false if no entry was found
   */
  clearCacheEntryForTitle(title: string): boolean {
    // Generate cache key for the title
    const mainKey = generateCacheKey(title);
    let cleared = false;

    // Check if we have this entry in the cache
    if (mangaCache[mainKey]) {
      delete mangaCache[mainKey];
      cleared = true;
    }

    // Try alternate forms of the title (English title/native title)
    // This should only match EXACT English/Native titles, not partial matches
    const titleLower = title.toLowerCase().trim();

    // Track entries to remove (to avoid modifying while iterating)
    const keysToRemove: string[] = [];

    // Look for entries that may be this exact manga but stored under a different title variant
    for (const key of Object.keys(mangaCache)) {
      if (key === mainKey) continue; // Skip the main key we already handled

      // Check if this cache entry is for this specific manga (by exact title match)
      const entries = mangaCache[key].manga;

      for (const manga of entries) {
        if (!manga.title) continue;

        // Only compare exact matches for English/romaji titles
        const romajiTitle = manga.title.romaji
          ? manga.title.romaji.toLowerCase().trim()
          : "";
        const englishTitle = manga.title.english
          ? manga.title.english.toLowerCase().trim()
          : "";

        // Only delete if it's an exact title match, not partial matches
        if (
          (romajiTitle && romajiTitle === titleLower) ||
          (englishTitle && englishTitle === titleLower)
        ) {
          keysToRemove.push(key);
          break; // No need to check other manga in this entry
        }
      }
    }

    // Remove the entries outside the loop to avoid concurrent modification
    if (keysToRemove.length > 0) {
      for (const key of keysToRemove) {
        delete mangaCache[key];
      }
      cleared = true;
    }

    // Save the updated cache if we cleared anything
    if (cleared) {
      saveCache();
    }

    return cleared;
  },

  /**
   * Clear cache entries for multiple manga titles at once
   * @param titles Array of manga titles to clear from cache
   * @returns number Number of cache entries cleared
   */
  clearCacheForTitles(titles: string[]): number {
    if (!titles || titles.length === 0) return 0;

    console.log(`Clearing cache for ${titles.length} manga titles...`);
    let entriesCleared = 0;
    let notFoundCount = 0;

    // Process all titles in a batch
    for (const title of titles) {
      if (this.clearCacheEntryForTitle(title)) {
        entriesCleared++;
      } else {
        notFoundCount++;
      }
    }

    console.log(
      `Cleared ${entriesCleared} cache entries (${notFoundCount} titles had no existing cache entries)`,
    );
    return entriesCleared;
  },

  clearAllCaches() {
    // Clear in-memory cache
    for (const key of Object.keys(mangaCache)) {
      delete mangaCache[key];
    }

    // Clear localStorage caches
    try {
      localStorage.removeItem("anilist_manga_cache");
      localStorage.removeItem("anilist_search_cache");
      console.log("All AniList caches cleared successfully");
    } catch (e) {
      console.error("Error clearing localStorage caches:", e);
    }

    return this.getCacheStatus();
  },

  printCacheKeysFor(title: string) {
    const key = generateCacheKey(title);
    console.log(`Cache key for "${title}": ${key}`);

    // Check if we have a cache entry for this title
    if (mangaCache[key]) {
      console.log(
        `Found in-memory cache entry for "${title}" with ${mangaCache[key].manga.length} results`,
      );
    } else {
      console.log(`No in-memory cache entry found for "${title}"`);
    }

    return key;
  },

  dumpCache() {
    return {
      ...mangaCache,
    };
  },
};

/**
 * Fetch manga by IDs in batches.
 *
 * @param ids - Array of AniList manga IDs to fetch.
 * @param token - Optional authentication token.
 * @param shouldCancel - Optional function to check for cancellation.
 * @param abortSignal - Optional abort signal to cancel the fetch.
 * @returns A promise resolving to an array of AniListManga objects.
 * @source
 */
export async function getBatchedMangaIds(
  ids: number[],
  token?: string,
  shouldCancel?: () => boolean,
  abortSignal?: AbortSignal,
): Promise<AniListManga[]> {
  if (!ids.length) return [];

  // Check for cancellation
  if (shouldCancel?.()) {
    throw new Error("Operation cancelled by user");
  }

  // Abort if signal is aborted
  if (abortSignal?.aborted) {
    throw new Error("Operation aborted by abort signal");
  }

  const results: AniListManga[] = [];
  const batchSize = 25; // AniList allows 25 ids per request

  // Process in batches to avoid overloading the API
  for (let i = 0; i < ids.length; i += batchSize) {
    // Check for cancellation between batches
    if (shouldCancel?.()) {
      throw new Error("Operation cancelled by user");
    }

    // Abort if signal is aborted
    if (abortSignal?.aborted) {
      throw new Error("Operation aborted by abort signal");
    }

    const batchIds = ids.slice(i, i + batchSize);
    try {
      const batchResults = await getMangaByIds(batchIds, token, abortSignal);
      results.push(...batchResults);
    } catch (error) {
      console.error(
        `Error fetching manga batch ${i} to ${i + batchSize}:`,
        error,
      );
      // Continue with next batch even if one fails
    }
  }

  return results;
}

/**
 * Calculate confidence percentage from match score
 * Converts the 0-1 match score to a 0-100 confidence percentage
 * Uses a more conservative algorithm to avoid inflated confidence scores
 * @param searchTitle - The original search title used for matching
 * @param manga - The manga to calculate confidence for
 * @returns Confidence percentage (0-100)
 */
function calculateConfidence(searchTitle: string, manga: AniListManga): number {
  // Calculate the match score first - always use original search title, not manga's own title
  const score = calculateMatchScore(manga, searchTitle);

  console.log(
    `Calculating confidence for match score: ${score.toFixed(3)} between "${searchTitle}" and "${manga.title.english || manga.title.romaji}"`,
  );

  if (score <= 0) {
    // No match found
    return 0;
  } else if (score >= 0.97) {
    // Near-perfect match - cap at 99% to avoid overconfidence
    return 99;
  } else if (score >= 0.94) {
    // Almost perfect match - very high confidence
    return Math.round(90 + (score - 0.94) * 125); // 90-96% range
  } else if (score >= 0.87) {
    // Strong match - high confidence (80-90%)
    return Math.round(80 + (score - 0.87) * 143);
  } else if (score >= 0.75) {
    // Good match - medium-high confidence (65-80%)
    return Math.round(65 + (score - 0.75) * 125);
  } else if (score >= 0.6) {
    // Reasonable match - medium confidence (50-65%)
    return Math.round(50 + (score - 0.6) * 100);
  } else if (score >= 0.4) {
    // Weak match - low confidence (30-50%)
    return Math.round(30 + (score - 0.4) * 100);
  } else if (score >= 0.2) {
    // Very weak match - very low confidence (15-30%)
    return Math.round(15 + (score - 0.2) * 75);
  } else {
    // Extremely weak match - minimal confidence (1-15%)
    return Math.max(1, Math.round(score * 75));
  }
}

/**
 * Clear cache for multiple manga titles at once. Use this when doing a batch rematch operation with bypassCache=true.
 *
 * @param titles - List of manga titles to clear from cache.
 * @returns Object with count of cleared entries and remaining cache size.
 * @source
 */
export function clearCacheForTitles(titles: string[]): {
  clearedCount: number;
  remainingCacheSize: number;
  titlesWithNoCache: number;
} {
  console.log(`Clearing cache for ${titles.length} manga titles...`);

  let clearedCount = 0;
  let titlesWithNoCache = 0;

  // Clear each title's cache entry
  for (const title of titles) {
    const cacheKey = generateCacheKey(title);

    if (mangaCache[cacheKey]) {
      delete mangaCache[cacheKey];
      clearedCount++;
    } else {
      titlesWithNoCache++;
    }
  }

  // Save the updated cache to localStorage
  if (clearedCount > 0) {
    saveCache();
  }

  console.log(
    `Cleared ${clearedCount} cache entries (${titlesWithNoCache} titles had no existing cache entries)`,
  );

  return {
    clearedCount,
    remainingCacheSize: Object.keys(mangaCache).length,
    titlesWithNoCache,
  };
}
