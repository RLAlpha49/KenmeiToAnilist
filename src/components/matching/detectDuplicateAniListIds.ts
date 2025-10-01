import { MangaMatchResult } from "../../api/anilist/types";
import { getIgnoredDuplicates } from "../../utils/storage";
import { DuplicateEntry } from "./DuplicateWarning";

export function detectDuplicateAniListIds(
  matches: MangaMatchResult[],
): DuplicateEntry[] {
  const anilistIdMap = new Map<
    number,
    { title: string; kenmeiTitles: string[] }
  >();

  // Collect all accepted matches with their AniList IDs
  for (const match of matches) {
    if (
      (match.status === "matched" || match.status === "manual") &&
      match.selectedMatch
    ) {
      const anilistId = match.selectedMatch.id;
      const anilistTitle =
        match.selectedMatch.title.romaji ||
        match.selectedMatch.title.english ||
        "Unknown Title";
      const kenmeiTitle = match.kenmeiManga.title;

      if (anilistIdMap.has(anilistId)) {
        // This AniList ID is already mapped to another Kenmei manga
        const existing = anilistIdMap.get(anilistId)!;
        existing.kenmeiTitles.push(kenmeiTitle);
      } else {
        // First time seeing this AniList ID
        anilistIdMap.set(anilistId, {
          title: anilistTitle,
          kenmeiTitles: [kenmeiTitle],
        });
      }
    }
  }

  // Find duplicates (AniList IDs mapped to multiple Kenmei titles)
  const duplicates: DuplicateEntry[] = [];
  const ignoredDuplicates = getIgnoredDuplicates();
  const ignoredIds = new Set(ignoredDuplicates.map((item) => item.anilistId));

  for (const [anilistId, value] of anilistIdMap) {
    if (value.kenmeiTitles.length > 1 && !ignoredIds.has(anilistId)) {
      duplicates.push({
        anilistId,
        anilistTitle: value.title,
        kenmeiTitles: value.kenmeiTitles,
      });
    }
  }

  return duplicates;
}
