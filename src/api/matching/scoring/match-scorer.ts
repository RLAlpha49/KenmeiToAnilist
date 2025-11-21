/**
 * @packageDocumentation
 * @module Matching/Scoring/MatchScorer
 * @description Core match scoring logic with multiple strategies for manga title matching.
 * Employs direct matching, word-based matching, and legacy approaches for comprehensive title coverage.
 */

import { AniListManga } from "../../anilist/types";
import {
  normalizeForMatching,
  processTitle,
  replaceSpecialChars,
  collectMangaTitles,
  createNormalizedTitles,
  isDifferenceOnlyArticles,
  checkSeasonPatterns,
  removePunctuation,
} from "../normalization";
import {
  calculateWordOrderSimilarity,
  containsCompleteTitle,
  calculateWordMatchScore,
} from "./similarity-calculator";
import {
  calculateEnhancedSimilarity,
  extractMeaningfulWords,
} from "../../../utils/enhanced-similarity";

/**
 * Normalized title entry with original and processed versions.
 * @source
 */
type NormalizedTitleEntry = {
  /** Normalized title text for matching. */
  text: string;
  /** Source/type identifier (e.g., "english", "romaji", "synonym"). */
  source: string;
  /** Original title text before normalization. */
  original: string;
};

/**
 * Options for customizing match score calculation behavior.
 * @source
 */
export interface MatchScoreOptions {
  /**
   * When true, skips meaningful word overlap and initialism heuristics.
   * Useful for regression testing and before/after comparisons.
   * @source
   */
  shouldDisableMeaningfulOverlap?: boolean;
}

/** Secondary/contextual words excluded from primary token matching (e.g., "season", "part", "episode"). @source */
const SECONDARY_WORDS = new Set([
  "season",
  "seasons",
  "seasonal",
  "part",
  "parts",
  "chapter",
  "chapters",
  "volume",
  "vol",
  "vols",
  "volumes",
  "episode",
  "episodes",
  "movie",
  "movies",
  "film",
  "films",
  "edition",
  "editions",
  "collection",
  "collections",
  "complete",
  "special",
  "specials",
  "ova",
  "ovas",
  "and",
]);
/** Words that map to their numeric equivalents. @source */
const NUMBER_WORD_MAP = new Map<string, string>([
  ["zero", "0"],
  ["one", "1"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
  ["ten", "10"],
  ["eleven", "11"],
  ["twelve", "12"],
  ["thirteen", "13"],
  ["fourteen", "14"],
  ["fifteen", "15"],
  ["sixteen", "16"],
  ["seventeen", "17"],
  ["eighteen", "18"],
  ["nineteen", "19"],
  ["twenty", "20"],
]);

/** Roman numeral to numeric value mapping. @source */
const ROMAN_NUMERAL_VALUES: Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
};

/** Regex patterns for validating Roman numeral components. @source */
const ROMAN_NUMERAL_PARTS = {
  thousands: /m{0,4}/,
  hundreds: /(cm|cd|d?c{0,3})/,
  tens: /(xc|xl|l?x{0,3})/,
  ones: /(ix|iv|v?i{0,3})/,
};

/**
 * Validate if a string is a valid Roman numeral.
 * Checks for valid characters and confirms the string follows proper Roman numeral patterns.
 *
 * @param str - The string to validate
 * @returns True if the string is a valid Roman numeral (e.g., "I", "IV", "MCMXC")
 * @source
 */
const isValidRomanNumeral = (str: string): boolean => {
  if (!/^[ivxlcdm]+$/i.test(str)) return false;
  // Check if string follows Roman numeral pattern
  const pattern = new RegExp(
    `^${ROMAN_NUMERAL_PARTS.thousands.source}${ROMAN_NUMERAL_PARTS.hundreds.source}${ROMAN_NUMERAL_PARTS.tens.source}${ROMAN_NUMERAL_PARTS.ones.source}$`,
    "i",
  );
  return pattern.test(str);
};

/**
 * Normalized token data for word matching and analysis.
 * @source
 */
type TokenData = {
  /** Array of normalized tokens. */
  normalized: string[];
  /** Set of all normalized tokens for fast membership lookup. */
  tokenSet: Set<string>;
  /** Primary tokens (non-secondary words with length > 1). */
  primaryTokens: string[];
};

/**
 * Normalize season, part, volume, chapter, and arc shorthand to numeric strings.
 * Converts patterns like "s1", "pt2", "vol3", "ch4", "arc5" to their numeric representation.
 *
 * @param token - The token to normalize (e.g., "s1", "season2", "vol3")
 * @returns The numeric string or null if not a recognized shorthand pattern
 * @source
 */
const normalizeSeasonShorthand = (token: string): string | null => {
  const seasonRegex = /^(?:s|season)(\d{1,2})$/;
  const partRegex = /^(?:p|pt|part)(\d{1,2})$/;
  const volumeRegex = /^(?:vol|volume)(\d{1,2})$/;
  const chapterRegex = /^(?:ch|chapter)(\d{1,3})$/;
  const arcRegex = /^(?:arc)(\d{1,2})$/;

  const seasonMatch = seasonRegex.exec(token);
  if (seasonMatch) return seasonMatch[1];

  const partMatch = partRegex.exec(token);
  if (partMatch) return partMatch[1];

  const volumeMatch = volumeRegex.exec(token);
  if (volumeMatch) return volumeMatch[1];

  const chapterMatch = chapterRegex.exec(token);
  if (chapterMatch) return chapterMatch[1];

  const arcMatch = arcRegex.exec(token);
  if (arcMatch) return arcMatch[1];

  return null;
};

