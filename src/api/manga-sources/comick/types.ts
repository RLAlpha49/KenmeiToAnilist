import type { AniListManga } from "../../anilist/types";
import type { BaseMangaEntry, BaseMangaDetail } from "../types";
import { MangaSource } from "../types";

/**
 * @packageDocumentation
 * @module comick-types
 * @description Comick API type definitions for manga search and AniList link extraction.
 */

/**
 * Represents a Comick manga entry from the search API.
 * Extends the base manga entry with Comick-specific properties.
 *
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
  md_titles?: Array<{
    title: string;
    lang: string;
  }>;
  md_comics?: {
    id: string;
    title: string;
    slug: string;
  };
  highlight?: string; // Search highlight from API
}

/**
 * Represents the search response from Comick API.
 *
 * @source
 */
export interface ComickSearchResponse {
  data: ComickManga[];
  status: string;
  message?: string;
}

/**
 * Represents a Comick manga detail with referrers (external links).
 * Extends the base manga detail with Comick-specific properties.
 *
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
    mu_comics?: {
      id: string;
      title: string;
      slug: string;
    };
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
    md_titles?: Array<{
      title: string;
      lang: string;
    }>;
    links?: {
      al?: string; // AniList ID
      ap?: string; // AnimePlanet
      kt?: string; // Kitsu
      mb?: string; // MangaBuddy
      mu?: string; // MangaUpdates
      mal?: string; // MyAnimeList
      [key: string]: string | undefined; // Allow for other site keys
    };
  };
  langList?: string[];
}

/**
 * Represents a matched manga from Comick with AniList info.
 * @deprecated Use MangaMatchResult from manga-sources/types instead.
 *
 * @source
 */
export interface ComickMatchResult {
  comickManga: ComickManga;
  anilistId?: number;
  anilistUrl?: string;
  source: "comick";
}

/**
 * Represents an enhanced AniList manga entry that includes Comick source info.
 * @deprecated Use EnhancedAniListManga from manga-sources/types instead.
 *
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
