/**
 * @packageDocumentation
 * @module kenmei-matcher
 * @description Matcher for Kenmei manga to AniList entries, including similarity scoring and best match finding utilities.
 */

import { KenmeiManga } from "./types";
import { AniListManga } from "../anilist/types";
import { calculateEnhancedSimilarity } from "../../utils/enhanced-similarity";

/**
 * Calculate string similarity using enhanced algorithms
 *
 * @param str1 - First string.
 * @param str2 - Second string.
 * @returns Similarity score between 0 and 1
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  // Use the enhanced similarity calculation and convert to 0-1 scale
  return calculateEnhancedSimilarity(str1, str2) / 100;
}

/**
 * Score a potential match between Kenmei manga and AniList entry
 *
 * @param kenmeiManga - The Kenmei manga entry.
 * @param anilistManga - The AniList manga entry.
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
 *
 * @param kenmeiManga - The Kenmei manga to match.
 * @param anilistManga - Array of potential AniList matches.
 * @param threshold - Minimum similarity threshold (0-1).
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
