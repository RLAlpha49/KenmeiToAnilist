/**
 * @file Manga result ranking and filtering
 * @module matching/orchestration/ranking
 */

import type { AniListManga } from "@/api/anilist/types";
import { calculateMatchScore } from "../scoring";
import {
  shouldIncludeMangaExact,
  shouldIncludeMangaRegular,
} from "../filtering/inclusion-rules";

// Titles to ignore during automatic matching (but allow in manual searches)
const IGNORED_AUTOMATIC_MATCH_TITLES = new Set([
  "watashi, isekai de dorei ni sarechaimashita (naki) shikamo goshujinsama wa seikaku no warui elf no joousama (demo chou bijin ← koko daiji) munou sugite nonoshiraremakuru kedo douryou no orc ga iyashi-kei da shi sato no elf wa kawaii shi",
]);

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
