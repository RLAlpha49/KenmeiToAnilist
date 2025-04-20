/**
 * Matcher for Kenmei manga to AniList entries
 */

import { KenmeiManga } from "./types";
import { AniListManga } from "../anilist/types";

/**
 * Calculate string similarity using Levenshtein distance
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Levenshtein distance implementation
  const len1 = s1.length;
  const len2 = s2.length;

  // Initialize matrix
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(null));

  // Fill first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  // Calculate similarity based on distance
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0; // Both strings are empty

  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

/**
 * Score a potential match between Kenmei manga and AniList entry
 * @param kenmeiManga The Kenmei manga entry
 * @param anilistManga The AniList manga entry
 * @returns Match confidence score between 0 and 1
 */
export function scoreMatch(
  kenmeiManga: KenmeiManga,
  anilistManga: AniListManga,
): number {
  const title = kenmeiManga.title.toLowerCase();

  // Try all available titles
  const scores: number[] = [];

  if (anilistManga.title.romaji) {
    scores.push(calculateSimilarity(title, anilistManga.title.romaji));
  }

  if (anilistManga.title.english) {
    scores.push(calculateSimilarity(title, anilistManga.title.english));
  }

  if (anilistManga.title.native) {
    scores.push(calculateSimilarity(title, anilistManga.title.native));
  }

  // Return the best match score
  return scores.length > 0 ? Math.max(...scores) : 0;
}

/**
 * Find the best match for a Kenmei manga in the AniList entries
 * @param kenmeiManga The Kenmei manga to match
 * @param anilistManga Array of potential AniList matches
 * @param threshold Minimum similarity threshold (0-1)
 * @returns The best matching AniList entry and its score, or null if no good match
 */
export function findBestMatch(
  kenmeiManga: KenmeiManga,
  anilistManga: AniListManga[],
  threshold = 0.7,
): { manga: AniListManga; score: number } | null {
  if (!anilistManga.length) return null;

  const matches = anilistManga.map((manga) => ({
    manga,
    score: scoreMatch(kenmeiManga, manga),
  }));

  // Sort by score (descending)
  matches.sort((a, b) => b.score - a.score);

  // Return best match if it meets the threshold
  return matches[0].score >= threshold ? matches[0] : null;
}
