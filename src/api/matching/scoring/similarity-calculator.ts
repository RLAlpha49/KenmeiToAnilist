/**
 * @packageDocumentation
 * @module Matching/Scoring/SimilarityCalculator
 * @description String similarity and word order comparison utilities for title matching.
 * Implements longest common subsequence analysis and position-based proximity scoring.
 */

/**
 * Calculate word order similarity using longest common subsequence.
 * Combines order preservation (50%), position proximity (30%), and word coverage (20%).
 *
 * @param primaryWords - First array of words to compare
 * @param comparisonWords - Second array of words to compare
 * @returns Order similarity score between 0 and 1
 * @source
 */
export function calculateWordOrderSimilarity(
  primaryWords: string[],
  comparisonWords: string[],
): number {
  // If either array is empty, no match
  if (primaryWords.length === 0 || comparisonWords.length === 0) return 0;

  // Filter for words that appear in both arrays
  const commonPrimaryWords = primaryWords.filter((word) =>
    comparisonWords.includes(word),
  );

  // If no common words, no order similarity
  if (commonPrimaryWords.length === 0) return 0;

  // Calculate longest common subsequence (LCS) length
  // This gives us the longest sequence of words that appear in same order
  const longestCommonSubsequenceLength =
    calculateLongestCommonSubsequenceLength(primaryWords, comparisonWords);

  // Calculate order preservation score
  // Higher LCS means better order preservation
  const maxLength = Math.max(primaryWords.length, comparisonWords.length);
  const lcsScore = longestCommonSubsequenceLength / maxLength;

  // Calculate position distance penalty
  // Words at similar positions get bonus
  let positionScore = 0;
  const minLength = Math.min(primaryWords.length, comparisonWords.length);

  for (let i = 0; i < minLength; i++) {
    if (primaryWords[i] === comparisonWords[i]) {
      positionScore += 1;
    } else if (comparisonWords.includes(primaryWords[i])) {
      // Word exists but in different position, give partial credit
      const actualPos = comparisonWords.indexOf(primaryWords[i]);
      const distance = Math.abs(i - actualPos);
      positionScore += Math.max(0, 1 - distance / maxLength);
    }
  }
  positionScore /= maxLength;

  // Calculate coverage (what portion of words are common)
  const coverage = commonPrimaryWords.length / maxLength;

  // Combine scores with weights
  // LCS is most important for order, then position, then coverage
  return lcsScore * 0.5 + positionScore * 0.3 + coverage * 0.2;
}

/**
 * Calculate longest common subsequence length between two word arrays.
 * Uses space-optimized dynamic programming (O(mn) time, O(n) space).
 *
 * @param primaryWords - First array of words
 * @param comparisonWords - Second array of words
 * @returns Length of the longest common subsequence
 * @source
 */
function calculateLongestCommonSubsequenceLength(
  primaryWords: string[],
  comparisonWords: string[],
): number {
  const m = primaryWords.length;
  const n = comparisonWords.length;

  // Use space-optimized DP (only need previous row)
  let previous = new Array<number>(n + 1).fill(0);
  let current = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (primaryWords[i - 1] === comparisonWords[j - 1]) {
        current[j] = previous[j - 1] + 1;
      } else {
        current[j] = Math.max(current[j - 1], previous[j]);
      }
    }
    // Swap arrays for next iteration
    [previous, current] = [current, previous];
    current.fill(0);
  }

  return previous[n];
}

/**
 * Check if title contains the complete search term and return significance score.
 * Significance is measured as the proportion of the full title that the search term represents.
 *
 * @param normalizedTitle - The normalized manga title
 * @param normalizedSearchTitle - The normalized search title
 * @returns Significance score between 0 and 1 (search term length / full title length), or 0 if not contained
 * @source
 */
export function containsCompleteTitle(
  normalizedTitle: string,
  normalizedSearchTitle: string,
): number {
  if (normalizedTitle.includes(normalizedSearchTitle)) {
    // Calculate how significant the contained title is compared to the full title
    // (Higher score when the search term represents more of the full title)
    return normalizedSearchTitle.length / normalizedTitle.length;
  }
  return 0;
}

const MATCH_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "for",
  "with",
  "by",
  "of",
  "in",
  "on",
  "at",
  "to",
  "from",
  "after",
  "before",
  "while",
  "during",
  "through",
  "around",
  "among",
  "against",
  "over",
  "under",
  "between",
  "about",
  "per",
  "via",
  "since",
  "until",
]);

