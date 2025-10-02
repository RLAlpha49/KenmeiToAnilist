/**
 * @packageDocumentation
 * @module manga-source-registry
 * @description Registry for managing manga source clients.
 */

import type { BaseMangaSourceClient } from "./base-client";
import type { BaseMangaEntry, BaseMangaDetail } from "./types";
import { MangaSource } from "./types";

/**
 * Registry for manga source clients.
 */
class MangaSourceRegistry {
  private readonly clients = new Map<MangaSource, BaseMangaSourceClient>();
  private initialized = false;

  /**
   * Initialize the registry with available clients.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load known clients in parallel to reduce startup latency and
    // keep the happy path clear. Individual failures are logged but do
    // not prevent other clients from registering.
    const loaders = [
      {
        source: MangaSource.COMICK,
        path: "./comick/client",
        exportName: "comickClient",
      },
      {
        source: MangaSource.MANGADEX,
        path: "./mangadex/client",
        exportName: "mangaDexClient",
      },
    ] as const;

    type Loader = (typeof loaders)[number];
    type LoadResult = {
      loader: Loader;
      client?: BaseMangaSourceClient;
      error?: unknown;
    };

    const isClient = (obj: unknown): obj is BaseMangaSourceClient => {
      return (
        typeof obj === "object" &&
        obj !== null &&
        typeof (obj as Record<string, unknown>)["searchManga"] === "function"
      );
    };

    const promises = loaders.map(async (l): Promise<LoadResult> => {
      try {
        const mod = await import(l.path);
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
      console.error(`Failed to initialize ${res.loader.path}:`, res.error);
    }

    this.initialized = true;
  }

  /**
   * Register a manga source client.
   */
  public registerClient(
    source: MangaSource,
    client: BaseMangaSourceClient,
  ): void {
    this.clients.set(source, client);
  }

  /**
   * Get a manga source client by source type.
   */
  public async getClient(
    source: MangaSource,
  ): Promise<BaseMangaSourceClient | null> {
    await this.initialize();
    return this.clients.get(source) || null;
  }

  /**
   * Internal helper to get a client or throw a clear error.
   * This reduces duplication across public methods that require a client.
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
   */
  public getAvailableSources(): MangaSource[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if a manga source is available.
   */
  public isSourceAvailable(source: MangaSource): boolean {
    return this.clients.has(source);
  }

  /**
   * Search manga across a specific source.
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
   */
  public async getCacheStatus(source: MangaSource) {
    const client = await this.getClient(source);
    if (!client) return null;
    return client.getCacheStatus();
  }
}

// Create and export the singleton registry
export const mangaSourceRegistry = new MangaSourceRegistry();

// Export the class for testing or custom registries
export { MangaSourceRegistry };
