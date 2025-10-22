import React from "react";
import { motion, type Variants } from "framer-motion";
import { Button } from "../ui/button";
import {
  CheckCircle2,
  Clock3,
  Sparkles,
  Wand2,
  AlertTriangle,
  RotateCcw,
  Undo2,
  Redo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

/**
 * Highlight stat configuration for display in the header.
 *
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
 *
 * @property headerVariants - Framer Motion animation variants.
 * @property matchResultsLength - Total number of matches to process.
 * @property showRematchOptions - Whether to display rematch options panel.
 * @property setShowRematchOptions - Callback to toggle rematch options visibility.
 * @property handleSetAllMatchedToPending - Callback to reset all matched items to pending.
 * @property matchingProcessIsLoading - Whether the matching process is running.
 * @property rateLimitIsRateLimited - Whether AniList rate limit is active.
 * @property statusSummary - Statistics summary with match counts and completion percent.
 * @property pendingBacklog - Number of pending items in the queue.
 * @property handleUndo - Callback for undo action.
 * @property handleRedo - Callback for redo action.
 * @property canUndo - Whether undo is available.
 * @property canRedo - Whether redo is available.
 * @source
 */
interface Props {
  headerVariants: Variants;
  matchResultsLength: number;
  showRematchOptions: boolean;
  setShowRematchOptions: (v: boolean) => void;
  handleSetAllMatchedToPending: () => void;
  matchingProcessIsLoading: boolean;
  rateLimitIsRateLimited: boolean;
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
}

/**
 * Displays the matching dashboard header with progress stats and action buttons.
 *
 * Shows completion percentage, match/manual/pending counts, and rematch controls.
 * Includes undo/redo functionality for match operations.
 *
 * @param props - The component props.
 * @returns The rendered matching page header.
 * @source
 */
export function MatchingPageHeader({
  headerVariants,
  matchResultsLength,
  showRematchOptions,
  setShowRematchOptions,
  handleSetAllMatchedToPending,
  matchingProcessIsLoading,
  rateLimitIsRateLimited,
  statusSummary,
  pendingBacklog,
  handleUndo,
  handleRedo,
  canUndo = false,
  canRedo = false,
}: Readonly<Props>) {
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
              {rateLimitIsRateLimited && (
                <Badge className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-100/60 px-3 py-1 text-amber-700 shadow-sm dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  AniList rate limit active
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

        <div className="relative z-10 mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full lg:max-w-2xl">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Review progress</span>
              <span>
                {reviewed} of {total} reviewed
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
              <div
                className="bg-linear-to-r h-full rounded-full from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                aria-hidden="true"
              />
            </div>
          </div>

          {matchResultsLength > 0 && !matchingProcessIsLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.25 }}
              className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end"
            >
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
                {/* Undo/Redo buttons */}
                {(canUndo || canRedo) && (
                  <TooltipProvider>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canUndo}
                            onClick={handleUndo}
                            aria-label="Undo last action (Ctrl+Z)"
                            className="rounded-xl border border-slate-300/70 bg-white/70 text-slate-700 hover:border-slate-400/80 hover:bg-white/90 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600/70 dark:hover:bg-slate-900"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canRedo}
                            onClick={handleRedo}
                            aria-label="Redo last action (Ctrl+Shift+Z)"
                            className="rounded-xl border border-slate-300/70 bg-white/70 text-slate-700 hover:border-slate-400/80 hover:bg-white/90 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600/70 dark:hover:bg-slate-900"
                          >
                            <Redo2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="h-8 w-px bg-slate-300/50 dark:bg-slate-600/50" />
                  </TooltipProvider>
                )}

                {matched > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleSetAllMatchedToPending}
                    className="group flex grow items-center justify-center gap-2 rounded-2xl border border-slate-300/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400/80 hover:bg-white/90 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600/70 dark:hover:bg-slate-900"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset matched to pending
                  </Button>
                )}
                <Button
                  onClick={() => setShowRematchOptions(!showRematchOptions)}
                  variant="default"
                  className="bg-linear-to-r grow rounded-2xl from-indigo-500 via-sky-500 to-blue-500 text-sm font-semibold shadow-lg hover:from-indigo-600 hover:via-sky-600 hover:to-blue-600 sm:grow-0"
                >
                  {showRematchOptions
                    ? "Hide Rematch Options"
                    : "Fresh Search (Clear Cache)"}
                </Button>
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
