import type { BaseMangaEntry, BaseMangaDetail } from "../types";
import { MangaSource } from "../types";

/**
 * @packageDocumentation
 * @module mangadex-types
 * @description MangaDex API type definitions for manga search and AniList link extraction.
 */

/**
 * Represents a MangaDex manga entry from the search API.
 * Extends the base manga entry with MangaDex-specific properties.
 *
 * @source
 */
export interface MangaDexManga extends BaseMangaEntry {
  source: MangaSource.MANGADEX;
  type: string;
  links?: {
    al?: string; // AniList ID
    ap?: string; // AnimePlanet
    kt?: string; // Kitsu
    mu?: string; // MangaUpdates
    mal?: string; // MyAnimeList
    [key: string]: string | undefined;
  };
  originalLanguage?: string;
  lastVolume?: string;
  lastChapter?: string;
  publicationDemographic?: string;
  contentRating?: string;
  tags?: Array<{
    id: string;
    type: string;
    attributes: {
      name: {
        en: string;
        [key: string]: string;
      };
      description: {
        en: string;
        [key: string]: string;
      };
      group: string;
      version: number;
    };
  }>;
}

/**
 * Attributes for MangaDex manga entries.
 *
 * @source
 */
export interface MangaDexAttributes {
  title: {
    en?: string;
    "ja-ro"?: string;
    ja?: string;
    [key: string]: string | undefined;
  };
  altTitles: Array<{
    [key: string]: string;
  }>;
  description: {
    en?: string;
    [key: string]: string | undefined;
  };
  isLocked: boolean;
  links?: {
    al?: string;
    ap?: string;
    kt?: string;
    mu?: string;
    mal?: string;
    [key: string]: string | undefined;
  };
  originalLanguage: string;
  lastVolume?: string;
  lastChapter?: string;
  publicationDemographic?: string;
  status: string;
  year?: number;
  contentRating: string;
  tags: Array<{
    id: string;
    type: string;
    attributes: {
      name: {
        en: string;
        [key: string]: string;
      };
      description: {
        en: string;
        [key: string]: string;
      };
      group: string;
      version: number;
    };
  }>;
  state: string;
  chapterNumbersResetOnNewVolume: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  availableTranslatedLanguages: string[];
  latestUploadedChapter: string;
}

/**
 * Represents the search response from MangaDex API.
 *
 * @source
 */
export interface MangaDexSearchResponse {
  result: string;
  response: string;
  data: Array<{
    id: string;
    type: string;
    attributes: MangaDexAttributes;
    relationships: Array<{
      id: string;
      type: string;
      attributes?: MangaDexAttributes;
    }>;
  }>;
  limit: number;
  offset: number;
  total: number;
}

/**
 * Represents a MangaDex manga detail with relationships (authors, artists, etc.).
 * Extends the base manga detail with MangaDex-specific properties.
 *
 * @source
 */
export interface MangaDexMangaDetail extends BaseMangaDetail {
  source: MangaSource.MANGADEX;
  data: {
    id: string;
    type: string;
    attributes: MangaDexAttributes;
    relationships: Array<{
      id: string;
      type: string;
      attributes?: {
        name?: string;
        imageUrl?: string;
        biography?: {
          en?: string;
          [key: string]: string | undefined;
        };
        twitter?: string;
        pixiv?: string;
        melonBook?: string;
        fanBook?: string;
        booth?: string;
        namicomi?: string;
        nicoVideo?: string;
        skeb?: string;
        fantia?: string;
        tumblr?: string;
        youtube?: string;
        weibo?: string;
        naver?: string;
        website?: string;
        createdAt?: string;
        updatedAt?: string;
        version?: number;
      };
    }>;
  };
}
