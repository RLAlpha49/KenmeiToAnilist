/**
 * @packageDocumentation
 * @module comick-client
 * @description Comick API client for searching manga and extracting AniList links.
 */

import { ComickManga, ComickMangaDetail, EnhancedAniListManga } from "./types";
import { getMangaByIds } from "../anilist/client";

// Cache for Comick search results
interface ComickCache {
  [key: string]: {
    data: ComickManga[];
    timestamp: number;
  };
}

// Cache settings
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
const comickCache: ComickCache = {};

/**
 * Search for manga on Comick API.
 *
 * @param query - The search query
 * @param limit - Maximum number of results to return (default: 10)
 * @returns Promise resolving to search results
 * @source
 */
export async function searchComickManga(
  query: string,
  limit: number = 10,
): Promise<ComickManga[]> {
  // Check cache first
  const cacheKey = `search:${query.toLowerCase()}:${limit}`;
  const cached = comickCache[cacheKey];

  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    console.log(`🎯 Comick cache hit for "${query}"`);
    return cached.data;
  }

  try {
    console.log(`🔍 Searching Comick for: "${query}" (limit: ${limit})`);

    // Use IPC to call the main process instead of direct fetch to avoid CORS issues
    const data = (await window.electronAPI.comick.search(
      query,
      limit,
    )) as ComickManga[];

    // Cache the results
    comickCache[cacheKey] = {
      data: data || [],
      timestamp: Date.now(),
    };

    console.log(
      `📦 Comick search found ${data?.length || 0} results for "${query}"`,
    );
    return data || [];
  } catch (error) {
    console.error(`❌ Comick search failed for "${query}":`, error);
    return [];
  }
}

/**
 * Get detailed information about a specific Comick manga.
 *
 * @param slug - The manga slug
 * @returns Promise resolving to manga details
 * @source
 */
export async function getComickMangaDetail(
  slug: string,
): Promise<ComickMangaDetail | null> {
  try {
    console.log(`📖 Getting Comick manga details for: ${slug}`);

    // Use IPC to call the main process instead of direct fetch to avoid CORS issues
    const data = (await window.electronAPI.comick.getMangaDetail(
      slug,
    )) as ComickMangaDetail;
    return data || null;
  } catch (error) {
    console.error(`❌ Failed to get Comick manga details for ${slug}:`, error);
    return null;
  }
}

/**
 * Extract AniList ID from a Comick manga's external links.
 *
 * @param comickManga - The Comick manga to check
 * @returns Promise resolving to AniList ID if found
 * @source
 */
export async function extractAniListIdFromComick(
  comickManga: ComickManga,
): Promise<number | null> {
  try {
    // Get detailed info which includes external links
    const detail = await getComickMangaDetail(comickManga.slug);

    if (!detail?.comic) {
      console.log(
        `🔗 No comic data found for Comick manga: ${comickManga.title}`,
      );
      return null;
    }

    // Check if links exist and handle the actual structure (object with site keys)
    const links = detail.comic.links;
    if (!links) {
      console.log(
        `🔗 No external links found for Comick manga: ${comickManga.title}`,
      );
      return null;
    }

    if (typeof links !== "object") {
      console.log(
        `🔗 Links is not an object for Comick manga: ${comickManga.title}`,
        { linksType: typeof links, links },
      );
      return null;
    }

    // Look for AniList ID - 'al' is the key for AniList in Comick API
    const anilistId = links.al;

    if (!anilistId) {
      console.log(
        `🔗 No AniList ID found for Comick manga: ${comickManga.title}`,
        { availableLinks: Object.keys(links) },
      );
      return null;
    }

    // Convert to number
    const parsedAnilistId = parseInt(anilistId, 10);

    if (isNaN(parsedAnilistId)) {
      console.log(
        `🔗 Invalid AniList ID format for Comick manga: ${comickManga.title}`,
        { anilistId },
      );
      return null;
    }

    console.log(
      `🎯 Found AniList ID ${parsedAnilistId} for Comick manga: ${comickManga.title}`,
    );

    return parsedAnilistId;
  } catch (error) {
    console.error(
      `❌ Failed to extract AniList ID for Comick manga ${comickManga.title}:`,
      error,
    );
    return null;
  }
}

