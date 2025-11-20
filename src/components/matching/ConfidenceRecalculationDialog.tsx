/**
 * Dialog for managing global confidence recalculation runs with live progress.
 * Keeps the UI responsive while communicating worker progress and status.
 * @source
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/Dialog";
import { Progress } from "../ui/Progress";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert, AlertDescription } from "../ui/Alert";
import { Loader2, RefreshCcw, ShieldHalf, AlertTriangle } from "lucide-react";
import type { ConfidenceRecalculationMetadata } from "@/workers";

interface ConfidenceProgress {
  current: number;
  total: number;
  currentTitle?: string;
}

type ConfidenceRunStatus =
  | "idle"
  | "running"
  | "completed"
  | "error"
  | "cancelled";

export interface ConfidenceRecalculationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress?: ConfidenceProgress | null;
  status: ConfidenceRunStatus;
  matchCount: number;
  lastDurationMs?: number;
  lastCompletedAt?: string;
  errorMessage?: string | null;
  canStart: boolean;
  onStart: () => void;
  onCancel: () => void;
  metadata?: ConfidenceRecalculationMetadata | null;
}

const statusConfig: Record<
  ConfidenceRunStatus,
  { label: string; tone: string }
> = {
  idle: {
    label: "Ready to run",
    tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  running: {
    label: "Recalculation in progress",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200",
  },
  completed: {
    label: "Completed",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  error: {
    label: "Failed",
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  },
  cancelled: {
    label: "Cancelled",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  },
};

const statusMessages: Record<ConfidenceRunStatus, string> = {
  idle: "Launch a run to refresh existing scores.",
  running: "Working through stored matches...",
  completed: "Confidence recalculation finished successfully.",
  cancelled: "Run cancelled before completion.",
  error: "An error occurred during the confidence recalculation.",
};

const formatDuration = (ms?: number) => {
  if (!ms || Number.isNaN(ms)) {
    return "--";
  }
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 1000 * 60) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} mins`;
};

interface ProgressDisplayState {
  percentage: number;
  progressLabel: string;
}

const deriveProgressDisplayState = (
  progress: ConfidenceProgress | undefined | null,
  metadata: ConfidenceRecalculationMetadata | undefined | null,
  matchCount: number,
  isRunning: boolean,
): ProgressDisplayState => {
  const progressCurrent = progress?.current ?? 0;
  const progressTotal = progress?.total ?? matchCount;
  const metadataCounts =
    metadata &&
    typeof metadata.processed === "number" &&
    typeof metadata.totalItems === "number"
      ? { current: metadata.processed, total: metadata.totalItems }
      : null;

  const displayCounts = isRunning
    ? { current: progressCurrent, total: progressTotal }
    : (metadataCounts ?? { current: progressCurrent, total: progressTotal });

  const ratioToUse =
    displayCounts.total > 0 ? displayCounts.current / displayCounts.total : 0;
  const rawPercentage = Number.isFinite(ratioToUse) ? ratioToUse * 100 : 0;
  const percentage = Number.isFinite(rawPercentage)
    ? Math.min(100, Math.max(0, Math.round(rawPercentage)))
    : 0;

  let progressLabel = "Awaiting start";
  if (isRunning) {
    if (
      progress &&
      typeof progress.current === "number" &&
      typeof progress.total === "number"
    ) {
      progressLabel = `${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`;
    } else if (matchCount > 0) {
      progressLabel = `0 / ${matchCount.toLocaleString()}`;
    }
  } else if (metadataCounts) {
    progressLabel = `Processed ${metadataCounts.current.toLocaleString()} of ${metadataCounts.total.toLocaleString()} entries`;
  } else if (displayCounts.total > 0) {
    progressLabel = `${displayCounts.current.toLocaleString()} / ${displayCounts.total.toLocaleString()}`;
  }

  return { percentage, progressLabel };
};

export function ConfidenceRecalculationDialog(
  props: Readonly<ConfidenceRecalculationDialogProps>,
) {
  const {
    open,
    onOpenChange,
    progress,
    status,
    matchCount,
    lastDurationMs,
    lastCompletedAt,
    errorMessage,
    canStart,
    onStart,
    onCancel,
    metadata,
  } = props;

  const isRunning = status === "running";
  const { percentage, progressLabel } = deriveProgressDisplayState(
    progress,
    metadata,
    matchCount,
    isRunning,
  );
  const statusBadge = statusConfig[status];

  let progressMessage = statusMessages[status];
  if (isRunning && progress?.currentTitle) {
    progressMessage = `Currently updating "${progress.currentTitle}"`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl space-y-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <ShieldHalf className="h-5 w-5" />
            Recalculate Confidence Scores
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusBadge.tone}>{statusBadge.label}</Badge>
            <span className="text-sm text-slate-500 dark:text-slate-300">
              {matchCount.toLocaleString()} entries queued
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>Processing progress</span>
              <span>{progressLabel}</span>
            </div>
            <Progress value={percentage} className="h-2" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {progressMessage}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Last duration
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                {formatDuration(lastDurationMs)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Last completed
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                {lastCompletedAt
                  ? new Date(lastCompletedAt).toLocaleString()
                  : "--"}
              </p>
            </div>
          </div>

          {errorMessage && status === "error" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {isRunning ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="flex items-center gap-2"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Cancel run
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onStart}
              disabled={!canStart || matchCount === 0}
              className="flex items-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Start recalculation
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
