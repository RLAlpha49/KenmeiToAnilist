/**
 * @packageDocumentation
 * @module Matching/Scoring/TitlePriority
 * @description Title type priority calculation for sorting matches
 */

import { AniListManga } from "../../anilist/types";
import { normalizeForMatching } from "../normalization";
import { calculateEnhancedSimilarity } from "../../../utils/enhanced-similarity";

/**
 * Calculate similarity score between a title and normalized search term
 *
 * @param title - The title to calculate similarity for (can be null/undefined)
 * @param normalizedSearch - The normalized search term
 * @returns Object containing similarity score and title type
 *
 * @internal
 */
function calculateTitleSimilarity(
  title: string | null | undefined,
  normalizedSearch: string,
): { similarity: number; titleType: string } {
  if (!title) {
    return { similarity: 0, titleType: "unknown" };
  }

  const similarity = calculateEnhancedSimilarity(
    normalizeForMatching(title),
    normalizedSearch,
  );

  return { similarity, titleType: "title" };
}

/**
 * Calculate title type priority for sorting when confidence scores are equal
 * Returns a priority score where higher numbers indicate higher priority
 * English/Romaji main titles get highest priority, synonyms get lowest priority
 *
 * @param manga - The manga to calculate priority for
 * @param searchTitle - The search title used for matching
 * @returns Priority score (higher = more important title type)
 *
 * @example
 * ```typescript
 * calculateTitleTypePriority(manga, "One Piece")
 * // Returns: 100 (if matched on English title)
 * // Returns: 90 (if matched on Romaji title)
 * // Returns: 70 (if matched on synonym)
 * ```
 */
export function calculateTitleTypePriority(
  manga: AniListManga,
  searchTitle: string,
): number {
  const normalizedSearch = normalizeForMatching(searchTitle);

  // Define title types with their priority scores
  const titleTypes = [
    { title: manga.title?.english, type: "english" },
    { title: manga.title?.romaji, type: "romaji" },
    { title: manga.title?.native, type: "native" },
  ];

  let bestMatchType = "synonym"; // Default to lowest priority
  let bestSimilarity = 0;

  // Check main titles (English, Romaji, Native)
  for (const { title, type } of titleTypes) {
    const { similarity } = calculateTitleSimilarity(title, normalizedSearch);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatchType = type;
    }
  }

  // Check synonyms (lowest priority)
  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const synonym of manga.synonyms) {
      const { similarity } = calculateTitleSimilarity(
        synonym,
        normalizedSearch,
      );
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatchType = "synonym";
      }
    }
  }

  // Return priority score based on title type
  const priorityMap: Record<string, number> = {
    english: 100,
    romaji: 90,
    native: 80,
    synonym: 70,
  };

  return priorityMap[bestMatchType] ?? 60;
}
