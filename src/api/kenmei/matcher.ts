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
  const title = kenmeiManga.title?.toLowerCase() ?? "";

  if (!title) return 0;

  // Collect available AniList titles and compute similarity scores in a compact way
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
    // short-circuit if perfect match
    if (best >= 1) return 1;
  }

  return best;
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
  if (!anilistManga?.length) return null;

  // Compute scores and keep only ones that meet threshold early
  const scored = [] as { manga: AniListManga; score: number }[];

  for (const manga of anilistManga) {
    const score = scoreMatch(kenmeiManga, manga);
    if (score <= 0) continue;
    scored.push({ manga, score });
  }

  if (!scored.length) return null;

  // Find the highest scored match without allocating extra arrays via sort
  let best = scored[0];
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].score > best.score) best = scored[i];
  }

  return best.score >= threshold ? best : null;
}
