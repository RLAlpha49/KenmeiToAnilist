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
 * Extends the base client with Comick-specific parsing and logic.
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
   */
  public async searchManga(
    query: string,
    limit: number = 10,
  ): Promise<ComickManga[]> {
    // Check cache first
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;
    const cached = this.getCachedData<ComickManga[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      console.log(`🔍 Searching Comick for: "${query}" (limit: ${limit})`);

      // Use generic manga source API to call the main process instead of direct fetch to avoid CORS issues
      const data = (await globalThis.electronAPI.mangaSource.search(
        "comick",
        query,
        limit,
      )) as ComickManga[];

      const results = this.parseSearchResponse(data);

      // Cache the results
      this.setCachedData(cacheKey, results);

      console.log(
        `📦 Comick search found ${results?.length || 0} results for "${query}"`,
      );
      return results;
    } catch (error) {
      console.error(`❌ Comick search failed for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific Comick manga using IPC.
   */
  public async getMangaDetail(slug: string): Promise<ComickMangaDetail | null> {
    try {
      console.log(`📖 Getting Comick manga details for: ${slug}`);

      // Use generic manga source API to call the main process instead of direct fetch to avoid CORS issues
      const rawData = await globalThis.electronAPI.mangaSource.getMangaDetail(
        "comick",
        slug,
      );
      return this.parseDetailResponse(rawData);
    } catch (error) {
      console.error(
        `❌ Failed to get Comick manga details for ${slug}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Parse raw search response into Comick manga entries.
   */
  // eslint-disable-next-line
  protected parseSearchResponse(rawResponse: any): ComickManga[] {
    if (!Array.isArray(rawResponse)) {
      return [];
    }

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
   */
  // eslint-disable-next-line
  protected parseDetailResponse(rawResponse: any): ComickMangaDetail | null {
    if (!rawResponse?.comic) {
      return null;
    }

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
            ...Object.fromEntries(
              Object.entries(comic.links).filter(
                ([key]) => !["al", "mal", "mu"].includes(key),
              ),
            ),
          }
        : undefined,
      source: MangaSource.COMICK,
      comic: rawResponse.comic, // Keep original structure for backward compatibility
      langList: rawResponse.langList,
    };
  }

  /**
   * Extract AniList ID from Comick manga detail.
   */
  protected extractAniListIdFromDetail(
    detail: ComickMangaDetail,
  ): number | null {
    const links = detail.comic?.links;
    if (!links || typeof links !== "object") {
      return null;
    }

    const anilistId = links.al;
    if (!anilistId) {
      return null;
    }

    const parsedAnilistId = Number.parseInt(anilistId, 10);
    return Number.isNaN(parsedAnilistId) ? null : parsedAnilistId;
  }
}

// Create a singleton instance
export const comickClient = new ComickClient();

// Export legacy functions for backward compatibility
export async function searchComickManga(
  query: string,
  limit: number = 10,
): Promise<ComickManga[]> {
  return comickClient.searchManga(query, limit);
}

export async function getComickMangaDetail(
  slug: string,
): Promise<ComickMangaDetail | null> {
  return comickClient.getMangaDetail(slug);
}

/**
 * Extract AniList ID from a Comick manga's external links.
 * @deprecated Use comickClient.extractAniListId() instead.
 *
 * @param comickManga - The Comick manga to check
 * @returns Promise resolving to AniList ID if found
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
 *
 * @param query - The search query
 * @param accessToken - AniList access token for fetching manga details
 * @param limit - Maximum number of results to return (default: 1)
 * @returns Promise resolving to enhanced AniList manga with Comick source info
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
 *
 * @param queries - Array of search queries to clear from cache
 * @returns Number of cache entries cleared
 * @source
 */
export function clearComickCache(queries: string[]): number {
  return comickClient.clearCache(queries);
}

/**
 * Get Comick cache status for debugging.
 * @deprecated Use comickClient.getCacheStatus() instead.
 *
 * @returns Cache status information
 * @source
 */
export function getComickCacheStatus() {
  return comickClient.getCacheStatus();
}
