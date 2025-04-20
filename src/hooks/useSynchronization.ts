/**
 * Hook for managing AniList synchronization
 */

import { useState, useCallback } from "react";
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

interface SynchronizationState {
  isActive: boolean;
  progress: SyncProgress | null;
  report: SyncReport | null;
  error: string | null;
  abortController: AbortController | null;
}

interface SynchronizationActions {
  startSync: (
    entries: AniListMediaEntry[],
    token: string,
    _?: undefined,
    displayOrderMediaIds?: number[],
  ) => Promise<void>;
  cancelSync: () => void;
  exportErrors: () => void;
  exportReport: () => void;
  reset: () => void;
}

/**
 * Hook that provides methods and state for managing AniList synchronization
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
  });

  // Start a synchronization operation
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

      try {
        // Create new AbortController for this operation
        const abortController = new AbortController();

        // Always use the full uniqueMediaIds array for displayOrderMediaIds
        const uniqueMediaIds =
          displayOrderMediaIds && displayOrderMediaIds.length > 0
            ? displayOrderMediaIds
            : Array.from(new Set(entries.map((e) => e.mediaId)));
        setState((prev) => ({
          ...prev,
          isActive: true,
          error: null,
          abortController,
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
            let overallProgress = regularEntries.length;
            let successfulUpdates = syncReport.successfulUpdates;
            let failedUpdates = syncReport.failedUpdates;
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

              setState((prev) => ({
                ...prev,
                progress: {
                  ...prev.progress!,
                  completed: overallProgress,
                  total: uniqueMediaIds.length,
                  successful: successfulUpdates,
                  failed: failedUpdates,
                  // Add currentEntry information for UI display
                  currentEntry: {
                    mediaId: entry.mediaId,
                    title: entry.title || `Manga #${entry.mediaId}`,
                    coverImage: entry.coverImage || "",
                  },
                  // Add step information if applicable
                  currentStep: step,
                  totalSteps: entry.syncMetadata?.useIncrementalSync ? 3 : null,
                  // Keep rate limiting status information
                  rateLimited: prev.progress?.rateLimited || false,
                  retryAfter: prev.progress?.retryAfter || null,
                },
              }));
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
                const targetProgress = entry.syncMetadata!.targetProgress;
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
                if (syncResult.failedUpdates > 0) {
                  failedUpdates += syncResult.failedUpdates;
                  errors.push(...syncResult.errors);
                } else {
                  successfulUpdates++;
                }

                // Update final progress after all steps are done
                overallProgress++;

                console.log(`Completed all steps for ${entry.mediaId}`);
              } catch (error) {
                console.error(
                  `Error processing incremental sync for entry ${entry.mediaId}:`,
                  error,
                );
                failedUpdates++;
                if (error instanceof Error) {
                  errors.push({
                    mediaId: entry.mediaId,
                    error: error.message,
                  });
                }
                // Continue with next entry
              }
            }

            // Create final report
            syncReport = {
              successfulUpdates: successfulUpdates,
              failedUpdates: failedUpdates,
              totalEntries: entries.length,
              skippedEntries: 0,
              errors: errors,
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
              setState((prev) => ({
                ...prev,
                progress,
              }));
            },
            abortController.signal,
            uniqueMediaIds,
          );
        }

        // Save report to history
        saveSyncReportToHistory(syncReport);

        // Update state with results
        setState((prev) => ({
          ...prev,
          isActive: false,
          report: syncReport,
          abortController: null,
        }));
      } catch (error) {
        console.error("Sync operation failed:", error);
        setState((prev) => ({
          ...prev,
          isActive: false,
          error: error instanceof Error ? error.message : String(error),
          abortController: null,
        }));
      }
    },
    [state.isActive],
  );

  // Cancel active synchronization
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
      }));

      // Add a message to make it clear the operation has been canceled
      console.log(
        "%c🛑 SYNC CANCELLED - All operations stopped",
        "color: red; font-weight: bold",
      );
    }
  }, [state.abortController]);

  // Export errors to file
  const exportErrors = useCallback(() => {
    if (state.report) {
      exportSyncErrorLog(state.report);
    }
  }, [state.report]);

  // Export full report to file
  const exportReport = useCallback(() => {
    if (state.report) {
      exportSyncReport(state.report);
    }
  }, [state.report]);

  // Reset the synchronization state
  const reset = useCallback(() => {
    setState({
      isActive: false,
      progress: null,
      report: null,
      error: null,
      abortController: null,
    });
  }, []);

  return [
    state,
    {
      startSync,
      cancelSync,
      exportErrors,
      exportReport,
      reset,
    },
  ];
}
