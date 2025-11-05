/**
 * Skip rules for filtering manga during matching.
 * Handles exclusion based on format (light novels), automatic matching blacklists, and custom rules.
 * @module filtering/skip-rules
 * @source
 */

import type { AniListManga } from "../../anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import { shouldSkipByCustomRules } from "./custom-rules";

/**
 * Titles to ignore during automatic matching operations.
 * Excluded from automatic matching but may be included in manual searches.
 * @constant
 * @source
 */
const IGNORED_AUTOMATIC_MATCH_TITLES = new Set([
  "watashi, isekai de dorei ni sarechaimashita (naki) shikamo goshujinsama wa seikaku no warui elf no joousama (demo chou bijin ← koko daiji) munou sugite nonoshiraremakuru kedo douryou no orc ga iyashi-kei da shi sato no elf wa kawaii shi",
]);

/**
 * Checks if a manga should be ignored for automatic matching.
 * Checks against automatic matching blacklist (case-insensitive).
 * @param manga - The manga to check
 * @returns True if manga is in the automatic matching blacklist
 * @source
 */
export function shouldIgnoreForAutomaticMatching(manga: AniListManga): boolean {
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
 * Checks if a manga should be skipped during ranking.
 * Skips light novels, automatic matching blacklist entries, and custom skip rules.
 * @param manga - The manga to check
 * @param isManualSearch - Whether this is a manual search operation
 * @param kenmeiManga - Optional Kenmei manga for custom rule evaluation
 * @returns True if the manga should be skipped
 * @source
 */
export function shouldSkipManga(
  manga: AniListManga,
  isManualSearch: boolean,
  kenmeiManga?: KenmeiManga,
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

  // Check custom skip rules if kenmeiManga provided
  if (
    kenmeiManga &&
    shouldSkipByCustomRules(manga, kenmeiManga, isManualSearch)
  ) {
    console.debug(
      `[MangaSearchService] ⏭️ Skipping due to custom rule: ${manga.title?.romaji || manga.title?.english || "unknown"}`,
    );
    return true;
  }

  return false;
}
