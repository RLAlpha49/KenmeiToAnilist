import React from "react";
import { ArrowLeft, Check, Info, Loader2, RefreshCw, X } from "lucide-react";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";

/**
 * Props for the MatchBulkActions component.
 *
 * @property emptyMatchesCount - Number of manga with no available matches.
 * @property onSkipEmptyMatches - Callback to skip all empty matches.
 * @property isSkippingEmptyMatches - Whether skip operation is in progress.
 * @property noMatchesCount - Number of items with no matches found.
 * @property onReSearchNoMatches - Callback to re-search items with no matches.
 * @property isReSearchingNoMatches - Whether re-search operation is in progress.
 * @property skippedMangaCount - Number of manually skipped manga.
 * @property onResetSkippedToPending - Callback to reset skipped items to pending.
 * @property isResettingSkippedToPending - Whether reset operation is in progress.
 * @property pendingMatchesCount - Number of pending matches.
 * @property onAcceptAllPendingMatches - Callback to accept all pending matches.
 * @property isAcceptingAllMatches - Whether accept operation is in progress.
 * @property onSetMatchedToPending - Optional callback to reset matched to pending.
 * @property isResettingMatchedToPending - Whether reset matched operation is in progress.
 * @property matchedCount - Optional count of matched items.
 * @source
 */
export interface MatchBulkActionsProps {
  emptyMatchesCount: number;
  onSkipEmptyMatches: () => void;
  isSkippingEmptyMatches: boolean;
  noMatchesCount: number;
  onReSearchNoMatches: () => void;
  isReSearchingNoMatches: boolean;
  skippedMangaCount: number;
  onResetSkippedToPending: () => void;
  isResettingSkippedToPending: boolean;
  pendingMatchesCount: number;
  onAcceptAllPendingMatches: () => void;
  isAcceptingAllMatches: boolean;
  onSetMatchedToPending?: () => void;
  isResettingMatchedToPending?: boolean;
  matchedCount?: number;
}

/**
 * Displays bulk action buttons for common match operations.
 *
 * Provides quick actions to skip empty matches, re-search no-matches, reset skipped,
 * and accept all pending matches.
 *
 * @param props - The component props.
 * @returns The rendered bulk actions component.
 * @source
 */
