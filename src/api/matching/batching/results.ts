/**
 * @file Compile and finalize batch match results
 * @module matching/batching/results
 */

import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { ComickSourceStorage, MangaDexSourceStorage } from "./types";
import type { CustomRule } from "@/utils/storage";
import { calculateConfidence } from "../scoring";
import { getSourceInfo } from "../sources";
import { getMatchConfig } from "@/utils/storage";
import {
  shouldAcceptByCustomRules,
  ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT,
  ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR,
} from "../filtering/custom-rules";
import { applySystemContentFilters } from "../filtering/system-filters";

/**
 * Filter matches based on configuration rules (one-shots, adult content, custom rules).
 *
 * Applies user-configured filtering during automatic matching:
 * 1. Filters out one-shots (if enabled)
 * 2. Filters out adult content (if enabled)
 * 3. **Skip rules applied first** - these take precedence and remove matches entirely
 * 4. Accept rules tracked but not removed - matched accept rules are marked for confidence boost
 *
 * **Confidence Boost Behavior**:
 * When a match satisfies a custom accept rule, it's marked internally. The createMangaMatchResult()
 * function later applies a confidence floor: 85% for exact title matches, 75% otherwise.
 * Skip rules always take precedence - if a match matches both skip and accept rules, it's skipped.
 *
 * @param potentialMatches - Potential manga matches.
 * @param mangaTitle - Title of manga being matched.
 * @param matchConfig - Configuration with ignoreOneShots, ignoreAdultContent.
 * @param kenmeiManga - Kenmei manga for custom rule evaluation.
 * @returns Filtered list of manga matches (with internal accept rule tracking if applicable).
 *
 * @example
 * ```typescript
 * const filtered = applyMatchFiltering(matches, "Naruto", config, kenmeiManga);
 * console.log(`Filtered to ${filtered.length} matches`);
 * // Accept rule matches will have confidence boosted in createMangaMatchResult()
 * ```
 *
 * @source
 */
export function applyMatchFiltering(
  potentialMatches: AniListManga[],
  mangaTitle: string,
  matchConfig: { ignoreOneShots?: boolean; ignoreAdultContent?: boolean },
  kenmeiManga: KenmeiManga,
): Array<AniListManga & { __acceptRuleMatch?: CustomRule }> {
  let filteredMatches: Array<
    AniListManga & { __acceptRuleMatch?: CustomRule }
  > = potentialMatches.map((m) => ({ ...m }));

  // Apply system content filters (novels, one-shots, adult content)
  const systemFiltered = applySystemContentFilters(
    filteredMatches,
    matchConfig,
    kenmeiManga,
    mangaTitle,
  );
  filteredMatches = systemFiltered.map((m) => ({
    ...m,
  })) as Array<AniListManga & { __acceptRuleMatch?: CustomRule }>;

  // Mark matches that satisfy custom accept rules (without removing them)
  // Confidence will be boosted later in createMangaMatchResult()
  filteredMatches = filteredMatches.map((match) => {
    const { shouldAccept, matchedRule } = shouldAcceptByCustomRules(
      match,
      kenmeiManga,
    );
    if (shouldAccept && matchedRule) {
      console.debug(
        `[MangaSearchService] ⭐ Marking confidence boost for "${match.title?.romaji || match.title?.english}" due to custom accept rule: "${matchedRule.description}"`,
      );
      return { ...match, __acceptRuleMatch: matchedRule };
    }
    return match;
  });

  return filteredMatches;
}

/**
 * Create MangaMatchResult for single manga with confidence scores and sources.
 *
 * Combines AniList matches with confidence scores and Comick/MangaDex source info.
 * **Applies confidence floor boost** for matches that satisfied custom accept rules:
 * - Exact matches: boosted to 85% confidence minimum
 * - Other matches: boosted to 75% confidence minimum
 *
 * @param manga - Kenmei manga entry.
 * @param potentialMatches - AniList matches for this manga (may have __acceptRuleMatch tracking).
 * @param comickSourceMap - Map of manga ID to Comick source info.
 * @param mangaDexSourceMap - Map of manga ID to MangaDex source info.
 * @returns Complete match result with confidence and source info.
 * @source
 */
export function createMangaMatchResult(
  manga: KenmeiManga,
  potentialMatches: Array<AniListManga & { __acceptRuleMatch?: CustomRule }>,
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

    let confidence = calculateConfidence(manga.title, match);

    // Apply confidence floor boost if accept rule matched
    if (match.__acceptRuleMatch) {
      const isExactMatch =
        manga.title.toLowerCase() === match.title?.romaji?.toLowerCase() ||
        manga.title.toLowerCase() === match.title?.english?.toLowerCase();
      const minConfidence = isExactMatch
        ? ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT
        : ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR;

      if (confidence < minConfidence) {
        console.debug(
          `[MangaSearchService] ⭐ Boosting confidence from ${(confidence * 100).toFixed(0)}% to ${(minConfidence * 100).toFixed(0)}% for "${match.title?.romaji || match.title?.english}" (accept rule match)`,
        );
        confidence = minConfidence;
      }
    }

    return {
      manga: match,
      confidence,
      comickSource: comickSourceMap.get(match.id),
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
 * Compile final match results from cached data with confidence scores.
 *
 * Applies filtering, creates match results with confidence scores, and includes source info.
 *
 * @param mangaList - Full list of Kenmei manga.
 * @param cachedResults - Cached/fetched AniList matches by index.
 * @param cachedComickSources - Comick source information by index.
 * @param cachedMangaDexSources - MangaDex source information by index.
 * @param checkCancellation - Cancellation check function.
 * @param updateProgress - Progress update callback.
 * @returns Array of complete match results.
 * @source
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
      manga,
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
 * Create partial match results from partially-processed data before cancellation.
 *
 * Returns successfully-matched entries when batch processing is cancelled.
 * Allows users to review partial progress.
 *
 * @param mangaList - Full list of Kenmei manga.
 * @param cachedResults - Results fetched before cancellation.
 * @returns Array of match results for successfully-processed manga.
 * @source
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
