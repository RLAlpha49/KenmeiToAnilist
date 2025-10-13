/**
 * Convert enhanced manga types to standard AniList format.
 *
 * @module sources/conversion
 * @packageDocumentation
 */

import type { AniListManga } from "../../anilist/types";
import type { EnhancedAniListManga } from "../../manga-sources/types";

/**
 * Convert enhanced manga to AniListManga format
 * @param enhancedManga - Enhanced manga with source information
 * @returns Standard AniListManga object without source info
 */
export function convertEnhancedMangaToAniList(
  enhancedManga: EnhancedAniListManga,
): AniListManga {
  return {
    id: enhancedManga.id,
    title: enhancedManga.title,
    synonyms: enhancedManga.synonyms,
    description: enhancedManga.description,
    format: enhancedManga.format,
    status: enhancedManga.status,
    chapters: enhancedManga.chapters,
    volumes: enhancedManga.volumes,
    countryOfOrigin: enhancedManga.countryOfOrigin,
    source: enhancedManga.source,
    coverImage: enhancedManga.coverImage,
    genres: enhancedManga.genres,
    tags: enhancedManga.tags,
    startDate: enhancedManga.startDate,
    staff: enhancedManga.staff,
    mediaListEntry: enhancedManga.mediaListEntry
      ? {
          ...enhancedManga.mediaListEntry,
          status: enhancedManga.mediaListEntry.status,
        }
      : enhancedManga.mediaListEntry,
    isAdult: enhancedManga.isAdult,
  };
}
