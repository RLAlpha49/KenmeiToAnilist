/**
 * System content filtering utilities for manga matching.
 *
 * Provides shared filtering logic for system-level content filters
 * (novels, one-shots, adult content) that are applied consistently
 * across multiple matching pipelines.
 *
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
 *
 * Applies the following filters in order:
 * 1. Always filter out novels and light novels (format-based)
 * 2. Filter one-shots if ignoreOneShots is enabled
 * 3. Filter adult content if ignoreAdultContent is enabled
 * 4. Apply custom skip rules if kenmeiManga is provided
 *
 * This shared logic is used across multiple filtering pipelines to ensure
 * consistent behavior for system-level content filtering.
 *
 * @param results - Manga results to filter
 * @param matchConfig - Match configuration with filter settings
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation
 * @param contextTitle - Optional title for debug logging
 * @returns Filtered manga results
 *
 * @example
 * ```typescript
 * const filtered = applySystemContentFilters(results, matchConfig, kenmeiManga, "Naruto");
 * console.log(`Filtered from ${results.length} to ${filtered.length} results`);
 * ```
 *
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
