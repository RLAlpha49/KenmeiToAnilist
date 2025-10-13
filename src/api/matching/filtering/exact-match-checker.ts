/**
 * Exact match validation for filtering
 * @module filtering/exact-match-checker
 */

import type { AniListManga } from "../../anilist/types";
import { normalizeForMatching } from "../normalization";
import { calculateEnhancedSimilarity } from "../../../utils/enhanced-similarity";

/**
 * Check if a manga's titles match the search title exactly (or very closely)
 * @param manga - The manga to check
 * @param searchTitle - The search title to match against
 * @returns True if there's an exact or near-exact match
 */
export function checkExactMatch(
  manga: AniListManga,
  searchTitle: string,
): boolean {
  // Check all titles directly
  const titlesToCheck = [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
  ].filter(Boolean);

  for (const title of titlesToCheck) {
    if (!title) continue;

    // Check different variations of the title against the search
    // This catches cases where normalization might miss things
    const normalSearch = normalizeForMatching(searchTitle);
    const normalTitle = normalizeForMatching(title);

    // Check if titles are very similar after normalization
    // Increased threshold from 0.85 to 0.88 for stricter matching
    if (
      normalTitle === normalSearch ||
      calculateEnhancedSimilarity(normalTitle, normalSearch) > 88
    ) {
      console.debug(
        `[MangaSearchService] ✅ Found good title match: "${title}" for "${searchTitle}"`,
      );
      return true;
    }

    // Check each word in the search query against the title
    const searchWords = searchTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);
    const titleLower = title.toLowerCase();

    // If all important words from search are in the title, consider it a match
    const allWordsFound = searchWords.every((word) =>
      titleLower.includes(word),
    );
    // Require at least 2 words for this to be valid, otherwise matches might be too loose
    if (allWordsFound && searchWords.length >= 2) {
      console.debug(
        `[MangaSearchService] ✅ All search words found in title: "${title}"`,
      );
      return true;
    }
  }

  return false;
}
