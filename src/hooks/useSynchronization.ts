/**
 * @packageDocumentation
 * @module useSynchronization
 * @description Custom React hook for managing AniList synchronization, including batch sync, progress tracking, error handling, and exporting reports in the Kenmei to AniList sync tool.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  syncMangaBatch,
  SyncReport,
  SyncProgress,
} from "../api/anilist/sync-service";
import { AniListMediaEntry } from "../api/anilist/types";
import {
  exportSyncErrorLog,
  exportSyncReport,
  saveSyncReportToHistory,
} from "../utils/export-utils";
import { storage, STORAGE_KEYS } from "../utils/storage";

/**
 * Snapshot of an in-progress synchronization session for pause/resume support.
 */
interface SyncResumeSnapshot {
  entries: AniListMediaEntry[];
  uniqueMediaIds: number[];
  completedMediaIds: number[];
  remainingMediaIds: number[];
  progress: SyncProgress;
  currentEntry: {
    mediaId: number;
    resumeFromStep?: number;
  } | null;
  reportFragment: PersistedSyncReport | null;

  timestamp: number;
}

type PersistedSyncReport = Omit<SyncReport, "timestamp"> & {
  timestamp: string;
};

const SNAPSHOT_STORAGE_KEY = STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT;

const cloneEntry = (entry: AniListMediaEntry): AniListMediaEntry => ({
  ...entry,
  previousValues: entry.previousValues ? { ...entry.previousValues } : null,
  syncMetadata: entry.syncMetadata ? { ...entry.syncMetadata } : null,
});

const cloneEntries = (entries: AniListMediaEntry[]): AniListMediaEntry[] =>
  entries.map(cloneEntry);

const toPersistedReport = (report: SyncReport): PersistedSyncReport => ({
  ...report,
  timestamp: report.timestamp.toISOString(),
});

const fromPersistedReport = (
  report: PersistedSyncReport | null,
): SyncReport | null => {
  if (!report) return null;
  return {
    ...report,
    timestamp: new Date(report.timestamp),
  };
};

const mergeReports = (
  baseReport: SyncReport | null,
  newReport: SyncReport,
): SyncReport => {
  if (!baseReport) return newReport;

  return {
    totalEntries: baseReport.totalEntries + newReport.totalEntries,
    successfulUpdates:
      baseReport.successfulUpdates + newReport.successfulUpdates,
    failedUpdates: baseReport.failedUpdates + newReport.failedUpdates,
    skippedEntries: baseReport.skippedEntries + newReport.skippedEntries,
    errors: [...baseReport.errors, ...newReport.errors],
    timestamp: newReport.timestamp,
  };
};

const saveSnapshotToStorage = (snapshot: SyncResumeSnapshot | null): void => {
  if (!snapshot) {
    storage.removeItem(SNAPSHOT_STORAGE_KEY);
    return;
  }

  try {
    storage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.error("Failed to persist sync snapshot:", error);
  }
};

/**
 * Represents the state of the synchronization process.
 *
 * @property isActive - Indicates if a synchronization is currently active.
 * @property progress - The current progress of the synchronization, or null if not started.
 * @property report - The final report of the synchronization, or null if not completed.
 * @property error - Any error message encountered during synchronization, or null if none.
 * @property abortController - The AbortController used to cancel the sync, or null if not active.
 *
 * @source
 */
interface SynchronizationState {
  isActive: boolean;
  progress: SyncProgress | null;
  report: SyncReport | null;
  error: string | null;
  abortController: AbortController | null;
  isPaused: boolean;
  resumeAvailable: boolean;
  resumeMetadata: {
    remainingMediaIds: number[];
    timestamp: number;
  } | null;
}

/**
 * Represents the set of actions available for synchronization.
 *
 * @property startSync - Starts the synchronization process.
 * @property cancelSync - Cancels the ongoing synchronization.
 * @property exportErrors - Exports the error log from the last sync.
 * @property exportReport - Exports the full sync report.
 * @property reset - Resets the synchronization state.
 *
 * @source
 */
interface SynchronizationActions {
  startSync: (
    entries: AniListMediaEntry[],
    token: string,
    _?: undefined,
    displayOrderMediaIds?: number[],
  ) => Promise<void>;
  cancelSync: () => void;
  pauseSync: () => void;
  resumeSync: (
    entries: AniListMediaEntry[],
    token: string,
    _?: undefined,
    displayOrderMediaIds?: number[],
  ) => Promise<void>;
  exportErrors: () => void;
  exportReport: () => void;
  reset: () => void;
}

