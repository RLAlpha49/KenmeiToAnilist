/**
 * @packageDocumentation
 * @module Matching/Scoring/SimilarityCalculator
 * @description String similarity and word order comparison utilities
 */

/**
 * Calculate similarity in word order between two word arrays
 * Returns a value between 0-1 where 1 means perfect order match
 *
 * @param words1 - First array of words to compare
 * @param words2 - Second array of words to compare
 * @returns Order similarity score between 0-1
 *
 * @example
 * ```typescript
 * calculateWordOrderSimilarity(["one", "piece"], ["piece", "one"])
 * // Returns: ~0.7 (order differs, so penalty applied)
 * ```
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

  // Calculate the positions of common words in each array
  const positions1 = commonWords1.map((word) => words1.indexOf(word));
  const positions2 = commonWords1.map((word) => words2.indexOf(word));

  // Check if order is preserved (all words in same relative order)
  let orderPreserved = true;

  for (let i = 1; i < positions1.length; i++) {
    const prevDiff1 = positions1[i] - positions1[i - 1];
    const prevDiff2 = positions2[i] - positions2[i - 1];

    // If signs differ, order is not preserved
    if (
      (prevDiff1 > 0 && prevDiff2 <= 0) ||
      (prevDiff1 <= 0 && prevDiff2 > 0)
    ) {
      orderPreserved = false;
      break;
    }
  }

  // Calculate how many words are in the same relative position
  const commonWordCount = commonWords1.length;

  // Return a score based on common words and if order is preserved
  return (
    (commonWordCount / Math.max(words1.length, words2.length)) *
    (orderPreserved ? 1 : 0.7)
  ); // Penalty if order differs
}

/**
 * Check if a title contains the complete search term as a unit
 * Returns a score from 0-1 based on how significant the contained title is
 *
 * @param normalizedTitle - The normalized manga title
 * @param normalizedSearchTitle - The normalized search title
 * @returns Significance score (0-1) of how much of the title the search represents
 *
 * @example
 * ```typescript
 * containsCompleteTitle("one piece season 2", "one piece")
 * // Returns: 0.5 (search term is half the full title)
 * ```
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
 * Calculate word matching score between title and search words
 *
 * @param titleWords - Array of words from the manga title
 * @param searchWords - Array of words from the search query
 * @returns Word matching score or -1 if no sufficient match
 *
 * @example
 * ```typescript
 * calculateWordMatchScore(["one", "piece", "manga"], ["one", "piece"])
 * // Returns: 0.9 (high word match ratio)
 * ```
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
