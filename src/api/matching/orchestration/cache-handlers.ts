/**
 * @file Cache handling operations for search orchestration
 * @module matching/orchestration/cache-handlers
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { MangaSearchResponse, SearchServiceConfig } from "./types";
import {
  generateCacheKey,
  isCacheValid,
  mangaCache,
  saveCache,
} from "../cache";
import { calculateConfidence, calculateTitleTypePriority } from "../scoring";
import { getMatchConfig } from "@/utils/storage";
import {
  shouldAcceptByCustomRules,
  ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT,
  ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR,
} from "../filtering/custom-rules";
import { applySystemContentFilters } from "../filtering/system-filters";

/**
 * Clear existing cache entry when bypassing cache.
 *
 * @param title - Manga title to clear from cache
 * @param cacheKey - Cache key for the title
 * @source
 */
export function handleCacheBypass(title: string, cacheKey: string): void {
  console.debug(
    `[MangaSearchService] 🔥 Fresh search: Explicitly clearing cache for "${title}"`,
  );

  if (mangaCache[cacheKey]) {
    delete mangaCache[cacheKey];
    console.debug(
      `[MangaSearchService] 🧹 Removed existing cache entry for "${title}"`,
    );
    saveCache();
  } else {
    console.debug(
      `[MangaSearchService] 🔍 No existing cache entry found for "${title}" to clear`,
    );
  }
}

/**
 * Process cached results with filtering and confidence recalculation.
 *
 * When `kenmeiManga` is provided, applies custom rules in the following order:
 * 1. System filters: one-shots, adult content
 * 2. Custom skip rules - removes matches entirely (highest precedence)
 * 3. Confidence recalculation based on cached results
 * 4. Custom accept rule boost - applies confidence floor immediately (85% exact / 75% other)
 *
 * Without `kenmeiManga`, only system filters are applied (backward-compatible mode).
 *
 * @param title - Manga title to process cached results for
 * @param cacheKey - Cache key to retrieve results from
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation
 * @returns Manga search response with cached results or null if cache invalid
 *
 * @remarks
 * Custom rules are only evaluated when kenmeiManga is provided to enable proper filtering.
 * For general caching without kenmeiManga, custom rules are not evaluated.
 * Skip rules take precedence over accept rules - if a match satisfies both, it is skipped.
 * Accept rule confidence boost is applied immediately within this function for cached results,
 * ensuring consistent confidence values before returning to the caller.
 *
 * @example
 * ```typescript
 * // With custom rules enabled
 * const response = processCachedResults("Naruto", "naruto_key", kenmeiManga);
 * // Result includes skip-rule filtered matches and accept-rule boosted confidence
 *
 * // Without custom rules (backward compatible)
 * const response = processCachedResults("Naruto", "naruto_key");
 * // Result is only system-filtered
 * ```
 *
 * @source
 */
export function processCachedResults(
  title: string,
  cacheKey: string,
  kenmeiManga?: KenmeiManga,
): MangaSearchResponse | null {
  if (!isCacheValid(cacheKey)) return null;

  console.debug(`[MangaSearchService] Using cache for ${title}`);
  let filteredManga = mangaCache[cacheKey].manga.filter(
    (manga) => manga.format !== "NOVEL" && manga.format !== "LIGHT_NOVEL",
  );

  const matchConfig = getMatchConfig();

  // Apply system content filters (one-shots, adult content, custom skip rules)
  filteredManga = applySystemContentFilters(
    filteredManga,
    matchConfig,
    kenmeiManga,
    title,
  );

  console.debug(
    `[MangaSearchService] ⚖️ Calculating fresh confidence scores for ${filteredManga.length} cached matches`,
  );

  const matches = filteredManga.map((manga) => {
    let confidence = calculateConfidence(title, manga);
    const titleTypePriority = calculateTitleTypePriority(manga, title);

    // Apply custom accept rule boost if kenmeiManga provided
    if (kenmeiManga) {
      const { shouldAccept, matchedRule } = shouldAcceptByCustomRules(
        manga,
        kenmeiManga,
      );
      if (shouldAccept && matchedRule) {
        // Apply confidence floor boost immediately for cached results
        const isExactMatch =
          title.toLowerCase() === manga.title?.romaji?.toLowerCase() ||
          title.toLowerCase() === manga.title?.english?.toLowerCase();
        const minConfidence = isExactMatch
          ? ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT
          : ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR;

        if (confidence < minConfidence) {
          console.debug(
            `[MangaSearchService] ⭐ Boosting cached result confidence from ${(confidence * 100).toFixed(0)}% to ${(minConfidence * 100).toFixed(0)}% for "${manga.title?.romaji || manga.title?.english}" (custom accept rule: "${matchedRule.description}")`,
          );
          confidence = minConfidence;
        }
      }
    }

    console.debug(
      `[MangaSearchService] ⚖️ Cached match confidence for "${manga.title?.english || manga.title?.romaji}": ${(confidence * 100).toFixed(0)}% (priority: ${titleTypePriority})`,
    );

    return { manga, confidence, titleTypePriority };
  });

  // Sort by confidence and priority
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.titleTypePriority - a.titleTypePriority;
  });

  const finalMatches = matches.map(({ manga, confidence }) => ({
    manga,
    confidence,
    comickSource: undefined,
  }));

  return {
    matches: finalMatches,
    pageInfo: undefined,
  };
}

/**
 * Store ranked manga results to cache for future searches.
 *
 * Skips caching if bypassCache is enabled in config.
 *
 * @param title - Manga title to cache results for
 * @param results - Ranked manga results to cache
 * @param searchConfig - Search configuration
 * @source
 */
export function cacheSearchResults(
  title: string,
  results: AniListManga[],
  searchConfig: SearchServiceConfig,
): void {
  if (searchConfig.bypassCache) {
    console.debug(
      `[MangaSearchService] 🔍 MANUAL SEARCH: Skipping cache save for "${title}"`,
    );
    return;
  }

  const cacheKey = generateCacheKey(title);
  mangaCache[cacheKey] = {
    manga: results,
    timestamp: Date.now(),
  };
  saveCache();
}
