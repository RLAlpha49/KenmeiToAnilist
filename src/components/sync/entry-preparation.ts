/**
 * @packageDocumentation
 * @module SyncPage/entry-preparation
 * @description Logic for preparing sync entries from manga matches
 */

import {
  AniListMediaEntry,
  MangaMatchResult,
  MediaListStatus,
  UserMediaList,
} from "../../api/anilist/types";
import { SyncConfig } from "../../utils/storage";
import { getEffectiveStatus, KenmeiMangaData } from "./sync-utils";

/**
 * Compute all entries to sync (unfiltered, all with changes)
 */
export function prepareAllEntriesToSync(
  mangaMatches: MangaMatchResult[],
  userLibrary: UserMediaList,
  syncConfig: SyncConfig,
): AniListMediaEntry[] {
  return mangaMatches
    .filter((match) => match.status === "matched" || match.status === "manual")
    .filter((match) => match.selectedMatch !== undefined)
    .map((match) => {
      // Get Kenmei data
      const kenmei = match.kenmeiManga;
      const anilist = match.selectedMatch!;
      const userEntry = userLibrary[anilist.id];
      if (
        userEntry &&
        userEntry.status === "COMPLETED" &&
        syncConfig.preserveCompletedStatus
      ) {
        return null;
      }

      const computeCalculatedStatus = (): MediaListStatus => {
        // Reuse existing getEffectiveStatus logic which already handles auto-pause checks
        const km: KenmeiMangaData = {
          status: kenmei.status,
          updated_at: kenmei.updated_at,
          last_read_at: kenmei.last_read_at,
          title: kenmei.title,
          chapters_read: kenmei.chapters_read,
          score: kenmei.score,
        };
        return getEffectiveStatus(km, syncConfig);
      };
      const calculatedStatus = computeCalculatedStatus();
      let privateStatus: boolean;
      if (userEntry) {
        if (syncConfig.setPrivate) {
          privateStatus = true;
        } else {
          privateStatus = userEntry.private || false;
        }
      } else {
        privateStatus = syncConfig.setPrivate;
      }
      const entry: AniListMediaEntry = {
        mediaId: anilist.id,
        status:
          syncConfig.prioritizeAniListStatus && userEntry?.status
            ? (userEntry.status as MediaListStatus)
            : calculatedStatus,
        progress: (() => {
          if (
            syncConfig.prioritizeAniListProgress &&
            userEntry?.progress &&
            userEntry.progress > 0
          ) {
            const kenmeiProgress = kenmei.chapters_read || 0;
            return Math.max(userEntry.progress, kenmeiProgress);
          }
          return kenmei.chapters_read || 0;
        })(),
        private: privateStatus,
        score: (() => {
          if (
            userEntry &&
            syncConfig.prioritizeAniListScore &&
            userEntry.score > 0
          ) {
            return userEntry.score;
          }
          return typeof kenmei.score === "number" ? kenmei.score : 0;
        })(),
        previousValues: userEntry
          ? {
              status: userEntry.status,
              progress:
                typeof userEntry.progress === "number" ? userEntry.progress : 0,
              score: typeof userEntry.score === "number" ? userEntry.score : 0,
              private: userEntry.private || false,
            }
          : null,
        title: anilist.title.romaji || kenmei.title,
        coverImage: anilist.coverImage?.large || anilist.coverImage?.medium,
      };
      entry.private ??= syncConfig.setPrivate || false;
      return entry;
    })
    .filter((entry): entry is AniListMediaEntry => entry !== null);
}

/**
 * Check if an entry has actual changes that need to be synced
 */
export function hasChanges(
  entry: AniListMediaEntry,
  syncConfig: SyncConfig,
): boolean {
  // New entry: not in userLibrary
  if (!entry.previousValues) return true;

  // Completed and preserve setting: skip
  if (
    entry.previousValues.status === "COMPLETED" &&
    syncConfig.preserveCompletedStatus
  ) {
    return false;
  }

  // Status change
  const statusWillChange = syncConfig.prioritizeAniListStatus
    ? false
    : entry.status !== entry.previousValues.status;

  // Progress change
  const progressWillChange = syncConfig.prioritizeAniListProgress
    ? entry.progress > entry.previousValues.progress
    : entry.progress !== entry.previousValues.progress;

  // Score change
  const anilistScore = Number(entry.previousValues.score || 0);
  const kenmeiScore = Number(entry.score || 0);
  const scoreWillChange =
    entry.previousValues.status === "COMPLETED" &&
    syncConfig.preserveCompletedStatus
      ? false
      : (() => {
          if (syncConfig.prioritizeAniListScore && anilistScore > 0) {
            return false;
          }
          return (
            kenmeiScore > 0 &&
            (anilistScore === 0 || Math.abs(kenmeiScore - anilistScore) >= 0.5)
          );
        })();

  // Privacy change
  const privacyWillChange =
    syncConfig.setPrivate && !entry.previousValues.private;

  return (
    statusWillChange ||
    progressWillChange ||
    scoreWillChange ||
    privacyWillChange
  );
}