/**
 * Convert Roman numerals to their decimal representation.
 * Handles standard Roman numeral notation with subtractive principle (IV=4, IX=9, etc.).
 *
 * @param roman - The Roman numeral string to convert (e.g., "IV", "MCMXC")
 * @returns The decimal number or null if invalid Roman numeral
 * @source
 */
const romanToDecimal = (roman: string): number | null => {
  let total = 0;
  let previousValue = 0;

  for (let index = roman.length - 1; index >= 0; index--) {
    const value = ROMAN_NUMERAL_VALUES[roman[index]];
    if (!value) return null;

    if (value < previousValue) {
      total -= value;
    } else {
      total += value;
      previousValue = value;
    }
  }

  return total > 0 ? total : null;
};

/**
 * Normalize a single token by converting to lowercase and handling special forms.
 * Processes numeric words, Roman numerals, season/part shorthands, and leading zeros.
 *
 * @param raw - The raw token string to normalize
 * @returns The normalized token (lowercase, numeric-substituted, or Roman numeral converted)
 * @source
 */
const normalizeToken = (raw: string): string => {
  const token = raw.toLowerCase().trim();
  if (!token) return token;

  const shorthand = normalizeSeasonShorthand(token);
  if (shorthand) return shorthand;

  if (NUMBER_WORD_MAP.has(token)) {
    return NUMBER_WORD_MAP.get(token)!;
  }

  if (/^\d+$/.test(token)) {
    return token.replace(/^0+/, "") || "0";
  }

  if (isValidRomanNumeral(token)) {
    const value = romanToDecimal(token);
    if (value !== null) {
      return String(value);
    }
  }

  return token;
};

/**
 * Normalize an array of tokens for matching operations.
 * Applies normalizeToken to each word and filters out empty results.
 *
 * @param words - The word array to normalize
 * @returns Normalized tokens with empty strings filtered out
 * @source
 */
const normalizeTokensForMatching = (words: string[]): string[] => {
  return words.map(normalizeToken).filter((word) => word.length > 0);
};

/**
 * Create normalized token data for word matching and analysis.
 * Separates primary tokens (significant words) from secondary/contextual words.
 *
 * @param words - The word array to process
 * @returns Token data with normalized tokens, token set, and primary tokens for matching
 * @source
 */
const createTokenData = (words: string[]): TokenData => {
  const normalized = normalizeTokensForMatching(words);
  const tokenSet = new Set(normalized);
  const primaryTokens = [
    ...new Set(
      normalized.filter(
        (token) => token.length > 1 && !SECONDARY_WORDS.has(token),
      ),
    ),
  ];

  return { normalized, tokenSet, primaryTokens };
};

/**
 * Build an initialism from significant words in a title.
 * Takes the first character of primary (non-secondary) words to create an acronym.
 *
 * @param rawWords - The raw word array from the title
 * @returns The initialism string (e.g., "JJK" for "Jujutsu Kaisen")
 * @source
 */
const buildInitialism = (rawWords: string[]): string => {
  const initialChars: string[] = [];

  for (const rawWord of rawWords) {
    const normalized = normalizeToken(rawWord);
    if (!normalized || SECONDARY_WORDS.has(normalized)) {
      continue;
    }

    const initialCharSource =
      /^\d+$/.test(normalized) && /^[a-z]/i.test(rawWord)
        ? rawWord.toLowerCase()
        : normalized;

    initialChars.push(initialCharSource[0]);
  }

  return initialChars.join("");
};

/**
 * Check if search term words appear in title with acceptable word order and proximity.
 * Single-word searches only check for word presence; multi-word searches verify order or adjacency.
 *
 * @param title - The title to check against
 * @param searchName - The search term to match
 * @returns True if title matches search criteria with acceptable word order/proximity
 * @source
 */
function isTitleMatch(title: string, searchName: string): boolean {
  // Remove punctuation from the title and the search name
  const cleanTitle = removePunctuation(title);
  const cleanSearchName = removePunctuation(searchName);

  // Split into words
  const titleWordsArray = cleanTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  const searchWordsArray = cleanSearchName
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  // If search is a single word, just check if it exists in the title
  if (searchWordsArray.length === 1) {
    return titleWordsArray.includes(searchWordsArray[0]);
  }

  // For multi-word searches, check if all words are present
  const areAllWordsPresent = searchWordsArray.every((word) =>
    titleWordsArray.includes(word),
  );
  if (!areAllWordsPresent) return false;

  // If all words are present, check for order preservation and proximity
  // Find indexes of search words in the title
  const indexes = searchWordsArray.map((word) => titleWordsArray.indexOf(word));

  // Check if the words appear in the same order (indexes should be increasing)
  const isSameOrder = indexes.every(
    (index, i) => i === 0 || index > indexes[i - 1],
  );

  // Count how many words are adjacent (index difference of 1)
  let adjacentCount = 0;
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] - indexes[i - 1] === 1) {
      adjacentCount++;
    }
  }

  // Calculate proximity score (what percentage of words are adjacent)
  const proximityScore = adjacentCount / (searchWordsArray.length - 1);

  // Return true if words are in same order OR if at least 50% are adjacent
  return isSameOrder || proximityScore >= 0.5;
}

