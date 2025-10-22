/**
 * @packageDocumentation
 * @module comick-client
 * @description Comick API client for searching manga and extracting AniList links.
 */

import { ComickManga, ComickMangaDetail } from "./types";
import { BaseMangaSourceClient } from "../base-client";
import { COMICK_CONFIG } from "../config";
import { MangaSource } from "../types";
import { withGroupAsync } from "@/utils/logging";

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
   * Search for manga on Comick API via IPC (to avoid CORS issues).
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
    return withGroupAsync(`[Comick] Search: "${query}"`, async () => {
      // Check cache first
      const cacheKey = `search:${query.toLowerCase()}:${limit}`;
      const cached = this.getCachedData<ComickManga[]>(cacheKey);
      if (cached) {
        console.debug(`[Comick] 📦 Using cached results for "${query}"`);
        return cached;
      }

      console.info(
        `[Comick] 🔍 Searching Comick for: "${query}" (limit: ${limit})`,
      );

      try {
        // Use generic manga source API to call main process via IPC instead of direct fetch (CORS)
        const data = (await globalThis.electronAPI.mangaSource.search(
          MangaSource.COMICK,
          query,
          limit,
        )) as ComickManga[];

        const results = this.parseSearchResponse(data);
        this.setCachedData(cacheKey, results);

        console.info(
          `[Comick] ✅ Comick search found ${results?.length || 0} results for "${query}"`,
        );
        return results;
      } catch (error) {
        console.error(
          `[Comick] ❌ Comick search failed for "${query}":`,
          error,
        );
        return [];
      }
    });
  } /**
   * Get detailed information about a specific Comick manga using IPC.
   * @param slug - The Comick manga slug.
   * @returns Promise resolving to manga detail or null if not found.
   * @source
   */
  public async getMangaDetail(slug: string): Promise<ComickMangaDetail | null> {
    return withGroupAsync(`[Comick] Detail: "${slug}"`, async () => {
      console.debug(`[Comick] 📖 Getting Comick manga details for: ${slug}`);

      try {
        // Use generic manga source API to call main process via IPC instead of direct fetch (CORS)
        const rawData = await globalThis.electronAPI.mangaSource.getMangaDetail(
          MangaSource.COMICK,
          slug,
        );
        const detail = this.parseDetailResponse(rawData);
        if (detail) {
          console.info(`[Comick] ✅ Retrieved details for manga ${slug}`);
        }
        return detail;
      } catch (error) {
        console.error(
          `[Comick] ❌ Failed to get Comick manga details for ${slug}:`,
          error,
        );
        return null;
      }
    });
  }

  /**
   * Parse raw search response into Comick manga entries.
   * Maps raw API fields to standardized ComickManga interface with validation.
   * @param rawResponse - The raw API response array.
   * @returns Array of parsed manga entries, skipping any invalid items.
   * @source
   */
  protected parseSearchResponse(rawResponse: unknown): ComickManga[] {
    if (!Array.isArray(rawResponse)) return [];

    return rawResponse
      .map((item: unknown): ComickManga | null => {
        // Validate required fields exist
        if (
          !item ||
          typeof item !== "object" ||
          !("id" in item) ||
          !("title" in item) ||
          !("slug" in item)
        ) {
          console.warn("[Comick] Skipping invalid search result item", item);
          return null;
        }

        const obj = item as Record<string, unknown>;
        return {
          id: String(obj.id),
          title: String(obj.title),
          slug: String(obj.slug),
          year: typeof obj.year === "number" ? obj.year : undefined,
          status: typeof obj.status === "number" ? obj.status : undefined,
          country: typeof obj.country === "string" ? obj.country : undefined,
          rating: typeof obj.rating === "string" ? obj.rating : undefined,
          rating_count:
            typeof obj.rating_count === "number" ? obj.rating_count : undefined,
          follow_count:
            typeof obj.follow_count === "number" ? obj.follow_count : undefined,
          user_follow_count:
            typeof obj.user_follow_count === "number"
              ? obj.user_follow_count
              : undefined,
          content_rating:
            typeof obj.content_rating === "string"
              ? obj.content_rating
              : undefined,
          demographic:
            typeof obj.demographic === "number" ? obj.demographic : undefined,
          alternativeTitles: Array.isArray(obj.md_titles)
            ? (obj.md_titles as Array<{ title: string; lang: string }>)
            : [],
          md_titles: Array.isArray(obj.md_titles)
            ? (obj.md_titles as Array<{ title: string; lang: string }>)
            : undefined,
          md_comics:
            obj.md_comics && typeof obj.md_comics === "object"
              ? (obj.md_comics as { id: string; title: string; slug: string })
              : undefined,
          highlight:
            typeof obj.highlight === "string" ? obj.highlight : undefined,
          source: MangaSource.COMICK,
        };
      })
      .filter((item): item is ComickManga => item !== null);
  }

  /**
   * Parse raw detail response into Comick manga detail with validation.
   * Extracts comic data and transforms external links format safely.
   * @param rawResponse - The raw API response object.
   * @returns Parsed manga detail or null if invalid.
   * @source
   */
  /**
   * Extract typed string field from object or return undefined.
   * @param obj - The object to extract from.
   * @param key - The field key.
   * @returns String value or undefined.
   * @source
   */
  private getStringField(
    obj: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = obj[key];
    return typeof value === "string" ? value : undefined;
  }

  /**
   * Extract typed number field from object or return undefined.
   * @param obj - The object to extract from.
   * @param key - The field key.
   * @returns Number value or undefined.
   * @source
   */
  private getNumberField(
    obj: Record<string, unknown>,
    key: string,
  ): number | undefined {
    const value = obj[key];
    return typeof value === "number" ? value : undefined;
  }

  /**
   * Extract typed boolean field from object or return undefined.
   * @param obj - The object to extract from.
   * @param key - The field key.
   * @returns Boolean value or undefined.
   * @source
   */
  private getBooleanField(
    obj: Record<string, unknown>,
    key: string,
  ): boolean | undefined {
    const value = obj[key];
    return typeof value === "boolean" ? value : undefined;
  }

  /**
   * Extract and validate array field from object or return empty array.
   * @param obj - The object to extract from.
   * @param key - The field key.
   * @returns Typed array or empty array.
   * @source
   */
  private getArrayField<T>(obj: Record<string, unknown>, key: string): T[] {
    const value = obj[key];
    return Array.isArray(value) ? (value as T[]) : [];
  }

  /**
   * Extract and validate object field from object or return undefined.
   * @param obj - The object to extract from.
   * @param key - The field key.
   * @returns Typed object or undefined.
   * @source
   */
  private getObjectField<T extends Record<string, unknown>>(
    obj: Record<string, unknown>,
    key: string,
  ): T | undefined {
    const value = obj[key];
    return value && typeof value === "object" ? (value as T) : undefined;
  }

  /**
   * Build comic nested object from Comick data with type validation.
   * @param comicObj - The comic object from API response.
   * @returns Parsed comic object.
   * @source
   */
  private buildComickComicObject(comicObj: Record<string, unknown>) {
    return {
      id: String(comicObj.id),
      title: String(comicObj.title),
      slug: String(comicObj.slug),
      desc: this.getStringField(comicObj, "desc"),
      status: this.getNumberField(comicObj, "status"),
      year: this.getNumberField(comicObj, "year"),
      country: this.getStringField(comicObj, "country"),
      created_at: this.getStringField(comicObj, "created_at"),
      updated_at: this.getStringField(comicObj, "updated_at"),
      demographic: this.getNumberField(comicObj, "demographic"),
      hentai: this.getBooleanField(comicObj, "hentai"),
      content_rating: this.getStringField(comicObj, "content_rating"),
      mu_comics: this.getObjectField<{
        id: string;
        title: string;
        slug: string;
      }>(comicObj, "mu_comics"),
      md_comics: this.getObjectField<{
        id: string;
        title: string;
        slug: string;
      }>(comicObj, "md_comics"),
      authors: this.getArrayField<{
        id: string;
        name: string;
        slug: string;
      }>(comicObj, "authors"),
      artists: this.getArrayField<{
        id: string;
        name: string;
        slug: string;
      }>(comicObj, "artists"),
      genres: this.getArrayField<{
        id: string;
        name: string;
        slug: string;
      }>(comicObj, "genres"),
      md_titles: this.getArrayField<{
        title: string;
        lang: string;
      }>(comicObj, "md_titles"),
      links: this.parseLinksObject(
        comicObj.links as Record<string, unknown> | undefined,
      ),
    };
  }

  /**
   * Parse raw detail response into Comick manga detail with validation.
   * Extracts comic data and transforms external links format safely.
   * @param rawResponse - The raw API response object.
   * @returns Parsed manga detail or null if invalid.
   * @source
   */
  protected parseDetailResponse(
    rawResponse: unknown,
  ): ComickMangaDetail | null {
    if (
      !rawResponse ||
      typeof rawResponse !== "object" ||
      !("comic" in rawResponse)
    ) {
      return null;
    }

    const response = rawResponse as Record<string, unknown>;
    const comic = response.comic;

    if (
      !comic ||
      typeof comic !== "object" ||
      !("id" in comic) ||
      !("title" in comic) ||
      !("slug" in comic)
    ) {
      console.warn("[Comick] Invalid comic detail structure", comic);
      return null;
    }

    const comicObj = comic as Record<string, unknown>;

    return {
      id: String(comicObj.id),
      title: String(comicObj.title),
      slug: String(comicObj.slug),
      description:
        typeof comicObj.desc === "string" ? comicObj.desc : undefined,
      status: typeof comicObj.status === "number" ? comicObj.status : undefined,
      year: typeof comicObj.year === "number" ? comicObj.year : undefined,
      country:
        typeof comicObj.country === "string" ? comicObj.country : undefined,
      createdAt:
        typeof comicObj.created_at === "string"
          ? comicObj.created_at
          : undefined,
      updatedAt:
        typeof comicObj.updated_at === "string"
          ? comicObj.updated_at
          : undefined,
      authors: Array.isArray(comicObj.authors)
        ? (comicObj.authors as Array<{
            id: string;
            name: string;
            slug: string;
          }>)
        : [],
      artists: Array.isArray(comicObj.artists)
        ? (comicObj.artists as Array<{
            id: string;
            name: string;
            slug: string;
          }>)
        : [],
      genres: Array.isArray(comicObj.genres)
        ? (comicObj.genres as Array<{ id: string; name: string; slug: string }>)
        : [],
      alternativeTitles: Array.isArray(comicObj.md_titles)
        ? (comicObj.md_titles as Array<{ title: string; lang: string }>)
        : [],
      externalLinks:
        comicObj.links && typeof comicObj.links === "object"
          ? this.parseExternalLinks(comicObj.links as Record<string, unknown>)
          : {},
      source: MangaSource.COMICK,
      comic: this.buildComickComicObject(comicObj),
      langList: Array.isArray(response.langList)
        ? (response.langList as string[])
        : undefined,
    };
  }

  /**
   * Parse external links object into typed structure.
   * @param links - Raw links object.
   * @returns Parsed external links with platform identifiers.
   * @source
   */
  private parseExternalLinks(
    links: Record<string, unknown>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    if (typeof links.al === "string") result.anilist = links.al;
    if (typeof links.mal === "string") result.myAnimeList = links.mal;
    if (typeof links.mu === "string") result.mangaUpdates = links.mu;
    // Include other platform links
    for (const [key, value] of Object.entries(links)) {
      if (!["al", "mal", "mu"].includes(key) && typeof value === "string") {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Parse raw links object into typed structure.
   * @param links - Raw links object or undefined.
   * @returns Parsed links with platform abbreviations.
   * @source
   */
  private parseLinksObject(
    links: Record<string, unknown> | undefined,
  ): Record<string, string | undefined> {
    if (!links) return {};
    const result: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(links)) {
      result[key] = typeof value === "string" ? value : undefined;
    }
    return result;
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
