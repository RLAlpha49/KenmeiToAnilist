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
 * @param str - The title string to normalize.
 * @returns Normalized title (lowercase, no punctuation, single spaces).
 * @source
 */
export function normalizeForMatching(str: string): string {
  // Try to get from cache first
  const cacheWarmer = getCacheWarmer();
  const cached = cacheWarmer.getNormalizedTitle(
    str,
    "normalizeForMatching",
    normalizeForMatchingDirect,
  );
  if (cached) {
    console.debug(
      `[TitleNormalizer] ✅ Cache HIT for normalizeForMatching: "${str}" → "${cached}"`,
    );
    return cached;
  }

  // Cache miss - compute directly
  const result = normalizeForMatchingDirect(str);
  console.debug(
    `[TitleNormalizer] ⚠️ Cache MISS for normalizeForMatching: "${str}" → "${result}"`,
  );
  return result;
}

/**
 * Direct implementation of normalize-for-matching (no cache).
 * @internal
 */
function normalizeForMatchingDirect(str: string): string {
  return str
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
export function createNormalizedTitles(
  manga: AniListManga,
): { text: string; source: string; original: string }[] {
  const allTitles: { text: string; source: string; original: string }[] = [];

  const pushTitle = (title: string | null | undefined, source: string) => {
    if (!title) return;

    // Get from cache if available
    const processedTitle = processTitle(title); // This now uses cache
    allTitles.push({
      text: normalizeForMatching(processedTitle), // This now uses cache
      source,
      original: processedTitle,
    });
  };

  pushTitle(manga.title.english, "english");
  pushTitle(manga.title.romaji, "romaji");
  pushTitle(manga.title.native, "native");

  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const [index, synonym] of manga.synonyms.entries()) {
      pushTitle(synonym, `synonym_${index}`);
    }
  }

  return allTitles;
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

  const addTitle = (rawTitle: string | null | undefined) => {
    if (!rawTitle) return;
    // Cache the raw title for consistency
    cacheWarmer.getNormalizedTitle(
      rawTitle,
      "collectMangaTitles",
      () => rawTitle,
    );
    titles.push(rawTitle);
  };

  addTitle(manga.title.english);
  addTitle(manga.title.romaji);
  addTitle(manga.title.native);

  if (manga.synonyms && Array.isArray(manga.synonyms)) {
    for (const synonym of manga.synonyms) {
      addTitle(synonym);
    }
  }

  return titles;
}

/**
 * Checks if the difference between two titles is solely due to articles (a, an, the).
 * Useful for matching titles that differ only in article usage. Uses cache.
 * @param title1 - First title to compare.
 * @param title2 - Second title to compare.
 * @returns True if titles are identical except for article presence/absence.
 * @source
 */
export function isDifferenceOnlyArticles(
  title1: string,
  title2: string,
): boolean {
  const articles = new Set(["a", "an", "the"]);

  // Normalize both titles (now uses cache)
  const norm1 = normalizeForMatching(title1)
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const norm2 = normalizeForMatching(title2)
    .split(/\s+/)
    .filter((word) => word.length > 0);

  console.debug(
    `[MangaSearchService] 🔍 Checking article difference between "${title1}" and "${title2}"`,
  );
  console.debug(
    `[MangaSearchService]   Normalized: ["${norm1.join('", "')}" vs ["${norm2.join('", "')}"]`,
  );

  // Find the longer and shorter word arrays
  const [longer, shorter] =
    norm1.length >= norm2.length ? [norm1, norm2] : [norm2, norm1];

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
