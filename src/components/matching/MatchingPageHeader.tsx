import React from "react";
import { motion, type Variants } from "framer-motion";
import { Button } from "../ui/Button";
import {
  CheckCircle2,
  Clock3,
  Sparkles,
  Wand2,
  AlertTriangle,
  RotateCcw,
  Undo2,
  Redo2,
  Gauge,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../ui/Badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/Tooltip";
import { ExportMatchesButton } from "./ExportMatchesButton";
import ImportMatchesButton from "./ImportMatchesButton";
import { MangaMatchResult } from "../../api/anilist/types";

/**
 * Highlight stat configuration for display in the header.
 * @property label - Display name for the statistic.
 * @property value - Numeric value to show.
 * @property icon - Icon component to display.
 * @property accent - Tailwind classes for styling.
 * @source
 */
type HighlightStat = {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
};

/**
 * Props for the MatchingPageHeader component.
 * @property headerVariants - Framer Motion animation variants.
 * @property matchResultsLength - Total number of matches to process.
 * @property isRematchOptionsVisible - Whether to display rematch options panel.
 * @property setIsRematchOptionsVisible - Callback to toggle rematch options visibility.
 * @property isMatchingProcessLoading - Whether the matching process is running.
 * @property isRateLimited - Whether AniList rate limit is active.
 * @property statusSummary - Statistics summary with match counts and completion percent.
 * @property pendingBacklog - Number of pending items in the queue.
 * @property handleUndo - Callback for undo action.
 * @property handleRedo - Callback for redo action.
 * @property canUndo - Whether undo is available.
 * @property canRedo - Whether redo is available.
 * @property matchResults - Array of match results for export.
 * @property onImportComplete - Callback after successful import with statistics.
 * @source
 */
interface MatchingPageHeaderProps {
  headerVariants: Variants;
  matchResultsLength: number;
  isRematchOptionsVisible: boolean;
  setIsRematchOptionsVisible: (isVisible: boolean) => void;
  isMatchingProcessLoading: boolean;
  isRateLimited: boolean;
  statusSummary: {
    total: number;
    matched: number;
    manual: number;
    pending: number;
    skipped: number;
    reviewed: number;
    completionPercent: number;
  };
  pendingBacklog: number;
  handleUndo?: () => void;
  handleRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  matchResults: MangaMatchResult[];
  onImportComplete?: (result: {
    imported: number;
    merged: number;
    skipped: number;
  }) => void;
  onRecalculateConfidence?: () => void;
  isConfidenceRecalcRunning?: boolean;
}

/**
 * Matching dashboard header displaying progress stats and action buttons.
 * Shows completion percentage, match/manual/pending counts, and rematch controls.
 * Includes undo/redo functionality and data export options.
 * @param props - Component props.
 * @returns Rendered matching page header with progress and statistics.
 * @source
 */
export function MatchingPageHeader({
  headerVariants,
  matchResultsLength,
  isRematchOptionsVisible,
  setIsRematchOptionsVisible,
  isMatchingProcessLoading,
  isRateLimited,
  statusSummary,
  pendingBacklog,
  handleUndo,
  handleRedo,
  canUndo = false,
  canRedo = false,
  matchResults,
  onImportComplete,
  onRecalculateConfidence,
  isConfidenceRecalcRunning = false,
}: Readonly<MatchingPageHeaderProps>) {
  const { matched, manual, pending, reviewed, total, completionPercent } =
    statusSummary;

  const highlightStats = React.useMemo<HighlightStat[]>(
    () => [
      {
        label: "Matched",
        value: matched,
        icon: CheckCircle2,
        accent:
          "bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-transparent text-emerald-600 dark:text-emerald-300",
      },
      {
        label: "Manual",
        value: manual,
        icon: Wand2,
        accent:
          "bg-gradient-to-br from-sky-500/15 via-sky-500/10 to-transparent text-sky-600 dark:text-sky-300",
      },
      {
        label: "Pending",
        value: pending,
        icon: Clock3,
        accent:
          "bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-transparent text-amber-600 dark:text-amber-300",
      },
    ],
    [matched, manual, pending],
  );

  const progressPercent = Math.min(completionPercent, 100);

  return (
    <motion.header className="mb-8" variants={headerVariants}>
      <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/80 px-6 py-7 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
        <div className="pointer-events-none absolute -top-20 left-12 h-52 w-52 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-10 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-sky-600 dark:text-sky-300">
              <Sparkles className="h-4 w-4" />
              Matching Dashboard
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 lg:text-4xl dark:text-white">
              Review and Elevate Your Manga Sync
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You&apos;ve reviewed {reviewed} of {total} titles. Keep refining
              matches or launch a fresh search when you&apos;re ready.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {isRateLimited && (
                <Badge className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-100/60 px-3 py-1 text-amber-700 shadow-sm dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Rate limited
                </Badge>
              )}
              {pendingBacklog > 0 && (
                <Badge className="flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-100/60 px-3 py-1 text-violet-700 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {pendingBacklog} manga ready to resume
                </Badge>
              )}
            </div>
          </div>

          <div className="grid w-full max-w-sm grid-cols-1 gap-4 sm:grid-cols-3">
            {highlightStats.map(({ label, value, icon: Icon, accent }) => (
              <div
                key={label}
                className={`group relative overflow-hidden rounded-2xl border border-white/40 bg-white/70 p-4 shadow-md transition-colors hover:border-white/60 hover:bg-white/90 dark:border-slate-700/60 dark:bg-slate-900/70 dark:hover:border-slate-600 dark:hover:bg-slate-900 ${accent}`}
              >
                <div className="bg-linear-to-br absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-70" />
                <div className="relative flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {label}
                    </span>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-6 flex flex-col gap-4">
          <div className="w-full">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Review progress</span>
              <span>
                {reviewed} of {total} reviewed
              </span>
            </div>
            <progress
              className="sr-only"
              max={Math.max(total, 1)}
              value={reviewed}
              aria-label={`Review progress: ${reviewed} of ${total} titles reviewed`}
            />
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80"
              aria-hidden="true"
            >
              <div
                className="bg-linear-to-r h-full rounded-full from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                aria-hidden="true"
              />
            </div>
          </div>

          {matchResultsLength > 0 && !isMatchingProcessLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.25 }}
              className="flex w-full flex-col gap-3"
            >
              {/* Primary Action Row - Most prominent */}
              <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  onClick={() =>
                    setIsRematchOptionsVisible(!isRematchOptionsVisible)
                  }
                  variant="default"
                  size="lg"
                  className="bg-linear-to-r group relative rounded-2xl from-indigo-500 via-sky-500 to-blue-500 px-6 py-3 text-base font-semibold shadow-lg transition-all hover:scale-[1.02] hover:from-indigo-600 hover:via-sky-600 hover:to-blue-600 hover:shadow-xl active:scale-[0.98]"
                  aria-label={
                    isRematchOptionsVisible
                      ? "Hide rematch options panel"
                      : "Open fresh search options to clear cache and rematch"
                  }
                >
                  <Sparkles className="mr-2 h-5 w-5" aria-hidden="true" />
                  {isRematchOptionsVisible
                    ? "Hide Rematch Options"
                    : "Fresh Search (Clear Cache)"}
                </Button>
              </div>

              {/* Secondary Actions Row - Grouped logically */}
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Left group: History controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {(canUndo || canRedo) && (
                    <TooltipProvider>
                      <fieldset
                        className="flex items-center gap-1 rounded-xl border border-slate-300/70 bg-white/50 p-1 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50"
                        aria-label="History controls"
                      >
                        <legend className="sr-only">History controls</legend>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canUndo}
                              onClick={handleUndo}
                              aria-label="Undo last action"
                              aria-keyshortcuts="Control+Z"
                              className="h-9 rounded-lg px-3 hover:bg-white/80 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800/80"
                            >
                              <Undo2 className="h-4 w-4" aria-hidden="true" />
                              <span className="ml-1.5 text-xs font-medium">
                                Undo
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Undo (Ctrl+Z)
                          </TooltipContent>
                        </Tooltip>

                        <div className="h-6 w-px bg-slate-300/50 dark:bg-slate-600/50" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canRedo}
                              onClick={handleRedo}
                              aria-label="Redo last action"
                              aria-keyshortcuts="Control+Shift+Z"
                              className="h-9 rounded-lg px-3 hover:bg-white/80 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800/80"
                            >
                              <Redo2 className="h-4 w-4" aria-hidden="true" />
                              <span className="ml-1.5 text-xs font-medium">
                                Redo
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Redo (Ctrl+Shift+Z)
                          </TooltipContent>
                        </Tooltip>
                      </fieldset>
                    </TooltipProvider>
                  )}
                </div>

                {/* Right group: Data and matching controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {matchResultsLength > 0 && onRecalculateConfidence && (
                    <Button
                      variant="outline"
                      size="default"
                      disabled={
                        isMatchingProcessLoading ||
                        isConfidenceRecalcRunning ||
                        isRateLimited
                      }
                      onClick={onRecalculateConfidence}
                      className="flex items-center gap-2"
                    >
                      <Gauge className="h-4 w-4" />
                      {isConfidenceRecalcRunning
                        ? "Refreshing..."
                        : "Refresh Confidence"}
                    </Button>
                  )}
                  {/* Import Button - Data import action */}
                  {matchResultsLength > 0 && onImportComplete && (
                    <ImportMatchesButton
                      variant="outline"
                      size="default"
                      disabled={isMatchingProcessLoading}
                      onImportComplete={onImportComplete}
                    />
                  )}
                  {/* Export Button - Data action */}
                  {matchResultsLength > 0 && (
                    <ExportMatchesButton
                      matches={matchResults}
                      variant="outline"
                      size="default"
                      disabled={isMatchingProcessLoading}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.header>
  );
}

const MemoizedMatchingPageHeader = React.memo(MatchingPageHeader);
MemoizedMatchingPageHeader.displayName = "MatchingPageHeader";

export default MemoizedMatchingPageHeader;