/**
 * Check for perfect and substantial partial matches between search and title.
 * Returns highest scores for exact matches, with lower scores for substantial containment.
 *
 * @param normalizedTitles - Normalized title entries to check
 * @param normalizedSearchTitle - The normalized search title
 * @param searchTitle - The original search title (for logging)
 * @param manga - The manga object being matched (for logging)
 * @returns Match score (0.8-1) if found, -1 otherwise
 * @source
 */
function checkDirectMatches(
  normalizedTitles: NormalizedTitleEntry[],
  normalizedSearchTitle: string,
  searchTitle: string,
  manga: AniListManga,
): number {
  for (const { text, source } of normalizedTitles) {
    // Perfect match
    if (text === normalizedSearchTitle) {
      console.debug(
        `[MangaSearchService] 💯 Perfect match found for title: "${text}" (${source})`,
      );
      return 1;
    }

    // Search title is substantial part of manga title
    if (
      text.includes(normalizedSearchTitle) &&
      normalizedSearchTitle.length > 6
    ) {
      if (
        isDifferenceOnlyArticles(
          searchTitle,
          manga.title.english || manga.title.romaji || "",
        )
      ) {
        console.debug(
          `[MangaSearchService] ⭐ Article-only difference detected between "${normalizedSearchTitle}" and "${text}" (${source}) - very high score`,
        );
        return 0.97;
      }
      console.debug(
        `[MangaSearchService] ✅ Search title "${searchTitle}" is a substantial part of "${text}" (${source})`,
      );
      return 0.85;
    }

    // Manga title is substantial part of search title
    if (normalizedSearchTitle.includes(text) && text.length > 6) {
      if (
        isDifferenceOnlyArticles(
          searchTitle,
          manga.title.english || manga.title.romaji || "",
        )
      ) {
        console.debug(
          `[MangaSearchService] ⭐ Article-only difference detected between "${text}" and "${searchTitle}" (${source}) - very high score`,
        );
        return 0.97;
      }
      console.debug(
        `[MangaSearchService] ✅ Title "${text}" is a substantial part of search "${searchTitle}" (${source})`,
      );
      return 0.8;
    }
  }

  return -1; // No direct match found
}

/**
 * Calculate enhanced text similarity with adaptive thresholds based on search length.
 * Shorter searches use higher threshold (0.6); longer searches use lower threshold (0.5).
 *
 * @param text - The text to compare
 * @param normalizedSearchTitle - The normalized search title
 * @param searchTitle - The original search title (for logging)
 * @param source - The source/type of the text being compared (for logging)
 * @returns Similarity score (0.6+) if above threshold, -1 otherwise
 * @source
 */
function checkEnhancedSimilarityScore(
  text: string,
  normalizedSearchTitle: string,
  searchTitle: string,
  source: string,
): number {
  const similarity =
    calculateEnhancedSimilarity(text, normalizedSearchTitle) / 100;
  const similarityThreshold = normalizedSearchTitle.length < 10 ? 0.6 : 0.5;

  if (similarity > similarityThreshold) {
    console.debug(
      `[MangaSearchService] 🔍 High text similarity (${similarity.toFixed(2)}) between "${text}" and "${searchTitle}" (${source})`,
    );
    return Math.max(0.6, similarity * 0.95);
  }

  return -1;
}

/**
 * Calculate composite word match score combining coverage, Jaccard similarity, and word order.
 * Weights coverage (65%) as primary factor, with Jaccard (20%) and order (15%) as supporting factors.
 *
 * @param titleTokenData - Token data from the title
 * @param searchTokenData - Token data from the search query
 * @param searchOrderTokens - Search tokens in order for order similarity calculation
 * @returns Composite match score between 0 and 1
 * @source
 */
function calculateCompositeWordScore(
  titleTokenData: TokenData,
  searchTokenData: TokenData,
  searchOrderTokens: string[],
): number {
  const primaryMatches = searchTokenData.primaryTokens.filter((token) =>
    titleTokenData.tokenSet.has(token),
  );

  const intersectionSize = [...titleTokenData.tokenSet].filter((token) =>
    searchTokenData.tokenSet.has(token),
  ).length;

  const unionSize = new Set([
    ...titleTokenData.tokenSet,
    ...searchTokenData.tokenSet,
  ]).size;

  const jaccardScore = unionSize === 0 ? 0 : intersectionSize / unionSize;

  const coverageRatio =
    searchTokenData.primaryTokens.length === 0
      ? 0
      : primaryMatches.length / searchTokenData.primaryTokens.length;

  const orderSimilarity = calculateWordOrderSimilarity(
    titleTokenData.normalized,
    searchOrderTokens,
  );

  return coverageRatio * 0.65 + jaccardScore * 0.2 + orderSimilarity * 0.15;
}

