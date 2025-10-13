/**
 * @file Manga result ranking and filtering
 * @module matching/orchestration/ranking
 */

import type { AniListManga } from "@/api/anilist/types";
import { calculateMatchScore } from "../scoring";
import { calculateEnhancedSimilarity } from "@/utils/enhanced-similarity";

// Titles to ignore during automatic matching (but allow in manual searches)
const IGNORED_AUTOMATIC_MATCH_TITLES = new Set([
  "watashi, isekai de dorei ni sarechaimashita (naki) shikamo goshujinsama wa seikaku no warui elf no joousama (demo chou bijin ← koko daiji) munou sugite nonoshiraremakuru kedo douryou no orc ga iyashi-kei da shi sato no elf wa kawaii shi",
]);

/**
 * Normalize a string for matching by removing punctuation and standardizing case
 * Preserves word boundaries to maintain distinction between separate words
 * @param str - The string to normalize
 * @returns Normalized string suitable for matching
 */
function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .replaceAll("-", "") // Remove dashes consistently with processTitle logic
    .replaceAll(/[^\w\s]/g, "") // Remove remaining punctuation
    .replaceAll(/\s+/g, " ") // Normalize spaces (replace multiple spaces with a single space)
    .replaceAll("_", " ") // Replace underscores with spaces
    .trim();
}

/**
 * Check if a manga should be ignored during automatic matching
 * @param manga - The manga to check
 * @returns True if the manga should be ignored during automatic matching
 */
function shouldIgnoreForAutomaticMatching(manga: AniListManga): boolean {
  // Get all titles to check (main titles + synonyms)
  const titlesToCheck = [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
  ].filter(Boolean) as string[];

  // Check if any title matches ignored titles (case-insensitive)
  return titlesToCheck.some((title) =>
    IGNORED_AUTOMATIC_MATCH_TITLES.has(title.toLowerCase()),
  );
}

/**
 * Check if a manga should be skipped during ranking
 * @param manga - The manga to check
 * @param isManualSearch - Whether this is a manual search operation
 * @returns True if the manga should be skipped
 */
function shouldSkipManga(
  manga: AniListManga,
  isManualSearch: boolean,
): boolean {
  // Skip Light Novels
  if (manga.format === "NOVEL" || manga.format === "LIGHT_NOVEL") {
    console.debug(
      `[MangaSearchService] ⏭️ Skipping light novel: ${manga.title?.romaji || manga.title?.english || "unknown"}`,
    );
    return true;
  }

  // Skip ignored titles for automatic matching (but allow for manual searches)
  if (!isManualSearch && shouldIgnoreForAutomaticMatching(manga)) {
    console.debug(
      `[MangaSearchService] ⏭️ Skipping ignored title for automatic matching: ${manga.title?.romaji || manga.title?.english || "unknown"}`,
    );
    return true;
  }

  return false;
}

/**
 * Check if a title matches in exact matching mode
 */
function checkExactMatch(manga: AniListManga, searchTitle: string): boolean {
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

/**
 * Evaluate if a manga should be included based on its score in exact matching mode
 */
function shouldIncludeMangaExact(
  manga: AniListManga,
  score: number,
  searchTitle: string,
  results: AniListManga[],
): { include: boolean; adjustedScore: number } {
  console.debug(
    `[MangaSearchService] 🔍 Checking titles for exact match against "${searchTitle}"`,
  );

  // In exact matching mode, do a thorough check of all titles
  // This ensures we don't miss matches due to normalization differences
  const foundGoodMatch = checkExactMatch(manga, searchTitle);

  // If this is an exact match run and we have a good score or manually found a good match
  // Increased threshold from 0.5 to 0.6 for stricter inclusion
  if (score > 0.6 || foundGoodMatch || results.length <= 2) {
    console.debug(
      `[MangaSearchService] ✅ Including manga "${manga.title?.romaji || manga.title?.english}" with score: ${score}`,
    );
    return {
      include: true,
      adjustedScore: foundGoodMatch ? Math.max(score, 0.75) : score,
    };
  } else {
    console.debug(
      `[MangaSearchService] ❌ Excluding manga "${manga.title?.romaji || manga.title?.english}" with score: ${score} (below threshold)`,
    );
    return { include: false, adjustedScore: score };
  }
}

/**
 * Evaluate if a manga should be included based on its score in regular matching mode
 */
function shouldIncludeMangaRegular(
  manga: AniListManga,
  score: number,
  results: AniListManga[],
): { include: boolean; adjustedScore: number } {
  if (score > 0.15 || results.length <= 2) {
    console.debug(
      `[MangaSearchService] ✅ Including manga "${manga.title?.romaji || manga.title?.english}" with score: ${score}`,
    );
    return { include: true, adjustedScore: score };
  } else {
    console.debug(
      `[MangaSearchService] ❌ Excluding manga "${manga.title?.romaji || manga.title?.english}" with score: ${score} (below threshold)`,
    );
    return { include: false, adjustedScore: score };
  }
}

/**
 * Core ranking logic shared between exact and regular ranking
 */
function rankMangaCore(
  results: AniListManga[],
  searchTitle: string,
  isManualSearch: boolean,
  includeMangaFn: (
    manga: AniListManga,
    score: number,
  ) => { include: boolean; adjustedScore: number },
): AniListManga[] {
  const scoredResults: Array<{ manga: AniListManga; score: number }> = [];

  // Score each manga result
  for (const manga of results) {
    // Check if manga should be skipped
    if (shouldSkipManga(manga, isManualSearch)) {
      continue;
    }

    const score = calculateMatchScore(manga, searchTitle);

    // Evaluate if manga should be included using the provided function
    const { include, adjustedScore } = includeMangaFn(manga, score);

    if (include) {
      scoredResults.push({ manga, score: adjustedScore });
    }
  }

  // Sort by score (descending)
  scoredResults.sort((a, b) => b.score - a.score);

  // Always include at least one result if available, even with low score
  if (scoredResults.length === 0 && results.length > 0) {
    console.debug(
      `[MangaSearchService] 🔄 No results matched score threshold but including top result anyway`,
    );
    const bestGuess = results[0];
    scoredResults.push({
      manga: bestGuess,
      score: 0.1, // Very low confidence
    });
  }

  console.debug(
    `[MangaSearchService] 🏆 Ranked results: ${scoredResults.length} manga after filtering and ranking`,
  );

  // Return just the manga objects, preserving the new order
  return scoredResults.map((item) => item.manga);
}

/**
 * Filter and rank manga results by match quality
 *
 * @param results - Array of manga results to rank
 * @param searchTitle - Original search title
 * @param exactMatchingOnly - Whether to use exact matching mode
 * @param isManualSearch - Whether this is a manual search (affects filtering)
 * @returns Ranked array of manga results
 */
export function rankMangaResults(
  results: AniListManga[],
  searchTitle: string,
  exactMatchingOnly: boolean,
  isManualSearch: boolean = false,
): AniListManga[] {
  const includeMangaFn = exactMatchingOnly
    ? (manga: AniListManga, score: number) =>
        shouldIncludeMangaExact(manga, score, searchTitle, results)
    : (manga: AniListManga, score: number) =>
        shouldIncludeMangaRegular(manga, score, results);

  return rankMangaCore(results, searchTitle, isManualSearch, includeMangaFn);
}
