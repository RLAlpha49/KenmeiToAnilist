/**
 * @packageDocumentation
 * @module SyncPage/ChangesSummary
 * @description Displays a summary of synchronization changes including library status, statistics, and refresh controls.
 */

import React from "react";
import {
  AlertCircle,
  Loader2,
  RefreshCcw,
  Library,
  UserPlus,
  ListChecks,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../ui/button";
import { UserMediaList, MangaMatchResult } from "../../api/anilist/types";
import { SyncConfig } from "../../utils/storage";
import { getEffectiveStatus } from "./sync-utils";

interface ChangesSummaryProps {
  /** Number of entries that have changes to sync */
  entriesWithChanges: number;
  /** Whether the library is currently loading */
  libraryLoading: boolean;
  /** Error message from library loading */
  libraryError: string | null;
  /** Whether the user is currently rate limited */
  isRateLimited: boolean;
  /** Callback to refresh the AniList library */
  onLibraryRefresh: () => void;
  /** User's AniList library indexed by manga ID */
  userLibrary: UserMediaList;
  /** All manga matches from Kenmei */
  mangaMatches: MangaMatchResult[];
  /** Current sync configuration */
  syncConfig: SyncConfig;
}

/**
 * ChangesSummary Component
 *
 * Displays a summary box with:
 * - Total number of entries to sync
 * - Library loading status and errors
 * - Library statistics (total entries, new entries, updates)
 * - Refresh button for the AniList library
 * - Important notes about hidden entries
 */
export const ChangesSummary: React.FC<ChangesSummaryProps> = ({
  entriesWithChanges,
  libraryLoading,
  libraryError,
  isRateLimited,
  onLibraryRefresh,
  userLibrary,
  mangaMatches,
  syncConfig,
}) => {
  const totalLibraryEntries = Object.keys(userLibrary || {}).length;
  const totalMatched = mangaMatches.filter(
    (match) => match.status !== "skipped",
  ).length;
  const newEntriesCount = mangaMatches.filter(
    (match) => match.selectedMatch && !userLibrary[match.selectedMatch.id],
  ).length;

  const updatesCount = mangaMatches.filter((match) => {
    if (!match.selectedMatch) return false;

    const anilist = match.selectedMatch;
    const kenmei = match.kenmeiManga;
    const userEntry = userLibrary[anilist.id];

    if (
      !userEntry ||
      (userEntry.status === "COMPLETED" && syncConfig.preserveCompletedStatus)
    ) {
      return false;
    }

    const statusWillChange = syncConfig.prioritizeAniListStatus
      ? false
      : getEffectiveStatus(kenmei, syncConfig) !== userEntry.status;

    const progressWillChange = syncConfig.prioritizeAniListProgress
      ? (kenmei.chapters_read || 0) > (userEntry.progress || 0)
      : (kenmei.chapters_read || 0) !== (userEntry.progress || 0);

    const anilistScore = Number(userEntry.score || 0);
    const kenmeiScore = Number(kenmei.score || 0);
    const scoreWillChange =
      syncConfig.prioritizeAniListScore &&
      userEntry.score &&
      Number(userEntry.score) > 0
        ? false
        : kenmei.score > 0 &&
          (anilistScore === 0 || Math.abs(kenmeiScore - anilistScore) >= 0.5);

    const privacyWillChange = syncConfig.setPrivate && !userEntry.private;

    return (
      statusWillChange ||
      progressWillChange ||
      scoreWillChange ||
      privacyWillChange
    );
  }).length;

  const readinessRatio =
    totalMatched > 0
      ? Math.min(100, Math.round((entriesWithChanges / totalMatched) * 100))
      : 0;

  const metrics = [
    {
      label: "Kenmei matches",
      value: totalMatched,
      helper: "after skipping dismissed items",
      icon: Sparkles,
      accent:
        "from-blue-400/70 via-blue-400/10 to-transparent dark:from-blue-500/40 dark:via-blue-500/5",
    },
    {
      label: "AniList references",
      value: totalLibraryEntries,
      helper: "from your library snapshot",
      icon: Library,
      accent:
        "from-indigo-400/70 via-indigo-400/10 to-transparent dark:from-indigo-500/40 dark:via-indigo-500/5",
    },
    {
      label: "New entries",
      value: newEntriesCount,
      helper: "will be created on sync",
      icon: UserPlus,
      accent:
        "from-emerald-400/70 via-emerald-400/10 to-transparent dark:from-emerald-500/40 dark:via-emerald-500/5",
    },
    {
      label: "Updates queued",
      value: updatesCount,
      helper: "existing titles getting changes",
      icon: ListChecks,
      accent:
        "from-amber-400/70 via-amber-400/10 to-transparent dark:from-amber-500/40 dark:via-amber-500/5",
    },
  ];

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/60">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
            Sync scope overview
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {entriesWithChanges}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              entries will sync
            </span>
          </div>
          <p className="max-w-xl text-xs text-slate-500 dark:text-slate-400">
            Adjust your configuration and filters to match only the changes you
            want to push.
          </p>
        </div>
        <div className="flex w-full items-center gap-3 md:w-auto">
          <div className="hidden h-16 w-16 items-center justify-center rounded-full border border-blue-200/80 bg-blue-50/70 text-lg font-semibold text-blue-600 md:flex dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
            {readinessRatio}%
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${readinessRatio}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{entriesWithChanges} ready</span>
              <span>{totalMatched} reviewed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {(() => {
          let libraryStatusContent: React.ReactNode;
          if (libraryLoading) {
            libraryStatusContent = (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-slate-500 dark:text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  Loading your AniList library for comparison...
                </span>
              </>
            );
          } else if (libraryError) {
            libraryStatusContent = (
              <>
                <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <span
                  className={
                    isRateLimited
                      ? "text-blue-600 dark:text-blue-300"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {isRateLimited
                    ? "AniList API rate limit reached. Waiting to retry..."
                    : libraryError}
                </span>
              </>
            );
          } else if (totalLibraryEntries > 0) {
            libraryStatusContent = (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  Found {totalLibraryEntries} AniList entries for comparison.
                </span>
              </>
            );
          } else {
            libraryStatusContent = (
              <>
                <Sparkles className="h-3 w-3 text-blue-500 dark:text-blue-300" />
                <span className="text-slate-500 dark:text-slate-400">
                  Library comparison will appear once loaded.
                </span>
              </>
            );
          }
          return (
            <div className="flex items-center gap-2 text-xs">
              {libraryStatusContent}
            </div>
          );
        })()}
        <Button
          variant="outline"
          size="sm"
          onClick={onLibraryRefresh}
          disabled={libraryLoading || isRateLimited}
          className="inline-flex items-center gap-2 rounded-full border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50/70 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/70 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        >
          <RefreshCcw
            className={`h-3 w-3 ${libraryLoading ? "animate-spin" : ""}`}
          />
          {libraryLoading
            ? "Refreshing..."
            : isRateLimited
              ? "Rate limit active"
              : "Refresh Library"}
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition hover:border-blue-200/60 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-950/50 dark:hover:border-blue-900/50"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${metric.accent} opacity-70`}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {metric.label}
                  </span>
                  <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {metric.value}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {metric.helper}
                  </span>
                </div>
                <div className="rounded-full bg-white/70 p-2 text-slate-500 shadow-sm dark:bg-slate-900/50 dark:text-slate-400">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100/60 bg-blue-50/80 px-4 py-3 text-xs text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
        <strong className="font-semibold">Note:</strong> Media entries with
        &ldquo;Hide from status lists&rdquo; enabled and not associated with any
        custom lists will not be returned by the AniList API and will be treated
        as new entries.
      </div>
    </div>
  );
};
