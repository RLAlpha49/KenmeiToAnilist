/**
 * Enhanced manga matching engine for AniList integration
 * Provides robust title matching between Kenmei entries and AniList manga
 */

import { KenmeiManga } from "../kenmei/types";
import { AniListManga, MangaMatchResult } from "../anilist/types";
import * as stringSimilarity from "string-similarity";

/**
 * Interface for match engine configuration
 */
export interface MatchEngineConfig {
  // Minimum confidence score (0-100) to consider a match as high confidence
  confidenceThreshold: number;

  // Language preferences for title matching
  preferEnglishTitles: boolean;
  preferRomajiTitles: boolean;
  useAlternativeTitles: boolean;

  // String comparison options
  caseSensitive: boolean;

  // Minimum length for titles to be considered for fuzzy matching
  minTitleLength: number;

  // Number of top matches to return
  maxMatches: number;
}

/**
 * Default configuration for the match engine
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
 * Clean and normalize a string for comparison
 */
export function normalizeString(text: string, caseSensitive = false): string {
  if (!text) return "";

  // Replace special characters and normalize spacing
  let normalized = text
    .replace(/[^\w\s]/gi, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Calculate string similarity using multiple algorithms for better accuracy
 * Returns a score between 0-100
 */
export function calculateSimilarity(
  str1: string,
  str2: string,
  config: Partial<MatchEngineConfig> = {},
): number {
  const { caseSensitive } = { ...DEFAULT_MATCH_CONFIG, ...config };

  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const s1 = normalizeString(str1, caseSensitive);
  const s2 = normalizeString(str2, caseSensitive);

  if (s1 === s2) return 100;
  if (s1.length < 2 || s2.length < 2) return 0;

  // Exact substring check (one is contained within the other)
  if (s1.includes(s2) || s2.includes(s1)) {
    const longerLength = Math.max(s1.length, s2.length);
    const shorterLength = Math.min(s1.length, s2.length);
    return Math.round((shorterLength / longerLength) * 100);
  }

  // String similarity calculation using Dice coefficient
  const similarity = stringSimilarity.compareTwoStrings(s1, s2);
  return Math.round(similarity * 100);
}

/**
 * Score a match between a Kenmei manga and an AniList manga entry
 * Returns a score between 0-100 and information about the match
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

  // Check primary titles based on preferences
  // We'll calculate similarity for all titles but weight them differently later

  if (anilistManga.title.english) {
    const englishScore = calculateSimilarity(
      kenmeiTitle,
      anilistManga.title.english,
      matchConfig,
    );
    scores.push({ field: "english", score: englishScore });

    // Exact match check
    if (englishScore === 100) {
      return { confidence: 100, isExactMatch: true, matchedField: "english" };
    }
  }

  if (anilistManga.title.romaji) {
    const romajiScore = calculateSimilarity(
      kenmeiTitle,
      anilistManga.title.romaji,
      matchConfig,
    );
    scores.push({ field: "romaji", score: romajiScore });

    // Exact match check
    if (romajiScore === 100) {
      return { confidence: 100, isExactMatch: true, matchedField: "romaji" };
    }
  }

  if (anilistManga.title.native) {
    const nativeScore = calculateSimilarity(
      kenmeiTitle,
      anilistManga.title.native,
      matchConfig,
    );
    scores.push({ field: "native", score: nativeScore });

    // Exact match check
    if (nativeScore === 100) {
      return { confidence: 100, isExactMatch: true, matchedField: "native" };
    }
  }

  // Check alternative titles if enabled
  if (
    useAlternativeTitles &&
    anilistManga.synonyms &&
    anilistManga.synonyms.length > 0
  ) {
    for (const synonym of anilistManga.synonyms) {
      if (!synonym) continue;

      const synonymScore = calculateSimilarity(
        kenmeiTitle,
        synonym,
        matchConfig,
      );
      scores.push({ field: "synonym", score: synonymScore });

      // Exact match check
      if (synonymScore === 100) {
        return { confidence: 100, isExactMatch: true, matchedField: "synonym" };
      }
    }
  }

  // Check Kenmei alternative titles against AniList titles
  if (
    useAlternativeTitles &&
    kenmeiManga.alternative_titles &&
    kenmeiManga.alternative_titles.length > 0
  ) {
    for (const altTitle of kenmeiManga.alternative_titles) {
      if (!altTitle) continue;

      const normalizedAltTitle = normalizeString(altTitle, caseSensitive);

      // Skip very short alternative titles
      if (normalizedAltTitle.length < matchConfig.minTitleLength) continue;

      // Check against each AniList title field
      if (anilistManga.title.english) {
        const altEnglishScore = calculateSimilarity(
          normalizedAltTitle,
          anilistManga.title.english,
          matchConfig,
        );
        scores.push({ field: "alt_to_english", score: altEnglishScore });

        if (altEnglishScore === 100) {
          return {
            confidence: 95,
            isExactMatch: true,
            matchedField: "alt_to_english",
          };
        }
      }

      if (anilistManga.title.romaji) {
        const altRomajiScore = calculateSimilarity(
          normalizedAltTitle,
          anilistManga.title.romaji,
          matchConfig,
        );
        scores.push({ field: "alt_to_romaji", score: altRomajiScore });

        if (altRomajiScore === 100) {
          return {
            confidence: 95,
            isExactMatch: true,
            matchedField: "alt_to_romaji",
          };
        }
      }
    }
  }

  // If we have no scores, return zero confidence
  if (scores.length === 0) {
    return { confidence: 0, isExactMatch: false, matchedField: "none" };
  }

  // Get the highest score and its field
  scores.sort((a, b) => b.score - a.score);
  const topScore = scores[0];

  // Apply title preference weighting
  let adjustedScore = topScore.score;
  if (topScore.field === "english" && preferEnglishTitles) {
    adjustedScore = Math.min(100, adjustedScore * 1.05);
  } else if (topScore.field === "romaji" && preferRomajiTitles) {
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
 * Find the best matches for a Kenmei manga entry from a list of AniList entries
 */
export function findBestMatches(
  kenmeiManga: KenmeiManga,
  anilistMangaList: AniListManga[],
  config: Partial<MatchEngineConfig> = {},
): MangaMatchResult {
  const matchConfig = { ...DEFAULT_MATCH_CONFIG, ...config };

  // Calculate match scores for each AniList manga
  const matchResults = anilistMangaList.map((manga) => {
    const matchScore = scoreMatch(kenmeiManga, manga, matchConfig);
    return {
      manga,
      confidence: matchScore.confidence,
      isExactMatch: matchScore.isExactMatch,
      matchedField: matchScore.matchedField,
    };
  });

  // Sort by confidence score (descending)
  matchResults.sort((a, b) => b.confidence - a.confidence);

  // Take only the top matches
  const topMatches = matchResults
    .slice(0, matchConfig.maxMatches)
    .filter((match) => match.confidence > 0);

  // Determine the match status
  let status: MangaMatchResult["status"] = "pending";

  if (topMatches.length === 0) {
    status = "pending"; // No matches found
  } else if (topMatches[0].isExactMatch) {
    status = "matched"; // Found an exact match
  } else if (
    topMatches[0].confidence >= matchConfig.confidenceThreshold &&
    (topMatches.length === 1 ||
      topMatches[0].confidence - topMatches[1].confidence > 20)
  ) {
    status = "matched"; // High confidence and significant gap to next match
  } else {
    status = "pending"; // Multiple potential matches or low confidence
  }

  // Format as MangaMatchResult
  return {
    kenmeiManga,
    anilistMatches: topMatches.map(({ manga, confidence }) => ({
      manga,
      confidence,
    })),
    status,
    selectedMatch: status === "matched" ? topMatches[0].manga : undefined,
    matchDate: new Date(),
  };
}

/**
 * Process a batch of manga entries for matching
 */
export async function processBatchMatches(
  kenmeiMangaList: KenmeiManga[],
  anilistMangaMap: Map<string, AniListManga[]>,
  config: Partial<MatchEngineConfig> = {},
): Promise<MangaMatchResult[]> {
  const results: MangaMatchResult[] = [];

  for (const kenmeiManga of kenmeiMangaList) {
    const searchKey = normalizeString(kenmeiManga.title).slice(0, 10);
    const potentialMatches = anilistMangaMap.get(searchKey) || [];

    // Find matches
    const matchResult = findBestMatches(kenmeiManga, potentialMatches, config);
    results.push(matchResult);
  }

  return results;
}