/**
 * Determine if a title has sufficient primary token matches to warrant overlap processing.
 * Requires at least 60% of search's primary tokens to be present in title, or no search tokens.
 *
 * @param searchTokenData - Token data from the search query
 * @param titleTokenData - Token data from the title
 * @returns True if title should be processed for word overlap analysis
 * @source
 */
function shouldProcessTitleForOverlap(
  searchTokenData: TokenData,
  titleTokenData: TokenData,
): boolean {
  const primaryMatches = searchTokenData.primaryTokens.filter((token) =>
    titleTokenData.tokenSet.has(token),
  );

  if (searchTokenData.primaryTokens.length === 0) return true;
  return primaryMatches.length / searchTokenData.primaryTokens.length >= 0.6;
}

/**
 * Log debug information for meaningful word overlap matches with detailed metrics.
 * Provides visibility into coverage, Jaccard similarity, and word order components.
 *
 * @param original - Original title text (for logging)
 * @param searchTitle - The search title (for logging)
 * @param source - Source/type of the title (for logging)
 * @param finalScore - The final match score
 * @param coverageRatio - Ratio of search primary tokens found in title (0-1)
 * @param jaccardScore - Jaccard similarity score (0-1)
 * @param orderSimilarity - Word order similarity score (0-1)
 * @source
 */
function logMeaningfulOverlapResult(
  original: string,
  searchTitle: string,
  source: string,
  finalScore: number,
  coverageRatio: number,
  jaccardScore: number,
  orderSimilarity: number,
): void {
  console.debug(
    `[MangaSearchService] 🔎 Meaningful overlap detected between "${original}" and "${searchTitle}" (${source}) - score ${finalScore.toFixed(2)} (coverage: ${coverageRatio.toFixed(2)}, jaccard: ${jaccardScore.toFixed(2)}, order: ${orderSimilarity.toFixed(2)})`,
  );
}

/**
 * Calculate metrics for meaningful word overlap analysis.
 * Computes coverage, Jaccard similarity, and word order similarity ratios.
 *
 * @param titleTokenData - Token data from the title
 * @param searchTokenData - Token data from the search query
 * @param searchOrderTokens - Search tokens in order for order similarity
 * @returns Object with coverage, Jaccard, and order similarity ratios (all 0-1)
 * @source
 */
function calculateOverlapMetrics(
  titleTokenData: TokenData,
  searchTokenData: TokenData,
  searchOrderTokens: string[],
): {
  coverageRatio: number;
  jaccardScore: number;
  orderSimilarity: number;
} {
  const primaryMatches = searchTokenData.primaryTokens.filter((token) =>
    titleTokenData.tokenSet.has(token),
  );

  const coverageRatio =
    searchTokenData.primaryTokens.length === 0
      ? 0
      : primaryMatches.length / searchTokenData.primaryTokens.length;

  const intersectionSize = [...titleTokenData.tokenSet].filter((token) =>
    searchTokenData.tokenSet.has(token),
  ).length;

  const unionSize = new Set([
    ...titleTokenData.tokenSet,
    ...searchTokenData.tokenSet,
  ]).size;

  const jaccardScore = unionSize === 0 ? 0 : intersectionSize / unionSize;

  const orderSimilarity = calculateWordOrderSimilarity(
    titleTokenData.normalized,
    searchOrderTokens,
  );

  return { coverageRatio, jaccardScore, orderSimilarity };
}

/**
 * Check word overlap between title and search using composite scoring.
 * Analyzes meaningful words with coverage, Jaccard, and order similarity metrics.
 * Returns best score or -1 if no meaningful overlap found.
 *
 * @param normalizedTitles - Normalized title entries to check
 * @param normalizedSearchTitle - The normalized search title
 * @param searchTitle - The original search title (for logging)
 * @returns Best overlap match score (0.6-0.98) or -1 if no match
 * @source
 */
function checkMeaningfulWordOverlap(
  normalizedTitles: NormalizedTitleEntry[],
  normalizedSearchTitle: string,
  searchTitle: string,
): number {
  const searchMeaningfulWords = extractMeaningfulWords(searchTitle);
  if (searchMeaningfulWords.length === 0) return -1;

  const searchTokenData = createTokenData(searchMeaningfulWords);
  if (searchTokenData.normalized.length === 0) return -1;

  const searchOrderTokens =
    searchTokenData.normalized.length > 0
      ? searchTokenData.normalized
      : normalizedSearchTitle.split(/\s+/).filter((word) => word.length > 0);

  let bestScore = -1;

  for (const { original, source } of normalizedTitles) {
    const titleMeaningfulWords = extractMeaningfulWords(original);
    if (titleMeaningfulWords.length === 0) continue;

    const titleTokenData = createTokenData(titleMeaningfulWords);
    if (titleTokenData.normalized.length === 0) continue;

    if (!shouldProcessTitleForOverlap(searchTokenData, titleTokenData)) {
      continue;
    }

    const compositeScore = calculateCompositeWordScore(
      titleTokenData,
      searchTokenData,
      searchOrderTokens,
    );

    if (compositeScore < 0.6) continue;

    const finalScore = Math.min(0.98, 0.8 + (compositeScore - 0.6) * 0.5);
    const metrics = calculateOverlapMetrics(
      titleTokenData,
      searchTokenData,
      searchOrderTokens,
    );

    logMeaningfulOverlapResult(
      original,
      searchTitle,
      source,
      finalScore,
      metrics.coverageRatio,
      metrics.jaccardScore,
      metrics.orderSimilarity,
    );

    bestScore = Math.max(bestScore, finalScore);
  }

  return bestScore;
}

