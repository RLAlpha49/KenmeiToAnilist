/**
 * Blacklisted AniList manga titles that should never be surfaced to the user.
 * @module matching/filtering/blacklist
 */

import type { AniListManga } from "@/api/anilist/types";
import { getMatchConfig } from "@/utils/storage";

function getMangaTitles(manga: AniListManga): string[] {
  return [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
  ]
    .filter(Boolean)
    .map((title) => title!.trim().toLowerCase());
}

/**
 * @returns True if the manga matches any of the blacklisted titles.
 */
export function isBlacklistedManga(manga: AniListManga): boolean {
  const config = getMatchConfig();
  if (!config.blacklist?.enabled) {
    return false;
  }

  const normalizedBlacklist = new Set(
    config.blacklist.items
      .filter((item) => item.enabled)
      .map((item) => item.title.trim().toLowerCase()),
  );

  const titlesToCheck = getMangaTitles(manga);
  return titlesToCheck.some((title) => normalizedBlacklist.has(title));
}

/**
 * Remove blacklisted manga entries from a list of AniList results.
 */
export function filterOutBlacklistedManga(
  results: AniListManga[],
): AniListManga[] {
  if (results.length === 0) {
    return results;
  }

  const filtered = results.filter((manga) => !isBlacklistedManga(manga));

  if (filtered.length !== results.length) {
    console.debug(
      `[MangaSearchService] 🧹 Removed ${results.length - filtered.length} blacklisted AniList result(s)`,
    );
  }

  return filtered;
}
