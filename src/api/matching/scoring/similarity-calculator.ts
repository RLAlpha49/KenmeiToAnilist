/**
 * @packageDocumentation
 * @module Matching/Scoring/SimilarityCalculator
 * @description String similarity and word order comparison utilities
 */

/**
 * Calculate word order similarity using longest common subsequence.
 * Combines order preservation, position proximity, and word coverage.
 *
 * @param words1 - First array of words to compare
 * @param words2 - Second array of words to compare
 * @returns Order similarity score between 0 and 1
 * @source
 */
export function calculateWordOrderSimilarity(
  words1: string[],
  words2: string[],
): number {
  // If either array is empty, no match
  if (words1.length === 0 || words2.length === 0) return 0;

  // Filter for words that appear in both arrays
  const commonWords1 = words1.filter((word) => words2.includes(word));

  // If no common words, no order similarity
  if (commonWords1.length === 0) return 0;

  // Calculate longest common subsequence (LCS) length
  // This gives us the longest sequence of words that appear in same order
  const lcsLength = calculateLCS(words1, words2);

  // Calculate order preservation score
  // Higher LCS means better order preservation
  const maxLength = Math.max(words1.length, words2.length);
  const lcsScore = lcsLength / maxLength;

  // Calculate position distance penalty
  // Words at similar positions get bonus
  let positionScore = 0;
  const minLength = Math.min(words1.length, words2.length);

  for (let i = 0; i < minLength; i++) {
    if (words1[i] === words2[i]) {
      positionScore += 1;
    } else if (words2.includes(words1[i])) {
      // Word exists but in different position, give partial credit
      const actualPos = words2.indexOf(words1[i]);
      const distance = Math.abs(i - actualPos);
      positionScore += Math.max(0, 1 - distance / maxLength);
    }
  }
  positionScore /= maxLength;

  // Calculate coverage (what portion of words are common)
  const coverage = commonWords1.length / maxLength;

  // Combine scores with weights
  // LCS is most important for order, then position, then coverage
  return lcsScore * 0.5 + positionScore * 0.3 + coverage * 0.2;
}

/**
 * Calculate longest common subsequence length between two word arrays.
 *
 * @param words1 - First array of words
 * @param words2 - Second array of words
 * @returns Length of the longest common subsequence
 * @source
 */
function calculateLCS(words1: string[], words2: string[]): number {
  const m = words1.length;
  const n = words2.length;

  // Use space-optimized DP (only need previous row)
  let previous = new Array<number>(n + 1).fill(0);
  let current = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (words1[i - 1] === words2[j - 1]) {
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
 *
 * @param normalizedTitle - The normalized manga title
 * @param normalizedSearchTitle - The normalized search title
 * @returns Significance score between 0 and 1 (search term portion of full title)
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

/**
 * Calculate word matching score between title and search words.
 * Returns high score if enough words match, -1 if insufficient match.
 *
 * @param titleWords - Array of words from the manga title
 * @param searchWords - Array of words from the search query
 * @returns Word match score (0.75+) or -1 if below threshold
 * @source
 */
export function calculateWordMatchScore(
  titleWords: string[],
  searchWords: string[],
): number {
  let matchingWords = 0;

  for (const word of titleWords) {
    if (word.length <= 2) continue;

    if (searchWords.includes(word)) {
      matchingWords++;
    } else {
      for (const searchWord of searchWords) {
        if (
          (word.startsWith(searchWord) || searchWord.startsWith(word)) &&
          Math.min(word.length, searchWord.length) >= 4
        ) {
          matchingWords += 0.5;
          break;
        }
      }
    }
  }

  const matchRatio =
    matchingWords /
    Math.max(2, Math.min(titleWords.length, searchWords.length));
  return matchRatio >= 0.75 ? 0.75 + (matchRatio - 0.75) * 0.6 : -1;
}
