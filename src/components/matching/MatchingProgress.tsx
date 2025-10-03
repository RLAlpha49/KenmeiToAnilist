/**
 * @packageDocumentation
 * @module MatchingProgressPanel
 * @description React component for displaying the progress of the manga matching process, including progress bar, status, and time estimate.
 */

import React, { ReactNode, useMemo } from "react";
import { MatchingProgress, TimeEstimate } from "../../types/matching";
import { formatTimeRemaining } from "../../utils/timeUtils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Loader2,
  RotateCcw,
  AlertOctagon,
  Sparkles,
  Clock3,
  BookOpenCheck,
  Gauge,
  Hourglass,
  Timer,
  Pause,
  Play,
  PauseCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/tailwind";

/**
 * Props for the PauseResumeButton component.
 *
 * @property isPaused - Whether the process is currently paused.
 * @property isManuallyPaused - Whether the pause was triggered manually.
 * @property onResumeProcess - Callback to resume the matching process (optional).
 * @property onPauseProcess - Callback to pause the matching process (optional).
 * @property resumeButtonDisabled - Whether the resume button should be disabled.
 * @property pauseButtonDisabled - Whether the pause button should be disabled.
 * @internal
 * @source
 */
interface PauseResumeButtonProps {
  isPaused: boolean;
  isManuallyPaused: boolean;
  onResumeProcess?: () => void;
  onPauseProcess?: () => void;
  resumeButtonDisabled: boolean;
  pauseButtonDisabled: boolean;
}

/**
 * Button component for pausing/resuming the matching process.
 *
 * @param props - The props for the PauseResumeButton component.
 * @returns The rendered pause/resume button React element.
 * @source
 */
