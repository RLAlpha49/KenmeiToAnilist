/**
 * @packageDocumentation
 * @module kenmei-matcher
 * @description Matcher for Kenmei manga to AniList entries, including similarity scoring and best match finding utilities.
 */

import { KenmeiManga } from "./types";
import { AniListManga } from "../anilist/types";
import { calculateEnhancedSimilarity } from "../../utils/enhanced-similarity";

/**
 * Calculate string similarity score normalized to 0-1 scale using enhanced algorithms.
 * @param str1 - First string to compare.
 * @param str2 - Second string to compare.
 * @returns Similarity score between 0 (no match) and 1 (perfect match).
 * @source
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  // Use enhanced similarity calculation normalized to 0-1 scale
  return calculateEnhancedSimilarity(str1, str2) / 100;
}

/**
 * Score a match between Kenmei and AniList manga by comparing available titles.
 * @param kenmeiManga - The Kenmei manga entry to score.
 * @param anilistManga - The AniList manga entry to compare against.
 * @returns Match confidence score between 0 and 1, where 1 is a perfect match.
 * @source
 */
export function scoreMatch(
  kenmeiManga: KenmeiManga,
  anilistManga: AniListManga,
): number {
  const title = kenmeiManga.title?.toLowerCase() ?? "";

  if (!title) return 0;

  // Compare against all available AniList titles and return highest score
  const candidateTitles = [
    anilistManga.title?.romaji,
    anilistManga.title?.english,
    anilistManga.title?.native,
  ];

  let best = 0;

  for (const candidate of candidateTitles) {
    if (!candidate) continue;
    const score = calculateSimilarity(title, candidate);
    if (score > best) best = score;
    // Short-circuit on perfect match
    if (best >= 1) return 1;
  }

  return best;
}

/**
 * Find the best matching AniList manga for a Kenmei entry based on title similarity.
 * @param kenmeiManga - The Kenmei manga to match.
 * @param anilistManga - Array of potential AniList matches to evaluate.
 * @param threshold - Minimum similarity threshold (0-1, default: 0.7).
 * @returns Best match above threshold with confidence score, or null if no match qualifies.
 * @source
 */
export function findBestMatch(
  kenmeiManga: KenmeiManga,
  anilistManga: AniListManga[],
  threshold = 0.7,
): { manga: AniListManga; score: number } | null {
  if (!anilistManga?.length) return null;

  // Score all entries and filter above threshold early
  const scored = [] as { manga: AniListManga; score: number }[];

  for (const manga of anilistManga) {
    const score = scoreMatch(kenmeiManga, manga);
    if (score <= 0) continue;
    scored.push({ manga, score });
  }

  if (!scored.length) return null;

  // Find highest scored match without allocating extra arrays
  let best = scored[0];
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].score > best.score) best = scored[i];
  }

  return best.score >= threshold ? best : null;
}