function MatchBulkActionsComponent({
  emptyMatchesCount,
  onSkipEmptyMatches,
  isSkippingEmptyMatches,
  noMatchesCount,
  onReSearchNoMatches,
  isReSearchingNoMatches,
  skippedMangaCount,
  onResetSkippedToPending,
  isResettingSkippedToPending,
  pendingMatchesCount,
  onAcceptAllPendingMatches,
  isAcceptingAllMatches,
  onSetMatchedToPending,
  isResettingMatchedToPending,
  matchedCount,
}: Readonly<MatchBulkActionsProps>) {
  const hasMatched = (matchedCount ?? 0) > 0;

  return (
    <div className="mb-4 flex flex-col space-y-4">
      {/* Live region for skip empty matches operation */}
      {isSkippingEmptyMatches && (
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          Skipping {emptyMatchesCount} empty matches...
        </output>
      )}

      {/* Live region for re-search operation */}
      {isReSearchingNoMatches && (
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          Re-searching {noMatchesCount} empty matches...
        </output>
      )}

      {/* Live region for reset skipped operation */}
      {isResettingSkippedToPending && (
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          Resetting {skippedMangaCount} skipped items to pending...
        </output>
      )}

      {/* Live region for reset matched operation */}
      {isResettingMatchedToPending && (
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          Resetting {matchedCount || 0} matched items to pending...
        </output>
      )}

      {/* Live region for accept all operation */}
      {isAcceptingAllMatches && (
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          Accepting all {pendingMatchesCount} pending matches...
        </output>
      )}
      {emptyMatchesCount > 0 && (
        <Card
          aria-labelledby="skip-empty-label"
          className="relative overflow-visible rounded-2xl border border-white/40 bg-white/70 p-4 shadow-md shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70"
        >
          <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 rounded-full bg-slate-400/15 blur-3xl" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onSkipEmptyMatches}
              disabled={isSkippingEmptyMatches}
              className="w-full border-slate-300/60 bg-white/60 text-slate-700 backdrop-blur hover:bg-white/90 hover:text-slate-900 sm:w-auto dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
              aria-label={`Skip ${emptyMatchesCount} empty ${emptyMatchesCount === 1 ? "match" : "matches"}`}
            >
              {isSkippingEmptyMatches ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Processing...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" aria-hidden="true" />
                  Skip Empty Matches ({emptyMatchesCount})
                </>
              )}
            </Button>
            <span
              id="skip-empty-label"
              className="text-muted-foreground text-sm"
            >
              Mark all pending manga with no matches as skipped
            </span>
          </div>
        </Card>
      )}

      {noMatchesCount > 0 && (
        <Card
          aria-labelledby="research-label"
          className="bg-linear-to-br relative overflow-visible rounded-2xl border border-purple-400/30 from-purple-100/70 via-white/60 to-white/50 p-4 shadow-lg shadow-purple-500/10 backdrop-blur dark:border-purple-500/30 dark:from-purple-900/20 dark:via-slate-900/60 dark:to-slate-900/50"
        >
          <div className="pointer-events-none absolute -bottom-16 left-6 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onReSearchNoMatches}
              disabled={isReSearchingNoMatches}
              className="w-full border-purple-400/40 bg-purple-500/90 text-white shadow-md shadow-purple-500/40 transition hover:border-purple-400/60 hover:bg-purple-500 sm:w-auto"
              aria-label={`Re-search ${noMatchesCount} ${noMatchesCount === 1 ? "match" : "matches"}`}
            >
              {isReSearchingNoMatches ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Re-search Empty Matches ({noMatchesCount})
                </>
              )}
            </Button>
            <span id="research-label" className="text-muted-foreground text-sm">
              Attempt to find matches for all manga without results
            </span>
          </div>
        </Card>
      )}

      {skippedMangaCount > 0 && (
        <Card
          aria-labelledby="reset-skipped-label"
          className="bg-linear-to-br relative overflow-visible rounded-2xl border border-orange-400/30 from-orange-100/70 via-white/60 to-white/50 p-4 shadow-lg shadow-orange-500/10 backdrop-blur dark:border-orange-500/30 dark:from-orange-900/20 dark:via-slate-900/60 dark:to-slate-900/50"
        >
          <div className="pointer-events-none absolute -top-12 right-6 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onResetSkippedToPending}
              disabled={isResettingSkippedToPending}
              className="w-full border-orange-400/40 bg-orange-500/90 text-white shadow-md shadow-orange-500/30 transition hover:border-orange-400/60 hover:bg-orange-500 sm:w-auto"
              aria-label={`Reset ${skippedMangaCount} skipped ${skippedMangaCount === 1 ? "item" : "items"} to pending`}
            >
              {isResettingSkippedToPending ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reset Skipped to Pending ({skippedMangaCount})
                </>
              )}
            </Button>
            <span
              id="reset-skipped-label"
              className="text-muted-foreground text-sm"
            >
              Reset all skipped manga back to pending status
            </span>
          </div>
        </Card>
      )}

      {hasMatched && (
        <Card
          aria-labelledby="reset-matched-label"
          className="bg-linear-to-br relative overflow-visible rounded-2xl border border-indigo-400/30 from-indigo-100/70 via-white/60 to-white/45 p-4 shadow-lg shadow-indigo-500/10 backdrop-blur dark:border-indigo-500/30 dark:from-indigo-900/25 dark:via-slate-900/60 dark:to-slate-900/55"
        >
          <div className="pointer-events-none absolute -top-14 right-6 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onSetMatchedToPending}
              disabled={isResettingMatchedToPending}
              className="w-full border-indigo-400/40 bg-indigo-500/90 text-white shadow-md shadow-indigo-500/40 transition hover:border-indigo-400/60 hover:bg-indigo-500 sm:w-auto"
              aria-label={`Reset ${matchedCount || 0} matched ${(matchedCount ?? 0) === 1 ? "item" : "items"} to pending`}
            >
              {isResettingMatchedToPending ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  {typeof matchedCount === "number"
                    ? `Reset Matched to Pending (${matchedCount})`
                    : "Reset Matched to Pending"}
                </>
              )}
            </Button>
            <span
              id="reset-matched-label"
              className="text-muted-foreground text-sm"
            >
              Reset all matched manga back to pending status
            </span>
          </div>
        </Card>
      )}

      {pendingMatchesCount > 0 && (
        <Card
          aria-labelledby="accept-all-label"
          className="bg-linear-to-br relative overflow-visible rounded-2xl border border-emerald-400/30 from-emerald-100/70 via-white/60 to-white/50 p-4 shadow-lg shadow-emerald-500/10 backdrop-blur dark:border-emerald-500/30 dark:from-emerald-900/20 dark:via-slate-900/60 dark:to-slate-900/50"
        >
          <div className="pointer-events-none absolute -bottom-14 left-6 h-40 w-40 rounded-full bg-emerald-500/25 blur-3xl" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onAcceptAllPendingMatches}
              disabled={isAcceptingAllMatches}
              className="w-full border-emerald-400/40 bg-emerald-500/90 text-white shadow-md shadow-emerald-500/40 transition hover:border-emerald-400/60 hover:bg-emerald-500 sm:w-auto"
              aria-label={`Accept all ${pendingMatchesCount} pending ${pendingMatchesCount === 1 ? "match" : "matches"}`}
            >
              {isAcceptingAllMatches ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  Accept All Matches ({pendingMatchesCount})
                </>
              )}
            </Button>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground"
                      aria-describedby="accept-tooltip"
                    >
                      <Info
                        className="h-4 w-4 cursor-help"
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent id="accept-tooltip">
                    <p>
                      It&apos;s still a good idea to skim over the matches to
                      ensure everything is correct before proceeding.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span
                id="accept-all-label"
                className="text-muted-foreground text-sm"
              >
                Accept all pending manga with available matches
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Memoized MatchBulkActions component for performance optimization. @source */
const MatchBulkActionsMemo = React.memo(MatchBulkActionsComponent);
MatchBulkActionsMemo.displayName = "MatchBulkActions";

export { MatchBulkActionsMemo as MatchBulkActions };