const MATCHABLE_WORD_MIN_LENGTH = 3;
const WORD_MATCH_BASE_RATIO = 0.75;
const WORD_MATCH_COVERAGE_PENALTY_SCALE = 0.5;
const WORD_MATCH_SEARCH_RATIO_THRESHOLD = 0.6;
const WORD_MATCH_SEARCH_RATIO_PENALTY_SCALE = 0.2;
const WORD_MATCH_FALLBACK_MIN_RATIO = 0.55;
const WORD_MATCH_FALLBACK_MIN_COVERAGE = 0.6;
const WORD_MATCH_FALLBACK_MIN_MATCHED_WORDS = 2;
const WORD_MATCH_FALLBACK_SEARCH_DENSITY_THRESHOLD = 1.1;
const WORD_MATCH_FALLBACK_SEARCH_COVERAGE_THRESHOLD = 0.35;
const WORD_MATCH_FALLBACK_SCORE_BASE = 0.65;
const WORD_MATCH_FALLBACK_SCORE_SCALE = 0.25;

const isMatchableWord = (word: string): boolean => {
  if (!word) return false;
  const normalized = word.toLowerCase();
  return (
    normalized.length >= MATCHABLE_WORD_MIN_LENGTH &&
    !MATCH_STOP_WORDS.has(normalized)
  );
};

const filterMatchableWords = (words: string[]): string[] => {
  return words
    .map((word) => word.trim().toLowerCase())
    .filter((word) => isMatchableWord(word));
};

const isPartialWordMatch = (word: string, searchWord: string): boolean => {
  const minLength = Math.min(word.length, searchWord.length);
  if (minLength < 4) return false;

  return (
    word.startsWith(searchWord) ||
    searchWord.startsWith(word) ||
    word.endsWith(searchWord) ||
    searchWord.endsWith(word)
  );
};

/**
 * Calculate word matching score between title and search words.
 * Counts exact word matches and partial matches (prefix/suffix) of length >= 4.
 * Requires minimum 75% match ratio to return a score.
 *
 * @param titleWords - Array of words from the manga title
 * @param searchWords - Array of words from the search query
 * @returns Word match score (0.75-1) or -1 if below threshold
 * @source
 */
export function calculateWordMatchScore(
  titleWords: string[],
  searchWords: string[],
): number {
  const matchableTitleWords = filterMatchableWords(titleWords);
  const matchableSearchWords = filterMatchableWords(searchWords);

  if (matchableTitleWords.length === 0 || matchableSearchWords.length === 0) {
    return -1;
  }

  let matchingWords = 0;
  const matchedSearchWords = new Set<string>();

  for (const word of matchableTitleWords) {
    for (const searchWord of matchableSearchWords) {
      if (matchedSearchWords.has(searchWord)) continue;

      if (word === searchWord) {
        matchingWords += 1;
        matchedSearchWords.add(searchWord);
        break;
      }

      if (isPartialWordMatch(word, searchWord)) {
        matchingWords += 0.5;
        matchedSearchWords.add(searchWord);
        break;
      }
    }
  }

  const denominator = Math.max(
    2,
    Math.min(matchableTitleWords.length, matchableSearchWords.length),
  );
  const matchRatio = matchingWords / denominator;
  const adjustedMatchRatio = applyDensityPenalty(
    matchRatio,
    matchingWords,
    matchableTitleWords.length,
    matchableSearchWords.length,
  );

  if (adjustedMatchRatio >= WORD_MATCH_BASE_RATIO) {
    return (
      WORD_MATCH_BASE_RATIO + (adjustedMatchRatio - WORD_MATCH_BASE_RATIO) * 0.6
    );
  }

  const fallbackScore = getWordMatchFallbackScore(
    adjustedMatchRatio,
    matchableTitleWords.length,
    matchableSearchWords.length,
    matchingWords,
  );

  if (fallbackScore !== null) {
    return fallbackScore;
  }

  return -1;
}

