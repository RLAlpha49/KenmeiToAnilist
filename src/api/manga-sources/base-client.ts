/**
 * @packageDocumentation
 * @module manga-source-base-client
 * @description Abstract base class for manga source API clients with common functionality.
 */

import type {
  BaseMangaEntry,
  BaseMangaDetail,
  MangaSourceConfig,
  EnhancedAniListManga,
  MangaSourceCache,
} from "./types";
import { MangaSource } from "./types";
import { getMangaByIds } from "../anilist/client";
import { getAppVersion } from "../../utils/app-version";

/**
 * Abstract base class for manga source API clients with common functionality.
 * Provides caching, URL building, HTTP requests, and AniList integration for all manga sources.
 * @template TMangaEntry - The manga entry type for this source.
 * @template TMangaDetail - The manga detail type for this source.
 * @source
 */
export abstract class BaseMangaSourceClient<
  TMangaEntry extends BaseMangaEntry = BaseMangaEntry,
  TMangaDetail extends BaseMangaDetail = BaseMangaDetail,
> {
  protected config: MangaSourceConfig;
  protected cache: MangaSourceCache = {};
  protected cacheExpiry: number;

  constructor(config: MangaSourceConfig) {
    this.config = config;
    // Cache TTL in milliseconds; default to 30 minutes if not specified
    this.cacheExpiry = (config.cache?.ttlMinutes ?? 30) * 60 * 1000;
  }

  /**
   * Get the source identifier for this client.
   * @returns The source enum value (e.g., MangaSource.COMICK).
   * @source
   */
  public getSource(): MangaSource {
    return this.config.source;
  }

  /**
   * Get the configuration for this source.
   * @returns The source's configuration object.
   * @source
   */
  public getConfig(): MangaSourceConfig {
    return this.config;
  }

  /**
   * Search for manga using this source's API.
   * Must be implemented by each subclass with source-specific logic.
   * @param query - The search query string.
   * @param limit - Maximum number of results to return.
   * @returns Promise resolving to an array of manga entries.
   * @source
   */
  public abstract searchManga(
    query: string,
    limit?: number,
  ): Promise<TMangaEntry[]>;

  /**
   * Get detailed information about a specific manga.
   * Must be implemented by each subclass with source-specific logic.
   * @param slug - The manga identifier or slug.
   * @returns Promise resolving to manga detail or null if not found.
   * @source
   */
  public abstract getMangaDetail(slug: string): Promise<TMangaDetail | null>;

  /**
   * Extract AniList ID from a manga's external links.
   * Must be implemented by each subclass; data structure varies by source.
   * @param detail - The manga detail object containing external links.
   * @returns The AniList ID or null if not found.
   * @source
   */
  protected abstract extractAniListIdFromDetail(
    detail: TMangaDetail,
  ): number | null;

  /**
   * Parse raw API response into manga entries.
   * Must be implemented by each subclass; response format varies by source.
   * @param rawResponse - The raw API response object.
   * @returns Array of parsed manga entries.
   * @source
   */
  // eslint-disable-next-line
  protected abstract parseSearchResponse(rawResponse: any): TMangaEntry[];

  /**
   * Parse raw API response into manga detail.
   * Must be implemented by each subclass; response format varies by source.
   * @param rawResponse - The raw API response object.
   * @returns Parsed manga detail or null if invalid.
   * @source
   */
  // eslint-disable-next-line
  protected abstract parseDetailResponse(rawResponse: any): TMangaDetail | null;

  /**
   * Build search URL with parameters.
   * Can be overridden by sources that need custom URL building logic.
   * @param query - The search query string.
   * @param limit - Maximum number of results.
   * @returns The formatted search URL.
   * @source
   */
  protected buildSearchUrl(query: string, limit: number): string {
    const encodedQuery = encodeURIComponent(query);
    const baseUrl = this.config.baseUrl + this.config.endpoints.search;
    return baseUrl
      .replace("{query}", encodedQuery)
      .replace("{limit}", limit.toString());
  }

  /**
   * Build detail URL for a specific manga.
   * Can be overridden by sources that need custom URL building logic.
   * @param slug - The manga identifier or slug.
   * @returns The formatted detail URL.
   * @source
   */
  protected buildDetailUrl(slug: string): string {
    const baseUrl = this.config.baseUrl + this.config.endpoints.detail;
    return baseUrl.replace("{slug}", slug);
  }

  /**
   * Make HTTP GET request to the manga source API.
   * Handles headers, error checking, and JSON parsing.
   * @param url - The full API URL to request.
   * @returns Promise resolving to the parsed JSON response.
   * @throws {Error} If the HTTP response is not ok.
   * @source
   */
  // eslint-disable-next-line
  protected async makeRequest(url: string): Promise<any> {
    // Prefer User-Agent from config; fall back to app version
    const defaultUserAgent = `KenmeiToAniList/${getAppVersion()}`;
    const userAgent = this.config.headers?.["User-Agent"] ?? defaultUserAgent;

    const headers = {
      Accept: "application/json",
      "User-Agent": userAgent,
      ...this.config.headers,
    };

    console.debug(
      `[MangaSourceBase] 🌐 ${this.config.name}: Making request to ${url}`,
    );

    const response = await fetch(url, { method: "GET", headers });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    return response.json();
  }

  /**
   * Check if cache is enabled and valid for a given key.
   * @param key - The cache key to validate.
   * @returns True if cache is enabled and entry has not expired.
   * @source
   */
  protected isCacheValid(key: string): boolean {
    if (!this.config.cache?.enabled) return false;

    const cached = this.cache[key];
    if (!cached) return false;

    const age = Date.now() - (cached.timestamp ?? 0);
    return age < this.cacheExpiry;
  }

  /**
   * Get data from cache if valid and not expired.
   * @template T - The type of cached data.
   * @param key - The cache key.
   * @returns Cached data or null if not valid.
   * @source
   */
  protected getCachedData<T>(key: string): T | null {
    if (!this.isCacheValid(key)) return null;

    const entry = this.cache[key];
    console.debug(
      `[MangaSourceBase] 🎯 ${this.config.name}: Cache hit for "${key}"`,
    );
    return entry.data as T;
  }

  /**
   * Store data in cache with current timestamp.
   * @template T - The type of data to cache.
   * @param key - The cache key.
   * @param data - The data to cache.
   * @source
   */
  protected setCachedData<T>(key: string, data: T): void {
    if (!this.config.cache?.enabled) return;

    this.cache[key] = {
      data,
      timestamp: Date.now(),
      source: this.config.source,
    };
  }

  /**
   * Extract AniList ID from a manga entry by fetching its full details.
   * @param manga - The manga entry to extract AniList ID from.
   * @returns Promise resolving to AniList ID or null if not found.
   * @source
   */
  public async extractAniListId(manga: TMangaEntry): Promise<number | null> {
    try {
      console.debug(
        `[MangaSourceBase] 🔗 ${this.config.name}: Extracting AniList ID for "${manga.title}"`,
      );

      const detail = await this.getMangaDetail(manga.slug);
      if (!detail) {
        console.debug(
          `[MangaSourceBase] 🔗 No detail data found for ${this.config.name} manga: ${manga.title}`,
        );
        return null;
      }

      const anilistId = this.extractAniListIdFromDetail(detail);
      if (anilistId) {
        console.debug(
          `[MangaSourceBase] 🎯 Found AniList ID ${anilistId} for ${this.config.name} manga: ${manga.title}`,
        );
        return anilistId;
      }

      console.debug(
        `[MangaSourceBase] 🔗 No AniList ID found for ${this.config.name} manga: ${manga.title}`,
      );
      return null;
    } catch (error) {
      console.error(
        `[MangaSourceBase] ❌ Failed to extract AniList ID for ${this.config.name} manga ${manga.title}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Search for manga on this source and enrich results with AniList data.
   * Fetches source results, extracts AniList IDs, and merges AniList data.
   * @param query - The search query string.
   * @param accessToken - AniList OAuth access token for fetching manga details.
   * @param limit - Maximum number of results to return (default: 1).
   * @returns Promise resolving to enhanced AniList manga entries with source info.
   * @source
   */
  public async searchAndGetAniListManga(
    query: string,
    accessToken: string,
    limit: number = 1,
  ): Promise<EnhancedAniListManga[]> {
    try {
      console.info(
        `[MangaSourceBase] 🔍 Starting ${this.config.name} search for "${query}" with limit ${limit}`,
      );

      // Search on this source
      const sourceResults = await this.searchManga(query, limit);
      if (!sourceResults?.length) {
        console.debug(
          `[MangaSourceBase] 📦 No ${this.config.name} results found for "${query}"`,
        );
        return [];
      }

      console.debug(
        `[MangaSourceBase] 📦 Found ${sourceResults.length} ${this.config.name} results, extracting AniList IDs...`,
      );

      const anilistIds: number[] = [];
      const sourceMap = new Map<number, TMangaEntry>();

      for (const sourceManga of sourceResults) {
        const anilistId = await this.extractAniListId(sourceManga);
        if (!anilistId) continue;
        anilistIds.push(anilistId);
        sourceMap.set(anilistId, sourceManga);
      }

      if (!anilistIds.length) {
        console.debug(
          `[MangaSourceBase] 🔗 No AniList links found in ${this.config.name} results for "${query}"`,
        );
        return [];
      }

      console.info(
        `[MangaSourceBase] 🎯 Found ${anilistIds.length} AniList IDs from ${this.config.name}: [${anilistIds.join(", ")}]`,
      );

      const anilistManga = await getMangaByIds(anilistIds, accessToken);
      if (!anilistManga?.length) {
        console.warn(
          `[MangaSourceBase] ❌ Failed to fetch AniList manga for IDs: [${anilistIds.join(", ")}]`,
        );
        return [];
      }

      // Enhance AniList manga with source info
      const enhancedManga: EnhancedAniListManga[] = anilistManga.map(
        (manga) => {
          const sourceInfo = sourceMap.get(manga.id);

          return {
            ...manga,
            sourceInfo: sourceInfo
              ? {
                  title: sourceInfo.title,
                  slug: sourceInfo.slug,
                  sourceId: sourceInfo.id,
                  source: this.config.source,
                  foundViaAlternativeSearch: true,
                }
              : undefined,
          };
        },
      );

      console.info(
        `[MangaSourceBase] ✅ Successfully enhanced ${enhancedManga.length} AniList manga with ${this.config.name} source info`,
      );
      return enhancedManga;
    } catch (error) {
      console.error(
        `[MangaSourceBase] ❌ ${this.config.name} search and AniList fetch failed for "${query}":`,
        error,
      );
      return [];
    }
  }

  /**
   * Clear cache entries for specific search queries.
   * Removes all cache entries matching the query pattern across different limits.
   * @param queries - Array of search queries to clear from cache.
   * @returns Number of cache entries cleared.
   * @source
   */
  public clearCache(queries: string[]): number {
    let clearedCount = 0;

    for (const query of queries) {
      // Clear cache entries matching query (different limits may exist)
      const keysToDelete = Object.keys(this.cache).filter((key) =>
        key.startsWith(`search:${query.toLowerCase()}:`),
      );

      for (const key of keysToDelete) {
        delete this.cache[key];
        clearedCount++;
      }
    }

    console.info(
      `[MangaSourceBase] 🧹 Cleared ${clearedCount} ${this.config.name} cache entries`,
    );
    return clearedCount;
  }

  /**
   * Get cache status and statistics for debugging.
   * @returns Object with total entries, active entries, and expired entries counts.
   * @source
   */
  public getCacheStatus() {
    const totalEntries = Object.keys(this.cache).length;
    const expiredEntries = Object.keys(this.cache).filter(
      (key) => Date.now() - this.cache[key].timestamp > this.cacheExpiry,
    ).length;

    return {
      source: this.config.name,
      totalEntries,
      activeEntries: totalEntries - expiredEntries,
      expiredEntries,
    };
  }
}
