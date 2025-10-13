/**
 * @file Compile and finalize batch match results
 * @module matching/batching/results
 */

import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { ComickSourceStorage, MangaDexSourceStorage } from "./types";
import { isOneShot } from "../normalization";
import { calculateConfidence } from "../scoring";
import { getSourceInfo } from "../sources";
import { getMatchConfig } from "@/utils/storage";

/**
 * Apply filtering rules to potential matches based on match configuration
 *
 * Filters one-shots and adult content based on user configuration.
 * These filters only apply during automatic matching, not manual review.
 *
 * @param potentialMatches - List of potential manga matches
 * @param mangaTitle - Title of the Kenmei manga being matched
 * @param matchConfig - Configuration for filtering (ignoreOneShots, ignoreAdultContent)
 * @returns Filtered list of manga matches
 */
export function applyMatchFiltering(
  potentialMatches: AniListManga[],
  mangaTitle: string,
  matchConfig: { ignoreOneShots?: boolean; ignoreAdultContent?: boolean },
): AniListManga[] {
  let filteredMatches = potentialMatches;

  // Filter out one-shots if the setting is enabled (for automatic matching)
  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredMatches.length;
    filteredMatches = filteredMatches.filter((match) => !isOneShot(match));
    const afterFilter = filteredMatches.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) for "${mangaTitle}" during batch matching`,
      );
    }
  }

  // Filter out adult content if the setting is enabled (for automatic matching)
  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredMatches.length;
    filteredMatches = filteredMatches.filter((match) => !match.isAdult);
    const afterFilter = filteredMatches.length;

    if (beforeFilter > afterFilter) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} adult content manga for "${mangaTitle}" during batch matching`,
      );
    }
  }

  return filteredMatches;
}

/**
 * Create MangaMatchResult for a single manga entry
 *
 * Combines manga data with match confidence scores and source information.
 * Includes Comick and MangaDex source mappings if available.
 *
 * @param manga - Kenmei manga entry
 * @param potentialMatches - List of AniList matches for this manga
 * @param comickSourceMap - Map of manga ID to Comick source info
 * @param mangaDexSourceMap - Map of manga ID to MangaDex source info
 * @returns Complete match result with confidence scores and source info
 */
export function createMangaMatchResult(
  manga: KenmeiManga,
  potentialMatches: AniListManga[],
  comickSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      comickId: string;
      foundViaComick: boolean;
    }
  >,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      foundViaMangaDex: boolean;
    }
  >,
): MangaMatchResult {
  // Fix mapping to create proper MangaMatch objects with Comick source info
  const potentialMatchesFixed = potentialMatches.map((match) => {
    const sourceInfo = getSourceInfo(
      match.id,
      comickSourceMap,
      mangaDexSourceMap,
    );

    return {
      manga: match,
      confidence: calculateConfidence(manga.title, match),
      comickSource: comickSourceMap.get(match.id), // Include Comick source if available
      mangaDexSource: mangaDexSourceMap.get(match.id),
      sourceInfo,
    };
  });

  return {
    kenmeiManga: manga,
    anilistMatches: potentialMatchesFixed,
    selectedMatch:
      potentialMatchesFixed.length > 0
        ? potentialMatchesFixed[0].manga
        : undefined,
    status: "pending",
  };
}

/**
 * Compile final results from cached data and create MangaMatchResult objects
 *
 * Takes categorized manga and cached results, applies filtering rules,
 * and creates structured match results with confidence scores and source info.
 *
 * @param mangaList - Full list of Kenmei manga
 * @param cachedResults - Cached/fetched AniList matches by index
 * @param cachedComickSources - Comick source information by index
 * @param cachedMangaDexSources - MangaDex source information by index
 * @param checkCancellation - Function to check if operation was cancelled
 * @param updateProgress - Callback to update progress
 * @returns Array of complete match results
 */
export function compileMatchResults(
  mangaList: KenmeiManga[],
  cachedResults: Record<number, AniListManga[]>,
  cachedComickSources: ComickSourceStorage,
  cachedMangaDexSources: MangaDexSourceStorage,
  checkCancellation: () => void,
  updateProgress: (index: number, title?: string) => void,
): MangaMatchResult[] {
  const results: MangaMatchResult[] = [];

  // First fill in the results array to match the mangaList length
  for (let i = 0; i < mangaList.length; i++) {
    results[i] = {
      kenmeiManga: mangaList[i],
      anilistMatches: [],
      status: "pending",
    } as MangaMatchResult; // Use empty arrays instead of null

    // Initialize empty Comick source maps for missing entries
    if (!cachedComickSources[i]) {
      cachedComickSources[i] = new Map();
    }
    if (!cachedMangaDexSources[i]) {
      cachedMangaDexSources[i] = new Map();
    }
  }

  // Fill in the results for manga we have matches for
  const matchConfig = getMatchConfig();
  for (let i = 0; i < mangaList.length; i++) {
    // Check for cancellation periodically
    if (i % 10 === 0) {
      checkCancellation();
    }

    const manga = mangaList[i];
    let potentialMatches = cachedResults[i] || [];

    // Apply filtering rules based on match configuration
    potentialMatches = applyMatchFiltering(
      potentialMatches,
      manga.title,
      matchConfig,
    );

    // Update progress for any remaining manga
    updateProgress(i, manga.title);

    // Create match result for this manga
    const comickSourceMap = cachedComickSources[i] || new Map();
    const mangaDexSourceMap = cachedMangaDexSources[i] || new Map();
    results[i] = createMangaMatchResult(
      manga,
      potentialMatches,
      comickSourceMap,
      mangaDexSourceMap,
    );
  }

  // Filter out any null entries (though there shouldn't be any)
  return results.filter((result) => result !== null);
}

/**
 * Handle partial results in case of cancellation during processing
 *
 * When batch processing is cancelled, this function creates match results
 * from whatever was successfully fetched before cancellation. Useful for
 * allowing users to review partial progress.
 *
 * @param mangaList - Full list of Kenmei manga
 * @param cachedResults - Results fetched before cancellation
 * @returns Array of match results for successfully processed manga
 */
export function handleCancellationResults(
  mangaList: KenmeiManga[],
  cachedResults: Record<number, AniListManga[]>,
): MangaMatchResult[] {
  const results: MangaMatchResult[] = [];

  // Process whatever results we have so far
  for (let i = 0; i < mangaList.length; i++) {
    if (cachedResults[i]) {
      const manga = mangaList[i];
      const potentialMatches = cachedResults[i].map((anilistManga) => ({
        manga: anilistManga,
        confidence: calculateConfidence(manga.title, anilistManga),
      }));

      results.push({
        kenmeiManga: manga,
        anilistMatches: potentialMatches,
        selectedMatch:
          potentialMatches.length > 0 ? potentialMatches[0].manga : undefined,
        status: "pending",
      });
    }
  }

  return results;
}