const PauseResumeButton: React.FC<PauseResumeButtonProps> = ({
  isPaused,
  isManuallyPaused,
  onResumeProcess,
  onPauseProcess,
  resumeButtonDisabled,
  pauseButtonDisabled,
}) => {
  if (isPaused) {
    const buttonLabel = isManuallyPaused
      ? "Resume Matching"
      : "Waiting for AniList";

    return (
      <Button
        size="lg"
        onClick={isManuallyPaused ? onResumeProcess : undefined}
        disabled={resumeButtonDisabled || !onResumeProcess}
        className={cn(
          "group relative w-full rounded-2xl text-base font-semibold transition-all duration-200",
          isManuallyPaused
            ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 focus-visible:ring-emerald-400"
            : "border border-slate-200/70 bg-slate-100/60 text-slate-500 shadow-inner shadow-slate-200/50 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400",
        )}
      >
        <span className="flex items-center justify-center gap-2">
          {isManuallyPaused ? (
            <Play className="h-5 w-5" />
          ) : (
            <Hourglass className="h-5 w-5" />
          )}
          {buttonLabel}
        </span>
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      onClick={onPauseProcess}
      disabled={pauseButtonDisabled || !onPauseProcess}
      className="group relative w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 focus-visible:ring-indigo-400"
    >
      <span className="flex items-center justify-center gap-2">
        <Pause className="h-5 w-5" />
        Pause Matching
      </span>
    </Button>
  );
};

const getBadgeConfig = ({
  isCancelling,
  isPaused,
  isRateLimitActive,
}: {
  isCancelling: boolean;
  isPaused: boolean;
  isRateLimitActive: boolean;
}): { colorClass: string; content: ReactNode } => {
  if (isCancelling) {
    return {
      colorClass:
        "bg-amber-500/20 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
      content: (
        <>
          <AlertOctagon className="h-3.5 w-3.5" />
          Cancelling run
        </>
      ),
    };
  }

  if (isRateLimitActive) {
    return {
      colorClass:
        "bg-amber-500/18 text-amber-700 dark:bg-amber-500/12 dark:text-amber-200",
      content: (
        <>
          <Hourglass className="h-3.5 w-3.5" />
          Waiting for AniList
        </>
      ),
    };
  }

  if (isPaused) {
    return {
      colorClass:
        "bg-purple-500/15 text-purple-600 dark:bg-purple-500/12 dark:text-purple-200",
      content: (
        <>
          <PauseCircle className="h-3.5 w-3.5" />
          Matching paused
        </>
      ),
    };
  }

  return {
    colorClass:
      "bg-blue-500/15 text-blue-600 dark:bg-blue-500/12 dark:text-blue-200",
    content: (
      <>
        <Sparkles className="h-3.5 w-3.5" />
        Auto matching in progress
      </>
    ),
  };
};

const formatCompactDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "—";
  }

  const roundedSeconds = Math.max(1, Math.round(seconds));

  if (roundedSeconds < 60) {
    return `${roundedSeconds}s`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (minutes < 60) {
    return remainingSeconds
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const generateStats = ({
  progress,
  totalProcessed,
  remainingCount,
  progressPercent,
  formattedElapsed,
  elapsedSeconds,
  formattedAverageDuration,
  averageSecondsPerManga,
}: {
  progress: MatchingProgress;
  totalProcessed: number;
  remainingCount: number;
  progressPercent: number;
  formattedElapsed: string;
  elapsedSeconds: number;
  formattedAverageDuration: string;
  averageSecondsPerManga: number;
}): Array<{
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  hint?: string;
}> => [
  {
    icon: BookOpenCheck,
    label: "Matched",
    value:
      progress.total > 0
        ? `${totalProcessed.toLocaleString()} / ${progress.total.toLocaleString()}`
        : totalProcessed.toLocaleString(),
    hint:
      progress.total > 0
        ? `${progressPercent}% complete`
        : "Awaiting batch details",
  },
  {
    icon: Hourglass,
    label: "Remaining",
    value: progress.total > 0 ? remainingCount.toLocaleString() : "—",
    hint:
      progress.total > 0
        ? "Titles left in queue"
        : "Start matching to populate",
  },
  {
    icon: Clock3,
    label: "Elapsed",
    value: formattedElapsed,
    hint:
      elapsedSeconds > 0
        ? "Since matching started"
        : "We just kicked things off",
  },
  {
    icon: Gauge,
    label: "Avg. per manga",
    value: formattedAverageDuration,
    hint:
      averageSecondsPerManga > 0
        ? "Based on recent speed"
        : "Gathering performance data",
  },
];

/**
 * Props for the MatchingProgressPanel component.
 *
 * @property isCancelling - Whether the process is currently being cancelled.
 * @property progress - The current progress state of the matching process.
 * @property statusMessage - The main status message to display.
 * @property detailMessage - Additional detail message to display.
 * @property timeEstimate - Estimated time remaining for the process.
 * @property onCancelProcess - Callback to cancel the matching process.
 * @property onPauseProcess - Callback to pause the matching process (optional).
 * @property onResumeProcess - Callback to resume the matching process (optional).
 * @property bypassCache - Whether to bypass the cache for matching (optional).
 * @property freshSearch - Whether a fresh search is being performed (optional).
 * @property disableControls - Whether to disable control buttons (optional).
 * @property isPaused - Whether the process is currently paused (optional).
 * @property isManuallyPaused - Whether the pause was triggered manually (optional).
 * @property isRateLimitActive - Whether pause is due to an active rate limit (optional).
 * @internal
 * @source
 */
export interface MatchingProgressProps {
  isCancelling: boolean;
  progress: MatchingProgress;
  statusMessage: string;
  detailMessage: ReactNode;
  timeEstimate: TimeEstimate;
  onCancelProcess: () => void;
  onPauseProcess?: () => void;
  onResumeProcess?: () => void;
  bypassCache?: boolean;
  freshSearch?: boolean;
  disableControls?: boolean;
  isPaused?: boolean;
  isManuallyPaused?: boolean;
  isRateLimitActive?: boolean;
}

/**
 * Displays the progress of the manga matching process, including progress bar, status, and time estimate.
 *
 * @param props - The props for the MatchingProgressPanel component.
 * @returns The rendered matching progress panel React element.
 * @source
 * @example
 * ```tsx
 * <MatchingProgressPanel
 *   isCancelling={false}
 *   progress={progress}
 *   statusMessage="Matching..."
 *   detailMessage={detail}
 *   timeEstimate={estimate}
 *   onCancelProcess={handleCancel}
 * />
 * ```
 */
export const MatchingProgressPanel: React.FC<MatchingProgressProps> = ({
  isCancelling,
  progress,
  statusMessage,
  detailMessage,
  timeEstimate,
  onCancelProcess,
  onPauseProcess,
  onResumeProcess,
  bypassCache,
  freshSearch,
  disableControls = false,
  isPaused = false,
  isManuallyPaused = false,
  isRateLimitActive = false,
}) => {
  const progressPercent = progress.total
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  const totalProcessed = progress.total
    ? Math.min(progress.current, progress.total)
    : progress.current;
  const remainingCount = progress.total
    ? Math.max(progress.total - progress.current, 0)
    : 0;

  const elapsedSeconds = useMemo(() => {
    if (!timeEstimate.startTime || progress.current <= 0) {
      return 0;
    }
    return Math.max(
      0,
      Math.round((Date.now() - timeEstimate.startTime) / 1000),
    );
  }, [progress.current, timeEstimate.startTime]);

  const formattedElapsed = formatCompactDuration(elapsedSeconds);
  const averageSecondsPerManga =
    timeEstimate.averageTimePerManga > 0
      ? timeEstimate.averageTimePerManga / 1000
      : 0;
  const formattedAverageDuration = formatCompactDuration(
    Math.round(averageSecondsPerManga),
  );

  const showEta =
    progress.current > 0 && timeEstimate.estimatedRemainingSeconds > 0;

  const stats = useMemo(
    () =>
      generateStats({
        progress,
        totalProcessed,
        remainingCount,
        progressPercent,
        formattedElapsed,
        elapsedSeconds,
        formattedAverageDuration,
        averageSecondsPerManga,
      }),
    [
      progress,
      totalProcessed,
      remainingCount,
      progressPercent,
      formattedElapsed,
      elapsedSeconds,
      formattedAverageDuration,
      averageSecondsPerManga,
    ],
  );

  const pauseButtonDisabled =
    disableControls || isCancelling || isPaused || isRateLimitActive;
  const resumeButtonDisabled =
    disableControls || isCancelling || !isManuallyPaused || isRateLimitActive;

  return (
    <Card className="relative isolate mb-8 overflow-hidden border">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18)_0%,rgba(255,255,255,0)_70%)] dark:bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.14)_0%,rgba(15,23,42,0)_82%)]" />

      <CardHeader className="relative z-10 space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {(() => {
            const badgeConfig = getBadgeConfig({
              isCancelling,
              isPaused,
              isRateLimitActive,
            });

            return (
              <Badge
                variant={isCancelling ? "destructive" : "secondary"}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold tracking-[0.2em] uppercase",
                  badgeConfig.colorClass,
                )}
              >
                {badgeConfig.content}
              </Badge>
            );
          })()}
          {(bypassCache || freshSearch) && (
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 rounded-full border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-blue-600 uppercase dark:border-blue-500/25 dark:bg-blue-500/12 dark:text-blue-200"
            >
              <RotateCcw className="h-3 w-3" />
              Fresh AniList search
            </Badge>
          )}
        </div>

        <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {isCancelling
            ? "Wrapping up safely..."
            : statusMessage || "Matching your manga library"}
        </CardTitle>
        <CardDescription className="text-base text-slate-600 dark:text-slate-300/90">
          {detailMessage ||
            "Sit tight while we cross-reference your titles with AniList."}
        </CardDescription>
      </CardHeader>

      <CardContent className="relative z-10 space-y-6 pb-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Progress
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {totalProcessed.toLocaleString()}
                {progress.total ? (
                  <span className="text-base font-normal text-slate-500 dark:text-slate-400">
                    {" "}
                    of {progress.total.toLocaleString()}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-sm font-semibold text-slate-600 shadow-sm shadow-blue-500/10 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-200">
              <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-300" />
              {progressPercent}% complete
            </div>
          </div>
          <Progress
            value={progressPercent}
            className="h-3 w-full bg-slate-200/70 dark:bg-slate-800/70"
            indicatorClassName="bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 shadow-[0_0_16px_rgba(56,189,248,0.35)] dark:shadow-[0_0_14px_rgba(129,140,248,0.28)]"
          />
        </div>

        {showEta && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="relative overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-cyan-500/10 p-4 shadow-inner dark:border-blue-500/25 dark:from-blue-500/14 dark:via-indigo-500/12 dark:to-cyan-500/12"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600 dark:bg-blue-500/18 dark:text-blue-200">
                <Timer className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-blue-600 uppercase dark:text-blue-200">
                  Estimated finish
                </p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">
                  {formatTimeRemaining(timeEstimate.estimatedRemainingSeconds)}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  ~{remainingCount.toLocaleString()} manga remaining
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value, hint }) => (
            <div
              key={label}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 p-4 shadow-sm shadow-blue-500/10 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/60 dark:bg-slate-900/55"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 to-transparent opacity-60 dark:from-slate-900/45" />
              <div className="relative z-10 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500 dark:bg-blue-500/16 dark:text-blue-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                    {label}
                  </p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                    {value}
                  </p>
                  {hint && (
                    <p className="text-xs text-slate-500 dark:text-slate-400/90">
                      {hint}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {progress.currentTitle && (
          <motion.div
            key={progress.currentTitle}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="relative overflow-hidden rounded-2xl border border-purple-200/60 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-slate-100/40 p-4 dark:border-purple-500/25 dark:from-purple-500/14 dark:via-blue-500/14 dark:to-slate-900/30"
            style={{ minHeight: 80, maxHeight: 120 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-200/90" />
                Currently matching
              </div>
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-purple-600 uppercase shadow-sm dark:bg-white/10 dark:text-purple-200">
                Live
              </span>
            </div>
            <p
              className="mt-2 truncate text-lg font-semibold text-slate-900 dark:text-white"
              title={progress.currentTitle}
              style={{ maxWidth: "100%" }}
            >
              {progress.currentTitle}
            </p>
          </motion.div>
        )}

        {(bypassCache || freshSearch) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-3 rounded-2xl border border-blue-200/60 bg-blue-50/60 p-4 text-sm text-blue-700 shadow-sm dark:border-blue-500/25 dark:bg-blue-900/15 dark:text-blue-200"
          >
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-600 dark:bg-blue-500/22 dark:text-blue-200">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Fresh AniList searches enabled
              </p>
              <p className="text-xs text-blue-700/80 dark:text-blue-200/80">
                Bypassing cached results to guarantee the latest data for
                matches.
              </p>
            </div>
          </motion.div>
        )}
      </CardContent>

      <CardFooter className="relative z-10 pt-0 pb-6">
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <PauseResumeButton
            isPaused={isPaused}
            isManuallyPaused={isManuallyPaused}
            onResumeProcess={onResumeProcess}
            onPauseProcess={onPauseProcess}
            resumeButtonDisabled={resumeButtonDisabled}
            pauseButtonDisabled={pauseButtonDisabled}
          />
          <Button
            variant={isCancelling ? "outline" : "default"}
            size="lg"
            onClick={onCancelProcess}
            disabled={isCancelling || disableControls}
            className={cn(
              "group relative w-full overflow-hidden rounded-2xl text-base font-semibold transition-all duration-200",
              isCancelling
                ? "border border-amber-400/50 bg-amber-50/80 text-amber-600 shadow-inner shadow-amber-200/40 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200"
                : "bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 text-white shadow-lg shadow-rose-500/30 hover:from-rose-600 hover:via-red-600 hover:to-orange-600 focus-visible:ring-rose-400",
            )}
          >
            {isCancelling ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cancelling...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <AlertOctagon className="h-5 w-5" />
                Cancel Process
              </span>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
