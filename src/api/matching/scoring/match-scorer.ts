/**
 * @packageDocumentation
 * @module Matching/Scoring/MatchScorer
 * @description Core match scoring logic for manga title matching
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
 * Check if words from search term appear in title with consideration for word order and proximity
 *
 * @param title - Title to check against
 * @param searchName - Search term to match
 * @returns True if the title matches the search criteria
 *
 * @internal
 */
type NormalizedTitleEntry = {
  text: string;
  source: string;
  original: string;
};

export interface MatchScoreOptions {
  /**
   * When true, skips the enhanced overlap heuristics to mimic legacy behaviour.
   * Useful for regression testing and before/after comparisons.
   */
  disableMeaningfulOverlap?: boolean;
}

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

const ROMAN_NUMERAL_VALUES: Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
};

const ROMAN_NUMERAL_REGEX =
  /^(?=[mdclxvi])m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

type TokenData = {
  normalized: string[];
  tokenSet: Set<string>;
  primaryTokens: string[];
};

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

  if (ROMAN_NUMERAL_REGEX.test(token)) {
    const value = romanToDecimal(token);
    if (value !== null) {
      return String(value);
    }
  }

  return token;
};

const normalizeTokensForMatching = (words: string[]): string[] => {
  return words.map(normalizeToken).filter((word) => word.length > 0);
};

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

const buildInitialism = (rawWords: string[]): string => {
  const letters: string[] = [];

  for (const rawWord of rawWords) {
    const normalized = normalizeToken(rawWord);
    if (!normalized || SECONDARY_WORDS.has(normalized)) {
      continue;
    }

    const source =
      /^\d+$/.test(normalized) && /^[a-z]/i.test(rawWord)
        ? rawWord.toLowerCase()
        : normalized;

    letters.push(source[0]);
  }

  return letters.join("");
};

function checkTitleMatch(title: string, searchName: string): boolean {
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
  const allWordsPresent = searchWordsArray.every((word) =>
    titleWordsArray.includes(word),
  );
  if (!allWordsPresent) return false;

  // If all words are present, check for order preservation and proximity
  // Find indexes of search words in the title
  const indexes = searchWordsArray.map((word) => titleWordsArray.indexOf(word));

  // Check if the words appear in the same order (indexes should be increasing)
  const sameOrder = indexes.every(
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
  return sameOrder || proximityScore >= 0.5;
}

/**
 * Check for direct and substantial partial matches
 *
 * @internal
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
 * Check enhanced similarity between normalized titles
 *
 * @internal
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
 * Check word-based matching between titles
 *
 * @internal
 */
function checkMeaningfulWordOverlap(
  normalizedTitles: NormalizedTitleEntry[],
  normalizedSearchTitle: string,
  searchTitle: string,
): number {
  const searchMeaningfulWords = extractMeaningfulWords(searchTitle);
  if (searchMeaningfulWords.length === 0) {
    return -1;
  }

  const searchTokenData = createTokenData(searchMeaningfulWords);
  if (searchTokenData.normalized.length === 0) {
    return -1;
  }

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

    const primaryMatches = searchTokenData.primaryTokens.filter((token) =>
      titleTokenData.tokenSet.has(token),
    );

    if (
      searchTokenData.primaryTokens.length > 0 &&
      primaryMatches.length / searchTokenData.primaryTokens.length < 0.6
    ) {
      continue;
    }

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

    const compositeScore =
      coverageRatio * 0.65 + jaccardScore * 0.2 + orderSimilarity * 0.15;

    if (compositeScore >= 0.6) {
      const finalScore = Math.min(0.98, 0.8 + (compositeScore - 0.6) * 0.5);
      console.debug(
        `[MangaSearchService] 🔎 Meaningful overlap detected between "${original}" and "${searchTitle}" (${source}) - score ${finalScore.toFixed(2)} (coverage: ${coverageRatio.toFixed(2)}, jaccard: ${jaccardScore.toFixed(2)}, order: ${orderSimilarity.toFixed(2)})`,
      );
      bestScore = Math.max(bestScore, finalScore);
    }
  }

  return bestScore;
}

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

  if (!options?.disableMeaningfulOverlap) {
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
 * Check exact title matching
 *
 * @internal
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
 * Check partial title matching
 *
 * @internal
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
 * Check word similarity matching
 *
 * @internal
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
 * Check contained title matching
 *
 * @internal
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
 * Check enhanced similarity matching
 *
 * @internal
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
 * Check subset matching (word coverage and order)
 *
 * @internal
 */
function checkSubsetMatch(
  processedTitle: string,
  searchTitle: string,
  normalizedTitle: string,
  normalizedSearchTitle: string,
  importantWords: string[],
): number {
  if (checkTitleMatch(processedTitle, searchTitle)) {
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
 * Check legacy matching approaches for backward compatibility
 *
 * @internal
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

  return bestScore;
}

/**
 * Calculate match score between a manga title and search query
 * Returns 0-1 score where 1 is perfect match, or -1 if no match
 *
 * @param manga - The manga to calculate match score for
 * @param searchTitle - The search title to match against
 * @returns Match score between 0-1 (or -1 if no match)
 *
 * @example
 * ```typescript
 * const score = calculateMatchScore(manga, "One Piece");
 * // Returns: 1.0 (perfect match)
 * // Returns: 0.85 (good match)
 * // Returns: -1 (no match)
 * ```
 */
export function calculateMatchScore(
  manga: AniListManga,
  searchTitle: string,
  options: MatchScoreOptions = {},
): number {
  // Handle empty search title
  if (!searchTitle || searchTitle.trim() === "") {
    console.warn(
      `[MangaSearchService] ⚠️ Empty search title provided for manga ID ${manga.id}`,
    );
    return -1;
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
    return directMatch;
  }

  // Try word-based matching approaches
  const wordMatch = checkWordMatching(
    normalizedTitles,
    normalizedSearchTitle,
    searchTitle,
    options,
  );
  if (wordMatch > 0) {
    return wordMatch;
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
  return legacyMatch;
}
