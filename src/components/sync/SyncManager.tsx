/**
 * @packageDocumentation
 * @module SyncManager
 * @description React component for orchestrating and displaying the manga synchronization process with AniList.
 * Handles progress tracking, error recovery, incremental sync strategy, rate limit handling, and session resumption.
 */

// Progress count display for incremental updates - currently marks as complete upfront causing incorrect display (e.g., 3/20 at start instead of 0/20). Should complete incremental updates at the end of the sync process. This is not a problem with actually updating entries but with how the progress of how many entries have been updated is displayed.

import React, { useEffect, useMemo, useState } from "react";
import { SyncProgress, SyncReport } from "../../api/anilist/sync-service";
import { AniListMediaEntry } from "../../api/anilist/types";
import {
  ErrorRecoveryAction,
  getRecoveryActionMessage,
} from "../../utils/errorHandling";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Sparkles,
  Activity,
  Gauge,
  ShieldAlert,
  TimerReset,
  PauseCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { useRateLimit } from "../../contexts/RateLimitContext";

/**
 * Type alias for error recovery action types.
 * Represents the different actions that can be taken to recover from sync errors.
 */
type RecoveryActionType =
  | "retry"
  | "refresh-token"
  | "check-connection"
  | "wait";

/**
 * Displays current synchronization progress with percentage, entry count, and status message.
 * Includes accessible progress bar and screen reader announcements for status updates.
 * Shows remaining entries, pause state, or completion status with appropriate messaging.
 * @param props - Object containing progress data and status string.
 * @param props.completedEntries - Number of entries successfully synced so far.
 * @param props.totalEntries - Total number of entries in the sync batch.
 * @param props.progressPercentage - Percentage of sync completion (0-100).
 * @param props.status - Current sync status ("idle" | "syncing" | "paused" | "completed" | "failed").
 * @returns Progress display card with percentage, progress bar, and status message.
 * @source
 */