/**
 * Search for manga on Comick and get their AniList counterparts.
 *
 * @param query - The search query
 * @param limit - Maximum number of results to return (default: 1 for automatic, 5 for manual)
 * @param accessToken - AniList access token for fetching manga details
 * @returns Promise resolving to enhanced AniList manga with Comick source info
 * @source
 */
export async function searchComickAndGetAniListManga(
  query: string,
  limit: number = 1,
  accessToken: string,
): Promise<EnhancedAniListManga[]> {
  try {
    console.log(`🔍 Starting Comick search for "${query}" with limit ${limit}`);

    // Search on Comick
    const comickResults = await searchComickManga(query, limit);

    if (!comickResults || comickResults.length === 0) {
      console.log(`📦 No Comick results found for "${query}"`);
      return [];
    }

    console.log(
      `📦 Found ${comickResults.length} Comick results, extracting AniList IDs...`,
    );

    // Extract AniList IDs from Comick results
    const anilistIds: number[] = [];
    const comickSourceMap = new Map<number, ComickManga>();

    for (const comickManga of comickResults) {
      const anilistId = await extractAniListIdFromComick(comickManga);

      if (anilistId) {
        anilistIds.push(anilistId);
        comickSourceMap.set(anilistId, comickManga);
      }
    }

    if (anilistIds.length === 0) {
      console.log(`🔗 No AniList links found in Comick results for "${query}"`);
      return [];
    }

    console.log(
      `🎯 Found ${anilistIds.length} AniList IDs from Comick: [${anilistIds.join(", ")}]`,
    );

    // Fetch AniList manga details
    const anilistManga = await getMangaByIds(anilistIds, accessToken);

    if (!anilistManga || anilistManga.length === 0) {
      console.log(
        `❌ Failed to fetch AniList manga for IDs: [${anilistIds.join(", ")}]`,
      );
      return [];
    }

    // Enhance AniList manga with Comick source info
    const enhancedManga: EnhancedAniListManga[] = anilistManga.map((manga) => {
      const comickSource = comickSourceMap.get(manga.id);

      return {
        ...manga,
        comickSource: comickSource
          ? {
              title: comickSource.title,
              slug: comickSource.slug,
              comickId: comickSource.id,
              foundViaComick: true,
            }
          : undefined,
      };
    });

    console.log(
      `✅ Successfully enhanced ${enhancedManga.length} AniList manga with Comick source info`,
    );
    return enhancedManga;
  } catch (error) {
    console.error(
      `❌ Comick search and AniList fetch failed for "${query}":`,
      error,
    );
    return [];
  }
}

/**
 * Clear Comick cache for specific search queries.
 *
 * @param queries - Array of search queries to clear from cache
 * @returns Number of cache entries cleared
 * @source
 */
export function clearComickCache(queries: string[]): number {
  let clearedCount = 0;

  for (const query of queries) {
    // Clear cache entries that match the query (different limits might exist)
    const keysToDelete = Object.keys(comickCache).filter((key) =>
      key.startsWith(`search:${query.toLowerCase()}:`),
    );

    for (const key of keysToDelete) {
      delete comickCache[key];
      clearedCount++;
    }
  }

  console.log(`🧹 Cleared ${clearedCount} Comick cache entries`);
  return clearedCount;
}

/**
 * Get Comick cache status for debugging.
 *
 * @returns Cache status information
 * @source
 */
export function getComickCacheStatus() {
  const totalEntries = Object.keys(comickCache).length;
  const expiredEntries = Object.keys(comickCache).filter(
    (key) => Date.now() - comickCache[key].timestamp > CACHE_EXPIRY,
  ).length;

  return {
    totalEntries,
    activeEntries: totalEntries - expiredEntries,
    expiredEntries,
  };
}