/**
 * Check if search term matches title initialism (e.g., "JJK" for "Jujutsu Kaisen").
 * Returns high score for exact initialism matches, lower scores for high similarity.
 *
 * @param normalizedTitles - Normalized title entries to check
 * @param searchTitle - The search title to match as potential initialism
 * @returns Initialism match score (0.8-0.92) or -1 if no match
 * @source
 */
function checkInitialismMatch(
  normalizedTitles: NormalizedTitleEntry[],
  searchTitle: string,
): number {
  const compactSearch = searchTitle.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

  if (compactSearch.length < 2) {
    return -1;
  }

  let bestScore = -1;

  for (const { original, source } of normalizedTitles) {
    const titleMeaningfulWords = extractMeaningfulWords(original);
    if (titleMeaningfulWords.length === 0) continue;

    const normalizedTokens = normalizeTokensForMatching(titleMeaningfulWords);
    if (normalizedTokens.length === 0) continue;

    const initialism = buildInitialism(titleMeaningfulWords);
    if (initialism.length < 2) continue;

    if (initialism === compactSearch) {
      console.debug(
        `[MangaSearchService] 🔤 Initialism match detected: "${searchTitle}" ↔ "${original}" (${source})`,
      );
      return 0.92;
    }

    const similarity =
      calculateEnhancedSimilarity(initialism, compactSearch) / 100;

    if (similarity >= 0.8) {
      const score = Math.min(0.9, 0.8 + (similarity - 0.8) * 0.5);
      console.debug(
        `[MangaSearchService] 🔤 Initialism similarity (${(similarity * 100).toFixed(1)}%) for "${searchTitle}" against "${original}" (${source})`,
      );
      bestScore = Math.max(bestScore, score);
    }
  }

  return bestScore;
}

/**
 * Detects if the search and candidate share a strong prefix (first few words) to boost the score.
 * Useful when titles share the same series/subtitle prefix but diverge after the first few words.
 */
function checkPrefixMatch(
  normalizedTitles: NormalizedTitleEntry[],
  normalizedSearchTitle: string,
  searchTitle: string,
): number {
  const searchTokens = normalizedSearchTitle
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (searchTokens.length < 2) return -1;

  let bestScore = -1;

  for (const { text, original, source } of normalizedTitles) {
    const titleTokens = text.split(/\s+/).filter((token) => token.length > 0);
    if (titleTokens.length === 0) continue;

    let prefixMatchCount = 0;
    while (
      prefixMatchCount < searchTokens.length &&
      prefixMatchCount < titleTokens.length &&
      searchTokens[prefixMatchCount] === titleTokens[prefixMatchCount]
    ) {
      prefixMatchCount++;
    }

    if (prefixMatchCount < 2) continue;

    const longestLength = Math.max(searchTokens.length, titleTokens.length);
    const coverageRatio = prefixMatchCount / longestLength;

    const matchBonus = Math.min(0.25, prefixMatchCount * 0.04);
    const coverageBonus = Math.min(0.15, coverageRatio * 0.3);
    const prefixScore = Math.min(0.92, 0.62 + matchBonus + coverageBonus);

    console.debug(
      `[MangaSearchService] 📌 Prefix match detected between "${searchTitle}" and "${original}" (${source}) - shared words: ${prefixMatchCount}, score: ${prefixScore.toFixed(2)}`,
    );

    bestScore = Math.max(bestScore, prefixScore);
    if (bestScore >= 0.9) {
      break;
    }
  }

  return bestScore;
}

/**
 * Check word-based matching approaches including word match, similarity, and overlap.
 * Tries enhanced similarity and meaningful word overlap unless disabled via options.
 *
 * @param normalizedTitles - Normalized title entries to check
 * @param normalizedSearchTitle - The normalized search title
 * @param searchTitle - The original search title
 * @param options - Matching options (e.g., to disable overlap heuristics)
 * @returns Best word-based match score or -1 if no match
 * @source
 */
