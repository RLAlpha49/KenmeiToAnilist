/**
 * @packageDocumentation
 * @module manga-sources
 * @description Main entry point for the manga sources system.
 */

// Core types and enums
export { MangaSource } from "./types";
import { MangaSource } from "./types";
import { mangaSourceRegistry } from "./registry";
export type {
  BaseMangaEntry,
  BaseMangaDetail,
  BaseMangaSearchResponse,
  MangaSourceConfig,
  MangaMatchResult,
  EnhancedAniListManga,
  MangaSourceCacheEntry,
  MangaSourceCache,
} from "./types";

// Base client and registry
export { BaseMangaSourceClient } from "./base-client";
export { mangaSourceRegistry, MangaSourceRegistry } from "./registry";

// Configuration system
export {
  COMICK_CONFIG,
  MANGADEX_CONFIG,
  MANGA_SOURCE_CONFIGS,
  getMangaSourceConfig,
  getAvailableMangaSources,
  isMangaSourceAvailable,
} from "./config";

export type { ComickManga, ComickMangaDetail } from "./comick/types";
export { comickClient } from "./comick/client";

export type { MangaDexManga, MangaDexMangaDetail } from "./mangadex/types";
export { mangaDexClient } from "./mangadex/client";

/**
 * Convenience function to get a manga source client.
 * @param source - The manga source to get the client for
 * @returns Promise resolving to the client or null if not available
 */
export async function getMangaSourceClient(source: MangaSource) {
  return mangaSourceRegistry.getClient(source);
}

/**
 * Convenience function to search manga across a source.
 * @param source - The manga source to search
 * @param query - Search query
 * @param limit - Maximum results to return
 * @returns Promise resolving to search results
 */
export async function searchMangaSource(
  source: MangaSource,
  query: string,
  limit?: number,
) {
  return mangaSourceRegistry.searchManga(source, query, limit);
}

/**
 * Convenience function to get manga details from a source.
 * @param source - The manga source to query
 * @param slug - Manga slug/identifier
 * @returns Promise resolving to manga details or null
 */
export async function getMangaSourceDetail(source: MangaSource, slug: string) {
  return mangaSourceRegistry.getMangaDetail(source, slug);
}