const ProgressDisplay: React.FC<{
  completedEntries: number;
  totalEntries: number;
  progressPercentage: number;
  status: string;
}> = ({ completedEntries, totalEntries, progressPercentage, status }) => {
  const remainingEntries = Math.max(totalEntries - completedEntries, 0);

  const statusMessage = (() => {
    if (status === "syncing") {
      return `${remainingEntries} entr${remainingEntries === 1 ? "y" : "ies"} remaining`;
    }

    if (status === "paused") {
      return `${remainingEntries} entr${remainingEntries === 1 ? "y" : "ies"} waiting to resume.`;
    }

    if (status === "completed") {
      return "All updates finished successfully.";
    }

    if (status === "failed") {
      return "Some entries need attention; review the details below.";
    }

    return "Ready to begin synchronization.";
  })();

  return (
    <div className="mb-6 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/60">
      {/* Live region for progress updates */}
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {completedEntries} of {totalEntries} entries synced.{" "}
        {progressPercentage}% complete.
      </output>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="bg-linear-to-br flex h-12 w-12 shrink-0 items-center justify-center rounded-full from-blue-500 to-indigo-500 text-white shadow-lg">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Synchronization progress
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {completedEntries} / {totalEntries} entries processed
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {statusMessage}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-blue-200/70 bg-blue-50/70 text-lg font-semibold text-blue-600 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/40 dark:text-blue-200">
            {progressPercentage}%
          </div>
          <div className="min-w-[200px]">
            <div
              className="h-3 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/60"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Synchronization progress: ${progressPercentage}% complete`}
            >
              <div
                className="bg-linear-to-r h-full rounded-full from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Renders status-dependent alerts for different sync states: idle, syncing, paused, completion, and errors.
 * Displays appropriate messaging, controls (incremental sync toggle), and visual indicators for each state.
 * @param props - Object containing sync status and configuration data.
 * @param props.status - Current sync status affecting alert display.
 * @param props.entries - Array of entries staged for sync.
 * @param props.incrementalSync - Whether incremental sync is enabled.
 * @param props.onIncrementalSyncChange - Optional callback when incremental sync toggle changes.
 * @param props.autoStart - Whether sync should auto-start without user action.
 * @param props.syncState - Optional current sync state with error/progress/resume metadata.
 * @returns Alert component with status-specific messaging and controls.
 * @source
 */
const StatusAlerts: React.FC<{
  status: string;
  entries: AniListMediaEntry[];
  incrementalSync: boolean;
  onIncrementalSyncChange?: (value: boolean) => void;
  autoStart: boolean;
  syncState?: {
    error?: string | null;
    progress?: SyncProgress | null;
    resumeMetadata?: {
      remainingMediaIds: number[];
      timestamp: number;
    } | null;
  };
}> = ({
  status,
  entries,
  incrementalSync,
  onIncrementalSyncChange,
  autoStart,
  syncState,
}) => {
  const renderIdle = () => {
    if (autoStart) return null;
    return (
      <div className="mb-6 text-center">
        <div className="relative overflow-hidden rounded-3xl border border-blue-200/70 bg-blue-50/70 p-6 shadow-sm dark:border-blue-800/60 dark:bg-blue-900/30">
          <div className="bg-linear-to-br pointer-events-none absolute inset-0 from-blue-100/70 via-transparent to-indigo-100/40 dark:from-blue-900/30 dark:via-transparent dark:to-indigo-900/30" />
          <div className="relative flex flex-col items-center gap-3">
            <div className="bg-linear-to-br flex h-12 w-12 items-center justify-center rounded-full from-blue-500 to-indigo-500 text-white shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                Ready to synchronize
              </h3>
              <p className="mt-1 max-w-sm text-sm text-blue-700/80 dark:text-blue-200/80">
                {entries.length} manga{" "}
                {entries.length === 1 ? "entry" : "entries"} are staged with
                changes. Fine tune your update strategy before launching.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/80 px-3 py-2 shadow-sm dark:border-blue-800/50 dark:bg-blue-950/40">
              <Switch
                id="incrementalSync"
                checked={incrementalSync}
                onCheckedChange={onIncrementalSyncChange}
                data-testid="switch"
              />
              <div className="text-left">
                <Label
                  htmlFor="incrementalSync"
                  className="text-sm font-medium text-blue-900 dark:text-blue-200"
                >
                  Use incremental progress updates
                </Label>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/70">
                  Breaks large jumps into steps so AniList merges activity
                  smoothly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSyncing = () => (
    <Alert className="mb-4 border-blue-200/70 bg-blue-50/80 backdrop-blur-md dark:border-blue-800/60 dark:bg-blue-900/30">
      <div className="flex gap-3">
        <div className="bg-linear-to-br flex h-10 w-20 shrink-0 items-center justify-center rounded-full from-blue-500 to-indigo-500 text-white shadow">
          <RefreshCw className="h-5 w-10 animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <AlertTitle className="text-blue-800 dark:text-blue-200">
            Synchronization in progress
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm text-blue-700/80 dark:text-blue-200/80">
            {incrementalSync
              ? "Applying incremental updates to trigger AniList activity merges. Larger entries may take an extra moment."
              : "Updating your AniList library with the latest Kenmei data. Sit tight — this won't take long."}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );

  const renderPaused = () => {
    const pausedAt = syncState?.resumeMetadata?.timestamp
      ? new Date(syncState.resumeMetadata.timestamp).toLocaleTimeString()
      : null;
    const remainingCount =
      syncState?.resumeMetadata?.remainingMediaIds.length || 0;
    const completedCount = syncState?.progress?.completed || 0;
    const totalCount = syncState?.progress?.total || remainingCount;
    const percentage =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <Alert className="mb-4 border-amber-200/70 bg-amber-50/80 backdrop-blur-md dark:border-amber-800/60 dark:bg-amber-900/30">
        <div className="flex gap-3">
          <div className="bg-linear-to-br flex h-10 w-20 shrink-0 items-center justify-center rounded-full from-amber-500 to-orange-500 text-white shadow">
            <PauseCircle className="h-5 w-10" />
          </div>
          <div className="min-w-0 flex-1">
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              Synchronization paused
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm text-amber-700/80 dark:text-amber-200/80">
              Your progress is saved. Resume whenever you&apos;re ready to pick
              up where you left off.
              {pausedAt && (
                <span className="ml-1 inline-block text-xs text-amber-600/70 dark:text-amber-300/70">
                  Paused at {pausedAt}
                </span>
              )}
              {remainingCount > 0 && (
                <div className="mt-2 text-xs text-amber-600/70 dark:text-amber-300/70">
                  <div>{remainingCount} entries remaining</div>
                  <div>
                    Checkpoint: {percentage}% complete before interruption
                  </div>
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  };

  const renderCompleted = () => (
    <Alert className="mb-4 border-emerald-200/70 bg-emerald-50/80 backdrop-blur-md dark:border-emerald-800/50 dark:bg-emerald-900/20">
      <div className="flex gap-3">
        <div className="bg-linear-to-br flex h-10 w-20 shrink-0 items-center justify-center rounded-full from-emerald-500 to-teal-500 text-white shadow">
          <CheckCircle className="h-5 w-10" />
        </div>
        <div className="min-w-0 flex-1">
          <AlertTitle className="text-emerald-800 dark:text-emerald-200">
            Synchronization complete
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-200/80">
            All entries are now up to date on AniList. Review the summary below
            or head back to your dashboard.
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );

  const renderFailed = () => (
    <Alert className="mb-4 border-rose-200/70 bg-rose-50/80 backdrop-blur-md dark:border-rose-900/60 dark:bg-rose-950/30">
      <div className="flex gap-3">
        <div className="bg-linear-to-br flex h-10 w-20 shrink-0 items-center justify-center rounded-full from-rose-500 to-red-500 text-white shadow">
          <ShieldAlert className="h-5 w-10" />
        </div>
        <div className="min-w-0 flex-1">
          <AlertTitle className="text-rose-800 dark:text-rose-200">
            Synchronization interrupted
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm text-rose-700/80 dark:text-rose-200/80">
            {syncState?.error?.includes("cancelled")
              ? "You stopped this sync. Resume when you're ready — no further entries were processed."
              : syncState?.error ||
                "A few entries didn't make it through. Review the errors below or retry the failed updates."}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );

  const renderers: Record<string, () => React.ReactElement | null> = {
    idle: renderIdle,
    syncing: renderSyncing,
    paused: renderPaused,
    completed: renderCompleted,
    failed: renderFailed,
  };

  return renderers[status] ? renderers[status]() : null;
};

// Helper component for current entry display
const CurrentEntryDisplay: React.FC<{
  progress: SyncProgress;
  entries: AniListMediaEntry[];
  status: string;
  incrementalSync: boolean;
}> = ({ progress, entries, status, incrementalSync }) => {
  if (status !== "syncing" || !progress.currentEntry) return null;

  return (
    <div className="bg-linear-to-br relative mb-6 overflow-hidden rounded-3xl border border-blue-200/70 from-blue-50/70 via-white/70 to-indigo-50/70 p-5 shadow-sm backdrop-blur-xl dark:border-blue-900/60 dark:from-blue-950/30 dark:via-slate-950/40 dark:to-indigo-950/30">
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        {progress.currentEntry.coverImage && (
          <div className="relative h-28 w-20 overflow-hidden rounded-2xl shadow-lg">
            <img
              src={progress.currentEntry.coverImage}
              alt={progress.currentEntry.title}
              className="h-full w-full object-cover"
            />
            <div className="bg-linear-to-t absolute inset-0 from-black/40 via-transparent to-transparent" />
          </div>
        )}

        <div className="flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-300">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Currently syncing
              </p>
              <h3 className="mt-1 text-xl font-semibold text-blue-950 dark:text-blue-100">
                {progress.currentEntry.title}
              </h3>
            </div>

            {incrementalSync && progress.totalSteps && progress.currentStep && (
              <div className="flex items-center gap-3 rounded-2xl border border-blue-200/60 bg-blue-100/60 px-3 py-2 text-xs font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/40 dark:text-blue-200">
                <Gauge className="h-4 w-4" />
                Step {progress.currentStep} of {progress.totalSteps}
                <span className="inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
                  {Math.round(
                    (progress.currentStep / progress.totalSteps) * 100,
                  )}
                  %
                </span>
              </div>
            )}
          </div>

          {incrementalSync && progress.totalSteps && progress.currentStep && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200/70 dark:bg-blue-900/40">
              <div
                className="bg-linear-to-r h-full rounded-full from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
                style={{
                  width: `${(progress.currentStep / progress.totalSteps) * 100}%`,
                }}
              />
            </div>
          )}

          {(() => {
            const currentEntry = entries.find(
              (entry) => entry.mediaId === progress.currentEntry?.mediaId,
            );

            if (!currentEntry) return null;

            if (!currentEntry.previousValues) {
              return (
                <div className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  New entry will be created on AniList
                </div>
              );
            }

            const fieldPills = [
              {
                label: "Progress",
                previous: currentEntry.previousValues?.progress ?? "—",
                next: currentEntry.progress ?? "—",
                changed:
                  currentEntry.previousValues?.progress !==
                  currentEntry.progress,
              },
              {
                label: "Status",
                previous: currentEntry.previousValues?.status ?? "—",
                next: currentEntry.status ?? "—",
                changed:
                  currentEntry.previousValues?.status !== currentEntry.status,
              },
              {
                label: "Score",
                previous:
                  currentEntry.previousValues?.score === null ||
                  currentEntry.previousValues?.score === undefined
                    ? "—"
                    : Math.round(currentEntry.previousValues.score).toString(),
                next:
                  currentEntry.score === null ||
                  currentEntry.score === undefined
                    ? "—"
                    : Math.round(currentEntry.score).toString(),
                changed:
                  currentEntry.previousValues?.score !== currentEntry.score,
              },
            ];

            return (
              <div className="flex flex-wrap gap-2">
                {fieldPills.map(({ label, previous, next, changed }) => {
                  return (
                    <div
                      key={label}
                      className="group inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-50/70 px-3 py-1 text-xs text-blue-800 shadow-sm transition dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-300">
                        {label}
                      </span>
                      <span className="text-blue-700/80 line-through decoration-blue-400/70 decoration-dotted dark:text-blue-300/70">
                        {previous}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-blue-400"
                      >
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                      <span
                        className={`text-sm font-semibold ${
                          changed
                            ? "text-blue-900 dark:text-blue-100"
                            : "text-blue-700/80 dark:text-blue-300/80"
                        }`}
                      >
                        {next}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// Helper component for error details
const ErrorDetails: React.FC<{
  report: SyncReport;
  onRetry?: (mediaId: number) => Promise<void>;
  onRefreshToken?: () => Promise<void>;
  onCheckConnection?: () => Promise<void>;
}> = ({ report, onRetry, onRefreshToken, onCheckConnection }) => {
  if (report.errors.length === 0) return null;

  /**
   * Maps ErrorRecoveryAction enum to an action type tuple.
   * Used to determine button text and behavior.
   */
  const mapRecoveryActionToType = (
    action: ErrorRecoveryAction,
  ): {
    actionType: RecoveryActionType;
    label: string;
  } => {
    switch (action) {
      case ErrorRecoveryAction.RETRY:
        return { actionType: "retry", label: "Retry" };
      case ErrorRecoveryAction.CHECK_CONNECTION:
        return { actionType: "check-connection", label: "Check Connection" };
      case ErrorRecoveryAction.REFRESH_TOKEN:
        return { actionType: "refresh-token", label: "Refresh Token" };
      case ErrorRecoveryAction.WAIT_RATE_LIMIT:
        return { actionType: "wait", label: "Wait & Retry" };
      case ErrorRecoveryAction.CONTACT_SUPPORT:
        return { actionType: "wait", label: "Contact Support" };
      case ErrorRecoveryAction.NONE:
      default:
        return { actionType: "retry", label: "Retry" };
    }
  };

  /**
   * Infer recovery action based on error message patterns.
   * Used as fallback when explicit recovery actions are not provided.
   */
  const inferRecoveryAction = (
    errorMessage: string,
  ): {
    recoveryAction: ErrorRecoveryAction;
    actionType: RecoveryActionType;
    label: string;
  } => {
    const lowerError = errorMessage.toLowerCase();

    if (
      lowerError.includes("network") ||
      lowerError.includes("fetch") ||
      lowerError.includes("connection")
    ) {
      return {
        recoveryAction: ErrorRecoveryAction.CHECK_CONNECTION,
        actionType: "check-connection",
        label: "Check Connection",
      };
    }

    if (
      lowerError.includes("unauthorized") ||
      lowerError.includes("token") ||
      lowerError.includes("auth")
    ) {
      return {
        recoveryAction: ErrorRecoveryAction.REFRESH_TOKEN,
        actionType: "refresh-token",
        label: "Refresh Token",
      };
    }

    if (lowerError.includes("rate") || lowerError.includes("429")) {
      return {
        recoveryAction: ErrorRecoveryAction.WAIT_RATE_LIMIT,
        actionType: "wait",
        label: "Wait & Retry",
      };
    }

    if (lowerError.includes("timeout") || lowerError.includes("408")) {
      return {
        recoveryAction: ErrorRecoveryAction.WAIT_RATE_LIMIT,
        actionType: "wait",
        label: "Retry Later",
      };
    }

    return {
      recoveryAction: ErrorRecoveryAction.RETRY,
      actionType: "retry",
      label: "Retry",
    };
  };

  const handleActionClick = async (
    actionType: RecoveryActionType,
    mediaId: number,
  ) => {
    try {
      switch (actionType) {
        case "retry":
          if (onRetry) {
            await onRetry(mediaId);
          }
          break;
        case "refresh-token":
          if (onRefreshToken) {
            await onRefreshToken();
          }
          break;
        case "check-connection":
          if (onCheckConnection) {
            await onCheckConnection();
          }
          break;
        case "wait":
          // Wait action - no callback needed, message is informational
          break;
      }
    } catch (error) {
      console.error(
        `[ErrorDetails] Error executing action ${actionType}:`,
        error,
      );
    }
  };

  return (
    <div className="rounded-3xl border border-rose-200/60 bg-rose-50/70 p-5 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          {report.errors.length} issue
          {report.errors.length === 1 ? "" : "s"} detected
        </div>
        <span className="text-xs text-rose-600/80 dark:text-rose-200/70">
          Review the entries below and use suggested actions to resolve them.
        </span>
      </div>
      <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
        {report.errors.map((errorItem) => {
          // Check if error item has explicit recovery action
          const errorData = errorItem as Record<string, unknown>;
          const hasExplicitRecovery =
            typeof errorData.recoveryAction === "string";

          // Use explicit recovery action if present, otherwise infer from error message
          const recoveryAction = hasExplicitRecovery
            ? (errorData.recoveryAction as ErrorRecoveryAction)
            : inferRecoveryAction(errorItem.error).recoveryAction;

          const { actionType, label } = hasExplicitRecovery
            ? mapRecoveryActionToType(recoveryAction)
            : inferRecoveryAction(errorItem.error);

          // Get helper text from the centralized function
          const helperText = getRecoveryActionMessage(recoveryAction);

          const isActionable =
            actionType !== "wait" &&
            ((actionType === "retry" && onRetry) ||
              (actionType === "refresh-token" && onRefreshToken) ||
              (actionType === "check-connection" && onCheckConnection));

          return (
            <div
              key={errorItem.mediaId}
              className="group overflow-hidden rounded-2xl border border-rose-200/60 bg-white/80 p-4 shadow-sm transition dark:border-rose-900/50 dark:bg-rose-950/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-200">
                    <XCircle className="h-4 w-4 text-rose-500" />
                    Media ID {errorItem.mediaId}
                  </p>
                  <p className="mt-2 text-xs text-rose-600/80 dark:text-rose-200/80">
                    {errorItem.error}
                  </p>
                  {helperText && (
                    <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                      💡 {helperText}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-500 dark:bg-rose-500/20 dark:text-rose-200">
                    {label}
                  </span>
                  {isActionable && (
                    <button
                      onClick={() =>
                        handleActionClick(actionType, errorItem.mediaId)
                      }
                      className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30"
                    >
                      Try Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper component for sync actions
const SyncActions: React.FC<{
  status: string;
  onStartSync: () => void;
  onCancel: () => void;
  onPause?: () => void;
  onResume?: () => void;
  canResume?: boolean;
  syncState?: { report?: SyncReport | null };
}> = ({
  status,
  onStartSync,
  onCancel,
  onPause,
  onResume,
  canResume,
  syncState,
}) => {
  if (status === "idle") {
    return (
      <>
        <Button
          variant="outline"
          onClick={onCancel}
          className="gap-2 border-slate-300/60 bg-white/70 text-slate-600 transition hover:bg-white dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200"
        >
          <XCircle className="h-4 w-4" />
          Cancel
        </Button>
        <Button
          onClick={onStartSync}
          className="bg-linear-to-r gap-2 from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500"
        >
          <Sparkles className="h-4 w-4" />
          Launch sync
        </Button>
      </>
    );
  }

  if (status === "syncing") {
    return (
      <>
        {onPause && (
          <Button
            variant="outline"
            onClick={onPause}
            className="gap-2 border-slate-300/60 bg-white/70 text-slate-600 transition hover:bg-white dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200"
          >
            <PauseCircle className="h-4 w-4 text-amber-500" />
            Pause sync
          </Button>
        )}
        <Button
          variant="destructive"
          onClick={onCancel}
          className="bg-linear-to-r gap-2 from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/30 transition hover:from-rose-500 hover:to-red-500"
        >
          <ShieldAlert className="h-4 w-4" />
          Cancel sync
        </Button>
      </>
    );
  }

  if (status === "paused") {
    return (
      <>
        <Button
          variant="outline"
          onClick={onCancel}
          className="gap-2 border-slate-300/60 bg-white/70 text-slate-600 transition hover:bg-white dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200"
        >
          <TimerReset className="h-4 w-4 text-slate-500 dark:text-slate-300" />
          Close
        </Button>
        {onResume && canResume && (
          <Button
            onClick={onResume}
            className="bg-linear-to-r gap-2 from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500"
          >
            <RefreshCw className="h-4 w-4" />
            Resume sync
          </Button>
        )}
      </>
    );
  }

  if (status === "completed" || status === "failed") {
    return (
      <>
        <Button
          variant="outline"
          onClick={onCancel}
          className="gap-2 border-slate-300/60 bg-white/70 text-slate-600 transition hover:bg-white dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200"
        >
          <TimerReset className="h-4 w-4 text-slate-500 dark:text-slate-300" />
          Close
        </Button>

        {status === "failed" &&
          syncState?.report &&
          syncState.report.errors.length > 0 && (
            <Button
              onClick={onStartSync}
              className="bg-linear-to-r gap-2 from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/30 transition hover:from-amber-500 hover:via-orange-500 hover:to-rose-500"
            >
              <RefreshCw className="h-4 w-4" />
              Retry failed updates
            </Button>
          )}
      </>
    );
  }

  return null;
};

/**
 * Props for the SyncManager component.
 *
 * @property entries - Array of AniList media entries to synchronize with detailed metadata.
 * @property token - AniList authentication bearer token for API requests.
 * @property onComplete - Optional callback invoked upon sync completion, receives the sync report with results.
 * @property onCancel - Optional callback invoked when user cancels the sync operation.
 * @property autoStart - Whether to automatically initiate sync on component mount (default: true).
 * @property syncState - Optional current sync state containing progress, report, errors, and resume metadata.
 * @property syncActions - Optional object with sync orchestration functions (start, cancel, pause, resume).
 * @property incrementalSync - Whether to break large progress jumps into incremental steps for better AniList activity merging.
 * @property onIncrementalSyncChange - Optional callback when user toggles incremental sync mode.
 * @property displayOrderMediaIds - Optional array of media IDs to control the display order in UI.
 * @source
 */
export interface SyncManagerProps {
  entries: AniListMediaEntry[];
  token: string;
  onComplete?: (report: SyncReport) => void;
  onCancel?: () => void;
  autoStart?: boolean;
  syncState?: {
    isActive: boolean;
    progress: SyncProgress | null;
    report: SyncReport | null;
    error: string | null;
    isPaused?: boolean;
    resumeAvailable?: boolean;
    resumeMetadata?: {
      remainingMediaIds: number[];
      timestamp: number;
    } | null;
  };
  syncActions?: {
    startSync: (
      entries: AniListMediaEntry[],
      token: string,
      _?: undefined,
      displayOrderMediaIds?: number[],
    ) => Promise<void>;
    cancelSync: () => void;
    pauseSync?: () => void;
    resumeSync?: (
      entries: AniListMediaEntry[],
      token: string,
      _?: undefined,
      displayOrderMediaIds?: number[],
    ) => Promise<void>;
  };
  incrementalSync?: boolean;
  onIncrementalSyncChange?: (value: boolean) => void;
  displayOrderMediaIds?: number[];
}

/**
 * Main synchronization orchestration component for syncing manga entries to AniList.
 *
 * Manages the complete sync lifecycle: initial state setup, progress tracking,
 * error handling with recovery options, pause/resume functionality, and result display.
 * Supports incremental progress updates, rate limiting awareness, and checkpointed resumption.
 *
 * UI includes:
 * - Real-time progress bar with percentage and entry count
 * - Status-dependent alerts (idle, syncing, paused, completed, failed)
 * - Current entry display with cover image and metadata
 * - Error details with action buttons for recovery
 * - Results summary with statistics and export capability
 *
 * @param props - Component props with entries, token, sync actions, and callbacks.
 * @returns Complete sync UI with progress, status, and results display.
 * @source
 */
const SyncManager: React.FC<SyncManagerProps> = ({
  entries,
  token,
  onComplete,
  onCancel,
  autoStart = true,
  syncState,
  syncActions,
  incrementalSync = false,
  onIncrementalSyncChange,
  displayOrderMediaIds,
}) => {
  const { rateLimitState } = useRateLimit();
  const [progressBaseline, setProgressBaseline] = useState<SyncProgress | null>(
    null,
  );
  const [resumeOffsets, setResumeOffsets] = useState({
    initialized: false,
    completed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  });

  useEffect(() => {
    if (syncState?.isPaused && syncState.progress) {
      setProgressBaseline(syncState.progress);
    }
  }, [syncState?.isPaused, syncState?.progress]);

  useEffect(() => {
    if (syncState?.resumeAvailable && syncState.progress && !progressBaseline) {
      setProgressBaseline(syncState.progress);
    }
  }, [progressBaseline, syncState?.progress, syncState?.resumeAvailable]);

  useEffect(() => {
    if (
      !syncState?.isActive &&
      !syncState?.isPaused &&
      !syncState?.resumeAvailable
    ) {
      setProgressBaseline(null);
      setResumeOffsets({
        initialized: false,
        completed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
      });
    }
  }, [syncState?.isActive, syncState?.isPaused, syncState?.resumeAvailable]);

  // Use progress from sync-service, fallback to default
  const defaultProgress: SyncProgress = {
    total: progressBaseline?.total ?? entries.length,
    completed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    currentEntry: null,
    currentStep: null,
    totalSteps: null,
    rateLimited: false,
    retryAfter: null,
  };

  const liveProgress = syncState?.progress ?? null;

  const computeStatus = (s?: SyncManagerProps["syncState"]) => {
    if (!s) return "idle" as const;
    if (s.isActive) return "syncing" as const;
    if (s.isPaused || s.resumeAvailable) return "paused" as const;
    if (s.report)
      return s.report.failedUpdates > 0
        ? ("failed" as const)
        : ("completed" as const);
    if (s.error) return "failed" as const;
    return "idle" as const;
  };

  const status = computeStatus(syncState);

  useEffect(() => {
    if (
      status === "syncing" &&
      progressBaseline &&
      (progressBaseline.completed > 0 ||
        progressBaseline.successful > 0 ||
        progressBaseline.failed > 0 ||
        progressBaseline.skipped > 0) &&
      liveProgress &&
      !resumeOffsets.initialized
    ) {
      setResumeOffsets({
        initialized: true,
        completed: liveProgress.completed,
        successful: liveProgress.successful,
        failed: liveProgress.failed,
        skipped: liveProgress.skipped,
      });
    }

    if (status !== "syncing" || !progressBaseline) {
      if (resumeOffsets.initialized || resumeOffsets.completed !== 0) {
        setResumeOffsets({
          initialized: false,
          completed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
        });
      }
    }
  }, [status, progressBaseline, liveProgress, resumeOffsets]);

  const displayProgress = useMemo<SyncProgress>(() => {
    if (!progressBaseline && !liveProgress) {
      return defaultProgress;
    }

    if (!progressBaseline) {
      return liveProgress ?? defaultProgress;
    }

    if (!liveProgress) {
      return progressBaseline;
    }

    if (status === "paused") {
      return {
        ...progressBaseline,
        currentEntry:
          liveProgress.currentEntry ?? progressBaseline.currentEntry,
        currentStep: liveProgress.currentStep ?? progressBaseline.currentStep,
        totalSteps: liveProgress.totalSteps ?? progressBaseline.totalSteps,
        rateLimited: liveProgress.rateLimited,
        retryAfter: liveProgress.retryAfter,
      };
    }

    const combinedTotal =
      progressBaseline.total || liveProgress.total || defaultProgress.total;

    const liveCompletedOffset = resumeOffsets.initialized
      ? resumeOffsets.completed
      : 0;
    const liveSuccessfulOffset = resumeOffsets.initialized
      ? resumeOffsets.successful
      : 0;
    const liveFailedOffset = resumeOffsets.initialized
      ? resumeOffsets.failed
      : 0;
    const liveSkippedOffset = resumeOffsets.initialized
      ? resumeOffsets.skipped
      : 0;

    const incrementalCompleted = Math.max(
      (liveProgress.completed ?? 0) - liveCompletedOffset,
      0,
    );
    const incrementalSuccessful = Math.max(
      (liveProgress.successful ?? 0) - liveSuccessfulOffset,
      0,
    );
    const incrementalFailed = Math.max(
      (liveProgress.failed ?? 0) - liveFailedOffset,
      0,
    );
    const incrementalSkipped = Math.max(
      (liveProgress.skipped ?? 0) - liveSkippedOffset,
      0,
    );

    return {
      ...liveProgress,
      total: combinedTotal,
      completed: Math.min(
        combinedTotal,
        progressBaseline.completed + incrementalCompleted,
      ),
      successful: progressBaseline.successful + incrementalSuccessful,
      failed: progressBaseline.failed + incrementalFailed,
      skipped: progressBaseline.skipped + incrementalSkipped,
      rateLimited: liveProgress.rateLimited,
      retryAfter: liveProgress.retryAfter,
    };
  }, [defaultProgress, liveProgress, progressBaseline, resumeOffsets, status]);

  const completedEntries = displayProgress.completed;
  const totalEntries = displayProgress.total;
  const progressPercentage =
    totalEntries > 0 ? Math.floor((completedEntries / totalEntries) * 100) : 0;

  const remainingEntries = Math.max(totalEntries - completedEntries, 0);
  const retryAfterMs =
    displayProgress.retryAfter ?? rateLimitState.retryAfter ?? null;
  const retryAfterSeconds =
    typeof retryAfterMs === "number"
      ? Math.max(Math.ceil(retryAfterMs / 1000), 1)
      : null;

  const statusDetails = (() => {
    switch (status) {
      case "syncing":
        return {
          label: "Running now",
          icon: RefreshCw,
          badgeClass:
            "bg-blue-500/15 text-blue-600 ring-1 ring-inset ring-blue-500/30 dark:text-blue-200",
          iconClass: "text-blue-500 animate-spin",
        };
      case "completed":
        return {
          label: "Finished",
          icon: CheckCircle,
          badgeClass:
            "bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300",
          iconClass: "text-emerald-500",
        };
      case "failed":
        return {
          label: "Attention needed",
          icon: ShieldAlert,
          badgeClass:
            "bg-rose-500/10 text-rose-600 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300",
          iconClass: "text-rose-500",
        };
      case "paused":
        return {
          label: "Paused",
          icon: PauseCircle,
          badgeClass:
            "bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
          iconClass: "text-amber-500",
        };
      case "idle":
      default:
        return {
          label: "Awaiting launch",
          icon: Sparkles,
          badgeClass:
            "bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/30 dark:text-indigo-200",
          iconClass: "text-indigo-500",
        };
    }
  })();

  const StatusIcon = statusDetails.icon;

  // Handle start synchronization
  const handleStartSync = async () => {
    console.info(
      `[SyncManager] 🚀 Starting sync with ${entries.length} entries (incremental: ${incrementalSync})`,
    );
    setProgressBaseline(null);
    if (syncActions?.startSync) {
      if (incrementalSync) {
        console.debug(
          "[SyncManager] 🔍 Processing entries for incremental sync...",
        );
        const processedEntries = entries.map((entry) => {
          // For new entries (no previousValues), use incremental sync if progress > 1
          if (!entry.previousValues) {
            const shouldUseIncremental = entry.progress > 1;
            return {
              ...entry,
              syncMetadata: {
                useIncrementalSync: shouldUseIncremental,
                targetProgress: entry.progress,
                progress: shouldUseIncremental ? 1 : entry.progress, // Start from 1 for incremental
              },
            };
          }

          // For existing entries, check if incremental sync is needed
          const previousProgress = entry.previousValues.progress || 0;
          const targetProgress = entry.progress;
          const shouldUseIncremental = targetProgress - previousProgress > 1;

          return {
            ...entry,
            syncMetadata: {
              useIncrementalSync: shouldUseIncremental,
              targetProgress,
              progress: shouldUseIncremental
                ? previousProgress + 1
                : entry.progress,
            },
          };
        });
        const incrementalCount = processedEntries.filter(
          (e) => e.syncMetadata?.useIncrementalSync,
        ).length;
        console.info(
          `[SyncManager] ✅ Prepared ${incrementalCount} entries for incremental sync`,
        );

        await syncActions.startSync(
          processedEntries,
          token,
          undefined,
          displayOrderMediaIds,
        );
      } else {
        console.debug("[SyncManager] 🔍 Starting standard sync...");
        await syncActions.startSync(
          entries,
          token,
          undefined,
          displayOrderMediaIds,
        );
      }
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    console.info("[SyncManager] 🛑 Cancelling sync operation");
    if (syncActions?.cancelSync) {
      syncActions.cancelSync();
    }
    if (onCancel) {
      onCancel();
    }
    setProgressBaseline(null);
  };

  const handlePause = () => {
    console.info("[SyncManager] ⏸️ Pausing sync operation");
    if (syncActions?.pauseSync) {
      syncActions.pauseSync();
    }
  };

  const handleResume = () => {
    console.info("[SyncManager] ▶️ Resuming sync operation");
    if (syncActions?.resumeSync) {
      syncActions.resumeSync(entries, token, undefined, displayOrderMediaIds);
    }
  };

  // Recovery action handlers for error details
  const handleErrorRetry = async (mediaId: number) => {
    console.info(`[SyncManager] 🔄 Retrying single entry: ${mediaId}`);
    // This would typically trigger a single-entry retry through syncActions
    // For now, we'll log it - the actual implementation depends on syncActions
  };

  const handleErrorRefreshToken = async () => {
    console.info("[SyncManager] 🔐 Refreshing authentication token");
    // This would typically trigger token refresh through auth context
    // For now, we'll log it - the actual implementation depends on auth context
  };

  const handleErrorCheckConnection = async () => {
    console.info("[SyncManager] 📡 Checking connection status");
    // This would typically trigger a connection check
    // For now, we'll log it - the actual implementation depends on network utilities
  };

  // If completed, notify parent
  useEffect(() => {
    if (status === "completed" || (status === "failed" && syncState?.report)) {
      if (onComplete && syncState?.report) {
        onComplete(syncState.report);
      }
    }
  }, [status, syncState?.report, onComplete]);

  // Auto-start synchronization if enabled
  useEffect(() => {
    if (autoStart && status === "idle" && entries.length > 0) {
      handleStartSync();
    }
  }, [autoStart, status, entries.length]);

  return (
    <Card className="relative mx-auto w-full max-w-3xl overflow-hidden border border-slate-200/70 bg-white/85 shadow-xl shadow-blue-500/10 backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-950/75">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(76,29,149,0.32),transparent_60%)]" />
      <CardHeader className="relative space-y-4 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              AniList sync mission
            </p>
            <CardTitle className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              AniList synchronization
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Updating {totalEntries} manga{" "}
              {totalEntries === 1 ? "entry" : "entries"} with the latest Kenmei
              changes.
            </CardDescription>
          </div>
          <div className="bg-linear-to-br flex h-14 w-14 items-center justify-center rounded-2xl from-blue-500 via-indigo-500 to-purple-500 text-white shadow-lg shadow-blue-500/30">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${statusDetails.badgeClass}`}
          >
            <StatusIcon className={`h-3.5 w-3.5 ${statusDetails.iconClass}`} />
            {statusDetails.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-slate-600 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200">
            <Gauge className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
            {totalEntries} queued
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-slate-600 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200">
            <TimerReset className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
            {incrementalSync ? "Incremental mode" : "Direct mode"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-slate-600 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200">
            <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
            {progressPercentage}% complete
          </span>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-8">
        <ProgressDisplay
          completedEntries={completedEntries}
          totalEntries={totalEntries}
          progressPercentage={progressPercentage}
          status={status}
        />

        <StatusAlerts
          status={status}
          entries={entries}
          incrementalSync={incrementalSync}
          onIncrementalSyncChange={onIncrementalSyncChange}
          autoStart={autoStart}
          syncState={syncState}
        />

        <CurrentEntryDisplay
          progress={displayProgress}
          entries={entries}
          status={status}
          incrementalSync={incrementalSync}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-emerald-700 shadow-inner dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="bg-linear-to-br pointer-events-none absolute inset-0 from-emerald-200/40 via-transparent to-teal-200/20 dark:from-emerald-500/20 dark:to-teal-500/10" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                Successful
              </div>
              <p className="text-3xl font-bold leading-none text-emerald-600 dark:text-emerald-200">
                {displayProgress.successful}
              </p>
              <span className="text-xs text-emerald-600/80 dark:text-emerald-200/70">
                Synced cleanly
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-rose-200/60 bg-rose-50/70 p-4 text-rose-700 shadow-inner dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            <div className="bg-linear-to-br pointer-events-none absolute inset-0 from-rose-200/40 via-transparent to-red-200/20 dark:from-rose-500/20 dark:to-red-500/10" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <XCircle className="h-4 w-4 text-rose-500 dark:text-rose-300" />
                Failed
              </div>
              <p className="text-3xl font-bold leading-none text-rose-600 dark:text-rose-200">
                {displayProgress.failed}
              </p>
              <span className="text-xs text-rose-600/80 dark:text-rose-200/70">
                {displayProgress.failed > 0 ? "Needs follow-up" : "No failures"}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4 text-slate-700 shadow-inner dark:border-slate-800/60 dark:bg-slate-950/40 dark:text-slate-200">
            <div className="bg-linear-to-br pointer-events-none absolute inset-0 from-slate-200/50 via-transparent to-indigo-200/30 dark:from-slate-700/40 dark:to-indigo-900/30" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                Remaining
              </div>
              <p className="text-3xl font-bold leading-none text-slate-700 dark:text-slate-200">
                {remainingEntries}
              </p>
            </div>
          </div>
        </div>

        {status === "syncing" && incrementalSync && (
          <div className="overflow-hidden rounded-3xl border border-amber-200/60 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="bg-linear-to-br flex h-12 w-12 items-center justify-center rounded-2xl from-amber-400 to-orange-500 text-white shadow-lg">
                  <TimerReset className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Incremental sync active
                  </h3>
                  <p className="mt-1 max-w-xs text-xs text-amber-700/80 dark:text-amber-200/80">
                    Large progress jumps are broken into smaller pulses so
                    AniList can merge activity smoothly.
                  </p>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-amber-200/60 bg-amber-100/70 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/40 dark:text-amber-200">
                  <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-amber-600 shadow-sm dark:bg-amber-900/60">
                    1
                  </span>
                  <p className="font-semibold">Initial progress</p>
                  <p className="mt-1 text-amber-600/80 dark:text-amber-200/70">
                    Increment by +1
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200/60 bg-amber-100/70 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/40 dark:text-amber-200">
                  <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-amber-600 shadow-sm dark:bg-amber-900/60">
                    2
                  </span>
                  <p className="font-semibold">Final progress</p>
                  <p className="mt-1 text-amber-600/80 dark:text-amber-200/70">
                    Set target value
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200/60 bg-amber-100/70 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/40 dark:text-amber-200">
                  <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-amber-600 shadow-sm dark:bg-amber-900/60">
                    3
                  </span>
                  <p className="font-semibold">Status & score</p>
                  <p className="mt-1 text-amber-600/80 dark:text-amber-200/70">
                    Update metadata
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "syncing" &&
          (displayProgress.rateLimited || rateLimitState.isRateLimited) &&
          (displayProgress.retryAfter !== null ||
            rateLimitState.retryAfter !== undefined) && (
            <div className="overflow-hidden rounded-3xl border border-rose-200/60 bg-rose-50/80 p-5 shadow-sm backdrop-blur dark:border-rose-900/50 dark:bg-rose-950/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="bg-linear-to-br flex h-12 w-12 items-center justify-center rounded-2xl from-rose-500 to-red-500 text-white shadow-lg">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                      {rateLimitState.isRateLimited
                        ? "Rate limit reached"
                        : "Retrying after hiccup"}
                    </h3>
                    <p className="mt-1 max-w-xs text-xs text-rose-700/80 dark:text-rose-200/80">
                      Pausing briefly to respect AniList limits before
                      continuing the sync.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start justify-center gap-1 rounded-2xl border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-rose-700 shadow-inner dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                  <span>
                    {retryAfterSeconds
                      ? `Resuming in ~${retryAfterSeconds}s`
                      : "Auto-retrying shortly"}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-rose-500 dark:text-rose-300">
                    Patience level: high
                  </span>
                </div>
              </div>
            </div>
          )}

        {syncState?.report && (
          <ErrorDetails
            report={syncState.report}
            onRetry={handleErrorRetry}
            onRefreshToken={handleErrorRefreshToken}
            onCheckConnection={handleErrorCheckConnection}
          />
        )}
      </CardContent>

      <CardFooter className="relative z-10 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/60 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/60">
        <SyncActions
          status={status}
          onStartSync={handleStartSync}
          onCancel={handleCancel}
          onPause={handlePause}
          onResume={handleResume}
          canResume={syncState?.resumeAvailable ?? false}
          syncState={syncState}
        />
      </CardFooter>
    </Card>
  );
};

/**
 * SyncManager React component for managing and displaying the synchronization process of manga entries with AniList.
 *
 * @param props - The props for the SyncManager component.
 * @returns The rendered sync manager React element.
 * @source
 */
export default SyncManager;