function checkWordMatching(
  normalizedTitles: NormalizedTitleEntry[],
  normalizedSearchTitle: string,
  searchTitle: string,
  options?: MatchScoreOptions,
): number {
  let bestScore = -1;
  const searchWords = normalizedSearchTitle
    .split(/\s+/)
    .filter((word) => word.length > 0);

  const prefixScore = checkPrefixMatch(
    normalizedTitles,
    normalizedSearchTitle,
    searchTitle,
  );
  if (prefixScore > bestScore) {
    bestScore = prefixScore;
  }

  for (const { text, source } of normalizedTitles) {
    const titleWords = text.split(/\s+/);

    // Calculate word matching score
    const wordMatchScore = calculateWordMatchScore(titleWords, searchWords);
    if (wordMatchScore > 0) {
      const adjustedDisplay = ((wordMatchScore - 0.75) / 0.6 + 0.75).toFixed(2);
      console.debug(
        `[MangaSearchService] ✅ High word match ratio (${adjustedDisplay}) between "${text}" and "${searchTitle}" (${source}) - score: ${wordMatchScore.toFixed(2)}`,
      );

      if (wordMatchScore > 0.9) {
        return wordMatchScore;
      }
      bestScore = Math.max(bestScore, wordMatchScore);
    }

    // Check enhanced similarity
    const similarityScore = checkEnhancedSimilarityScore(
      text,
      normalizedSearchTitle,
      searchTitle,
      source,
    );
    if (similarityScore > 0) {
      bestScore = Math.max(bestScore, similarityScore);
    }
  }

  if (!options?.shouldDisableMeaningfulOverlap) {
    const overlapScore = checkMeaningfulWordOverlap(
      normalizedTitles,
      normalizedSearchTitle,
      searchTitle,
    );
    if (overlapScore > 0) {
      bestScore = Math.max(bestScore, overlapScore);
    }

    const initialismScore = checkInitialismMatch(normalizedTitles, searchTitle);
    if (initialismScore > 0) {
      bestScore = Math.max(bestScore, initialismScore);
    }
  }

  return bestScore;
}

/**
 * Check for exact title matches including suffix removal and special character handling.
 * Returns highest score (1.0) for perfect matches, lower score (0.95) after suffix removal.
 *
 * @param normalizedTitle - The normalized title
 * @param specialCharTitle - Title with special characters replaced
 * @param normalizedSearchTitle - The normalized search title
 * @param specialCharSearchTitle - Search with special characters replaced
 * @param title - The original title for logging
 * @returns Match score (0.95-1) if found, -1 otherwise
 * @source
 */
function checkExactTitleMatch(
  normalizedTitle: string,
  specialCharTitle: string,
  normalizedSearchTitle: string,
  specialCharSearchTitle: string,
  title: string,
): number {
  if (
    normalizedTitle === normalizedSearchTitle ||
    specialCharTitle === specialCharSearchTitle
  ) {
    console.debug(`[MangaSearchService] 💯 Perfect match found for "${title}"`);
    return 1;
  }

  const titleWithoutSuffix = normalizedTitle
    .replace(/@\w+$|[@(（][^)）]*[)）]$/, "")
    .trim();
  if (titleWithoutSuffix === normalizedSearchTitle) {
    console.debug(
      `[MangaSearchService] 💯 Perfect match found after removing suffix: "${title}"`,
    );
    return 0.95;
  }

  const specialCharTitleWithoutSuffix = specialCharTitle
    .replace(/@\w+$|[@(（][^)）]*[)）]$/, "")
    .trim();
  if (specialCharTitleWithoutSuffix === specialCharSearchTitle) {
    console.debug(
      `[MangaSearchService] 💯 Perfect match found after removing suffix and fixing special chars: "${title}"`,
    );
    return 0.95;
  }

  return -1;
}

/**
 * Check if search term is a substantial part of the title.
 * Requires search length > 6 to avoid false positives on short terms.
 *
 * @param normalizedTitle - The normalized title
 * @param specialCharTitle - Title with special characters replaced
 * @param normalizedSearchTitle - The normalized search title
 * @param specialCharSearchTitle - Search with special characters replaced
 * @param title - The original title for logging
 * @param searchTitle - The original search title for logging
 * @returns Match score (0.85) if found, -1 otherwise
 * @source
 */
function checkPartialTitleMatch(
  normalizedTitle: string,
  specialCharTitle: string,
  normalizedSearchTitle: string,
  specialCharSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  if (
    (normalizedTitle.includes(normalizedSearchTitle) ||
      specialCharTitle.includes(specialCharSearchTitle)) &&
    normalizedSearchTitle.length > 6
  ) {
    console.debug(
      `[MangaSearchService] ✅ Found search title as substantial part of full title: "${title}" contains "${searchTitle}"`,
    );
    return 0.85;
  }
  return -1;
}

/**
 * Check word-level similarity between title and search.
 * Counts matching words (length > 1) and returns score based on match ratio threshold (0.75).
 *
 * @param specialCharTitle - Title with special characters replaced
 * @param specialCharSearchTitle - Search with special characters replaced
 * @param title - The original title for logging
 * @param searchTitle - The original search title for logging
 * @returns Similarity score (0.8-1) if high match ratio, -1 otherwise
 * @source
 */
function checkWordSimilarity(
  specialCharTitle: string,
  specialCharSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  const titleWords = specialCharTitle.split(/\s+/);
  const searchWords = specialCharSearchTitle.split(/\s+/);

  let matchingWordCount = 0;
  const totalWords = Math.max(titleWords.length, searchWords.length);

  for (const word of titleWords) {
    if (searchWords.includes(word) && word.length > 1) {
      matchingWordCount++;
    }
  }

  const wordMatchRatio = matchingWordCount / totalWords;
  if (wordMatchRatio >= 0.75) {
    console.debug(
      `[MangaSearchService] 🔤 High word match ratio (${wordMatchRatio.toFixed(2)}) between "${title}" and "${searchTitle}"`,
    );
    return 0.8 + (wordMatchRatio - 0.75) * 0.8;
  }

  return -1;
}