/**
 * Hook that provides methods and state for managing AniList synchronization.
 *
 * @returns A tuple containing the synchronization state and an object of synchronization actions.
 * @example
 * ```ts
 * const [syncState, syncActions] = useSynchronization();
 * syncActions.startSync(entries, token);
 * ```
 * @source
 */
export function useSynchronization(): [
  SynchronizationState,
  SynchronizationActions,
] {
  const [state, setState] = useState<SynchronizationState>({
    isActive: false,
    progress: null,
    report: null,
    error: null,
    abortController: null,
    isPaused: false,
    resumeAvailable: false,
    resumeMetadata: null,
  });
  const resumeSnapshotRef = useRef<SyncResumeSnapshot | null>(null);
  const initialEntriesRef = useRef<AniListMediaEntry[]>([]);
  const uniqueMediaIdsRef = useRef<number[]>([]);
  const pauseRequestedRef = useRef(false);
  const resumeRequestedRef = useRef(false);
  const hasLoadedSnapshotRef = useRef(false);

  const updateSnapshotFromProgress = (
    progress: SyncProgress | null,
    entriesForRun: AniListMediaEntry[],
  ) => {
    if (!progress) {
      resumeSnapshotRef.current = null;
      initialEntriesRef.current = [];
      uniqueMediaIdsRef.current = [];
      saveSnapshotToStorage(null);
      setState((prev) => ({
        ...prev,
        resumeAvailable: false,
        resumeMetadata: null,
      }));
      return;
    }

    const uniqueMediaIds = uniqueMediaIdsRef.current;

    if (!uniqueMediaIds.length) {
      resumeSnapshotRef.current = null;
      saveSnapshotToStorage(null);
      return;
    }

    const completedCount = Math.min(progress.completed, uniqueMediaIds.length);
    const completedMediaIds = uniqueMediaIds.slice(0, completedCount);
    const remainingMediaIds = uniqueMediaIds.slice(completedCount);

    if (
      remainingMediaIds.length === 0 &&
      (!progress.currentEntry || completedCount === uniqueMediaIds.length)
    ) {
      resumeSnapshotRef.current = null;
      initialEntriesRef.current = [];
      saveSnapshotToStorage(null);
      setState((prev) => ({
        ...prev,
        resumeAvailable: false,
        resumeMetadata: null,
      }));
      return;
    }

    const pendingEntries = cloneEntries(
      entriesForRun.filter((entry) =>
        remainingMediaIds.includes(entry.mediaId),
      ),
    );

    if (progress.currentEntry) {
      const pendingIndex = pendingEntries.findIndex(
        (entry) => entry.mediaId === progress.currentEntry?.mediaId,
      );

      if (pendingIndex !== -1) {
        const metadata = pendingEntries[pendingIndex].syncMetadata;
        if (metadata?.useIncrementalSync && progress.currentStep) {
          pendingEntries[pendingIndex] = {
            ...pendingEntries[pendingIndex],
            syncMetadata: {
              ...metadata,
              resumeFromStep: progress.currentStep,
            },
          };
        }
      }
    }

    const snapshot: SyncResumeSnapshot = {
      entries: pendingEntries,
      uniqueMediaIds: [...uniqueMediaIds],
      completedMediaIds,
      remainingMediaIds,
      progress: {
        ...progress,
        currentEntry: progress.currentEntry
          ? { ...progress.currentEntry }
          : null,
      },
      currentEntry: progress.currentEntry
        ? {
            mediaId: progress.currentEntry.mediaId,
            resumeFromStep: progress.currentStep ?? undefined,
          }
        : null,
      reportFragment: resumeSnapshotRef.current?.reportFragment ?? null,
      timestamp: Date.now(),
    };

    resumeSnapshotRef.current = snapshot;
    initialEntriesRef.current = pendingEntries;
    saveSnapshotToStorage(snapshot);
    setState((prev) => ({
      ...prev,
      resumeAvailable: true,
      resumeMetadata: {
        remainingMediaIds,
        timestamp: snapshot.timestamp,
      },
    }));
  };

  const clearResumeSnapshot = () => {
    resumeSnapshotRef.current = null;
    initialEntriesRef.current = [];
    uniqueMediaIdsRef.current = [];
    saveSnapshotToStorage(null);
    setState((prev) => ({
      ...prev,
      resumeAvailable: false,
      resumeMetadata: null,
    }));
  };

  useEffect(() => {
    if (hasLoadedSnapshotRef.current) return;
    hasLoadedSnapshotRef.current = true;

    const storedSnapshot = storage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!storedSnapshot) return;

    try {
      const parsed: SyncResumeSnapshot = JSON.parse(storedSnapshot);

      if (!parsed?.remainingMediaIds?.length) {
        storage.removeItem(SNAPSHOT_STORAGE_KEY);
        return;
      }

      resumeSnapshotRef.current = {
        ...parsed,
        progress: {
          ...parsed.progress,
          currentEntry: parsed.progress.currentEntry
            ? { ...parsed.progress.currentEntry }
            : null,
        },
      };
      initialEntriesRef.current = cloneEntries(parsed.entries || []);
      uniqueMediaIdsRef.current = [...parsed.uniqueMediaIds];

      setState((prev) => ({
        ...prev,
        progress: parsed.progress ?? prev.progress,
        isPaused: true,
        resumeAvailable: true,
        resumeMetadata: {
          remainingMediaIds: parsed.remainingMediaIds,
          timestamp: parsed.timestamp,
        },
      }));
    } catch (error) {
      console.error("Failed to load stored sync snapshot:", error);
      storage.removeItem(SNAPSHOT_STORAGE_KEY);
    }
  }, []);

  /**
   * Starts a synchronization operation for the provided AniList media entries.
   *
   * @param entries - The AniList media entries to synchronize.
   * @param token - The AniList authentication token.
   * @param _unused - (Unused) Reserved for future use.
   * @param displayOrderMediaIds - Optional array of media IDs to control display order.
   * @returns A promise that resolves when synchronization is complete.
   * @throws If the sync operation fails or is aborted.
   * @source
   */
  const startSync = useCallback(
    async (
      entries: AniListMediaEntry[],
      token: string,
      _unused?: undefined,
      displayOrderMediaIds?: number[],
    ) => {
      if (state.isActive) {
        console.warn("Sync is already in progress");
        return;
      }

      if (!entries.length) {
        setState((prev) => ({
          ...prev,
          error: "No entries to synchronize",
        }));
        return;
      }

      if (!token) {
        setState((prev) => ({
          ...prev,
          error: "No authentication token available",
        }));
        return;
      }

      const isResume = resumeRequestedRef.current;
      resumeRequestedRef.current = false;

      if (!isResume && resumeSnapshotRef.current) {
        clearResumeSnapshot();
      }

      const existingReportFragment = isResume
        ? fromPersistedReport(resumeSnapshotRef.current?.reportFragment ?? null)
        : null;
      pauseRequestedRef.current = false;

      try {
        // Create new AbortController for this operation
        const abortController = new AbortController();

        // Always use the full uniqueMediaIds array for displayOrderMediaIds
        const uniqueMediaIds =
          displayOrderMediaIds && displayOrderMediaIds.length > 0
            ? displayOrderMediaIds
            : Array.from(new Set(entries.map((e) => e.mediaId)));
        uniqueMediaIdsRef.current = [...uniqueMediaIds];
        initialEntriesRef.current = cloneEntries(entries);

        const initialProgress: SyncProgress = {
          total: uniqueMediaIds.length,
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

        let lastReportedProgress: SyncProgress = initialProgress;

        setState((prev) => ({
          ...prev,
          isActive: true,
          error: null,
          abortController,
          progress: initialProgress,
          isPaused: false,
          resumeAvailable: false,
          resumeMetadata: null,
        }));

        updateSnapshotFromProgress(initialProgress, initialEntriesRef.current);

        console.log("Total entries to sync:", entries.length);

        // Check if any entries need incremental sync
        const needsIncrementalSync = entries.some(
          (entry) => entry.syncMetadata?.useIncrementalSync,
        );

        let syncReport: SyncReport;

        // Handle incremental sync if needed
        if (needsIncrementalSync) {
          try {
            console.log("Using sequential incremental sync mode");

            // Get entries that need incremental sync
            const incrementalEntries = entries
              .filter((entry) => entry.syncMetadata?.useIncrementalSync)
              .map((entry) => {
                // Make sure each entry has the complete metadata we need
                const previousProgress = entry.previousValues?.progress || 0;
                const targetProgress = entry.progress;

                return {
                  ...entry,
                  syncMetadata: {
                    ...entry.syncMetadata!,
                    targetProgress,
                    progress: previousProgress,
                    // Set flags for steps
                    updatedStatus:
                      entry.status !== entry.previousValues?.status,
                    updatedScore: entry.score !== entry.previousValues?.score,
                    // Don't specify a step, let syncMangaBatch handle it
                    step: undefined,
                  },
                };
              });
            const regularEntries = entries.filter(
              (entry) => !entry.syncMetadata?.useIncrementalSync,
            );

            console.log(
              `Processing ${incrementalEntries.length} entries with incremental sync`,
            );
            console.log(
              `Processing ${regularEntries.length} entries with regular sync`,
            );

            // Handle regular entries first in a single batch
            if (regularEntries.length > 0) {
              console.log("Processing regular entries in a single batch");

              // Process the batch synchronously
              syncReport = await syncMangaBatch(
                regularEntries,
                token,
                (progress) => {
                  setState((prev) => ({
                    ...prev,
                    progress: {
                      ...progress,
                      // Always use unique manga count for total
                      total: uniqueMediaIds.length,
                    },
                  }));
                },
                abortController.signal,
                uniqueMediaIds,
              );
            } else {
              // Initialize with empty report if no regular entries
              syncReport = {
                totalEntries: 0,
                successfulUpdates: 0,
                failedUpdates: 0,
                skippedEntries: 0,
                errors: [],
                timestamp: new Date(),
              };

              // Initialize progress with proper structure
              setState((prev) => ({
                ...prev,
                progress: {
                  total: uniqueMediaIds.length,
                  completed: 0,
                  successful: 0,
                  failed: 0,
                  skipped: 0,
                  currentEntry: null,
                  currentStep: null,
                  totalSteps: null,
                  rateLimited: false,
                  retryAfter: null,
                },
              }));
            }

            // Process each incremental entry individually through all its steps
            let successfulUpdates = syncReport.successfulUpdates;
            let failedUpdates = syncReport.failedUpdates;
            let skippedUpdates = syncReport.skippedEntries;
            let overallProgress =
              successfulUpdates + failedUpdates + skippedUpdates;
            const errors = [...syncReport.errors];

            // Create custom progress tracker
            const updateProgress = (
              entry: AniListMediaEntry,
              step: number | null = null,
              stepCompleted: boolean = false,
              success: boolean = true,
            ) => {
              if (stepCompleted) {
                overallProgress++;
                if (success) successfulUpdates++;
                else failedUpdates++;
              }

              const nextProgress: SyncProgress = {
                ...lastReportedProgress,
                completed: overallProgress,
                total: uniqueMediaIds.length,
                successful: successfulUpdates,
                failed: failedUpdates,
                skipped: skippedUpdates,
                currentEntry: {
                  mediaId: entry.mediaId,
                  title: entry.title || `Manga #${entry.mediaId}`,
                  coverImage: entry.coverImage || "",
                },
                currentStep: step,
                totalSteps: entry.syncMetadata?.useIncrementalSync ? 3 : null,
              };

              lastReportedProgress = nextProgress;

              setState((prev) => ({
                ...prev,
                progress: nextProgress,
              }));
              updateSnapshotFromProgress(
                nextProgress,
                initialEntriesRef.current,
              );
            };

            // Process each entry that needs incremental sync sequentially
            for (const entry of incrementalEntries) {
              // Check if operation has been canceled
              if (abortController.signal.aborted) {
                console.log("Incremental sync cancelled - stopping processing");
                break; // Stop processing more entries
              }

              try {
                const previousProgress = entry.previousValues?.progress || 0;
                const targetProgress = entry.syncMetadata.targetProgress;
                const progressDiff = targetProgress - previousProgress;

                console.log(
                  `Processing entry ${entry.mediaId} (${entry.title || "Untitled"}) with progress diff ${progressDiff}`,
                );

                // Send the entry directly to syncMangaBatch which will handle the step processing
                const syncResult = await syncMangaBatch(
                  [entry],
                  token,
                  (progress) => {
                    // When we receive progress updates, merge them into our overall progress
                    if (progress.currentEntry) {
                      updateProgress(
                        entry,
                        progress.currentStep,
                        false, // Don't increment completion here, syncMangaBatch handles it
                        true,
                      );
                    }
                  },
                  abortController.signal,
                  uniqueMediaIds,
                );

                // If the operation was aborted during this entry's sync, don't continue processing
                if (abortController.signal.aborted) {
                  console.log(
                    `Sync aborted during processing of entry ${entry.mediaId}`,
                  );
                  break;
                }

                // Add any errors to our collection
                successfulUpdates += syncResult.successfulUpdates;
                failedUpdates += syncResult.failedUpdates;
                skippedUpdates += syncResult.skippedEntries;
                overallProgress += syncResult.totalEntries;
                if (syncResult.errors.length) {
                  errors.push(...syncResult.errors);
                }

                const finalizedProgress: SyncProgress = {
                  ...lastReportedProgress,
                  completed: overallProgress,
                  total: uniqueMediaIds.length,
                  successful: successfulUpdates,
                  failed: failedUpdates,
                  skipped: skippedUpdates,
                  currentEntry: lastReportedProgress.currentEntry,
                  currentStep: null,
                  totalSteps: lastReportedProgress.totalSteps,
                };

                lastReportedProgress = finalizedProgress;
                setState((prev) => ({
                  ...prev,
                  progress: finalizedProgress,
                }));
                updateSnapshotFromProgress(
                  finalizedProgress,
                  initialEntriesRef.current,
                );

                console.log(`Completed all steps for ${entry.mediaId}`);
              } catch (error) {
                console.error(
                  `Error processing incremental sync for entry ${entry.mediaId}:`,
                  error,
                );
                failedUpdates++;
                overallProgress++;
                if (error instanceof Error) {
                  errors.push({
                    mediaId: entry.mediaId,
                    error: error.message,
                  });
                }
                const failedProgress: SyncProgress = {
                  ...lastReportedProgress,
                  completed: overallProgress,
                  total: uniqueMediaIds.length,
                  successful: successfulUpdates,
                  failed: failedUpdates,
                  skipped: skippedUpdates,
                  currentEntry: lastReportedProgress.currentEntry,
                  currentStep: null,
                  totalSteps: lastReportedProgress.totalSteps,
                };
                lastReportedProgress = failedProgress;
                setState((prev) => ({
                  ...prev,
                  progress: failedProgress,
                }));
                updateSnapshotFromProgress(
                  failedProgress,
                  initialEntriesRef.current,
                );
                // Continue with next entry
              }
            }

            // Create final report
            syncReport = {
              successfulUpdates,
              failedUpdates,
              totalEntries: successfulUpdates + failedUpdates + skippedUpdates,
              skippedEntries: skippedUpdates,
              errors,
              timestamp: new Date(),
            };

            console.log("Incremental sync completed successfully");
          } catch (error) {
            console.error("Error during incremental sync:", error);
            throw error; // Re-throw to be caught by outer try/catch
          }
        }
        // Standard single-request sync
        else {
          console.log("Using standard (non-incremental) sync mode");
          syncReport = await syncMangaBatch(
            entries,
            token,
            (progress) => {
              const normalizedProgress: SyncProgress = {
                ...progress,
                total: uniqueMediaIds.length,
              };
              lastReportedProgress = normalizedProgress;
              setState((prev) => ({
                ...prev,
                progress: normalizedProgress,
              }));
              updateSnapshotFromProgress(
                normalizedProgress,
                initialEntriesRef.current,
              );
            },
            abortController.signal,
            uniqueMediaIds,
          );
        }

        if (pauseRequestedRef.current) {
          const partialReport = mergeReports(
            existingReportFragment,
            syncReport,
          );

          if (!resumeSnapshotRef.current) {
            updateSnapshotFromProgress(
              lastReportedProgress,
              initialEntriesRef.current,
            );
          }

          if (resumeSnapshotRef.current) {
            resumeSnapshotRef.current.reportFragment =
              toPersistedReport(partialReport);
            resumeSnapshotRef.current.progress = {
              ...lastReportedProgress,
            };
            resumeSnapshotRef.current.timestamp = Date.now();
            saveSnapshotToStorage(resumeSnapshotRef.current);
          }

          setState((prev) => ({
            ...prev,
            isActive: false,
            isPaused: true,
            report: partialReport,
            error: null,
            abortController: null,
            resumeAvailable: true,
            resumeMetadata: resumeSnapshotRef.current
              ? {
                  remainingMediaIds:
                    resumeSnapshotRef.current.remainingMediaIds,
                  timestamp: resumeSnapshotRef.current.timestamp,
                }
              : prev.resumeMetadata,
          }));

          return;
        }

        const finalReport = mergeReports(existingReportFragment, syncReport);

        if (!pauseRequestedRef.current) {
          saveSyncReportToHistory(finalReport);
          clearResumeSnapshot();
        }

        setState((prev) => ({
          ...prev,
          isActive: false,
          isPaused: false,
          report: finalReport,
          abortController: null,
          resumeAvailable: false,
          resumeMetadata: null,
        }));
      } catch (error) {
        console.error("Sync operation failed:", error);
        setState((prev) => ({
          ...prev,
          isActive: false,
          error: error instanceof Error ? error.message : String(error),
          abortController: null,
          isPaused: false,
          resumeAvailable: prev.resumeAvailable,
        }));
      }
    },
    [clearResumeSnapshot, state.isActive],
  );

  /**
   * Cancels the active synchronization operation, aborting all in-progress requests.
   *
   * @remarks
   * If no synchronization is active, this function does nothing.
   *
   * @source
   */
  const cancelSync = useCallback(() => {
    if (state.abortController) {
      console.log("Cancellation requested - aborting all sync operations");
      state.abortController.abort();
      setState((prev) => ({
        ...prev,
        isActive: false,
        abortController: null,
        // Set a special error string for cancellation
        error: "Synchronization cancelled by user",
        // Preserve the current report if any (partial results)
        report: prev.report || null,
        isPaused: false,
        resumeAvailable: false,
        resumeMetadata: null,
      }));
      pauseRequestedRef.current = false;
      clearResumeSnapshot();

      // Add a message to make it clear the operation has been canceled
      console.log(
        "%c🛑 SYNC CANCELLED - All operations stopped",
        "color: red; font-weight: bold",
      );
    }
  }, [clearResumeSnapshot, state.abortController]);

  const pauseSync = useCallback(() => {
    if (state.abortController) {
      console.log("Pause requested - stopping current sync after current task");
      pauseRequestedRef.current = true;
      state.abortController.abort();
    }
  }, [state.abortController]);

  const resumeSync = useCallback(
    async (
      entries: AniListMediaEntry[],
      token: string,
      _unused?: undefined,
      displayOrderMediaIds?: number[],
    ) => {
      const snapshot = resumeSnapshotRef.current;

      if (!snapshot) {
        console.warn("No paused synchronization state available to resume.");
        return;
      }

      const remainingIds = snapshot.remainingMediaIds;
      if (!remainingIds || remainingIds.length === 0) {
        console.warn("Paused state contains no remaining entries.");
        clearResumeSnapshot();
        return;
      }

      const sourceEntries =
        snapshot.entries && snapshot.entries.length > 0
          ? snapshot.entries
          : entries;

      const entriesToResume = cloneEntries(
        (sourceEntries.length > 0 ? sourceEntries : entries).filter((entry) =>
          remainingIds.includes(entry.mediaId),
        ),
      );

      if (!entriesToResume.length) {
        console.warn("No matching entries found to resume.");
        clearResumeSnapshot();
        return;
      }

      resumeRequestedRef.current = true;

      await startSync(
        entriesToResume,
        token,
        _unused,
        displayOrderMediaIds?.length ? displayOrderMediaIds : remainingIds,
      );
    },
    [clearResumeSnapshot, startSync],
  );

  /**
   * Exports the error log from the last synchronization report to a file.
   *
   * @remarks
   * If no report is available, this function does nothing.
   *
   * @source
   */
  const exportErrors = useCallback(() => {
    if (state.report) {
      exportSyncErrorLog(state.report);
    }
  }, [state.report]);

  /**
   * Exports the full synchronization report to a file.
   *
   * @remarks
   * If no report is available, this function does nothing.
   *
   * @source
   */
  const exportReport = useCallback(() => {
    if (state.report) {
      exportSyncReport(state.report);
    }
  }, [state.report]);

  /**
   * Resets the synchronization state to its initial values.
   *
   * @source
   */
  const reset = useCallback(() => {
    clearResumeSnapshot();
    setState({
      isActive: false,
      progress: null,
      report: null,
      error: null,
      abortController: null,
      isPaused: false,
      resumeAvailable: false,
      resumeMetadata: null,
    });
  }, [clearResumeSnapshot]);

  return [
    state,
    {
      startSync,
      cancelSync,
      pauseSync,
      resumeSync,
      exportErrors,
      exportReport,
      reset,
    },
  ];
}
