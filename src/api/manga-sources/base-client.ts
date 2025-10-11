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
 * Abstract base class for manga source API clients.
 * Provides common functionality and defines the interface that all manga sources must implement.
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
    this.cacheExpiry = (config.cache?.ttlMinutes ?? 30) * 60 * 1000; // Default 30 minutes
  }

  /**
   * Get the source identifier for this client.
   */
  public getSource(): MangaSource {
    return this.config.source;
  }

  /**
   * Get the configuration for this source.
   */
  public getConfig(): MangaSourceConfig {
    return this.config;
  }

  /**
   * Search for manga using this source's API.
   * Must be implemented by each source.
   */
  public abstract searchManga(
    query: string,
    limit?: number,
  ): Promise<TMangaEntry[]>;

  /**
   * Get detailed information about a specific manga.
   * Must be implemented by each source.
   */
  public abstract getMangaDetail(slug: string): Promise<TMangaDetail | null>;

  /**
   * Extract AniList ID from a manga's external links.
   * Must be implemented by each source as the data structure varies.
   */
  protected abstract extractAniListIdFromDetail(
    detail: TMangaDetail,
  ): number | null;

  /**
   * Parse raw API response into manga entries.
   * Must be implemented by each source as the response format varies.
   */
  // eslint-disable-next-line
  protected abstract parseSearchResponse(rawResponse: any): TMangaEntry[];

  /**
   * Parse raw API response into manga detail.
   * Must be implemented by each source as the response format varies.
   */
  // eslint-disable-next-line
  protected abstract parseDetailResponse(rawResponse: any): TMangaDetail | null;

  /**
   * Build search URL with parameters.
   * Can be overridden by sources that need custom URL building logic.
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
   */
  protected buildDetailUrl(slug: string): string {
    const baseUrl = this.config.baseUrl + this.config.endpoints.detail;
    return baseUrl.replace("{slug}", slug);
  }

  /**
   * Make HTTP request to the manga source API.
   * Provides common error handling and request configuration.
   */
  // eslint-disable-next-line
  protected async makeRequest(url: string): Promise<any> {
    // Prefer any User-Agent provided in the config, otherwise use app version
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
   */
  protected isCacheValid(key: string): boolean {
    if (!this.config.cache?.enabled) return false;

    const cached = this.cache[key];
    if (!cached) return false;

    const age = Date.now() - (cached.timestamp ?? 0);
    return age < this.cacheExpiry;
  }

  /**
   * Get data from cache if valid.
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
   * Extract AniList ID from a manga entry by fetching its details.
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
   * Search for manga and get their AniList counterparts.
   * This provides the main workflow that all sources can use.
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
   * Clear cache for specific search queries.
   */
  public clearCache(queries: string[]): number {
    let clearedCount = 0;

    for (const query of queries) {
      // Clear cache entries that match the query (different limits might exist)
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
   * Get cache status for debugging.
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