/**
 * Check if search term is completely contained in the title.
 * Uses containsCompleteTitle to calculate significance bonus based on search term proportion.
 *
 * @param normalizedTitle - The normalized title
 * @param normalizedSearchTitle - The normalized search title
 * @param title - The original title for logging
 * @param searchTitle - The original search title for logging
 * @returns Containment score (0.85-0.95) if found, -1 otherwise
 * @source
 */
function checkContainedTitle(
  normalizedTitle: string,
  normalizedSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  const completeTitleBonus = containsCompleteTitle(
    normalizedTitle,
    normalizedSearchTitle,
  );
  if (completeTitleBonus > 0) {
    const containedScore = 0.85 + completeTitleBonus * 0.1;
    console.debug(
      `[MangaSearchService] 🔍 Search title "${searchTitle}" completely contained in "${title}" with score ${containedScore.toFixed(2)}`,
    );
    return containedScore;
  }
  return -1;
}

/**
 * Check enhanced similarity between title and search with adaptive thresholds.
 * Uses length-based thresholds: shorter searches (< 10 chars) use 0.6, longer use 0.45.
 *
 * @param normalizedTitle - The normalized title
 * @param normalizedSearchTitle - The normalized search title
 * @param title - The original title for logging
 * @param searchTitle - The original search title for logging
 * @returns Similarity score (0.45-1) if above threshold, -1 otherwise
 * @source
 */
function checkEnhancedSimilarity(
  normalizedTitle: string,
  normalizedSearchTitle: string,
  title: string,
  searchTitle: string,
): number {
  const similarity =
    calculateEnhancedSimilarity(normalizedTitle, normalizedSearchTitle) / 100;
  const similarityThreshold = normalizedSearchTitle.length < 10 ? 0.6 : 0.45;

  if (similarity > similarityThreshold) {
    console.debug(
      `[MangaSearchService] 🔍 High similarity (${similarity.toFixed(2)}) between "${title}" and "${searchTitle}"`,
    );
    return Math.max(0.8, similarity);
  }

  return -1;
}

/**
 * Check subset matching using word coverage, length difference, and word order.
 * Combines multiple factors: base score (50%), length (10%), coverage (10%), order (10%), plus 20% extra.
 *
 * @param processedTitle - The processed title
 * @param searchTitle - The original search title
 * @param normalizedTitle - The normalized title
 * @param normalizedSearchTitle - The normalized search title
 * @param importantWords - Important search words (length > 2) to check coverage
 * @returns Composite match score (0.5+) or -1 if no title match
 * @source
 */
function checkSubsetMatch(
  processedTitle: string,
  searchTitle: string,
  normalizedTitle: string,
  normalizedSearchTitle: string,
  importantWords: string[],
): number {
  if (isTitleMatch(processedTitle, searchTitle)) {
    const lengthDiff =
      Math.abs(processedTitle.length - searchTitle.length) /
      Math.max(processedTitle.length, searchTitle.length);

    const matchedWords = importantWords.filter((word) =>
      normalizedTitle.includes(word),
    ).length;
    const wordCoverage =
      importantWords.length > 0 ? matchedWords / importantWords.length : 0;

    const orderSimilarity = calculateWordOrderSimilarity(
      normalizedTitle.split(/\s+/),
      normalizedSearchTitle.split(/\s+/),
    );

    const baseScore = 0.5;
    const lengthFactor = (1 - lengthDiff) * 0.1;
    const coverageFactor = wordCoverage * 0.1;
    const orderFactor = orderSimilarity * 0.1;

    const wordMatchScore =
      baseScore + lengthFactor + coverageFactor + orderFactor;

    console.debug(
      `[MangaSearchService] 🔍 Word match for "${processedTitle}" with composite score ${wordMatchScore.toFixed(2)} ` +
        `(length: ${lengthFactor.toFixed(2)}, coverage: ${coverageFactor.toFixed(2)}, order: ${orderFactor.toFixed(2)})`,
    );

    return wordMatchScore;
  }
  return -1;
}

/**
 * Check legacy matching approaches for comprehensive title coverage.
 * Tries multiple matching strategies: exact, partial, word similarity, containment, enhanced similarity, season patterns, and subset.
 * Returns early if score >= 0.95 for efficiency.
 *
 * @param titles - Array of title strings to check
 * @param normalizedSearchTitle - The normalized search title
 * @param searchTitle - The original search title
 * @param importantWords - Important search words (length > 2) for subset matching
 * @returns Best legacy match score or -1 if no match
 * @source
 */
