/**
 * @packageDocumentation
 * @module comick-types
 * @description Comick API response type definitions for manga search and details.
 */

// AniList types are not required in this file; use base EnhancedAniListManga from manga-sources/types when needed
import type {
  BaseMangaEntry,
  BaseMangaDetail,
  MangaMatchResult,
  EnhancedAniListManga as BaseEnhancedAniListManga,
} from "../types";
import { MangaSource } from "../types";

/**
 * Represents a Comick manga entry from the search API.
 * Extends the base manga entry with Comick-specific properties and metadata.
 * @source
 */
export interface ComickManga extends BaseMangaEntry {
  source: MangaSource.Comick;
  rating?: string;
  ratingCount?: number;
  followCount?: number;
  userFollowCount?: number;
  contentRating?: string;
  demographic?: number;
  /** Multi-dimensional titles from Comick's data system */
  mdTitles?: Array<{
    title: string;
    lang: string;
  }>;
  /** MangaDex cross-reference data */
  mdComics?: {
    id: string;
    title: string;
    slug: string;
  };
  /** Search highlight from API results */
  highlight?: string;
}

/**
 * Represents the search response from Comick API.
 * @source
 */
export interface ComickSearchResponse {
  data: ComickManga[];
  status: string;
  message?: string;
}

/**
 * Represents a Comick manga detail with external referrers and cross-references.
 * Extends the base manga detail with Comick-specific properties and nested comic data.
 * @source
 */
export interface ComickMangaDetail extends BaseMangaDetail {
  source: MangaSource.Comick;
  comic: {
    id: string;
    title: string;
    slug: string;
    desc?: string;
    status?: number;
    year?: number;
    country?: string;
    createdAt?: string;
    updatedAt?: string;
    demographic?: number;
    hentai?: boolean;
    contentRating?: string;
    /** MangaUpdates cross-reference */
    muComics?: {
      id: string;
      title: string;
      slug: string;
    };
    /** MangaDex cross-reference */
    mdComics?: {
      id: string;
      title: string;
      slug: string;
    };
    authors?: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
    artists?: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
    genres?: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
    /** Multi-dimensional titles */
    mdTitles?: Array<{
      title: string;
      lang: string;
    }>;
    /** External links to other platforms */
    links?: {
      al?: string; // AniList ID
      ap?: string; // AnimePlanet
      kt?: string; // Kitsu
      mb?: string; // MangaBuddy
      mu?: string; // MangaUpdates
      mal?: string; // MyAnimeList
      [key: string]: string | undefined;
    };
  };
  langList?: string[];
}

/**
 * @deprecated Use MangaMatchResult<ComickManga> from manga-sources/types instead.
 */
export type ComickMatchResult = MangaMatchResult<ComickManga>;

/**
 * @deprecated Use EnhancedAniListManga from manga-sources/types instead.
 */
export type EnhancedAniListManga = BaseEnhancedAniListManga;
