/**
 * Skip rules for filtering manga during matching.
 * Handles exclusion based on format (light novels), automatic matching blacklists, and custom rules.
 * @module filtering/skip-rules
 * @source
 */

import type { AniListManga } from "../../anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import { isBlacklistedManga } from "./blacklist";
import { shouldSkipByCustomRules } from "./custom-rules";

/**
 * Checks if a manga should be ignored for automatic matching.
 * Checks against automatic matching blacklist (case-insensitive).
 * @param manga - The manga to check
 * @returns True if manga is in the automatic matching blacklist
 * @source
 */
export function shouldIgnoreForAutomaticMatching(manga: AniListManga): boolean {
  return isBlacklistedManga(manga);
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

  if (isBlacklistedManga(manga)) {
    console.debug(
      `[MangaSearchService] ⏭️ Skipping blacklisted title: ${manga.title?.romaji || manga.title?.english || "unknown"}`,
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
