import React from "react";
import { ArrowLeft, Check, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "../../../utils/tailwind";
import { Button } from "../../ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/Tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

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
 * @property isSetMatchedToPendingDisabled - Whether the reset matched action should be disabled.
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
  isSetMatchedToPendingDisabled?: boolean;
  matchedCount?: number;
}

type BulkActionDefinition = {
  key: string;
  label: string;
  tooltip: string;
  placeholder: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  isLoading: boolean;
  onClick?: () => void;
  disabledReason?: string;
  ariaLabel: (count: number) => string;
};

/**
 * Displays bulk action buttons for common match operations.
 *
 * Provides quick actions to skip empty matches, re-search no-matches, reset skipped items,
 * reset matched items, and accept all pending matches. Includes live regions for accessibility.
 *
 * @param props - Component props including action counts and callbacks.
 * @returns Rendered bulk actions container with conditional action cards.
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
  isSetMatchedToPendingDisabled,
  matchedCount,
}: Readonly<MatchBulkActionsProps>) {
  const resetMatchedCount = matchedCount ?? 0;
  const isResettingMatched = Boolean(isResettingMatchedToPending);
  const hasBulkActionButtons =
    emptyMatchesCount > 0 ||
    noMatchesCount > 0 ||
    skippedMangaCount > 0 ||
    resetMatchedCount > 0 ||
    pendingMatchesCount > 0 ||
    isSkippingEmptyMatches ||
    isReSearchingNoMatches ||
    isResettingSkippedToPending ||
    isResettingMatched ||
    isAcceptingAllMatches;

  let resetMatchedDisabledReason: string | undefined;
  if (!onSetMatchedToPending) {
    resetMatchedDisabledReason = "Reset matched action is not configured.";
  } else if (isSetMatchedToPendingDisabled) {
    resetMatchedDisabledReason =
      "Reset matched action is temporarily disabled.";
  }

  const bulkActionBaseClasses =
    "group relative flex w-full items-center gap-2 justify-start overflow-hidden rounded-xl border border-white/40 bg-white/65 px-3 py-2 text-left text-sm font-medium text-slate-900 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-slate-800/60 dark:bg-slate-900/65 dark:text-white";

  const bulkActions: BulkActionDefinition[] = [
    {
      key: "skip-empty",
      label: "Skip Empty",
      tooltip: "Mark all pending manga with no matches as skipped",
      placeholder: "No pending manga are missing matches right now.",
      accent: "border-slate-300/70 text-slate-900 dark:text-slate-200",
      icon: X,
      count: emptyMatchesCount,
      isLoading: isSkippingEmptyMatches,
      onClick: onSkipEmptyMatches,
      ariaLabel: (count) =>
        `Skip ${count} empty ${count === 1 ? "match" : "matches"}`,
    },
    {
      key: "re-search",
      label: "Re-search Empty",
      tooltip: "Attempt to find matches for all manga without results",
      placeholder: "All manga already have match candidates.",
      accent: "border-purple-400/60 text-purple-600 dark:text-purple-300",
      icon: RefreshCw,
      count: noMatchesCount,
      isLoading: isReSearchingNoMatches,
      onClick: onReSearchNoMatches,
      ariaLabel: (count) =>
        `Re-search ${count} ${count === 1 ? "match" : "matches"}`,
    },
    {
      key: "reset-skipped",
      label: "Reset Skipped",
      tooltip: "Reset all skipped manga back to pending status",
      placeholder: "No skipped manga to reset.",
      accent: "border-orange-400/60 text-orange-600 dark:text-orange-300",
      icon: ArrowLeft,
      count: skippedMangaCount,
      isLoading: isResettingSkippedToPending,
      onClick: onResetSkippedToPending,
      ariaLabel: (count) =>
        `Reset ${count} skipped ${count === 1 ? "item" : "items"} to pending`,
    },
    {
      key: "reset-matched",
      label: "Reset Matched",
      tooltip: "Reset all matched manga back to pending status",
      placeholder: "No matched manga to reset to pending.",
      accent: "border-indigo-400/60 text-indigo-600 dark:text-indigo-300",
      icon: ArrowLeft,
      count: resetMatchedCount,
      isLoading: isResettingMatched,
      onClick: onSetMatchedToPending,
      disabledReason: resetMatchedDisabledReason,
      ariaLabel: (count) =>
        `Reset ${count} matched ${count === 1 ? "item" : "items"} to pending`,
    },
    {
      key: "accept-all",
      label: "Accept All",
      tooltip: "Accept all pending manga with available matches",
      placeholder: "No pending matches have valid results.",
      accent: "border-emerald-400/60 text-emerald-600 dark:text-emerald-300",
      icon: Check,
      count: pendingMatchesCount,
      isLoading: isAcceptingAllMatches,
      onClick: onAcceptAllPendingMatches,
      ariaLabel: (count) =>
        `Accept all ${count} pending ${count === 1 ? "match" : "matches"}`,
    },
  ];

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/75 py-0 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
      <CardHeader className="relative z-10 flex min-h-[60px] border-b border-white/40 pb-3 pt-4 dark:border-slate-800/60">
        <div className="flex w-full items-center gap-3">
          <div className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <Check className="h-4 w-4" />
          </div>
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
            Bulk Actions
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex-1 p-4">
        <div className="flex flex-col gap-3">
          {/* Live regions announce operation status to screen readers */}
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
          {isResettingMatched && (
            <output className="sr-only" aria-live="polite" aria-atomic="true">
              Resetting {resetMatchedCount} matched items to pending...
            </output>
          )}

          {/* Live region for accept all operation */}
          {isAcceptingAllMatches && (
            <output className="sr-only" aria-live="polite" aria-atomic="true">
              Accepting all {pendingMatchesCount} pending matches...
            </output>
          )}

          {!hasBulkActionButtons && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              Bulk actions will become available once manga matches need
              attention.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {bulkActions.map((action) => {
              const hasItems = action.count > 0;
              const isReady = hasItems && !action.disabledReason;
              const isBusy = action.isLoading;
              const isInteractive = isBusy || isReady;
              const isDisabled = isBusy || !isReady;
              const isPlaceholder = action.count === 0;
              const buttonClassName = cn(
                bulkActionBaseClasses,
                action.accent,
                isInteractive
                  ? "hover:border-white/70 hover:bg-white/90 focus-visible:ring-slate-200 dark:focus-visible:ring-slate-100"
                  : "cursor-not-allowed opacity-60",
              );

              // Use the placeholder or disabledReason first, otherwise the action's tooltip
              const tooltipText = isPlaceholder
                ? action.placeholder
                : (action.disabledReason ?? action.tooltip);

              // Ensure placeholder state uses a not-allowed cursor so the mouse clearly shows it's disabled
              const triggerWrapperClass = cn("inline-block w-full", {
                "cursor-not-allowed": isPlaceholder,
              });

              const Icon = action.icon as React.ComponentType<{
                className?: string;
              }>;

              return (
                <div key={action.key} className="flex flex-col gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {isDisabled ? (
                          <span
                            className={triggerWrapperClass}
                            aria-disabled={!isInteractive}
                          >
                            <Button
                              variant="outline"
                              onClick={action.onClick}
                              disabled={isDisabled}
                              className={buttonClassName}
                              aria-label={action.ariaLabel(action.count)}
                            >
                              {isBusy ? (
                                <Loader2
                                  className="mr-2 h-4 w-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Icon
                                  className="mr-2 h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="flex-1 text-sm font-medium">
                                {action.label} ({action.count})
                              </span>
                            </Button>
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={action.onClick}
                            disabled={isDisabled}
                            className={buttonClassName}
                            aria-label={action.ariaLabel(action.count)}
                          >
                            {isBusy ? (
                              <Loader2
                                className="mr-2 h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Icon
                                className="mr-2 h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            <span className="flex-1 text-sm font-medium">
                              {action.label} ({action.count})
                            </span>
                          </Button>
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tooltipText}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Memoized MatchBulkActions component for performance optimization. @source */
const MatchBulkActionsMemo = React.memo(MatchBulkActionsComponent);
MatchBulkActionsMemo.displayName = "MatchBulkActions";

export { MatchBulkActionsMemo as MatchBulkActions };
