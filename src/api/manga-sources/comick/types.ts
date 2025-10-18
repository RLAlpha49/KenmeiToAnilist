import type { AniListManga } from "../../anilist/types";
import type { BaseMangaEntry, BaseMangaDetail } from "../types";
import { MangaSource } from "../types";

/**
 * @packageDocumentation
 * @module comick-types
 * @description Comick API response type definitions for manga search and details.
 */

/**
 * Represents a Comick manga entry from the search API.
 * Extends the base manga entry with Comick-specific properties and metadata.
 * @source
 */
export interface ComickManga extends BaseMangaEntry {
  source: MangaSource.COMICK;
  rating?: string;
  rating_count?: number;
  follow_count?: number;
  user_follow_count?: number;
  content_rating?: string;
  demographic?: number;
  /** Multi-dimensional titles from Comick's data system */
  md_titles?: Array<{
    title: string;
    lang: string;
  }>;
  /** MangaDex cross-reference data */
  md_comics?: {
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
  source: MangaSource.COMICK;
  comic: {
    id: string;
    title: string;
    slug: string;
    desc?: string;
    status?: number;
    year?: number;
    country?: string;
    created_at?: string;
    updated_at?: string;
    demographic?: number;
    hentai?: boolean;
    content_rating?: string;
    /** MangaUpdates cross-reference */
    mu_comics?: {
      id: string;
      title: string;
      slug: string;
    };
    /** MangaDex cross-reference */
    md_comics?: {
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
    md_titles?: Array<{
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
 * Represents a matched manga from Comick with AniList information.
 * @deprecated Use MangaMatchResult from manga-sources/types instead.
 * @source
 */
export interface ComickMatchResult {
  comickManga: ComickManga;
  anilistId?: number;
  anilistUrl?: string;
  source: "comick";
}

/**
 * Represents an enhanced AniList manga entry that includes Comick source information.
 * @deprecated Use EnhancedAniListManga from manga-sources/types instead.
 * @source
 */
export interface EnhancedAniListManga extends AniListManga {
  comickSource?: {
    title: string;
    slug: string;
    comickId: string;
    foundViaComick: boolean;
  };
}
