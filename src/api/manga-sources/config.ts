/**
 * @packageDocumentation
 * @module manga-source-config
 * @description Configuration system for manga source APIs including Comick and MangaDex.
 */

import type { MangaSourceConfig } from "./types";
import { MangaSource } from "./types";
import { getAppVersion } from "../../utils/app-version";

/**
 * User-Agent header for API requests.
 * Identifies the application making requests to external APIs.
 * @source
 */
const USER_AGENT = `KenmeiToAniList/${getAppVersion()}`;

/**
 * Default cache configuration for manga sources.
 * Enables caching with 30-minute TTL.
 * @source
 */
const defaultCache = { enabled: true, ttlMinutes: 30 };

/**
 * Factory function to create a manga source configuration with default headers and cache.
 * @param cfg - The base configuration object.
 * @returns The configuration with User-Agent header and default cache settings applied.
 * @source
 */
const makeConfig = (cfg: MangaSourceConfig): MangaSourceConfig => ({
  ...cfg,
  headers: { "User-Agent": USER_AGENT, ...cfg.headers },
  cache: cfg.cache ?? defaultCache,
});

/**
 * Configuration for Comick API.
 * Includes endpoints, rate limits, and cache settings for searching and fetching manga.
 * @source
 */
export const COMICK_CONFIG: MangaSourceConfig = makeConfig({
  name: "Comick",
  source: MangaSource.COMICK,
  baseUrl: "https://api.comick.fun",
  endpoints: {
    search: "/v1.0/search?q={query}&limit={limit}&t=false",
    detail: "/comic/{slug}",
  },
  rateLimit: {
    requestsPerSecond: 10,
    burstLimit: 20,
  },
});

/**
 * Configuration for MangaDex API.
 * Includes endpoints, rate limits (stricter than Comick), and cache settings.
 * @source
 */
export const MANGADEX_CONFIG: MangaSourceConfig = makeConfig({
  name: "MangaDex",
  source: MangaSource.MANGADEX,
  baseUrl: "https://api.mangadex.org",
  endpoints: {
    search:
      "/manga?title={query}&limit={limit}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica",
    detail:
      "/manga/{slug}?includes[]=author&includes[]=artist&includes[]=cover_art",
  },
  rateLimit: {
    requestsPerSecond: 5, // MangaDex has stricter rate limits than Comick
    burstLimit: 10,
  },
});

/**
 * Registry of all available manga source configurations.
 * Maps each supported source to its configuration.
 * @source
 */
export const MANGA_SOURCE_CONFIGS: Record<MangaSource, MangaSourceConfig> = {
  [MangaSource.COMICK]: COMICK_CONFIG,
  [MangaSource.MANGADEX]: MANGADEX_CONFIG,
};

/**
 * Get configuration for a specific manga source.
 * @param source - The manga source enum value.
 * @returns The source's configuration object.
 * @throws {Error} If no configuration exists for the provided source.
 * @source
 */
export function getMangaSourceConfig(source: MangaSource): MangaSourceConfig {
  const config = MANGA_SOURCE_CONFIGS[source];
  if (!config)
    throw new Error(`No configuration found for manga source: ${source}`);
  return config;
}

/**
 * Get all available manga sources.
 * @returns Array of all supported manga source enum values.
 * @source
 */
export function getAvailableMangaSources(): MangaSource[] {
  return Object.keys(MANGA_SOURCE_CONFIGS) as unknown as MangaSource[];
}

/**
 * Check if a manga source is available and configured.
 * @param source - The manga source enum value to check.
 * @returns True if the source has a configuration.
 * @source
 */
export function isMangaSourceAvailable(source: MangaSource): boolean {
  return source in MANGA_SOURCE_CONFIGS;
}
