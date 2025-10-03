/**
 * @packageDocumentation
 * @module SyncPage/ChangesSummary
 * @description Displays a summary of synchronization changes including library status, statistics, and refresh controls.
 */

import React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
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
  return (
    <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <h3 className="flex items-center text-sm font-medium">
        <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
        Changes Summary
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        {entriesWithChanges} entries will be synchronized to your AniList
        account.
      </p>

      {libraryLoading && (
        <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading your AniList library for comparison...
        </div>
      )}

      {libraryError && (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-3 w-3" />
          {!isRateLimited && <span>{libraryError}</span>}

          {/* Only show Try Again button when not rate limited */}
          {!isRateLimited && (
            <Button
              variant="link"
              className="h-auto px-0 py-0 text-xs"
              onClick={onLibraryRefresh}
            >
              Try Again
            </Button>
          )}
        </div>
      )}

      {!libraryLoading &&
        !libraryError &&
        userLibrary &&
        Object.keys(userLibrary).length > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
              <span>
                Found{" "}
                <span className="font-semibold">
                  {Object.keys(userLibrary).length}
                </span>{" "}
                unique entries in your AniList library for comparison
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onLibraryRefresh}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              Refresh
            </Button>
          </div>
        )}

      {!libraryLoading && !libraryError && (
        <div className="mt-4 rounded bg-blue-50 p-2 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
          <div className="mb-1 font-semibold">Manga Statistics:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="text-slate-600 dark:text-slate-400">
                Kenmei manga:
              </span>{" "}
              {mangaMatches.length}
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">
                AniList library:
              </span>{" "}
              {Object.keys(userLibrary).length}
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">
                New entries:
              </span>{" "}
              {
                mangaMatches.filter(
                  (match) =>
                    match.selectedMatch && !userLibrary[match.selectedMatch.id],
                ).length
              }
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">
                Updates:
              </span>{" "}
              {
                mangaMatches.filter((match) => {
                  // Only count manga that will actually have changes
                  if (!match.selectedMatch) return false;

                  const anilist = match.selectedMatch;
                  const kenmei = match.kenmeiManga;
                  const userEntry = userLibrary[anilist.id];

                  // Skip if not in user library or if completed and we're preserving completed status
                  if (
                    !userEntry ||
                    (userEntry.status === "COMPLETED" &&
                      syncConfig.preserveCompletedStatus)
                  ) {
                    return false;
                  }

                  // Check if any values will change based on sync configuration
                  let statusWillChange: boolean;
                  if (userEntry) {
                    if (syncConfig.prioritizeAniListStatus) {
                      statusWillChange = false;
                    } else {
                      statusWillChange =
                        getEffectiveStatus(kenmei, syncConfig) !==
                        userEntry.status;
                    }
                  } else {
                    statusWillChange = true;
                  }

                  const progressWillChange =
                    syncConfig.prioritizeAniListProgress
                      ? // Will only change if Kenmei has more chapters read than AniList
                        (kenmei.chapters_read || 0) > (userEntry.progress || 0)
                      : (kenmei.chapters_read || 0) !==
                        (userEntry.progress || 0);

                  const anilistScore = Number(userEntry.score || 0);
                  const kenmeiScore = Number(kenmei.score || 0);
                  const scoreWillChange =
                    syncConfig.prioritizeAniListScore &&
                    userEntry.score &&
                    Number(userEntry.score) > 0
                      ? false
                      : kenmei.score > 0 &&
                        (anilistScore === 0 ||
                          Math.abs(kenmeiScore - anilistScore) >= 0.5);

                  // Check if privacy will change
                  const privacyWillChange =
                    syncConfig.setPrivate && !userEntry.private;

                  // Count entry only if at least one value will change
                  return (
                    statusWillChange ||
                    progressWillChange ||
                    scoreWillChange ||
                    privacyWillChange
                  );
                }).length
              }
            </div>
          </div>

          <div className="mt-2 border-t border-blue-200 pt-2 text-amber-600 dark:border-blue-800 dark:text-amber-400">
            <strong className="text-xs">Note:</strong> Media entries with
            &ldquo;Hide from status lists&rdquo; option set to true and not
            associated with any custom lists will not be returned by the query
            and will be treated as not in your library.
          </div>
        </div>
      )}
    </div>
  );
};
