/**
 * Compile and finalize batch match results
 * @module matching/batching/results
 */

import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { ComickSourceStorage, MangaDexSourceStorage } from "./types";
import type { CustomRule, MatchConfig } from "@/utils/storage";
import { calculateConfidence } from "../scoring";
import { getSourceInfo } from "../sources";
import { getMatchConfig, getSavedMatchResults } from "@/utils/storage";
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
 * @param matchConfig - Configuration with shouldIgnoreOneShots, shouldIgnoreAdultContent.
 * @param kenmeiManga - Kenmei manga for custom rule evaluation.
 * @returns Filtered list of manga matches (with internal accept rule tracking if applicable).
 * @source
 */
export function applyMatchFiltering(
  potentialMatches: AniListManga[],
  mangaTitle: string,
  matchConfig: Partial<MatchConfig>,
  kenmeiManga: KenmeiManga,
): Array<AniListManga & { matchedAcceptRule?: CustomRule }> {
  let filteredMatches: Array<
    AniListManga & { matchedAcceptRule?: CustomRule }
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
  })) as Array<AniListManga & { matchedAcceptRule?: CustomRule }>;

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
      return { ...match, matchedAcceptRule: matchedRule };
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
 * @param potentialMatches - AniList matches for this manga (may have matchedAcceptRule tracking).
 * @param comickSourceMap - Map of manga ID to Comick source info.
 * @param mangaDexSourceMap - Map of manga ID to MangaDex source info.
 * @returns Complete match result with confidence and source info.
 * @source
 */