function checkLegacyMatching(
  titles: string[],
  normalizedSearchTitle: string,
  searchTitle: string,
  importantWords: string[],
): number {
  let bestScore = -1;

  for (const title of titles) {
    if (!title) continue;

    const processedTitle = processTitle(title);
    const normalizedTitle = normalizeForMatching(processedTitle);
    const specialCharTitle = replaceSpecialChars(normalizedTitle);
    const specialCharSearchTitle = replaceSpecialChars(normalizedSearchTitle);

    // Log special character replacements if they differ
    if (
      specialCharTitle !== normalizedTitle ||
      specialCharSearchTitle !== normalizedSearchTitle
    ) {
      console.debug(
        `[MangaSearchService] 🔡 Special character replacement: "${normalizedTitle}" → "${specialCharTitle}"`,
      );
      console.debug(
        `[MangaSearchService] 🔡 Special character replacement: "${normalizedSearchTitle}" → "${specialCharSearchTitle}"`,
      );
    }

    // Check various matching approaches
    const approaches = [
      () =>
        checkExactTitleMatch(
          normalizedTitle,
          specialCharTitle,
          normalizedSearchTitle,
          specialCharSearchTitle,
          title,
        ),
      () =>
        checkPartialTitleMatch(
          normalizedTitle,
          specialCharTitle,
          normalizedSearchTitle,
          specialCharSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkWordSimilarity(
          specialCharTitle,
          specialCharSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkContainedTitle(
          normalizedTitle,
          normalizedSearchTitle,
          title,
          searchTitle,
        ),
      () =>
        checkEnhancedSimilarity(
          normalizedTitle,
          normalizedSearchTitle,
          title,
          searchTitle,
        ),
      () => checkSeasonPatterns(normalizedTitle, normalizedSearchTitle),
      () =>
        checkSubsetMatch(
          processedTitle,
          searchTitle,
          normalizedTitle,
          normalizedSearchTitle,
          importantWords,
        ),
    ];

    for (const approach of approaches) {
      const score = approach();
      if (score > 0) {
        bestScore = Math.max(bestScore, score);
        if (score >= 0.95) return score; // Early return for very high scores
      }
    }
  }

  return Math.max(0, bestScore);
}
/**
 * Detailed breakdown of match score components.
 * @source
 */
export interface MatchScoreDetails {
  /** Final calculated score (0-1). */
  score: number;
  /** Type of match that produced the score. */
  matchType: "direct" | "word" | "legacy" | "none";
  /** Individual component scores. */
  components: {
    directMatch: number;
    wordMatch: number;
    legacyMatch: number;
  };
}

/**
 * Calculate match score between a manga title and search query.
 * Uses multiple matching strategies in order: direct matches, word-based matching, then legacy approaches.
 * Returns normalized score between 0 and 1, or -1 if no match found.
 *
 * @param manga - The manga to calculate match score for
 * @param searchTitle - The search title to match against
 * @param options - Options to customize matching behavior (e.g., disable overlap heuristics)
 * @returns Match score between 0 and 1, or -1 if no match found
 * @source
 */
export function calculateMatchScoreDetails(
  manga: AniListManga,
  searchTitle: string,
  options: MatchScoreOptions = {},
): MatchScoreDetails {
  // Handle empty search title
  if (!searchTitle || searchTitle.trim() === "") {
    console.warn(
      `[MangaSearchService] ⚠️ Empty search title provided for manga ID ${manga.id}`,
    );
    return {
      score: -1,
      matchType: "none",
      components: { directMatch: 0, wordMatch: 0, legacyMatch: 0 },
    };
  }

  // Log for debugging
  console.debug(
    `[MangaSearchService] 🔍 Calculating match score for "${searchTitle}" against manga ID ${manga.id}, titles:`,
    {
      english: manga.title.english,
      romaji: manga.title.romaji,
      native: manga.title.native,
      synonyms: manga.synonyms?.slice(0, 3), // Limit to first 3 for cleaner logs
    },
  );

  // If we have synonyms, log them explicitly for better debugging
  if (manga.synonyms && manga.synonyms.length > 0) {
    console.debug(
      `[MangaSearchService] 📚 Synonyms for manga ID ${manga.id}:`,
      manga.synonyms,
    );
  }

  // Collect all manga titles
  const titles = collectMangaTitles(manga);

  // Create normalized titles for matching
  const normalizedTitles = createNormalizedTitles(manga);

  // Normalize the search title for better matching
  const normalizedSearchTitle = normalizeForMatching(searchTitle);
  const searchWords = normalizedSearchTitle.split(/\s+/);
  const importantWords = searchWords.filter((word) => word.length > 2);

  // Check for direct matches first (highest confidence)
  const directMatch = checkDirectMatches(
    normalizedTitles,
    normalizedSearchTitle,
    searchTitle,
    manga,
  );

  if (directMatch > 0) {
    return {
      score: directMatch,
      matchType: "direct",
      components: { directMatch, wordMatch: 0, legacyMatch: 0 },
    };
  }

  // Try word-based matching approaches
  const wordMatch = checkWordMatching(
    normalizedTitles,
    normalizedSearchTitle,
    searchTitle,
    options,
  );

  if (wordMatch > 0) {
    return {
      score: wordMatch,
      matchType: "word",
      components: { directMatch: 0, wordMatch, legacyMatch: 0 },
    };
  }

  // Finally try legacy matching approaches for comprehensive coverage
  const legacyMatch = checkLegacyMatching(
    titles,
    normalizedSearchTitle,
    searchTitle,
    importantWords,
  );

  console.debug(
    `[MangaSearchService] 🔍 Final match score for "${searchTitle}": ${legacyMatch.toFixed(2)}`,
  );

  return {
    score: legacyMatch,
    matchType: "legacy",
    components: { directMatch: 0, wordMatch: 0, legacyMatch },
  };
}

export function calculateMatchScore(
  manga: AniListManga,
  searchTitle: string,
  options: MatchScoreOptions = {},
): number {
  return calculateMatchScoreDetails(manga, searchTitle, options).score;
}