function getWordMatchFallbackScore(
  adjustedMatchRatio: number,
  titleWordCount: number,
  searchWordCount: number,
  matchingWords: number,
): number | null {
  const coverageRatio =
    titleWordCount === 0 ? 0 : matchingWords / titleWordCount;
  const searchDensity =
    titleWordCount === 0 ? 0 : searchWordCount / titleWordCount;
  const searchCoverage =
    searchWordCount === 0 ? 0 : matchingWords / searchWordCount;

  if (
    !shouldTriggerWordMatchFallback(
      adjustedMatchRatio,
      coverageRatio,
      matchingWords,
      searchDensity,
      searchCoverage,
    )
  ) {
    return null;
  }

  const fallbackScore = calculateWordMatchFallbackScore(adjustedMatchRatio);
  console.debug(
    `[MangaSearchService] ⚙️ Word match fallback triggered: ratio=${adjustedMatchRatio.toFixed(
      2,
    )}, coverage=${coverageRatio.toFixed(2)}, density=${searchDensity.toFixed(
      2,
    )}, searchCoverage=${searchCoverage.toFixed(2)} → score=${fallbackScore.toFixed(2)}`,
  );

  return fallbackScore;
}

function shouldTriggerWordMatchFallback(
  adjustedMatchRatio: number,
  coverageRatio: number,
  matchingWords: number,
  searchDensity: number,
  searchCoverage: number,
): boolean {
  if (matchingWords < WORD_MATCH_FALLBACK_MIN_MATCHED_WORDS) return false;
  if (coverageRatio < WORD_MATCH_FALLBACK_MIN_COVERAGE) return false;
  if (searchDensity < WORD_MATCH_FALLBACK_SEARCH_DENSITY_THRESHOLD)
    return false;
  if (searchCoverage < WORD_MATCH_FALLBACK_SEARCH_COVERAGE_THRESHOLD) {
    console.debug(
      `[MangaSearchService] ⚠️ Word match fallback suppressed: search coverage ${(
        searchCoverage * 100
      ).toFixed(1)}% is below the ${(
        WORD_MATCH_FALLBACK_SEARCH_COVERAGE_THRESHOLD * 100
      ).toFixed(0)}% threshold`,
    );
    return false;
  }
  return adjustedMatchRatio >= WORD_MATCH_FALLBACK_MIN_RATIO;
}

function calculateWordMatchFallbackScore(adjustedMatchRatio: number): number {
  const delta = adjustedMatchRatio - WORD_MATCH_FALLBACK_MIN_RATIO;
  const rawScore = Math.max(
    WORD_MATCH_FALLBACK_SCORE_BASE,
    WORD_MATCH_FALLBACK_SCORE_BASE + delta * WORD_MATCH_FALLBACK_SCORE_SCALE,
  );
  return Math.min(WORD_MATCH_BASE_RATIO - 0.01, rawScore);
}

function applyDensityPenalty(
  matchRatio: number,
  matchingWords: number,
  titleWordCount: number,
  searchWordCount: number,
): number {
  const titleCoverage =
    titleWordCount === 0 ? 0 : matchingWords / titleWordCount;
  const coveragePenalty = Math.max(0, WORD_MATCH_BASE_RATIO - titleCoverage);

  const searchDensity =
    titleWordCount === 0 ? 0 : searchWordCount / titleWordCount;
  const searchRatioPenalty = Math.max(
    0,
    WORD_MATCH_SEARCH_RATIO_THRESHOLD - searchDensity,
  );

  const totalPenalty =
    coveragePenalty * WORD_MATCH_COVERAGE_PENALTY_SCALE +
    searchRatioPenalty * WORD_MATCH_SEARCH_RATIO_PENALTY_SCALE;
  const adjustedMatchRatio = Math.max(0, matchRatio - totalPenalty);

  if (totalPenalty > 0 && adjustedMatchRatio < WORD_MATCH_BASE_RATIO) {
    const reasons = [] as string[];
    if (coveragePenalty > 0) {
      reasons.push(
        `only ${titleCoverage.toFixed(2)} of the title tokens contributed to the match`,
      );
    }
    if (searchRatioPenalty > 0) {
      reasons.push(`search/title token density is ${searchDensity.toFixed(2)}`);
    }
    console.debug(
      `[MangaSearchService] Word match density penalty (${totalPenalty.toFixed(2)}) reduced ratio ${matchRatio.toFixed(
        2,
      )}: ${reasons.join(" and ")}.`,
    );
  }

  return adjustedMatchRatio;
}
