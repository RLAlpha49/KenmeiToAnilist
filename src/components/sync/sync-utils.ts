/**
 * @packageDocumentation
 * @module SyncPage/sync-utils
 * @description Utility functions for sync calculations
 */

import { MediaListStatus } from "../../api/anilist/types";
import { STATUS_MAPPING, KenmeiStatus } from "../../api/kenmei/types";
import { SyncConfig } from "../../utils/storage";

/**
 * Kenmei manga data structure for status calculation.
 * @property status - Reading status in Kenmei.
 * @property updated_at - Last update timestamp.
 * @property last_read_at - Last read timestamp (optional).
 * @property title - Manga title.
 * @property chapters_read - Number of chapters read (optional).
 * @property score - User rating (optional).
 * @source
 */
export interface KenmeiMangaData {
  status: string;
  updated_at: string;
  last_read_at?: string;
  title: string;
  chapters_read?: number;
  score?: number;
}

/**
 * User entry data structure from AniList.
 * @property status - Current reading status.
 * @property progress - Current chapter progress.
 * @property score - User rating (0-10).
 * @property private - Privacy setting.
 * @source
 */
export interface UserEntryData {
  status: string;
  progress: number;
  score: number;
  private: boolean;
}

/**
 * Result of sync change calculation.
 * @property statusWillChange - Whether status will change.
 * @property progressWillChange - Whether progress will change.
 * @property scoreWillChange - Whether score will change.
 * @property isNewEntry - Whether entry is new to the library.
 * @property isCompleted - Whether entry is completed and preserved.
 * @property changeCount - Total number of fields that will change.
 * @source
 */
export interface SyncChangesResult {
  statusWillChange: boolean;
  progressWillChange: boolean;
  scoreWillChange: boolean;
  isNewEntry: boolean;
  isCompleted: boolean;
  changeCount: number;
}

/**
 * Calculate the effective status for a manga entry, considering auto-pause settings.
 * If auto-pause is enabled and inactivity threshold is exceeded, returns PAUSED status.
 * @param kenmei - Kenmei manga data with status and activity timestamps.
 * @param syncConfig - Sync configuration with auto-pause settings.
 * @returns The effective AniList media status (may be auto-paused).
 * @throws Does not throw; logs warnings for invalid dates or thresholds.
 * @source
 */
export function getEffectiveStatus(
  kenmei: KenmeiMangaData,
  syncConfig: SyncConfig,
): MediaListStatus {
  // Check if manga should be auto-paused due to inactivity
  const lastActivity = kenmei.last_read_at || kenmei.updated_at;
  if (
    syncConfig.autoPauseInactive &&
    kenmei.status.toLowerCase() !== "completed" &&
    kenmei.status.toLowerCase() !== "dropped" &&
    lastActivity
  ) {
    // Calculate how many days since the last activity
    const lastUpdated = new Date(lastActivity);

    // Validate the parsed date
    if (Number.isNaN(lastUpdated.getTime())) {
      console.warn(
        `[Auto-Pause Warning] Title: "${kenmei.title}" | Invalid date format: ${lastActivity}`,
      );
      return STATUS_MAPPING[kenmei.status as KenmeiStatus];
    }

    const daysSinceUpdate = Math.floor(
      (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Additional validation
    if (daysSinceUpdate < 0) {
      console.warn(
        `[Auto-Pause Warning] Title: "${kenmei.title}" | Negative days calculated (future date): ${daysSinceUpdate}`,
      );
      return STATUS_MAPPING[kenmei.status as KenmeiStatus];
    }

    // Check if using a custom threshold (not in predefined list)
    const isCustomThreshold = ![1, 7, 14, 30, 60, 90, 180, 365].includes(
      syncConfig.autoPauseThreshold,
    );
    const threshold = isCustomThreshold
      ? (syncConfig.customAutoPauseThreshold ?? 30)
      : syncConfig.autoPauseThreshold;

    // Validate threshold value
    const validThreshold =
      typeof threshold === "number" && threshold > 0 ? threshold : 30;
    if (validThreshold !== threshold) {
      console.warn(
        `[Auto-Pause Warning] Title: "${kenmei.title}" | Invalid threshold value: ${threshold}, using fallback: ${validThreshold}`,
      );
    }

    if (daysSinceUpdate >= validThreshold) {
      return "PAUSED";
    }
  }

  // Otherwise use the normal status mapping
  // Use type assertion for safety
  const status = kenmei.status as KenmeiStatus;
  return STATUS_MAPPING[status];
}

/**
 * Calculate what changes will occur when syncing a manga entry.
 * Determines which fields (status, progress, score, privacy) will change based on config priorities.
 * @param kenmei - Kenmei manga data.
 * @param userEntry - Existing AniList entry data (undefined if new).
 * @param syncConfig - Sync configuration with priority settings.
 * @returns Object describing all changes and their count.
 * @source
 */
export function calculateSyncChanges(
  kenmei: KenmeiMangaData,
  userEntry: UserEntryData | undefined,
  syncConfig: SyncConfig,
): SyncChangesResult {
  const determineStatusWillChange = (): boolean => {
    if (!userEntry) return true;
    if (syncConfig.prioritizeAniListStatus) return false;
    const effective = getEffectiveStatus(kenmei, syncConfig);
    const preservesCompleted =
      userEntry.status === "COMPLETED" && syncConfig.preserveCompletedStatus;
    return effective !== userEntry.status && !preservesCompleted;
  };

  const determineProgressWillChange = (): boolean => {
    if (!userEntry) return true;
    const kenmeiProgress = kenmei.chapters_read || 0;
    const aniProgress = userEntry.progress || 0;
    if (syncConfig.prioritizeAniListProgress) {
      return kenmeiProgress > aniProgress; // only if Kenmei ahead
    }
    return kenmeiProgress !== aniProgress;
  };

  const determineScoreWillChange = (): boolean => {
    const kenmeiScore = Number(kenmei.score || 0);
    if (!userEntry) return kenmeiScore > 0;

    // If preserving completed entries, don't touch score
    if (
      userEntry.status === "COMPLETED" &&
      syncConfig.preserveCompletedStatus
    ) {
      return false;
    }

    // If AniList score is preferred and meaningful, don't change
    if (
      syncConfig.prioritizeAniListScore &&
      userEntry.score &&
      Number(userEntry.score) > 0
    ) {
      return false;
    }

    const aniScore = Number(userEntry.score || 0);
    return (
      kenmeiScore > 0 &&
      (aniScore === 0 || Math.abs(kenmeiScore - aniScore) >= 0.5)
    );
  };

  const statusWillChange = determineStatusWillChange();
  const progressWillChange = determineProgressWillChange();
  const scoreWillChange = determineScoreWillChange();

  const isNewEntry = !userEntry;
  const isCompleted = !!(userEntry && userEntry.status === "COMPLETED");

  const willSetPrivate = userEntry
    ? syncConfig.setPrivate && !userEntry.private
    : syncConfig.setPrivate;
  const changeCount = [
    statusWillChange,
    progressWillChange,
    scoreWillChange,
    willSetPrivate,
  ].filter(Boolean).length;

  return {
    statusWillChange,
    progressWillChange,
    scoreWillChange,
    isNewEntry,
    isCompleted,
    changeCount,
  };
}
