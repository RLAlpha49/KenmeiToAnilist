/**
 * @packageDocumentation
 * @module mangadex-client
 * @description MangaDex API client for searching manga and extracting AniList links.
 */

import { MangaDexManga, MangaDexMangaDetail } from "./types";
import { BaseMangaSourceClient } from "../base-client";
import { MANGADEX_CONFIG } from "../config";
import { MangaSource } from "../types";

/**
 * MangaDex-specific manga source client.
 * Extends the base client with MangaDex-specific parsing and logic.
 */
export class MangaDexClient extends BaseMangaSourceClient<
  MangaDexManga,
  MangaDexMangaDetail
> {
  constructor() {
    super(MANGADEX_CONFIG);
  }

  /**
   * Search for manga on MangaDex API.
   */
  public async searchManga(
    query: string,
    limit: number = 10,
  ): Promise<MangaDexManga[]> {
    // Check cache first
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;
    const cached = this.getCachedData<MangaDexManga[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      console.log(`🔍 Searching MangaDex for: "${query}" (limit: ${limit})`);

      // Make direct HTTP request using the base client's functionality
      const url = this.buildSearchUrl(query, limit);
      const data = await this.makeRequest(url);

      const results = this.parseSearchResponse(data);

      // Cache the results
      this.setCachedData(cacheKey, results);

      console.log(
        `📦 MangaDex search found ${results?.length || 0} results for "${query}"`,
      );
      return results;
    } catch (error) {
      console.error(`❌ MangaDex search failed for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific MangaDex manga.
   */
  public async getMangaDetail(id: string): Promise<MangaDexMangaDetail | null> {
    try {
      console.log(`📖 Getting MangaDex manga details for: ${id}`);

      // Make direct HTTP request using the base client's functionality
      const url = this.buildDetailUrl(id);
      const rawData = await this.makeRequest(url);
      return this.parseDetailResponse(rawData);
    } catch (error) {
      console.error(
        `❌ Failed to get MangaDex manga details for ${id}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Parse raw search response into MangaDex manga entries.
   */
  // eslint-disable-next-line
  protected parseSearchResponse(rawResponse: any): MangaDexManga[] {
    if (!Array.isArray(rawResponse?.data)) {
      console.log("🔍 MangaDex: Invalid search response format");
      return [];
    }

    // eslint-disable-next-line
    return rawResponse.data.map((item: any) => {
      const attributes = item.attributes || {};
      const title = attributes.title || {};
      const altTitles = attributes.altTitles || [];

      // Get the primary title (prefer English, then romanized Japanese, then any available)
      const primaryTitle =
        title.en ||
        title["ja-ro"] ||
        title.ja ||
        Object.values(title)[0] ||
        "Unknown Title";

      // Parse alternative titles
      const alternativeTitles: Array<{ title: string; lang: string }> = [];

      // Add all title variants
      for (const [lang, titleText] of Object.entries(title)) {
        if (titleText && titleText !== primaryTitle) {
          alternativeTitles.push({ title: titleText as string, lang });
        }
      }

      // Add alt titles
      for (const altTitle of altTitles) {
        for (const [lang, titleText] of Object.entries(altTitle)) {
          if (titleText) {
            alternativeTitles.push({ title: titleText as string, lang });
          }
        }
      }

      return {
        id: item.id,
        title: primaryTitle,
        slug: item.id, // MangaDex uses ID as the identifier
        year: attributes.year,
        status: this.mapMangaDexStatus(attributes.status),
        country: attributes.originalLanguage,
        alternativeTitles,
        source: MangaSource.MANGADEX,
        type: item.type,
        links: attributes.links,
        originalLanguage: attributes.originalLanguage,
        lastVolume: attributes.lastVolume,
        lastChapter: attributes.lastChapter,
        publicationDemographic: attributes.publicationDemographic,
        contentRating: attributes.contentRating,
        tags: attributes.tags,
      } as MangaDexManga;
    });
  }

  /**
   * Parse raw detail response into MangaDex manga detail.
   */
  // eslint-disable-next-line
  protected parseDetailResponse(rawResponse: any): MangaDexMangaDetail | null {
    if (!rawResponse?.data) {
      console.log("📖 MangaDex: Invalid detail response format");
      return null;
    }

    const data = rawResponse.data;
    const attributes = data.attributes || {};
    const title = attributes.title || {};
    const altTitles = attributes.altTitles || [];

    // Get the primary title (prefer English, then romanized Japanese, then any available)
    const primaryTitle =
      title.en ||
      title["ja-ro"] ||
      title.ja ||
      Object.values(title)[0] ||
      "Unknown Title";

    // Parse alternative titles
    const alternativeTitles: Array<{ title: string; lang: string }> = [];

    // Add all title variants
    for (const [lang, titleText] of Object.entries(title)) {
      if (titleText && titleText !== primaryTitle) {
        alternativeTitles.push({ title: titleText as string, lang });
      }
    }

    // Add alt titles
    for (const altTitle of altTitles) {
      for (const [lang, titleText] of Object.entries(altTitle)) {
        if (titleText) {
          alternativeTitles.push({ title: titleText as string, lang });
        }
      }
    }

    // Parse authors and artists from relationships
    const authors: Array<{ id: string; name: string; slug?: string }> = [];
    const artists: Array<{ id: string; name: string; slug?: string }> = [];

    if (data.relationships) {
      // eslint-disable-next-line
      data.relationships.forEach((rel: any) => {
        if (rel.type === "author" && rel.attributes?.name) {
          authors.push({
            id: rel.id,
            name: rel.attributes.name,
            slug: rel.id,
          });
        } else if (rel.type === "artist" && rel.attributes?.name) {
          artists.push({
            id: rel.id,
            name: rel.attributes.name,
            slug: rel.id,
          });
        }
      });
    }

    return {
      id: data.id,
      title: primaryTitle,
      slug: data.id,
      description:
        attributes.description?.en ||
        (Object.values(attributes.description || {})[0] as string),
      status: this.mapMangaDexStatus(attributes.status),
      year: attributes.year,
      country: attributes.originalLanguage,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
      authors,
      artists,
      genres:
        attributes.tags
          // eslint-disable-next-line
          ?.filter((tag: any) => tag.attributes?.group === "genre")
          // eslint-disable-next-line
          .map((tag: any) => ({
            id: tag.id,
            name:
              tag.attributes.name.en || Object.values(tag.attributes.name)[0],
            slug: tag.id,
          })) || [],
      alternativeTitles,
      externalLinks: attributes.links
        ? {
            anilist: attributes.links.al,
            myAnimeList: attributes.links.mal,
            mangaUpdates: attributes.links.mu,
            ...attributes.links,
          }
        : undefined,
      source: MangaSource.MANGADEX,
      data: rawResponse.data,
    } as MangaDexMangaDetail;
  }

  /**
   * Extract AniList ID from MangaDex manga detail.
   */
  protected extractAniListIdFromDetail(
    detail: MangaDexMangaDetail,
  ): number | null {
    try {
      // Check if external links exist
      const links = detail.data?.attributes?.links;
      if (!links) {
        console.log(
          `🔗 No external links found for MangaDex manga: ${detail.title}`,
        );
        return null;
      }

      // Look for AniList ID - 'al' is the key for AniList in MangaDex API
      const anilistId = links.al;

      if (!anilistId) {
        console.log(
          `🔗 No AniList ID found for MangaDex manga: ${detail.title}`,
          { availableLinks: Object.keys(links) },
        );
        return null;
      }

      // Convert to number
      const parsedAnilistId = Number.parseInt(anilistId, 10);

      if (Number.isNaN(parsedAnilistId)) {
        console.log(
          `🔗 Invalid AniList ID format for MangaDex manga: ${detail.title}`,
          { anilistId },
        );
        return null;
      }

      console.log(
        `🎯 Found AniList ID ${parsedAnilistId} for MangaDex manga: ${detail.title}`,
      );

      return parsedAnilistId;
    } catch (error) {
      console.error(
        `❌ Failed to extract AniList ID for MangaDex manga ${detail.title}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Map MangaDex status to numeric status.
   */
  private mapMangaDexStatus(status: string): number {
    switch (status?.toLowerCase()) {
      case "ongoing":
        return 1;
      case "completed":
        return 2;
      case "hiatus":
        return 3;
      case "cancelled":
        return 4;
      default:
        return 0; // Unknown
    }
  }

  /**
   * Build search URL with parameters for MangaDex API.
   */
  protected buildSearchUrl(query: string, limit: number): string {
    const encodedQuery = encodeURIComponent(query);
    // MangaDex uses offset-based pagination, we'll start at offset 0
    return `${this.config.baseUrl}/manga?title=${encodedQuery}&limit=${limit}&offset=0&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&order[relevance]=desc`;
  }

  /**
   * Build detail URL for a specific manga.
   */
  protected buildDetailUrl(id: string): string {
    return `${this.config.baseUrl}/manga/${id}?includes[]=author&includes[]=artist&includes[]=cover_art`;
  }
}

// Create and export the singleton client
export const mangaDexClient = new MangaDexClient();

// Legacy function exports for backward compatibility
/**
 * Search for manga on MangaDex API.
 * @deprecated Use mangaDexClient.searchManga() instead.
 */
export async function searchMangaDexManga(
  query: string,
  limit: number = 10,
): Promise<MangaDexManga[]> {
  return mangaDexClient.searchManga(query, limit);
}

/**
 * Get detailed information about a specific MangaDex manga.
 * @deprecated Use mangaDexClient.getMangaDetail() instead.
 */
export async function getMangaDexMangaDetail(
  id: string,
): Promise<MangaDexMangaDetail | null> {
  return mangaDexClient.getMangaDetail(id);
}

/**
 * Extract AniList ID from a MangaDex manga's external links.
 * @deprecated Use mangaDexClient.extractAniListId() instead.
 */
export async function extractAniListIdFromMangaDex(
  mangaDexManga: MangaDexManga,
): Promise<number | null> {
  return mangaDexClient.extractAniListId(mangaDexManga);
}

/**
 * Search for manga on MangaDex and get their AniList counterparts.
 * @deprecated Use mangaDexClient.searchAndGetAniListManga() instead.
 */
export async function searchMangaDexAndGetAniListManga(
  query: string,
  accessToken: string,
  limit: number = 1,
) {
  return mangaDexClient.searchAndGetAniListManga(query, accessToken, limit);
}

/**
 * Clear MangaDex cache for specific search queries.
 * @deprecated Use mangaDexClient.clearCache() instead.
 */
export function clearMangaDexCache(queries: string[]): number {
  return mangaDexClient.clearCache(queries);
}

/**
 * Get MangaDex cache status for debugging.
 * @deprecated Use mangaDexClient.getCacheStatus() instead.
 */
export function getMangaDexCacheStatus() {
  return mangaDexClient.getCacheStatus();
}
