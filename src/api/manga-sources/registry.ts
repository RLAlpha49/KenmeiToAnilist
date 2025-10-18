/**
 * @packageDocumentation
 * @module manga-source-registry
 * @description Registry for managing and accessing manga source client instances.
 */

import type { BaseMangaSourceClient } from "./base-client";
import type { BaseMangaEntry, BaseMangaDetail } from "./types";
import { MangaSource } from "./types";

/**
 * Registry for manga source clients.
 * Manages lazy initialization and lifecycle of all available manga source clients.
 * Uses dynamic imports to load clients on demand and handle initialization failures gracefully.
 * @source
 */
class MangaSourceRegistry {
  private readonly clients = new Map<MangaSource, BaseMangaSourceClient>();
  private initialized = false;

  /**
   * Initialize the registry with available clients.
   * Loads clients dynamically in parallel, catching and logging individual failures.
   * @source
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load known clients in parallel to reduce startup latency and
    // keep the happy path clear. Individual failures are logged but do
    // not prevent other clients from registering.
    const loaders = [
      {
        source: MangaSource.COMICK,
        exportName: "comickClient",
        importFn: () => import("./comick/client"),
      },
      {
        source: MangaSource.MANGADEX,
        exportName: "mangaDexClient",
        importFn: () => import("./mangadex/client"),
      },
    ] as const;

    type Loader = (typeof loaders)[number];
    type LoadResult = {
      loader: Loader;
      client?: BaseMangaSourceClient;
      error?: unknown;
    };

    // Type guard to verify a value is a valid client instance
    const isClient = (obj: unknown): obj is BaseMangaSourceClient => {
      return (
        typeof obj === "object" &&
        obj !== null &&
        typeof (obj as Record<string, unknown>)["searchManga"] === "function"
      );
    };

    const promises = loaders.map(async (l): Promise<LoadResult> => {
      try {
        // Use per-loader import function so Vite can statically analyze and avoid dynamic-import warnings
        const mod = await l.importFn();
        const candidate = (mod as Record<string, unknown>)[l.exportName];
        if (isClient(candidate)) {
          return { loader: l, client: candidate };
        }
        return {
          loader: l,
          error: new Error(`Export ${l.exportName} not found or invalid`),
        };
      } catch (err) {
        return { loader: l, error: err };
      }
    });

    const results = await Promise.all(promises);

    for (const res of results) {
      if (res.client) {
        this.registerClient(res.loader.source, res.client);
        continue;
      }
      console.error(
        `Failed to initialize loader ${res.loader.exportName} for source ${String(
          res.loader.source,
        )}:`,
        res.error,
      );
    }

    this.initialized = true;
  }

  /**
   * Register a manga source client.
   * @param source - The manga source identifier.
   * @param client - The client instance to register.
   * @source
   */
  public registerClient(
    source: MangaSource,
    client: BaseMangaSourceClient,
  ): void {
    this.clients.set(source, client);
  }

  /**
   * Get a manga source client by source type.
   * Initializes the registry on first call.
   * @param source - The manga source to retrieve.
   * @returns Promise resolving to the client or null if not available.
   * @source
   */
  public async getClient(
    source: MangaSource,
  ): Promise<BaseMangaSourceClient | null> {
    await this.initialize();
    return this.clients.get(source) || null;
  }

  /**
   * Internal helper to get a client or throw a clear error.
   * Reduces duplication across public methods that require a client.
   * @param source - The manga source to retrieve.
   * @returns Promise resolving to the client.
   * @throws {Error} If the source is not available.
   * @source
   */
  private async getClientOrThrow(
    source: MangaSource,
  ): Promise<BaseMangaSourceClient> {
    const client = await this.getClient(source);
    if (!client) {
      throw new Error(`Manga source not available: ${source}`);
    }
    return client;
  }

  /**
   * Get all registered manga sources.
   * @returns Array of all registered source identifiers.
   * @source
   */
  public getAvailableSources(): MangaSource[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if a manga source is available.
   * @param source - The manga source to check.
   * @returns True if the source is registered.
   * @source
   */
  public isSourceAvailable(source: MangaSource): boolean {
    return this.clients.has(source);
  }

  /**
   * Search manga across a specific source.
   * @template T - The manga entry type.
   * @param source - The manga source to search.
   * @param query - The search query string.
   * @param limit - Maximum number of results (optional).
   * @returns Promise resolving to array of manga entries.
   * @throws {Error} If the source is not available.
   * @source
   */
  public async searchManga<T extends BaseMangaEntry>(
    source: MangaSource,
    query: string,
    limit?: number,
  ): Promise<T[]> {
    const client = await this.getClientOrThrow(source);
    return client.searchManga(query, limit) as Promise<T[]>;
  }

  /**
   * Get manga detail from a specific source.
   * @template T - The manga detail type.
   * @param source - The manga source to query.
   * @param slug - The manga identifier or slug.
   * @returns Promise resolving to manga detail or null if not found.
   * @throws {Error} If the source is not available.
   * @source
   */
  public async getMangaDetail<T extends BaseMangaDetail>(
    source: MangaSource,
    slug: string,
  ): Promise<T | null> {
    const client = await this.getClientOrThrow(source);
    return client.getMangaDetail(slug) as Promise<T | null>;
  }

  /**
   * Search and get AniList manga from a specific source.
   * Searches the source and enriches results with AniList data.
   * @param source - The manga source to search.
   * @param query - The search query string.
   * @param accessToken - AniList OAuth access token.
   * @param limit - Maximum number of results (optional).
   * @returns Promise resolving to enhanced AniList manga entries.
   * @throws {Error} If the source is not available.
   * @source
   */
  public async searchAndGetAniListManga(
    source: MangaSource,
    query: string,
    accessToken: string,
    limit?: number,
  ) {
    const client = await this.getClientOrThrow(source);
    return client.searchAndGetAniListManga(query, accessToken, limit);
  }

  /**
   * Clear cache for a specific source.
   * @param source - The manga source whose cache to clear.
   * @param queries - Array of search queries to clear from cache.
   * @returns Promise resolving to the number of cache entries cleared.
   * @source
   */
  public async clearCache(
    source: MangaSource,
    queries: string[],
  ): Promise<number> {
    const client = await this.getClient(source);
    if (!client) return 0;
    return client.clearCache(queries);
  }

  /**
   * Get cache status for a specific source.
   * @param source - The manga source to query.
   * @returns Promise resolving to cache status info or null if source unavailable.
   * @source
   */
  public async getCacheStatus(source: MangaSource) {
    const client = await this.getClient(source);
    if (!client) return null;
    return client.getCacheStatus();
  }
}

/**
 * Singleton registry instance for manga source clients.
 * Provides centralized access to all manga source clients.
 * @source
 */
export const mangaSourceRegistry = new MangaSourceRegistry();

/**
 * MangaSourceRegistry class export for testing or custom registry instances.
 * @source
 */
export { MangaSourceRegistry };
