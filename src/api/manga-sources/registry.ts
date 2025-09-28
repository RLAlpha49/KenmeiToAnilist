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
    if (this.initialized) {
      return;
    }

    // Dynamically import clients to avoid circular dependencies
    try {
      const { comickClient } = await import("./comick/client");
      this.registerClient(MangaSource.COMICK, comickClient);
    } catch (error) {
      console.error("Failed to initialize Comick client:", error);
    }

    try {
      const { mangaDexClient } = await import("./mangadex/client");
      this.registerClient(MangaSource.MANGADEX, mangaDexClient);
    } catch (error) {
      console.error("Failed to initialize MangaDex client:", error);
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
    const client = await this.getClient(source);
    if (!client) {
      throw new Error(`Manga source not available: ${source}`);
    }

    return client.searchManga(query, limit) as Promise<T[]>;
  }

  /**
   * Get manga detail from a specific source.
   */
  public async getMangaDetail<T extends BaseMangaDetail>(
    source: MangaSource,
    slug: string,
  ): Promise<T | null> {
    const client = await this.getClient(source);
    if (!client) {
      throw new Error(`Manga source not available: ${source}`);
    }

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
    const client = await this.getClient(source);
    if (!client) {
      throw new Error(`Manga source not available: ${source}`);
    }

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
    if (!client) {
      return 0;
    }

    return client.clearCache(queries);
  }

  /**
   * Get cache status for a specific source.
   */
  public async getCacheStatus(source: MangaSource) {
    const client = await this.getClient(source);
    if (!client) {
      return null;
    }

    return client.getCacheStatus();
  }
}

// Create and export the singleton registry
export const mangaSourceRegistry = new MangaSourceRegistry();

// Export the class for testing or custom registries
export { MangaSourceRegistry };
