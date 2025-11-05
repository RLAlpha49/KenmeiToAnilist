/**
 * System content filtering utilities for manga matching.
 * Provides shared filtering logic for novels, one-shots, and adult content
 * applied consistently across multiple matching pipelines.
 * @module filtering/system-filters
 * @source
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import { isOneShot } from "../normalization";
import { shouldSkipByCustomRules } from "./custom-rules";

/**
 * Configuration for system content filtering.
 * @property ignoreOneShots - Whether to filter out one-shots
 * @property ignoreAdultContent - Whether to filter out adult content
 * @source
 */
export interface SystemFilterConfig {
  ignoreOneShots?: boolean;
  ignoreAdultContent?: boolean;
}

/**
 * Apply system content filters to manga results.
 * Filters novels, one-shots (if enabled), adult content (if enabled), and custom skip rules.
 * @param results - Manga results to filter
 * @param matchConfig - Match configuration with filter settings
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation
 * @param contextTitle - Optional title for debug logging
 * @returns Filtered manga results
 * @source
 */
export function applySystemContentFilters(
  results: AniListManga[],
  matchConfig: SystemFilterConfig,
  kenmeiManga?: KenmeiManga,
  contextTitle?: string,
): AniListManga[] {
  let filteredResults = results.filter(
    (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
  );

  // Filter one-shots if enabled
  if (matchConfig.ignoreOneShots) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !isOneShot(manga));
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter && contextTitle) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} one-shot(s) for "${contextTitle}" during system content filtering`,
      );
    }
  }

  // Filter adult content if enabled
  if (matchConfig.ignoreAdultContent) {
    const beforeFilter = filteredResults.length;
    filteredResults = filteredResults.filter((manga) => !manga.isAdult);
    const afterFilter = filteredResults.length;

    if (beforeFilter > afterFilter && contextTitle) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeFilter - afterFilter} adult content manga for "${contextTitle}" during system content filtering`,
      );
    }
  }

  // Apply custom skip rules if kenmeiManga provided
  if (kenmeiManga) {
    const beforeCustomSkip = filteredResults.length;
    filteredResults = filteredResults.filter(
      (manga) => !shouldSkipByCustomRules(manga, kenmeiManga, false),
    );
    const afterCustomSkip = filteredResults.length;

    if (beforeCustomSkip > afterCustomSkip && contextTitle) {
      console.debug(
        `[MangaSearchService] 🚫 Filtered out ${beforeCustomSkip - afterCustomSkip} manga by custom skip rules for "${contextTitle}"`,
      );
    }
  }

  return filteredResults;
}
