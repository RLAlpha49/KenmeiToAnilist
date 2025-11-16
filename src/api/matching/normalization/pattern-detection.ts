/**
 * Pattern detection utilities for manga format and season/part detection.
 * Identifies one-shots and distinguishes season/part variants of series.
 * @module normalization/pattern-detection
 */

import { AniListManga } from "../../anilist/types";

/**
 * Checks if a manga is in one-shot format.
 * One-shots have format "ONE_SHOT", single chapter, or single volume.
 * @param manga - The manga data to check.
 * @returns True if the manga is a one-shot.
 * @source
 */
export function isOneShot(manga: AniListManga): boolean {
  return (
    manga.format === "ONE_SHOT" ||
    manga.chapters === 1 ||
    (manga.chapters === undefined && manga.volumes === 1)
  );
}

/**
 * Detects if two titles differ only by season/part/volume numbering patterns.
 * Supports Season, Part, Volume, Tome, Arc, and Cour patterns with Arabic and Roman numerals.
 * @param leftTitle - The title from Kenmei (or left-hand side).
 * @param rightTitle - The title from AniList (or right-hand side).
 * @returns Similarity score 0.95 if only season patterns differ, -1 if no pattern detected.
 * @source
 */
export function checkSeasonPattern(
  leftTitle: string,
  rightTitle: string,
): number {
  // Patterns to detect season/part/volume indicators
  const seasonPatterns = [
    // Basic season patterns
    /season\s+(\d+)/gi,
    /s(\d+)(?:\s|$)/gi,
    /saison\s+(\d+)/gi,

    // Part patterns
    /part\s+(\d+)/gi,
    /partie\s+(\d+)/gi,

    // Volume patterns
    /vol\.\s*(\d+)/gi,
    /volume\s+(\d+)/gi,

    // Tome patterns (French)
    /tome\s+(\d+)/gi,

    // Roman numerals (more comprehensive)
    /\b(?:season|part|tome|vol\.?|volume)?\s*([IVX]+)\b/gi,

    // Arc patterns
    /arc\s+(\d+)/gi,

    // Cour patterns (anime seasons)
    /cour\s+(\d+)/gi,
  ];

  // Check if either title contains any season pattern
  let hasLeftPattern = false;
  let hasRightPattern = false;

  for (const pattern of seasonPatterns) {
    if (pattern.test(leftTitle)) hasLeftPattern = true;
    if (pattern.test(rightTitle)) hasRightPattern = true;
  }

  // If only one has a season pattern, remove it and check similarity
  if (hasLeftPattern || hasRightPattern) {
    let cleanLeft = leftTitle;
    let cleanRight = rightTitle;

    // Remove all season patterns
    for (const pattern of seasonPatterns) {
      cleanLeft = cleanLeft.replaceAll(pattern, "").trim();
      cleanRight = cleanRight.replaceAll(pattern, "").trim();
    }

    // Normalize and compare
    const normalizedLeft = cleanLeft
      .toLowerCase()
      .replaceAll(/[^\w\s]/g, "")
      .trim();
    const normalizedRight = cleanRight
      .toLowerCase()
      .replaceAll(/[^\w\s]/g, "")
      .trim();
    if (normalizedLeft === normalizedRight) {
      return 0.95; // High similarity, just season difference
    }
  }

  return -1; // No season pattern detected
}

/**
 * Detects season patterns between titles with debug logging.
 * Wraps `checkSeasonPattern` to log matches when season/part/volume differences are found.
 * @param leftTitle - The title from Kenmei (or left-hand side).
 * @param rightTitle - The title from AniList (or right-hand side).
 * @returns Similarity score 0.95 if only season patterns differ, -1 if no pattern detected.
 * @source
 */
export function checkSeasonPatterns(
  leftTitle: string,
  rightTitle: string,
): number {
  const result = checkSeasonPattern(leftTitle, rightTitle);

  if (result > 0) {
    console.debug(
      `[MangaSearchService] 🎯 Season pattern match found: "${leftTitle}" ↔ "${rightTitle}" (score: ${result})`,
    );
    console.debug(
      `[MangaSearchService]   Likely same series with different season/part numbering`,
    );
  }

  return result;
}
