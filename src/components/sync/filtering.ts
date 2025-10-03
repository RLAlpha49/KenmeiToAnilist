/**
 * @packageDocumentation
 * @module SyncPage/filtering
 * @description Filtering and sorting logic for manga matches
 */

import { MangaMatchResult, UserMediaList } from "../../api/anilist/types";
import { SyncConfig } from "../../utils/storage";
import { getEffectiveStatus } from "./sync-utils";
import { FilterOptions, SortOption } from "./types";

/**
 * Apply filters to manga matches
 */
export function filterMangaMatches(
  mangaMatches: MangaMatchResult[],
  filters: FilterOptions,
  userLibrary: UserMediaList,
  syncConfig: SyncConfig,
): MangaMatchResult[] {
  return mangaMatches
    .filter((match) => match.status === "matched" || match.status === "manual")
    .filter((match) => match.selectedMatch !== undefined)
    .filter((match) => {
      // Status filter
      const statusMap = {
        reading: "reading",
        completed: "completed",
        planned: "plan_to_read",
        paused: "on_hold",
        dropped: "dropped",
      } as const;

      const statusMatches =
        filters.status === "all" ||
        (statusMap as Record<string, string>)[filters.status] ===
          match.kenmeiManga.status.toLowerCase();

      if (!statusMatches) return false;

      // Changes filter
      if (filters.changes !== "all") {
        const anilist = match.selectedMatch!;
        const userEntry = userLibrary[anilist.id];

        const isCompletedAndPreserved =
          userEntry &&
          userEntry.status === "COMPLETED" &&
          syncConfig.preserveCompletedStatus;

        if (isCompletedAndPreserved) {
          if (filters.changes === "with-changes") return false;
        } else {
          // Use shared helper getChangeCount to calculate exact change count
          const changeCount = getChangeCount(match, userLibrary, syncConfig);
          const hasChanges = changeCount > 0;

          if (filters.changes === "with-changes" && !hasChanges) return false;
          if (filters.changes === "no-changes" && hasChanges) return false;
        }
      }

      // Library filter
      if (filters.library !== "all") {
        const anilist = match.selectedMatch!;
        const isNewEntry = !userLibrary[anilist.id];
        if (filters.library === "new" && !isNewEntry) return false;
        if (filters.library === "existing" && isNewEntry) return false;
      }

      return true;
    });
}

/**
 * Calculate change count for a manga match
 */
function getChangeCount(
  match: MangaMatchResult,
  userLibrary: UserMediaList,
  syncConfig: SyncConfig,
): number {
  const anilist = match.selectedMatch!;
  const kenmei = match.kenmeiManga;
  const userEntry = userLibrary[anilist.id];
  const isCompleted =
    userEntry &&
    userEntry.status === "COMPLETED" &&
    syncConfig.preserveCompletedStatus;

  if (isCompleted) return 0;
  if (!userEntry) return 3; // New entry, all fields will change

  const statusWillChange =
    !syncConfig.prioritizeAniListStatus &&
    getEffectiveStatus(kenmei, syncConfig) !== userEntry.status;

  const progressWillChange = syncConfig.prioritizeAniListProgress
    ? (kenmei.chapters_read || 0) > (userEntry.progress || 0)
    : (kenmei.chapters_read || 0) !== (userEntry.progress || 0);

  const anilistScore = Number(userEntry.score);
  const kenmeiScore = Number(kenmei.score || 0);

  const scoreWillChange =
    !syncConfig.prioritizeAniListScore &&
    kenmei.score > 0 &&
    (anilistScore === 0 || Math.abs(kenmeiScore - anilistScore) >= 0.5);

  // Check if privacy will change
  const privacyWillChange = syncConfig.setPrivate && !userEntry.private;

  return (
    (statusWillChange ? 1 : 0) +
    (progressWillChange ? 1 : 0) +
    (scoreWillChange ? 1 : 0) +
    (privacyWillChange ? 1 : 0)
  );
}

/**
 * Sort filtered manga matches
 */
export function sortMangaMatches(
  filteredMatches: MangaMatchResult[],
  sortOption: SortOption,
  userLibrary: UserMediaList,
  syncConfig: SyncConfig,
): MangaMatchResult[] {
  return [...filteredMatches].sort((a, b) => {
    const anilistA = a.selectedMatch!;
    const anilistB = b.selectedMatch!;
    const kenmeiA = a.kenmeiManga;
    const kenmeiB = b.kenmeiManga;

    // Sort based on the selected field
    let comparison = 0;

    switch (sortOption.field) {
      case "title":
        comparison = (anilistA.title.romaji || kenmeiA.title).localeCompare(
          anilistB.title.romaji || kenmeiB.title,
        );
        break;
      case "status":
        comparison = kenmeiA.status.localeCompare(kenmeiB.status);
        break;
      case "progress":
        comparison =
          (kenmeiA.chapters_read || 0) - (kenmeiB.chapters_read || 0);
        break;
      case "score":
        comparison = (kenmeiA.score || 0) - (kenmeiB.score || 0);
        break;
      case "changes":
        comparison =
          getChangeCount(b, userLibrary, syncConfig) -
          getChangeCount(a, userLibrary, syncConfig);
        break;
    }

    // Apply sort direction
    return sortOption.direction === "asc" ? comparison : -comparison;
  });
}
