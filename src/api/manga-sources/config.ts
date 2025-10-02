/**
 * @packageDocumentation
 * @module manga-source-config
 * @description Configuration system for manga source APIs.
 */

import type { MangaSourceConfig } from "./types";
import { MangaSource } from "./types";
import { getAppVersion } from "../../utils/app-version";

/**
 * Configuration for Comick API.
 */
const USER_AGENT = `KenmeiToAniList/${getAppVersion()}`;

const defaultCache = { enabled: true, ttlMinutes: 30 };

const makeConfig = (cfg: MangaSourceConfig): MangaSourceConfig => ({
  ...cfg,
  headers: { "User-Agent": USER_AGENT, ...(cfg.headers ?? {}) },
  cache: cfg.cache ?? defaultCache,
});

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
    requestsPerSecond: 5, // MangaDex has stricter rate limits
    burstLimit: 10,
  },
});

/**
 * Registry of all available manga source configurations.
 */
export const MANGA_SOURCE_CONFIGS: Record<MangaSource, MangaSourceConfig> = {
  [MangaSource.COMICK]: COMICK_CONFIG,
  [MangaSource.MANGADEX]: MANGADEX_CONFIG,
};

/**
 * Get configuration for a specific manga source.
 */
export function getMangaSourceConfig(source: MangaSource): MangaSourceConfig {
  const config = MANGA_SOURCE_CONFIGS[source];
  if (!config)
    throw new Error(`No configuration found for manga source: ${source}`);
  return config;
}

/**
 * Get all available manga sources.
 */
export function getAvailableMangaSources(): MangaSource[] {
  return Object.keys(MANGA_SOURCE_CONFIGS) as unknown as MangaSource[];
}

/**
 * Check if a manga source is available.
 */
export function isMangaSourceAvailable(source: MangaSource): boolean {
  return source in MANGA_SOURCE_CONFIGS;
}
