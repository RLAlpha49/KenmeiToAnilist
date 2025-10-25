/**
 * @packageDocumentation
 * @module match-engine
 * @description Enhanced manga matching engine for AniList integration. Provides robust title matching between Kenmei entries and AniList manga.
 */

import { KenmeiManga } from "../kenmei/types";
import { AniListManga, MangaMatchResult } from "../anilist/types";
import { calculateEnhancedSimilarity } from "../../utils/enhanced-similarity";

/**
 * Configuration options for manga matching behavior.
 * @source
 */
export interface MatchEngineConfig {
  /** Minimum confidence score (0-100) to auto-match results. */
  confidenceThreshold: number;

  /** Boost scores when matching against English titles. */
  preferEnglishTitles: boolean;
  /** Boost scores when matching against Romaji titles. */
  preferRomajiTitles: boolean;
  /** Include AniList synonyms and alternative titles in matching. */
  useAlternativeTitles: boolean;

  /** Preserve case during title comparison. */
  caseSensitive: boolean;

  /** Skip titles shorter than this length to reduce false positives. */
  minTitleLength: number;

  /** Maximum number of candidate matches to return. */
  maxMatches: number;
}

/**
 * Default configuration for manga matching.
 * @source
 */
export const DEFAULT_MATCH_CONFIG: MatchEngineConfig = {
  confidenceThreshold: 75,
  preferEnglishTitles: true,
  preferRomajiTitles: false,
  useAlternativeTitles: true,
  caseSensitive: false,
  minTitleLength: 3,
  maxMatches: 5,
};

/**
 * Normalizes a string by removing special characters and optionally converting to lowercase.
 * @param text - The string to normalize.
 * @param caseSensitive - Whether to preserve case.
 * @returns Normalized string with special characters removed and spaces collapsed.
 * @source
 */
