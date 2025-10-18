/**
 * @packageDocumentation
 * @module comick-client
 * @description Comick API client for searching manga and extracting AniList links.
 */

import { ComickManga, ComickMangaDetail } from "./types";
import { BaseMangaSourceClient } from "../base-client";
import { COMICK_CONFIG } from "../config";
import { MangaSource } from "../types";

/**
 * Comick-specific manga source client.
 * Extends the base client with Comick-specific API parsing and IPC communication.
 * Uses IPC to avoid CORS issues when calling Comick API from renderer process.
 * @source
 */
export class ComickClient extends BaseMangaSourceClient<
  ComickManga,
  ComickMangaDetail
> {
  constructor() {
    super(COMICK_CONFIG);
  }

  /**
   * Search for manga on Comick API using IPC to avoid CORS issues.
   * Results are cached for 30 minutes by default.
   * @param query - The search query string.
   * @param limit - Maximum number of results to return (default: 10).
   * @returns Promise resolving to array of Comick manga entries.
   * @source
   */
  public async searchManga(
    query: string,
    limit: number = 10,
  ): Promise<ComickManga[]> {
    // Check cache first
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;
    const cached = this.getCachedData<ComickManga[]>(cacheKey);
    if (cached) return cached;

    console.info(
      `[Comick] 🔍 Searching Comick for: "${query}" (limit: ${limit})`,
    );

    try {
      // Use generic manga source API to call main process via IPC instead of direct fetch (CORS)
      const data = (await globalThis.electronAPI.mangaSource.search(
        "comick",
        query,
        limit,
      )) as ComickManga[];

      const results = this.parseSearchResponse(data);
      this.setCachedData(cacheKey, results);

      console.info(
        `[Comick] 📦 Comick search found ${results?.length || 0} results for "${query}"`,
      );
      return results;
    } catch (error) {
      console.error(`[Comick] ❌ Comick search failed for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific Comick manga using IPC.
   * @param slug - The Comick manga slug.
   * @returns Promise resolving to manga detail or null if not found.
   * @source
   */
  public async getMangaDetail(slug: string): Promise<ComickMangaDetail | null> {
    console.debug(`[Comick] 📖 Getting Comick manga details for: ${slug}`);

    try {
      // Use generic manga source API to call main process via IPC instead of direct fetch (CORS)
      const rawData = await globalThis.electronAPI.mangaSource.getMangaDetail(
        "comick",
        slug,
      );
      return this.parseDetailResponse(rawData);
    } catch (error) {
      console.error(
        `[Comick] ❌ Failed to get Comick manga details for ${slug}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Parse raw search response into Comick manga entries.
   * Maps raw API fields to standardized ComickManga interface.
   * @param rawResponse - The raw API response array.
   * @returns Array of parsed manga entries.
   * @source
   */
  // eslint-disable-next-line
  protected parseSearchResponse(rawResponse: any): ComickManga[] {
    if (!Array.isArray(rawResponse)) return [];

    // eslint-disable-next-line
    return rawResponse.map((item: any) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      year: item.year,
      status: item.status,
      country: item.country,
      rating: item.rating,
      rating_count: item.rating_count,
      follow_count: item.follow_count,
      user_follow_count: item.user_follow_count,
      content_rating: item.content_rating,
      demographic: item.demographic,
      alternativeTitles: item.md_titles || [],
      md_titles: item.md_titles,
      md_comics: item.md_comics,
      highlight: item.highlight,
      source: MangaSource.COMICK,
    }));
  }

  /**
   * Parse raw detail response into Comick manga detail.
   * Extracts comic data and transforms external links format.
   * @param rawResponse - The raw API response object.
   * @returns Parsed manga detail or null if invalid.
   * @source
   */
  // eslint-disable-next-line
  protected parseDetailResponse(rawResponse: any): ComickMangaDetail | null {
    if (!rawResponse?.comic) return null;

    const comic = rawResponse.comic;

    return {
      id: comic.id,
      title: comic.title,
      slug: comic.slug,
      description: comic.desc,
      status: comic.status,
      year: comic.year,
      country: comic.country,
      createdAt: comic.created_at,
      updatedAt: comic.updated_at,
      authors: comic.authors || [],
      artists: comic.artists || [],
      genres: comic.genres || [],
      alternativeTitles: comic.md_titles || [],
      externalLinks: comic.links
        ? {
            anilist: comic.links.al,
            myAnimeList: comic.links.mal,
            mangaUpdates: comic.links.mu,
            // Include other platform links
            ...Object.fromEntries(
              Object.entries(comic.links).filter(
                ([key]) => !["al", "mal", "mu"].includes(key),
              ),
            ),
          }
        : undefined,
      source: MangaSource.COMICK,
      comic: rawResponse.comic, // Keep original for backward compatibility
      langList: rawResponse.langList,
    };
  }

  /**
   * Extract AniList ID from Comick manga detail.
   * Parses the 'al' field from external links section.
   * @param detail - The Comick manga detail object.
   * @returns The AniList ID as a number or null if not found.
   * @source
   */
  protected extractAniListIdFromDetail(
    detail: ComickMangaDetail,
  ): number | null {
    const links = detail.comic?.links;
    if (!links || typeof links !== "object") return null;

    const anilistId = links.al;
    if (!anilistId) return null;

    const parsedAnilistId = Number.parseInt(anilistId, 10);
    return Number.isNaN(parsedAnilistId) ? null : parsedAnilistId;
  }
}

/**
 * Singleton Comick client instance.
 * Used for all Comick API operations.
 * @source
 */
export const comickClient = new ComickClient();

/**
 * Search for manga on Comick API.
 * @deprecated Use comickClient.searchManga() instead.
 * @param query - The search query string.
 * @param limit - Maximum number of results (default: 10).
 * @returns Promise resolving to array of Comick manga entries.
 * @source
 */
export async function searchComickManga(
  query: string,
  limit: number = 10,
): Promise<ComickManga[]> {
  return comickClient.searchManga(query, limit);
}

/**
 * Get detailed information about a specific Comick manga.
 * @deprecated Use comickClient.getMangaDetail() instead.
 * @param slug - The Comick manga slug.
 * @returns Promise resolving to manga detail or null if not found.
 * @source
 */
export async function getComickMangaDetail(
  slug: string,
): Promise<ComickMangaDetail | null> {
  return comickClient.getMangaDetail(slug);
}

/**
 * Extract AniList ID from a Comick manga's external links.
 * @deprecated Use comickClient.extractAniListId() instead.
 * @param comickManga - The Comick manga entry to extract ID from.
 * @returns Promise resolving to AniList ID if found or null.
 * @source
 */
export async function extractAniListIdFromComick(
  comickManga: ComickManga,
): Promise<number | null> {
  return comickClient.extractAniListId(comickManga);
}

/**
 * Search for manga on Comick and get their AniList counterparts.
 * @deprecated Use comickClient.searchAndGetAniListManga() instead.
 * @param query - The search query string.
 * @param accessToken - AniList OAuth access token.
 * @param limit - Maximum number of results (default: 1).
 * @returns Promise resolving to enhanced AniList manga with Comick source info.
 * @source
 */
export async function searchComickAndGetAniListManga(
  query: string,
  accessToken: string,
  limit: number = 1,
) {
  return comickClient.searchAndGetAniListManga(query, accessToken, limit);
}

/**
 * Clear Comick cache for specific search queries.
 * @deprecated Use comickClient.clearCache() instead.
 * @param queries - Array of search queries to clear from cache.
 * @returns Number of cache entries cleared.
 * @source
 */
export function clearComickCache(queries: string[]): number {
  return comickClient.clearCache(queries);
}

/**
 * Get Comick cache status for debugging.
 * @deprecated Use comickClient.getCacheStatus() instead.
 * @returns Cache status information with entry counts.
 * @source
 */
export function getComickCacheStatus() {
  return comickClient.getCacheStatus();
}
