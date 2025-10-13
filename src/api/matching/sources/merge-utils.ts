/**
 * Utilities for merging and managing results from multiple manga sources.
 *
 * @module sources/merge-utils
 * @packageDocumentation
 */

import type { AniListManga } from "../../anilist/types";
import type {
  ComickSourceMap,
  MangaDexSourceMap,
  GenericSourceInfo,
} from "./types";

/**
 * Merge results from original search, Comick, and MangaDex while handling duplicates
 * @param originalResults - Results from direct AniList search
 * @param comickResults - Results from Comick fallback
 * @param mangaDexResults - Results from MangaDex fallback
 * @param comickSourceMap - Comick source information map
 * @param mangaDexSourceMap - MangaDex source information map
 * @returns Merged results and updated source maps
 */
export function mergeSourceResults(
  originalResults: AniListManga[],
  comickResults: AniListManga[],
  mangaDexResults: AniListManga[],
  comickSourceMap: ComickSourceMap,
  mangaDexSourceMap: MangaDexSourceMap,
): {
  mergedResults: AniListManga[];
  comickSourceMap: ComickSourceMap;
  mangaDexSourceMap: MangaDexSourceMap;
} {
  const seenIds = new Set<number>();
  const mergedResults: AniListManga[] = [];
  const finalComickSourceMap = new Map(comickSourceMap);
  const finalMangaDexSourceMap = new Map(mangaDexSourceMap);

  // Add original results first
  for (const manga of originalResults) {
    if (!seenIds.has(manga.id)) {
      seenIds.add(manga.id);
      mergedResults.push(manga);
    }
  }

  // Add Comick results, checking for duplicates
  for (const manga of comickResults) {
    if (seenIds.has(manga.id)) {
      // If duplicate, keep the Comick source info
      console.debug(
        `[MangaSearchService] 🔄 Found duplicate manga ID ${manga.id} from Comick, keeping source info`,
      );
    } else {
      seenIds.add(manga.id);
      mergedResults.push(manga);
    }
  }

  // Add MangaDex results, checking for duplicates
  for (const manga of mangaDexResults) {
    if (seenIds.has(manga.id)) {
      // If duplicate, keep the MangaDex source info
      console.debug(
        `[MangaSearchService] 🔄 Found duplicate manga ID ${manga.id} from MangaDex, keeping source info`,
      );
    } else {
      seenIds.add(manga.id);
      mergedResults.push(manga);
    }
  }

  console.debug(
    `[MangaSearchService] 🔗 Merged results: ${originalResults.length} original + ${comickResults.length} Comick + ${mangaDexResults.length} MangaDex = ${mergedResults.length} unique results`,
  );

  return {
    mergedResults,
    comickSourceMap: finalComickSourceMap,
    mangaDexSourceMap: finalMangaDexSourceMap,
  };
}

/**
 * Get source info for a manga from either Comick or MangaDex source maps
 * @param mangaId - The manga ID to look up
 * @param comickSourceMap - Comick source information map
 * @param mangaDexSourceMap - MangaDex source information map
 * @returns Generic source info or undefined if not found
 */
export function getSourceInfo(
  mangaId: number,
  comickSourceMap: ComickSourceMap,
  mangaDexSourceMap: MangaDexSourceMap,
): GenericSourceInfo | undefined {
  if (comickSourceMap.has(mangaId)) {
    const comickInfo = comickSourceMap.get(mangaId)!;
    return {
      title: comickInfo.title,
      slug: comickInfo.slug,
      sourceId: comickInfo.comickId,
      source: "comick",
      foundViaAlternativeSearch: comickInfo.foundViaComick,
    };
  }

  if (mangaDexSourceMap.has(mangaId)) {
    const mangaDexInfo = mangaDexSourceMap.get(mangaId)!;
    return {
      title: mangaDexInfo.title,
      slug: mangaDexInfo.slug,
      sourceId: mangaDexInfo.mangaDexId,
      source: "mangadex",
      foundViaAlternativeSearch: mangaDexInfo.foundViaMangaDex,
    };
  }

  return undefined;
}