export function normalizeString(text: string, caseSensitive = false): string {
  if (!text) return "";

  // Replace special characters and normalize spacing
  const replaced = text
    .replaceAll(/[^\w\s]/gi, " ") // Replace special chars with space
    .replaceAll(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  return caseSensitive ? replaced : replaced.toLowerCase();
}

/**
 * Calculates string similarity using enhanced algorithms.
 * @param str1 - First string to compare.
 * @param str2 - Second string to compare.
 * @returns Similarity score between 0 and 100.
 * @source
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  // Use the enhanced similarity calculation
  return calculateEnhancedSimilarity(str1, str2, {
    debug: false, // Set to true for debugging
  });
}

/**
 * Scores primary titles (english, romaji, native) and returns early on exact match.
 * @param kenmeiTitle - Normalized Kenmei title.
 * @param anilistManga - AniList manga entry.
 * @param scores - Accumulator array for similarity scores.
 * @returns Match result object if exact match (100%) found, null otherwise.
 * @source
 */
function scorePrimaryTitles(
  kenmeiTitle: string,
  anilistManga: AniListManga,
  scores: Array<{ field: string; score: number }>,
): { confidence: number; isExactMatch: boolean; matchedField: string } | null {
  const titleFields = [
    { field: "english", title: anilistManga.title.english },
    { field: "romaji", title: anilistManga.title.romaji },
    { field: "native", title: anilistManga.title.native },
  ];

  for (const { field, title } of titleFields) {
    if (!title) continue;

    const score = calculateSimilarity(kenmeiTitle, title);
    scores.push({ field, score });

    if (score === 100) {
      return { confidence: 100, isExactMatch: true, matchedField: field };
    }
  }

  return null;
}

/**
 * Scores AniList synonyms and returns early on exact match.
 * @param kenmeiTitle - Normalized Kenmei title.
 * @param anilistManga - AniList manga entry.
 * @param scores - Accumulator array for similarity scores.
 * @returns Match result object if exact match (100%) found, null otherwise.
 * @source
 */
function scoreSynonyms(
  kenmeiTitle: string,
  anilistManga: AniListManga,
  scores: Array<{ field: string; score: number }>,
): { confidence: number; isExactMatch: boolean; matchedField: string } | null {
  if (!anilistManga.synonyms?.length) return null;

  for (const synonym of anilistManga.synonyms) {
    if (!synonym) continue;

    const synonymScore = calculateSimilarity(kenmeiTitle, synonym);
    scores.push({ field: "synonym", score: synonymScore });

    if (synonymScore === 100) {
      return { confidence: 100, isExactMatch: true, matchedField: "synonym" };
    }
  }

  return null;
}

/**
 * Scores a single alternative title against AniList primary titles.
 * @param normalizedAltTitle - Normalized alternative title.
 * @param anilistManga - AniList manga entry.
 * @param scores - Accumulator array for similarity scores.
 * @returns Match result object if exact match (100%) found, null otherwise.
 * @source
 */
function checkAlternativeTitleMatch(
  normalizedAltTitle: string,
  anilistManga: AniListManga,
  scores: Array<{ field: string; score: number }>,
): { confidence: number; isExactMatch: boolean; matchedField: string } | null {
  // Check against english title
  if (anilistManga.title.english) {
    const altEnglishScore = calculateSimilarity(
      normalizedAltTitle,
      anilistManga.title.english,
    );
    scores.push({ field: "alt_to_english", score: altEnglishScore });

    if (altEnglishScore === 100) {
      return {
        confidence: 100,
        isExactMatch: true,
        matchedField: "alt_to_english",
      };
    }
  }

  // Check against romaji title
  if (anilistManga.title.romaji) {
    const altRomajiScore = calculateSimilarity(
      normalizedAltTitle,
      anilistManga.title.romaji,
    );
    scores.push({ field: "alt_to_romaji", score: altRomajiScore });

    if (altRomajiScore === 100) {
      return {
        confidence: 100,
        isExactMatch: true,
        matchedField: "alt_to_romaji",
      };
    }
  }

  return null;
}

/**
 * Scores Kenmei alternative titles against AniList titles and returns early on exact match.
 * @param kenmeiManga - Kenmei manga entry.
 * @param anilistManga - AniList manga entry.
 * @param caseSensitive - Whether comparison is case sensitive.
 * @param minTitleLength - Minimum length threshold for alternative titles.
 * @param scores - Accumulator array for similarity scores.
 * @returns Match result object if exact match (100%) found, null otherwise.
 * @source
 */
function scoreAlternativeTitles(
  kenmeiManga: KenmeiManga,
  anilistManga: AniListManga,
  caseSensitive: boolean,
  minTitleLength: number,
  scores: Array<{ field: string; score: number }>,
): { confidence: number; isExactMatch: boolean; matchedField: string } | null {
  if (!kenmeiManga.alternative_titles?.length) return null;

  for (const altTitle of kenmeiManga.alternative_titles) {
    if (!altTitle) continue;

    const normalizedAltTitle = normalizeString(altTitle, caseSensitive);
    if (normalizedAltTitle.length < minTitleLength) continue;

    const matchResult = checkAlternativeTitleMatch(
      normalizedAltTitle,
      anilistManga,
      scores,
    );
    if (matchResult) return matchResult;
  }

  return null;
}

/**
 * Calculates final adjusted score with language preference weighting.
 * @param scores - Array of scores with field identifiers.
 * @param preferEnglishTitles - Whether to boost English title scores by 5%.
 * @param preferRomajiTitles - Whether to boost Romaji title scores by 5%.
 * @returns Match result with final confidence (0-100), exact match status, and matched field.
 * @source
 */
function calculateFinalScore(
  scores: Array<{ field: string; score: number }>,
  preferEnglishTitles: boolean,
  preferRomajiTitles: boolean,
): { confidence: number; isExactMatch: boolean; matchedField: string } {
  if (scores.length === 0) {
    return { confidence: 0, isExactMatch: false, matchedField: "none" };
  }

  // Get the highest score and its field (avoid mutating the array)
  const topScore = scores.reduce(
    (best, cur) => (cur.score > best.score ? cur : best),
    scores[0],
  );

  // Apply title preference weighting
  let adjustedScore = topScore.score;
  if (
    (topScore.field === "english" && preferEnglishTitles) ||
    (topScore.field === "romaji" && preferRomajiTitles)
  ) {
    adjustedScore = Math.min(100, adjustedScore * 1.05);
  }

  // Consider an "exact match" if the confidence is very high
  const isExactMatch = adjustedScore >= 95;

  return {
    confidence: Math.round(adjustedScore),
    isExactMatch,
    matchedField: topScore.field,
  };
}

/**
 * Scores a Kenmei manga against an AniList manga entry using title comparison.
 * Returns a confidence score (0-100) and match metadata.
 *
 * Checks primary titles (english, romaji, native), synonyms, and alternative titles
 * in that order, returning early on 100% match. Final score is determined by the
 * highest similarity across all checked fields.
 *
 * @param kenmeiManga - Kenmei manga to match.
 * @param anilistManga - AniList manga candidate.
 * @param config - Partial config to override defaults.
 * @returns Match result with confidence score, exact match flag, and matched field.
 * @source
 */
export function scoreMatch(
  kenmeiManga: KenmeiManga,
  anilistManga: AniListManga,
  config: Partial<MatchEngineConfig> = {},
): { confidence: number; isExactMatch: boolean; matchedField: string } {
  const matchConfig = { ...DEFAULT_MATCH_CONFIG, ...config };
  const {
    caseSensitive,
    preferEnglishTitles,
    preferRomajiTitles,
    useAlternativeTitles,
  } = matchConfig;

  // Normalize the Kenmei title
  const kenmeiTitle = normalizeString(kenmeiManga.title, caseSensitive);

  // Skip extremely short titles (likely errors)
  if (kenmeiTitle.length < matchConfig.minTitleLength) {
    return { confidence: 0, isExactMatch: false, matchedField: "none" };
  }

  // Array to store all similarity scores with their sources
  const scores: Array<{ field: string; score: number }> = [];

  // Check primary titles - early return if exact match found
  const primaryMatch = scorePrimaryTitles(kenmeiTitle, anilistManga, scores);
  if (primaryMatch) return primaryMatch;

  // Check alternative titles if enabled - early return if exact match found
  if (useAlternativeTitles) {
    const synonymMatch = scoreSynonyms(kenmeiTitle, anilistManga, scores);
    if (synonymMatch) return synonymMatch;

    const altTitleMatch = scoreAlternativeTitles(
      kenmeiManga,
      anilistManga,
      caseSensitive,
      matchConfig.minTitleLength,
      scores,
    );
    if (altTitleMatch) return altTitleMatch;
  }

  // Calculate final score with preferences
  return calculateFinalScore(scores, preferEnglishTitles, preferRomajiTitles);
}

/**
 * Finds the best matching AniList entries for a Kenmei manga and returns ranked candidates.
 *
 * Scores all candidates and determines match status automatically:
 * - "matched": Exact match found OR high confidence (>threshold) with >20 point lead
 * - "pending": Multiple close candidates, low confidence, or ambiguous results
 *
 * Results are sorted by confidence descending. Returns up to maxMatches candidates with
 * confidence > 0. Uses deterministic scoring based on title similarity.
 *
 * @param kenmeiManga - Kenmei manga entry to match.
 * @param anilistMangaList - Candidates to score.
 * @param config - Partial config to override defaults.
 * @returns Match result with ranked candidates, status, and selected match.
 * @source
 */
export function findBestMatches(
  kenmeiManga: KenmeiManga,
  anilistMangaList: AniListManga[],
  config: Partial<MatchEngineConfig> = {},
): MangaMatchResult {
  const matchConfig = { ...DEFAULT_MATCH_CONFIG, ...config };

  // Calculate match scores for each AniList manga and sort descending
  const matchResults = anilistMangaList
    .map((manga) => {
      const matchScore = scoreMatch(kenmeiManga, manga, matchConfig);
      return {
        manga,
        confidence: matchScore.confidence,
        isExactMatch: matchScore.isExactMatch,
        matchedField: matchScore.matchedField,
      } as const;
    })
    .sort((a, b) => b.confidence - a.confidence);

  // Take only the top matches and exclude zero-confidence entries
  const topMatches = matchResults
    .slice(0, matchConfig.maxMatches)
    .filter((m) => m.confidence > 0);

  if (topMatches.length === 0) {
    return {
      kenmeiManga,
      anilistMatches: [],
      status: "pending",
      selectedMatch: undefined,
      matchDate: new Date().toISOString(),
    };
  }

  if (topMatches[0].isExactMatch) {
    return {
      kenmeiManga,
      anilistMatches: topMatches.map(({ manga, confidence }) => ({
        id: manga.id,
        manga,
        confidence,
      })),
      status: "matched",
      selectedMatch: topMatches[0].manga,
      matchDate: new Date().toISOString(),
    };
  }

  const hasHighConfidence =
    topMatches[0].confidence >= matchConfig.confidenceThreshold &&
    (topMatches.length === 1 ||
      topMatches[0].confidence - topMatches[1].confidence > 20);

  if (hasHighConfidence) {
    return {
      kenmeiManga,
      anilistMatches: topMatches.map(({ manga, confidence }) => ({
        id: manga.id,
        manga,
        confidence,
      })),
      status: "matched",
      selectedMatch: topMatches[0].manga,
      matchDate: new Date().toISOString(),
    };
  }

  // Multiple potential matches or low confidence => pending
  return {
    kenmeiManga,
    anilistMatches: topMatches.map(({ manga, confidence }) => ({
      id: manga.id,
      manga,
      confidence,
    })),
    status: "pending",
    selectedMatch: undefined,
    matchDate: new Date().toISOString(),
  };
}

/**
 * Processes a batch of Kenmei manga entries, finding best AniList matches for each.
 *
 * Groups AniList candidates by search key (normalized title prefix) for efficient
 * lookup. Logs processing progress and completion statistics.
 *
 * @param kenmeiMangaList - Kenmei entries to match.
 * @param anilistMangaMap - Map of search keys to AniList candidates.
 * @param config - Partial config to override defaults.
 * @returns Promise resolving to array of match results, one per Kenmei entry.
 * @source
 */
export async function processBatchMatches(
  kenmeiMangaList: KenmeiManga[],
  anilistMangaMap: Map<string, AniListManga[]>,
  config: Partial<MatchEngineConfig> = {},
): Promise<MangaMatchResult[]> {
  console.info(
    `[MatchEngine] 🔍 Processing batch matches for ${kenmeiMangaList.length} manga entries`,
  );
  console.debug(
    `[MatchEngine] 🔍 AniList manga map contains ${anilistMangaMap.size} search keys`,
  );

  const results = kenmeiMangaList.map((kenmeiManga) => {
    const searchKey = normalizeString(kenmeiManga.title).slice(0, 10);
    const potentialMatches = anilistMangaMap.get(searchKey) || [];
    return findBestMatches(kenmeiManga, potentialMatches, config);
  });

  const matchedCount = results.filter(
    (r) => r.anilistMatches && r.anilistMatches.length > 0,
  ).length;
  console.info(
    `[MatchEngine] ✅ Batch processing complete: ${matchedCount}/${kenmeiMangaList.length} with matches`,
  );

  return results;
}
