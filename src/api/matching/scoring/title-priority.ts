/**
 * @packageDocumentation
 * @module Matching/Scoring/TitlePriority
 * @description Title type priority calculation for sorting matches with equal confidence.
 * Prioritizes official titles (English > Romaji > Native) over synonyms.
 */

import { AniListManga } from "../../anilist/types";
import { normalizeForMatching } from "../normalization";
import { calculateEnhancedSimilarity } from "../../../utils/enhanced-similarity";

/**
 * Calculate similarity score between a title and normalized search term.
 * Returns zero similarity for null/undefined titles.
 *
 * @param title - The title to calculate similarity for (can be null/undefined)
 * @param normalizedSearch - The normalized search term
 * @returns Object with similarity score (0-1) and generic title type identifier
 * @source
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
 * Calculate title type priority for sorting matches with equal confidence.
 * Prioritizes official title types (English: 100 > Romaji: 90 > Native: 80) over synonyms (70).
 * Fallback priority is 60.
 *
 * @param manga - The manga to calculate priority for
 * @param searchTitle - The search title used for matching
 * @returns Priority score where higher values indicate higher importance (60-100)
 * @source
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
