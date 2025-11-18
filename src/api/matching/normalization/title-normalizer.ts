/**
 * Title normalization and processing utilities for manga matching.
 * Provides functions for consistent title comparison and collection across multiple sources.
 * @module normalization/title-normalizer
 */

import { AniListManga } from "../../anilist/types";
import { getCacheWarmer } from "./cache-warmer";

/**
 * Direct normalization for matching - checks cache first, then computes.
 * Converts to lowercase, removes punctuation and special characters, normalizes whitespace.
 * @param title - The title string to normalize.
 * @returns Normalized title (lowercase, no punctuation, single spaces).
 * @source
 */
export function normalizeForMatching(title: string): string {
  // Try to get from cache first
  const cacheWarmer = getCacheWarmer();
  const cached = cacheWarmer.getNormalizedTitle(
    title,
    "normalizeForMatching",
    normalizeForMatchingDirect,
  );
  if (cached) {
    console.debug(
      `[TitleNormalizer] ✅ Cache HIT for normalizeForMatching: "${title}" → "${cached}"`,
    );
    return cached;
  }

  // Cache miss - compute directly
  const result = normalizeForMatchingDirect(title);
  console.debug(
    `[TitleNormalizer] ⚠️ Cache MISS for normalizeForMatching: "${title}" → "${result}"`,
  );
  return result;
}

/**
 * Direct implementation of normalize-for-matching (no cache).
 * @internal
 */
function normalizeForMatchingDirect(title: string): string {
  return title
    .toLowerCase()
    .replaceAll("-", "") // Remove dashes consistently with processTitle logic
    .replaceAll(/[^\w\s]/g, "") // Remove remaining punctuation
    .replaceAll(/\s+/g, " ") // Normalize spaces (replace multiple spaces with a single space)
    .replaceAll("_", " ") // Replace underscores with spaces
    .trim();
}

/**
 * Processes a title by removing parentheses and normalizing special characters.
 * Handles Unicode quotes and common spacing issues. Checks cache first.
 * @param title - The title to process.
 * @returns Processed title with cleaned formatting and normalized quotes.
 * @source
 */
export function processTitle(title: string): string {
  // Try to get from cache first
  const cacheWarmer = getCacheWarmer();
  const cached = cacheWarmer.getNormalizedTitle(
    title,
    "processTitle",
    processTitleDirect,
  );
  if (cached) {
    console.debug(
      `[TitleNormalizer] ✅ Cache HIT for processTitle: "${title}" → "${cached}"`,
    );
    return cached;
  }

  // Cache miss - compute directly
  const result = processTitleDirect(title);
  console.debug(
    `[TitleNormalizer] ⚠️ Cache MISS for processTitle: "${title}" → "${result}"`,
  );
  return result;
}

/**
 * Direct implementation of processTitle (no cache).
 * @internal
 */
function processTitleDirect(title: string): string {
  const withoutParentheses = title.replaceAll(/\s*\([^()]*\)\s*/g, " ");

  return withoutParentheses
    .replaceAll("-", " ")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"')
    .replaceAll("\u201D", '"')
    .replaceAll("_", " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
}

/**
 * Creates normalized title variants from manga data for matching.
 * Processes English, Romaji, Native, and Synonym titles with source attribution. Uses cache.
 * @param manga - The manga data to extract titles from.
 * @returns Array of title objects with normalized text, source label, and original form.
 * @source
 */
export type NormalizedTitle = {
  text: string;
  source: string;
  original: string;
};

export function createNormalizedTitles(manga: AniListManga): NormalizedTitle[] {
  const normalizedTitles: NormalizedTitle[] = [];

  const addNormalizedTitle = (
    title: string | null | undefined,
    source: string,
  ) => {
    if (!title) return;

    // Get from cache if available
    const processedTitle = processTitle(title); // This now uses cache
    normalizedTitles.push({
      text: normalizeForMatching(processedTitle), // This now uses cache
      source,
      original: processedTitle,
    });
  };

  addNormalizedTitle(manga.title.english, "english");
  addNormalizedTitle(manga.title.romaji, "romaji");
  addNormalizedTitle(manga.title.native, "native");

  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const [index, synonym] of manga.synonyms.entries()) {
      addNormalizedTitle(synonym, `synonym_${index}`);
    }
  }

  return normalizedTitles;
}

/**
 * Collects all raw (non-normalized) title strings from manga data. Uses cache for consistency.
 * Includes English, Romaji, Native titles and all synonyms.
 * @param manga - The manga data to collect titles from.
 * @returns Array of all title strings in their original form.
 * @source
 */
export function collectMangaTitles(manga: AniListManga): string[] {
  const titles: string[] = [];
  const cacheWarmer = getCacheWarmer();

  const addRawTitle = (rawTitle: string | null | undefined) => {
    if (!rawTitle) return;
    // Cache the raw title for consistency
    cacheWarmer.getNormalizedTitle(
      rawTitle,
      "collectMangaTitles",
      () => rawTitle,
    );
    titles.push(rawTitle);
  };

  addRawTitle(manga.title.english);
  addRawTitle(manga.title.romaji);
  addRawTitle(manga.title.native);

  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const synonym of manga.synonyms) {
      addRawTitle(synonym);
    }
  }

  return titles;
}

/**
 * Checks if the difference between two titles is solely due to articles (a, an, the).
 * Useful for matching titles that differ only in article usage. Uses cache.
 * @param leftTitle - First title to compare.
 * @param rightTitle - Second title to compare.
 * @returns True if titles are identical except for article presence/absence.
 * @source
 */
export function isDifferenceOnlyArticles(
  leftTitle: string,
  rightTitle: string,
): boolean {
  const articles = new Set(["a", "an", "the"]);

  // Normalize both titles (now uses cache)
  const leftWords = normalizeForMatching(leftTitle)
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const rightWords = normalizeForMatching(rightTitle)
    .split(/\s+/)
    .filter((word) => word.length > 0);

  console.debug(
    `[MangaSearchService] 🔍 Checking article difference between "${leftTitle}" and "${rightTitle}"`,
  );
  console.debug(
    `[MangaSearchService]   Normalized: ["${leftWords.join('", "')}" vs ["${rightWords.join('", "')}"]`,
  );

  // Find the longer and shorter word arrays
  const [longer, shorter] =
    leftWords.length >= rightWords.length
      ? [leftWords, rightWords]
      : [rightWords, leftWords];

  // If they have the same number of words, they're not article-different
  if (longer.length === shorter.length) {
    console.debug(`[MangaSearchService]   Same length, not article difference`);
    return false;
  }

  // Remove all articles from both arrays and compare
  const longerWithoutArticles = longer.filter((word) => !articles.has(word));
  const shorterWithoutArticles = shorter.filter((word) => !articles.has(word));

  console.debug(
    `[MangaSearchService]   Without articles: ["${longerWithoutArticles.join('", "')}" vs ["${shorterWithoutArticles.join('", "')}"]`,
  );

  // If after removing articles, they're identical, then the difference was only articles
  const isArticleOnly =
    longerWithoutArticles.length === shorterWithoutArticles.length &&
    longerWithoutArticles.every(
      (word, index) => word === shorterWithoutArticles[index],
    );

  console.debug(
    `[MangaSearchService]   Article-only difference: ${isArticleOnly}`,
  );
  return isArticleOnly;
}