export function createMangaMatchResult(
  manga: KenmeiManga,
  potentialMatches: Array<AniListManga & { matchedAcceptRule?: CustomRule }>,
  comickSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      comickId: string;
      isFoundViaComick: boolean;
    }
  >,
  mangaDexSourceMap: Map<
    number,
    {
      title: string;
      slug: string;
      mangaDexId: string;
      isFoundViaMangaDex: boolean;
    }
  >,
): MangaMatchResult {
  // Fix mapping to create proper MangaMatch objects with Comick source info
  const normalizedMatches = potentialMatches.map((match) => {
    const sourceInfo = getSourceInfo(
      match.id,
      comickSourceMap,
      mangaDexSourceMap,
    );

    let confidence = calculateConfidence(manga.title, match);

    // Apply confidence floor boost if accept rule matched
    if (match.matchedAcceptRule) {
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
    anilistMatches: normalizedMatches,
    selectedMatch:
      normalizedMatches.length > 0 ? normalizedMatches[0].manga : undefined,
    status: "pending",
  };
}

/**
 * Process matching using Web Workers for parallel execution.
 * Returns null if workers are unavailable or fail.
 */
async function processWithWorkers(
  mangaList: KenmeiManga[],
  cachedResults: Record<number, AniListManga[]>,
  matchConfig: ReturnType<typeof getMatchConfig>,
  options: {
    cachedComickSources: ComickSourceStorage;
    cachedMangaDexSources: MangaDexSourceStorage;
    checkCancellation: () => void;
    updateProgress: (index: number, title?: string) => void;
    preserveExistingStatus: (
      result: MangaMatchResult,
      manga: KenmeiManga,
    ) => void;
  },
): Promise<MangaMatchResult[] | null> {
  try {
    const { executeMatchingWithWorkers } = await import("@/workers");

    // Build candidates map for worker execution and track accept rule matches
    // Use index-based keys to avoid collision when manga.id is undefined
    const candidatesMap = new Map<string, AniListManga[]>();
    const acceptRuleMatchIdsByIndex = new Map<string, Set<number>>(); // index -> Set of AniList IDs with accept rule

    for (let i = 0; i < mangaList.length; i++) {
      const manga = mangaList[i];
      let potentialMatches = cachedResults[i] || [];

      // Apply filtering rules
      potentialMatches = applyMatchFiltering(
        potentialMatches,
        manga.title,
        matchConfig,
        manga,
      );

      // Track which candidates had accept rule matches for this manga
      const acceptRuleMatchIds = new Set<number>();
      for (const match of potentialMatches) {
        // Access the matchedAcceptRule marker if present
        if (
          (match as AniListManga & { matchedAcceptRule?: CustomRule })
            .matchedAcceptRule
        ) {
          acceptRuleMatchIds.add(match.id);
        }
      }
      if (acceptRuleMatchIds.size > 0) {
        acceptRuleMatchIdsByIndex.set(String(i), acceptRuleMatchIds);
      }

      // Strip off the matchedAcceptRule marker before sending to worker
      const cleanedMatches = potentialMatches.map((match) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { matchedAcceptRule, ...rest } = match as AniListManga & {
          matchedAcceptRule?: CustomRule;
        };
        return rest as AniListManga;
      });
      // Use index as key instead of manga.id
      candidatesMap.set(String(i), cleanedMatches);
    }

    // Execute matching in parallel using workers
    // Cast MatchConfig to Partial<MatchEngineConfig> for worker execution
    const execution = executeMatchingWithWorkers(
      mangaList,
      candidatesMap,
      matchConfig as Parameters<typeof executeMatchingWithWorkers>[2],
      (current, _total, title) => {
        if (current % 10 === 0) {
          options.checkCancellation();
        }
        options.updateProgress(current - 1, title);
      },
      true,
    );

    let workerResults: MangaMatchResult[];
    try {
      workerResults = await execution.promise;
    } catch (error) {
      // Cancel the execution on error
      execution.cancel();
      throw error;
    }

    // Merge worker results with source information and apply accept rule confidence boost
    const results: MangaMatchResult[] = [];
    for (let i = 0; i < workerResults.length; i++) {
      const workerResult = workerResults[i];
      const manga = mangaList[i];
      const comickSourceMap = options.cachedComickSources[i] || new Map();
      const mangaDexSourceMap = options.cachedMangaDexSources[i] || new Map();

      // Add source information to the result
      let enrichedResult: MangaMatchResult = {
        ...workerResult,
        anilistMatches: (workerResult.anilistMatches || []).map((match) => {
          const matchId = match.id;
          return {
            ...match,
            comickSource:
              matchId === undefined ? undefined : comickSourceMap.get(matchId),
            mangaDexSource:
              matchId === undefined
                ? undefined
                : mangaDexSourceMap.get(matchId),
          };
        }),
      };

      // Apply accept rule confidence floor boost if applicable
      // Use index-based key to match acceptRuleMatchIdsByIndex
      const acceptRuleIds = acceptRuleMatchIdsByIndex.get(String(i));
      if (acceptRuleIds && acceptRuleIds.size > 0) {
        enrichedResult = {
          ...enrichedResult,
          anilistMatches:
            enrichedResult.anilistMatches?.map((match) => {
              if (match.id !== undefined && acceptRuleIds.has(match.id)) {
                // Determine if this is an exact match
                const isExactMatch =
                  manga.title.toLowerCase() ===
                    match.manga?.title?.romaji?.toLowerCase() ||
                  manga.title.toLowerCase() ===
                    match.manga?.title?.english?.toLowerCase();

                const minConfidence = isExactMatch
                  ? ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT
                  : ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR;

                if (match.confidence < minConfidence) {
                  console.debug(
                    `[ProcessWithWorkers] ⭐ Boosting confidence from ${(match.confidence * 100).toFixed(0)}% to ${(minConfidence * 100).toFixed(0)}% for "${match.manga?.title?.romaji || match.manga?.title?.english}" (accept rule match)`,
                  );
                  return {
                    ...match,
                    confidence: minConfidence,
                  };
                }
              }
              return match;
            }) || [],
        };
      }

      // Preserve status from existing result
      options.preserveExistingStatus(enrichedResult, mangaList[i]);

      results[i] = enrichedResult;
    }

    return results;
  } catch (error) {
    console.warn("[CompileResults] Worker execution failed:", error);
    return null;
  }
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
 * @param shouldUseWorkers - Whether to use Web Workers for parallel processing (default: true).
 * @returns Array of complete match results.
 * @source
 */
export async function compileMatchResults(
  mangaList: KenmeiManga[],
  cachedResults: Record<number, AniListManga[]>,
  cachedComickSources: ComickSourceStorage,
  cachedMangaDexSources: MangaDexSourceStorage,
  checkCancellation: () => void,
  updateProgress: (index: number, title?: string) => void,
  shouldUseWorkers = true,
): Promise<MangaMatchResult[]> {
  const results: MangaMatchResult[] = [];

  // Load existing match results to preserve statuses
  const existingResults = getSavedMatchResults() || [];
  const existingById = new Map<string, MangaMatchResult>();
  const existingByTitle = new Map<string, MangaMatchResult>();

  for (const result of existingResults) {
    if (result.kenmeiManga.id) {
      existingById.set(
        String(result.kenmeiManga.id),
        result as MangaMatchResult,
      );
    }
    existingByTitle.set(
      result.kenmeiManga.title.toLowerCase(),
      result as MangaMatchResult,
    );
  }

  // Helper function to preserve status from existing result
  const preserveExistingStatus = (
    newResult: MangaMatchResult,
    manga: KenmeiManga,
  ): void => {
    let existingResult = manga.id
      ? existingById.get(String(manga.id))
      : undefined;
    existingResult ??= existingByTitle.get(manga.title.toLowerCase());

    if (existingResult?.status && existingResult.status !== "pending") {
      newResult.status = existingResult.status;
      newResult.selectedMatch = existingResult.selectedMatch;
      newResult.matchDate = existingResult.matchDate;
    }
  };

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

  // Try using workers for parallel processing if enabled
  if (shouldUseWorkers) {
    const workerResults = await processWithWorkers(
      mangaList,
      cachedResults,
      matchConfig,
      {
        cachedComickSources,
        cachedMangaDexSources,
        checkCancellation,
        updateProgress,
        preserveExistingStatus,
      },
    );

    if (workerResults) {
      return workerResults.filter((result) => result !== null);
    }
    // Fall through to synchronous processing if workers failed
  }

  // Fallback: Synchronous processing on main thread
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
    const newResult = createMangaMatchResult(
      manga,
      potentialMatches,
      comickSourceMap,
      mangaDexSourceMap,
    );

    // Preserve status from existing result if it's not "pending"
    preserveExistingStatus(newResult, manga);

    results[i] = newResult;
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

  // Load existing match results to preserve statuses during cancellation
  const existingResults = getSavedMatchResults() || [];
  const existingById = new Map<string, MangaMatchResult>();
  const existingByTitle = new Map<string, MangaMatchResult>();

  for (const result of existingResults) {
    if (result.kenmeiManga.id) {
      existingById.set(
        String(result.kenmeiManga.id),
        result as MangaMatchResult,
      );
    }
    existingByTitle.set(
      result.kenmeiManga.title.toLowerCase(),
      result as MangaMatchResult,
    );
  }

  // Helper to get existing result by ID or title
  const getExistingResult = (
    manga: KenmeiManga,
  ): MangaMatchResult | undefined => {
    if (manga.id) {
      const byId = existingById.get(String(manga.id));
      if (byId) return byId;
    }
    return existingByTitle.get(manga.title.toLowerCase());
  };

  // Process whatever results we have so far
  for (let i = 0; i < mangaList.length; i++) {
    if (cachedResults[i]) {
      const manga = mangaList[i];
      const potentialMatches = cachedResults[i].map((anilistManga) => ({
        manga: anilistManga,
        confidence: calculateConfidence(manga.title, anilistManga),
      }));

      const newResult: MangaMatchResult = {
        kenmeiManga: manga,
        anilistMatches: potentialMatches,
        selectedMatch:
          potentialMatches.length > 0 ? potentialMatches[0].manga : undefined,
        status: "pending",
      };

      // Preserve status from existing result if it's not "pending"
      const existingResult = getExistingResult(manga);
      if (existingResult?.status && existingResult.status !== "pending") {
        newResult.status = existingResult.status;
        newResult.selectedMatch = existingResult.selectedMatch;
        newResult.matchDate = existingResult.matchDate;
      }

      results.push(newResult);
    }
  }

  return results;
}
