/**
 * @packageDocumentation
 * @module SyncManager
 * @description React component for managing and displaying the synchronization process of manga entries with AniList, including progress, error handling, and incremental sync options.
 */
import React, { useEffect } from "react";
import { SyncProgress, SyncReport } from "../../api/anilist/sync-service";
import { AniListMediaEntry } from "../../api/anilist/types";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { useRateLimit } from "../../contexts/RateLimitContext";

/**
 * Props for the SyncManager component.
 *
 * @property entries - The list of AniList media entries to synchronize.
 * @property token - The AniList authentication token.
 * @property onComplete - Optional callback invoked when synchronization completes, with the sync report.
 * @property onCancel - Optional callback invoked when synchronization is cancelled.
 * @property autoStart - Whether to automatically start synchronization on mount (default: true).
 * @property syncState - Optional sync state object containing progress, report, and error information.
 * @property syncActions - Optional sync actions for starting and cancelling sync.
 * @property incrementalSync - Whether to use incremental sync mode.
 * @property onIncrementalSyncChange - Callback for toggling incremental sync mode.
 * @property displayOrderMediaIds - Optional array of media IDs to control display order.
 * @internal
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
  };
  syncActions?: {
    startSync: (
      entries: AniListMediaEntry[],
      token: string,
      _?: undefined,
      displayOrderMediaIds?: number[],
    ) => Promise<void>;
    cancelSync: () => void;
  };
  incrementalSync?: boolean;
  onIncrementalSyncChange?: (value: boolean) => void;
  displayOrderMediaIds?: number[];
}

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

  // Use progress from sync-service, fallback to default
  const progress = syncState?.progress || {
    total: entries.length,
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

  console.log("[SyncManager] Progress:", progress);

  // DEBUG: Log progress object from sync-service
  React.useEffect(() => {
    if (syncState?.progress) {
      console.log("[SyncManager] Progress update:", syncState.progress);
    }
  }, [syncState?.progress]);

  // Use progress.completed and progress.total directly
  const completedEntries = progress.completed;
  const totalEntries = progress.total;
  const progressPercentage =
    totalEntries > 0 ? Math.floor((completedEntries / totalEntries) * 100) : 0;

  // Determine status based on the hook's state
  let status: "idle" | "syncing" | "completed" | "failed" = "idle";
  if (syncState?.isActive) {
    status = "syncing";
  } else if (syncState?.report) {
    status = syncState.report.failedUpdates > 0 ? "failed" : "completed";
  } else if (syncState?.error) {
    status = "failed";
  }

  // Handle start synchronization
  const handleStartSync = async () => {
    if (syncActions?.startSync) {
      if (incrementalSync) {
        const processedEntries = entries.map((entry) => {
          const previousProgress = entry.previousValues?.progress || 0;
          const targetProgress = entry.progress;
          return {
            ...entry,
            syncMetadata: {
              useIncrementalSync: targetProgress - previousProgress > 1,
              targetProgress,
              progress: previousProgress + 1,
            },
          };
        });
        await syncActions.startSync(
          processedEntries,
          token,
          undefined,
          displayOrderMediaIds,
        );
      } else {
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
    if (syncActions?.cancelSync) {
      syncActions.cancelSync();
    }
    if (onCancel) {
      onCancel();
    }
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
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>AniList Synchronization</CardTitle>
        <CardDescription>
          Updating {totalEntries} manga{" "}
          {totalEntries === 1 ? "entry" : "entries"} with changes to your
          AniList account
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between">
            <span className="text-sm font-medium">
              Progress: {completedEntries} of {totalEntries} entries
            </span>
            <span className="text-sm font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />

          {/* Show estimated remaining entries */}
          <div className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {status === "syncing" && completedEntries > 0
                ? `${totalEntries - completedEntries} entries remaining`
                : " "}
            </span>
            <span>
              {status === "syncing" && progressPercentage > 0
                ? progressPercentage + "% complete"
                : ""}
            </span>
          </div>
        </div>

        {status === "idle" && !autoStart && (
          <div className="mb-6 text-center">
            <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle>Ready to Synchronize</AlertTitle>
              <AlertDescription>
                {entries.length} manga{" "}
                {entries.length === 1 ? "entry" : "entries"} with changes are
                ready to be synchronized to your AniList account. Entries
                without changes have been automatically filtered out.
              </AlertDescription>
            </Alert>

            {/* Add incremental sync option */}
            <div className="mt-2 mb-4 flex items-center justify-center space-x-2">
              <Switch
                id="incrementalSync"
                checked={incrementalSync}
                onCheckedChange={onIncrementalSyncChange}
                data-testid="switch"
              />
              <Label htmlFor="incrementalSync" className="text-sm">
                Use incremental progress updates
                <span className="text-muted-foreground block text-xs">
                  Updates progress gradually to trigger activity merge
                </span>
              </Label>
            </div>
          </div>
        )}

        {/* Status message */}
        {status === "syncing" && (
          <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <AlertTitle>Synchronization in progress</AlertTitle>
            <AlertDescription>
              {incrementalSync
                ? "Please wait while your manga entries are being updated on AniList using incremental progress updates. This may take longer but helps trigger activity merges."
                : "Please wait while your manga entries are being updated on AniList."}
            </AlertDescription>
          </Alert>
        )}

        {/* Show current entry being synced */}
        {status === "syncing" && progress.currentEntry && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <h3 className="mb-2 flex items-center text-sm font-semibold">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-600" />
              Currently Syncing:
            </h3>
            <div className="flex items-start">
              {progress.currentEntry.coverImage && (
                <img
                  src={progress.currentEntry.coverImage}
                  alt={progress.currentEntry.title}
                  className="mr-3 h-16 w-12 rounded-sm object-cover shadow-sm"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-blue-800 dark:text-blue-300">
                  {progress.currentEntry.title}
                </p>

                {/* Show incremental sync steps if applicable */}
                {incrementalSync &&
                  progress.totalSteps &&
                  progress.currentStep && (
                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          Step {progress.currentStep} of {progress.totalSteps}
                          {progress.currentStep === 1 && " (Initial Progress)"}
                          {progress.currentStep === 2 && " (Final Progress)"}
                          {progress.currentStep === 3 && " (Status & Score)"}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {Math.round(
                            (progress.currentStep / progress.totalSteps) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                          style={{
                            width: `${(progress.currentStep / progress.totalSteps) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                {/* For entries that should be in the entries array, show changes */}
                {completedEntries < totalEntries &&
                  entries[completedEntries] && (
                    <div className="mt-3 space-y-1.5 rounded-md bg-white/50 px-3 py-2 dark:bg-slate-800/20">
                      <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Changes:
                      </h4>
                      {entries[completedEntries].previousValues ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Progress:</span>
                            <div className="flex items-center">
                              <span className="text-slate-500">
                                {
                                  entries[completedEntries].previousValues
                                    ?.progress
                                }
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
                                className="mx-1 text-blue-400"
                              >
                                <path d="M5 12h14"></path>
                                <path d="m12 5 7 7-7 7"></path>
                              </svg>
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {entries[completedEntries].progress}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Status:</span>
                            <div className="flex items-center">
                              <span className="text-slate-500">
                                {entries[completedEntries].previousValues
                                  ?.status || "None"}
                              </span>
                              {entries[completedEntries].status !==
                                entries[completedEntries].previousValues
                                  ?.status && (
                                <>
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
                                    className="mx-1 text-blue-400"
                                  >
                                    <path d="M5 12h14"></path>
                                    <path d="m12 5 7 7-7 7"></path>
                                  </svg>
                                  <span className="font-medium text-blue-600 dark:text-blue-400">
                                    {entries[completedEntries].status}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Score:</span>
                            <div className="flex items-center">
                              <span className="text-slate-500">
                                {entries[completedEntries].previousValues
                                  ?.score !== null &&
                                entries[completedEntries].previousValues
                                  ?.score !== undefined
                                  ? entries[completedEntries].previousValues
                                      .score
                                  : "None"}
                              </span>
                              {entries[completedEntries].score !==
                                entries[completedEntries].previousValues
                                  ?.score && (
                                <>
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
                                    className="mx-1 text-blue-400"
                                  >
                                    <path d="M5 12h14"></path>
                                    <path d="m12 5 7 7-7 7"></path>
                                  </svg>
                                  <span className="font-medium text-blue-600 dark:text-blue-400">
                                    {entries[completedEntries].score}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-0.5">
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
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
                              className="mr-1"
                            >
                              <path d="M12 5v14"></path>
                              <path d="M5 12h14"></path>
                            </svg>
                            New Entry
                          </span>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Success/Error counters */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center justify-center rounded-md bg-green-50 py-4 dark:bg-green-900/20">
            <div className="mb-1 flex items-center">
              <CheckCircle className="mr-1.5 h-4 w-4 text-green-500" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Successful
              </p>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {progress.successful}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-md bg-red-50 py-4 dark:bg-red-900/20">
            <div className="mb-1 flex items-center">
              <XCircle className="mr-1.5 h-4 w-4 text-red-500" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Failed
              </p>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {progress.failed}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-md bg-slate-100 py-4 dark:bg-slate-800">
            <div className="mb-1 flex items-center">
              <Clock className="mr-1.5 h-4 w-4 text-slate-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-400">
                Remaining
              </p>
            </div>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
              {totalEntries - completedEntries}
            </p>
          </div>
        </div>

        {/* Display incremental sync info if active */}
        {status === "syncing" && incrementalSync && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 mr-2 h-5 w-5 flex-shrink-0 text-amber-500"
              >
                <path d="M12 19V5"></path>
                <path d="m5 12 7-7 7 7"></path>
              </svg>
              <div>
                <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Incremental Sync Active
                </h3>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                  For large progress updates, each manga is synchronized in
                  multiple steps to properly trigger AniList activity merges.
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-amber-100/70 p-2 dark:bg-amber-900/40">
                    <span className="mb-1 inline-block h-5 w-5 rounded-full bg-amber-200 text-center font-medium text-amber-700 dark:bg-amber-800 dark:text-amber-300">
                      1
                    </span>
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Initial Progress
                    </p>
                    <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                      Increment by +1
                    </p>
                  </div>
                  <div className="rounded-md bg-amber-100/70 p-2 dark:bg-amber-900/40">
                    <span className="mb-1 inline-block h-5 w-5 rounded-full bg-amber-200 text-center font-medium text-amber-700 dark:bg-amber-800 dark:text-amber-300">
                      2
                    </span>
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Final Progress
                    </p>
                    <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                      Set final value
                    </p>
                  </div>
                  <div className="rounded-md bg-amber-100/70 p-2 dark:bg-amber-900/40">
                    <span className="mb-1 inline-block h-5 w-5 rounded-full bg-amber-200 text-center font-medium text-amber-700 dark:bg-amber-800 dark:text-amber-300">
                      3
                    </span>
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Status & Score
                    </p>
                    <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                      Update metadata
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Display rate limiting information if active */}
        {status === "syncing" &&
          (progress.rateLimited || rateLimitState.isRateLimited) &&
          (progress.retryAfter !== null ||
            rateLimitState.retryAfter !== undefined) && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-start">
                <Clock className="mt-0.5 mr-2 h-5 w-5 flex-shrink-0 text-red-500" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                    {(progress.retryAfter && progress.retryAfter > 10000) ||
                    rateLimitState.isRateLimited
                      ? "Synchronization Paused"
                      : "Retrying After Server Error"}
                  </h3>
                </div>
              </div>
            </div>
          )}

        {status === "completed" && (
          <Alert className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Synchronization complete</AlertTitle>
            <AlertDescription>
              All manga entries have been successfully updated on AniList.
            </AlertDescription>
          </Alert>
        )}

        {status === "failed" && (
          <Alert className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertTitle>Synchronization failed</AlertTitle>
            <AlertDescription>
              {syncState?.error && syncState.error.includes("cancelled")
                ? "Synchronization was cancelled by user. No further entries will be processed."
                : syncState?.error ||
                  `${progress.failed} entries failed to update. You can retry the failed entries.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Error details */}
        {syncState?.report && syncState.report.errors.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 flex items-center text-sm font-medium text-red-700 dark:text-red-400">
              <AlertCircle className="mr-1.5 h-4 w-4 text-red-500" />
              Error Details:
            </h3>
            <div className="max-h-60 overflow-y-auto rounded-md border border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-900/10">
              <ul className="divide-y divide-red-200 dark:divide-red-800/50">
                {syncState.report.errors.map((error, index) => (
                  <li key={index} className="p-3 text-sm">
                    <div className="flex flex-col">
                      <div className="mb-1 flex items-center">
                        <XCircle className="mr-1.5 h-3.5 w-3.5 text-red-500" />
                        <span className="font-medium text-red-700 dark:text-red-400">
                          Media ID {error.mediaId}
                        </span>
                      </div>
                      <div className="ml-5 rounded-sm bg-red-100 p-1.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-500">
                        {error.error}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end space-x-2">
        {status === "idle" && (
          <>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleStartSync}>Start Synchronization</Button>
          </>
        )}

        {status === "syncing" && (
          <Button variant="destructive" onClick={handleCancel}>
            Cancel Sync
          </Button>
        )}

        {(status === "completed" || status === "failed") && (
          <>
            <Button variant="outline" onClick={handleCancel}>
              Close
            </Button>

            {status === "failed" &&
              syncState?.report &&
              syncState.report.errors.length > 0 && (
                <Button onClick={handleStartSync}>Retry Failed Updates</Button>
              )}
          </>
        )}
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
