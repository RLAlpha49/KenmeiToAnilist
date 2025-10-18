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
} from "../utils/exportUtils";
import { storage, STORAGE_KEYS } from "../utils/storage";
import {
  useDebugActions,
  StateInspectorHandle,
} from "../contexts/DebugContext";

/**
 * Snapshot of an in-progress synchronization session for pause/resume recovery.
 * Stores entries, progress state, and partial reports for restart on app reopen.
 * @source
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

/**
 * Clones a single AniList media entry with deep copies of nested objects for safe state management.
 * @param entry - The media entry to clone.
 * @returns A cloned copy of the media entry.
 * @source
 */
const cloneEntry = (entry: AniListMediaEntry): AniListMediaEntry => ({
  ...entry,
  previousValues: entry.previousValues ? { ...entry.previousValues } : null,
  syncMetadata: entry.syncMetadata ? { ...entry.syncMetadata } : null,
});

/**
 * Clones multiple AniList media entries with deep copies of nested objects.
 * @param entries - Array of media entries to clone.
 * @returns Array of cloned media entries.
 * @source
 */
const cloneEntries = (entries: AniListMediaEntry[]): AniListMediaEntry[] =>
  entries.map(cloneEntry);

/**
 * Converts a SyncReport to a JSON-serializable format for storage persistence.
 * @param report - The sync report to convert.
 * @returns Report with timestamp as ISO string for storage.
 * @source
 */
const toPersistedReport = (report: SyncReport): PersistedSyncReport => ({
  ...report,
  timestamp: report.timestamp.toISOString(),
});

/**
 * Restores a stored sync report to its runtime format with proper Date object.
 * @param report - The persisted report with ISO timestamp string.
 * @returns Sync report with timestamp as Date object, or null if input is null.
 * @source
 */
const fromPersistedReport = (
  report: PersistedSyncReport | null,
): SyncReport | null => {
  if (!report) return null;
  return {
    ...report,
    timestamp: new Date(report.timestamp),
  };
};

/**
 * Merges two sync reports, combining statistics and error arrays.
 * @param baseReport - The initial or partial report.
 * @param newReport - The new report to merge in.
 * @returns Merged report with combined statistics using the new report's timestamp.
 * @source
 */
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

/**
 * Executes either standard or incremental sync mode based on entry metadata.
 * Handles both regular batch processing and sequential incremental sync for progress-tracked entries.
 * @param entries - AniList media entries to synchronize.
 * @param token - AniList authentication token.
 * @param abortController - Controller for cancelling sync operations.
 * @param uniqueMediaIds - Array of unique media IDs for progress tracking.
 * @param setState - State setter for synchronization state updates.
 * @param updateSnapshotFromProgress - Callback to update resume snapshot from progress.
 * @param initialEntriesRef - Ref containing initial entries for recovery.
 * @returns Promise resolving to sync report and final progress state.
 * @source
 */
async function executeSyncModeImpl(
  entries: AniListMediaEntry[],
  token: string,
  abortController: AbortController,
  uniqueMediaIds: number[],
  setState: React.Dispatch<React.SetStateAction<SynchronizationState>>,
  updateSnapshotFromProgress: (
    progress: SyncProgress | null,
    entriesForRun: AniListMediaEntry[],
  ) => void,
  initialEntriesRef: { current: AniListMediaEntry[] },
): Promise<{ syncReport: SyncReport; lastReportedProgress: SyncProgress }> {
  let lastReportedProgress: SyncProgress = {
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

  const needsIncrementalSync = entries.some(
    (e) => e.syncMetadata?.useIncrementalSync,
  );

  if (!needsIncrementalSync) {
    console.info(
      "[Synchronization] ⚙️ Using standard (non-incremental) sync mode",
    );
    console.debug("[Synchronization] 🔍 Starting regular batch processing...");
    const syncReport = await runRegularBatch(
      entries,
      token,
      abortController.signal,
      uniqueMediaIds,
      (progress) => {
        const normalized: SyncProgress = {
          ...progress,
          total: uniqueMediaIds.length,
        };
        lastReportedProgress = normalized;
        setState((prev) => ({ ...prev, progress: normalized }));
        updateSnapshotFromProgress(normalized, initialEntriesRef.current);
      },
    );
    return { syncReport, lastReportedProgress };
  }

  // Incremental sync path
  console.info("[Synchronization] ⚙️ Using sequential incremental sync mode");
  const incrementalEntries = entries
    .filter((e) => e.syncMetadata?.useIncrementalSync)
    .map((entry) => {
      const previousProgress = entry.previousValues?.progress || 0;
      const targetProgress = entry.progress;
      return {
        ...entry,
        syncMetadata: {
          ...entry.syncMetadata!,
          targetProgress,
          progress: previousProgress,
          updatedStatus: entry.status !== entry.previousValues?.status,
          updatedScore: entry.score !== entry.previousValues?.score,
          step: undefined,
        },
      };
    });

  const regularEntries = entries.filter(
    (e) => !e.syncMetadata?.useIncrementalSync,
  );

  console.info(
    `[Synchronization] 📚 Processing ${incrementalEntries.length} entries with incremental sync`,
  );
  console.info(
    `[Synchronization] 📚 Processing ${regularEntries.length} entries with regular sync`,
  );

  console.debug("[Synchronization] 🔍 Starting regular batch processing...");

  // Process regular batch first
  let syncReport = await runRegularBatch(
    regularEntries,
    token,
    abortController.signal,
    uniqueMediaIds,
    (progress) => {
      lastReportedProgress = progress;
      setState((prev) => ({ ...prev, progress }));
      updateSnapshotFromProgress(progress, initialEntriesRef.current);
    },
  );

  // Then incremental entries sequentially
  const incReport = await runIncrementalEntries({
    incEntries: incrementalEntries,
    tokenArg: token,
    abortSignal: abortController.signal,
    uniqueIds: uniqueMediaIds,
    initialPartialReport: syncReport,
    setState,
    updateSnapshotFromProgress,
    initialEntriesRef,
    onProgressUpdate: () => {
      /* no-op: runIncrementalEntries updates state directly */
    },
  });

  syncReport = incReport;
  console.info("[Synchronization] ✅ Incremental sync completed successfully");
  return { syncReport, lastReportedProgress };
}

/**
 * Saves or clears the sync resume snapshot to persistent storage for recovery on app restart.
 * @param snapshot - The snapshot to save, or null to clear existing snapshot.
 * @source
 */
const saveSnapshotToStorage = (snapshot: SyncResumeSnapshot | null): void => {
  if (!snapshot) {
    console.debug("[Synchronization] 🔍 Removing sync snapshot from storage");
    storage.removeItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
    return;
  }

  try {
    console.debug(
      `[Synchronization] 🔍 Saving sync snapshot: ${snapshot.remainingMediaIds.length} remaining entries`,
    );
    storage.setItem(
      STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT,
      JSON.stringify(snapshot),
    );
  } catch (error) {
    console.error(
      "[Synchronization] ❌ Failed to persist sync snapshot:",
      error,
    );
  }
};

/**
 * Creates a progress updater object for incremental sync entry tracking.
 * Maintains counters and updates state with detailed step-level progress information.
 * @param uniqueIds - Array of unique media IDs for calculating percentages.
 * @param initialPartialReport - Starting report for accumulating results.
 * @param setState - State setter for synchronization state.
 * @param updateSnapshotFromProgress - Callback to update resume snapshot.
 * @param initialEntriesRef - Reference to initial entries.
 * @param onProgressUpdate - Callback for external progress listeners.
 * @returns Object with methods for updating and querying progress state.
 * @source
 */
const createProgressUpdater = (
  uniqueIds: number[],
  initialPartialReport: SyncReport,
  setState: React.Dispatch<React.SetStateAction<SynchronizationState>>,
  updateSnapshotFromProgress: (
    progress: SyncProgress | null,
    entriesForRun: AniListMediaEntry[],
  ) => void,
  initialEntriesRef: { current: AniListMediaEntry[] },
  onProgressUpdate: (p: SyncProgress) => void,
) => {
  let successfulUpdates = initialPartialReport.successfulUpdates;
  let failedUpdates = initialPartialReport.failedUpdates;
  let skippedUpdates = initialPartialReport.skippedEntries;
  let overallProgress = successfulUpdates + failedUpdates + skippedUpdates;

  let lastReportedProgress: SyncProgress = {
    total: uniqueIds.length,
    completed: overallProgress,
    successful: successfulUpdates,
    failed: failedUpdates,
    skipped: skippedUpdates,
    currentEntry: null,
    currentStep: null,
    totalSteps: null,
    rateLimited: false,
    retryAfter: null,
  };

  const updateProgressLocal = (
    entry: AniListMediaEntry,
    step: number | null = null,
    stepCompleted = false,
    success = true,
  ) => {
    if (stepCompleted) {
      overallProgress++;
      if (success) successfulUpdates++;
      else failedUpdates++;
    }
    const next: SyncProgress = {
      ...lastReportedProgress,
      completed: overallProgress,
      total: uniqueIds.length,
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
      rateLimited: false,
      retryAfter: null,
    };
    lastReportedProgress = next;
    setState((prev) => ({ ...prev, progress: next }));
    updateSnapshotFromProgress(next, initialEntriesRef.current);
    onProgressUpdate(next);
  };

  return {
    updateProgressLocal,
    getCounters: () => ({
      successfulUpdates,
      failedUpdates,
      skippedUpdates,
      overallProgress,
    }),
    incrementSuccess: () => successfulUpdates++,
    incrementFailed: () => failedUpdates++,
    incrementSkipped: () => skippedUpdates++,
    addProgress: (count: number) => (overallProgress += count),
    getLastProgress: () => lastReportedProgress,
    setLastProgress: (progress: SyncProgress) => {
      lastReportedProgress = progress;
    },
  };
};

/**
 * Represents the state of an active synchronization process.
 * @property isActive - Whether synchronization is currently running.
 * @property progress - Current progress details, or null if not started.
 * @property report - Completed or partial sync report, or null.
 * @property error - Error message if sync failed, or null.
 * @property abortController - Controller for cancelling the sync, or null.
 * @property isPaused - Whether the sync is paused and resumable.
 * @property resumeAvailable - Whether a paused sync can be resumed.
 * @property resumeMetadata - Metadata about available resume state.
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
 * Executes a standard (non-incremental) batch sync operation.
 * Processes all entries in the batch and returns the final report.
 * @param batchEntries - Entries to synchronize in this batch.
 * @param tokenArg - AniList authentication token.
 * @param abortSignal - Signal for cancelling the batch operation.
 * @param uniqueIds - Unique media IDs for progress normalization.
 * @param onProgressUpdate - Callback for progress updates.
 * @returns Promise resolving to the batch sync report.
 * @source
 */
async function runRegularBatch(
  batchEntries: AniListMediaEntry[],
  tokenArg: string,
  abortSignal: AbortSignal,
  uniqueIds: number[],
  onProgressUpdate: (p: SyncProgress) => void,
): Promise<SyncReport> {
  if (batchEntries.length === 0) {
    return {
      totalEntries: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedEntries: 0,
      errors: [],
      timestamp: new Date(),
    };
  }
  return await syncMangaBatch(
    batchEntries,
    tokenArg,
    (progress) => {
      const normalized: SyncProgress = {
        ...progress,
        total: uniqueIds.length,
      };
      onProgressUpdate(normalized);
    },
    abortSignal,
    uniqueIds,
  );
}

/**
 * Context object bundling parameters for incremental sync operations.
 * Reduces parameter count and improves code readability for sequential entry processing.
 * @source
 */
interface IncrementalSyncContext {
  incEntries: AniListMediaEntry[];
  tokenArg: string;
  abortSignal: AbortSignal;
  uniqueIds: number[];
  initialPartialReport: SyncReport;
  setState: React.Dispatch<React.SetStateAction<SynchronizationState>>;
  updateSnapshotFromProgress: (
    progress: SyncProgress | null,
    entriesForRun: AniListMediaEntry[],
  ) => void;
  initialEntriesRef: { current: AniListMediaEntry[] };
  onProgressUpdate: (p: SyncProgress) => void;
}

/**
 * Handles transitioning to paused state: persists partial report and snapshot for resume.
 * Updates state to reflect paused status with resumable metadata.
 * @param existingReportFragment - Partial report from previous session if resuming.
 * @param syncReport - Current batch's sync report.
 * @param lastReportedProgress - Last progress update before pause.
 * @param resumeSnapshotRef - Reference to resume snapshot object.
 * @param updateSnapshotFromProgress - Callback to update snapshot.
 * @param initialEntriesRef - Reference to initial entries.
 * @param setState - State setter for synchronization state.
 * @source
 */
function handlePausedSync(
  existingReportFragment: SyncReport | null,
  syncReport: SyncReport,
  lastReportedProgress: SyncProgress,
  resumeSnapshotRef: { current: SyncResumeSnapshot | null },
  updateSnapshotFromProgress: (
    progress: SyncProgress | null,
    entriesForRun: AniListMediaEntry[],
  ) => void,
  initialEntriesRef: { current: AniListMediaEntry[] },
  setState: React.Dispatch<React.SetStateAction<SynchronizationState>>,
): void {
  const partialReport = mergeReports(existingReportFragment, syncReport);

  if (!resumeSnapshotRef.current) {
    updateSnapshotFromProgress(lastReportedProgress, initialEntriesRef.current);
  }

  if (resumeSnapshotRef.current) {
    resumeSnapshotRef.current.reportFragment = toPersistedReport(partialReport);
    resumeSnapshotRef.current.progress = { ...lastReportedProgress };
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
          remainingMediaIds: resumeSnapshotRef.current.remainingMediaIds,
          timestamp: resumeSnapshotRef.current.timestamp,
        }
      : prev.resumeMetadata,
  }));
}

/**
 * Finalizes a completed sync operation: saves report history and clears resume state.
 * Marks synchronization as no longer active.
 * @param existingReportFragment - Partial report from previous session if resuming.
 * @param syncReport - Final batch sync report to finalize.
 * @param pauseRequested - Whether pause was requested instead of full completion.
 * @param clearResumeSnapshot - Callback to clear resume snapshot.
 * @param setState - State setter for synchronization state.
 * @source
 */
function finalizeSyncOperation(
  existingReportFragment: SyncReport | null,
  syncReport: SyncReport,
  pauseRequested: boolean,
  clearResumeSnapshot: () => void,
  setState: React.Dispatch<React.SetStateAction<SynchronizationState>>,
): void {
  const finalReport = mergeReports(existingReportFragment, syncReport);

  if (!pauseRequested) {
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
}

/**
 * Processes incremental entries sequentially, merging results into accumulated report.
 * Handles step-level progress tracking and error recovery for each entry.
 * @param context - IncrementalSyncContext containing all required parameters.
 * @returns Promise resolving to merged sync report with all incremental results.
 * @source
 */
async function runIncrementalEntries(
  context: IncrementalSyncContext,
): Promise<SyncReport> {
  const {
    incEntries,
    tokenArg,
    abortSignal,
    uniqueIds,
    initialPartialReport,
    setState,
    updateSnapshotFromProgress,
    initialEntriesRef,
    onProgressUpdate,
  } = context;
  const progressUpdater = createProgressUpdater(
    uniqueIds,
    initialPartialReport,
    setState,
    updateSnapshotFromProgress,
    initialEntriesRef,
    onProgressUpdate,
  );

  const errors = [...initialPartialReport.errors];

  for (const entry of incEntries) {
    if (abortSignal.aborted) {
      console.info(
        "[Synchronization] ⏹️ Incremental sync cancelled - stopping processing",
      );
      break;
    }

    console.debug(
      `[Synchronization] 🔍 Processing incremental entry: ${entry.title || entry.mediaId}`,
    );

    try {
      const syncResult = await syncMangaBatch(
        [entry],
        tokenArg,
        (progress) => {
          if (progress.currentEntry) {
            progressUpdater.updateProgressLocal(
              entry,
              progress.currentStep ?? null,
              false,
              true,
            );
          }
        },
        abortSignal,
        uniqueIds,
      );

      if (abortSignal.aborted) {
        console.info(
          `[Synchronization] ⏹️ Sync aborted during processing of entry ${entry.mediaId}`,
        );
        break;
      }

      console.debug(
        `[Synchronization] ✅ Completed incremental entry: ${entry.title || entry.mediaId}`,
      );

      const counters = progressUpdater.getCounters();
      const successfulUpdates =
        counters.successfulUpdates + syncResult.successfulUpdates;
      const failedUpdates = counters.failedUpdates + syncResult.failedUpdates;
      const skippedUpdates =
        counters.skippedUpdates + syncResult.skippedEntries;
      const overallProgress =
        counters.overallProgress + syncResult.totalEntries;

      if (syncResult.errors.length) errors.push(...syncResult.errors);

      const finalized: SyncProgress = {
        ...progressUpdater.getLastProgress(),
        completed: overallProgress,
        total: uniqueIds.length,
        successful: successfulUpdates,
        failed: failedUpdates,
        skipped: skippedUpdates,
        currentStep: null,
      };

      progressUpdater.setLastProgress(finalized);
      setState((prev) => ({ ...prev, progress: finalized }));
      updateSnapshotFromProgress(finalized, initialEntriesRef.current);

      console.debug(
        `[Synchronization] Completed all steps for ${entry.mediaId}`,
      );
    } catch (err) {
      console.error(
        `[Synchronization] Error processing incremental sync for entry ${entry.mediaId}:`,
        err,
      );

      const counters = progressUpdater.getCounters();
      const failedUpdates = counters.failedUpdates + 1;
      const overallProgress = counters.overallProgress + 1;

      if (err instanceof Error) {
        errors.push({ mediaId: entry.mediaId, error: err.message });
      }

      const failedProgress: SyncProgress = {
        ...progressUpdater.getLastProgress(),
        completed: overallProgress,
        total: uniqueIds.length,
        failed: failedUpdates,
        currentStep: null,
      };

      progressUpdater.setLastProgress(failedProgress);
      setState((prev) => ({ ...prev, progress: failedProgress }));
      updateSnapshotFromProgress(failedProgress, initialEntriesRef.current);
    }
  }

  const finalCounters = progressUpdater.getCounters();
  return {
    successfulUpdates: finalCounters.successfulUpdates,
    failedUpdates: finalCounters.failedUpdates,
    totalEntries:
      finalCounters.successfulUpdates +
      finalCounters.failedUpdates +
      finalCounters.skippedUpdates,
    skippedEntries: finalCounters.skippedUpdates,
    errors,
    timestamp: new Date(),
  };
}

/**
 * Set of actions available for controlling synchronization operations.
 * @property startSync - Begins synchronization of the provided entries.
 * @property cancelSync - Aborts the active sync and clears state.
 * @property pauseSync - Pauses sync after current entry, saving state for resume.
 * @property resumeSync - Resumes a previously paused synchronization.
 * @property exportErrors - Exports the error log from the last sync report.
 * @property exportReport - Exports the complete sync report to file.
 * @property reset - Resets synchronization state to initial values.
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

type DebuggableSynchronizationState = Omit<
  SynchronizationState,
  "abortController"
> & {
  abortController: {
    aborted: boolean;
    reason?: unknown;
  } | null;
};

interface SyncDebugSnapshot {
  state: DebuggableSynchronizationState;
  resumeSnapshot: SyncResumeSnapshot | null;
  pendingEntriesCount: number;
  uniqueMediaIds: number[];
  pauseRequested: boolean;
  resumeRequested: boolean;
}

const toDebugSyncState = (
  input: SynchronizationState,
): DebuggableSynchronizationState => ({
  ...input,
  abortController: input.abortController
    ? {
        aborted: input.abortController.signal.aborted,
        reason: (input.abortController.signal as { reason?: unknown }).reason,
      }
    : null,
});

const fromDebugSyncState = (
  input: DebuggableSynchronizationState,
): SynchronizationState => ({
  ...input,
  abortController: null,
});

/**
 * Provides state management and control methods for AniList synchronization operations.
 * Supports batch sync, pause/resume recovery, incremental entry processing, and error tracking.
 * Persists state to storage for recovery on app restart.
 * @returns Tuple of [synchronization state, synchronization actions].
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
  const { registerStateInspector: registerSyncStateInspector, recordEvent } =
    useDebugActions();
  const syncInspectorHandleRef =
    useRef<StateInspectorHandle<SyncDebugSnapshot> | null>(null);
  const syncSnapshotRef = useRef<SyncDebugSnapshot | null>(null);
  const getSyncSnapshotRef = useRef<() => SyncDebugSnapshot>(() => ({
    state: toDebugSyncState(state),
    resumeSnapshot: resumeSnapshotRef.current
      ? {
          ...resumeSnapshotRef.current,
          entries: cloneEntries(resumeSnapshotRef.current.entries),
        }
      : null,
    pendingEntriesCount: initialEntriesRef.current.length,
    uniqueMediaIds: [...uniqueMediaIdsRef.current],
    pauseRequested: pauseRequestedRef.current,
    resumeRequested: resumeRequestedRef.current,
  }));

  getSyncSnapshotRef.current = () => ({
    state: toDebugSyncState(state),
    resumeSnapshot: resumeSnapshotRef.current
      ? {
          ...resumeSnapshotRef.current,
          entries: cloneEntries(resumeSnapshotRef.current.entries),
        }
      : null,
    pendingEntriesCount: initialEntriesRef.current.length,
    uniqueMediaIds: [...uniqueMediaIdsRef.current],
    pauseRequested: pauseRequestedRef.current,
    resumeRequested: resumeRequestedRef.current,
  });

  const emitSyncSnapshot = useCallback(() => {
    if (!syncInspectorHandleRef.current) return;
    const snapshot = getSyncSnapshotRef.current();
    syncSnapshotRef.current = snapshot;
    syncInspectorHandleRef.current.publish(snapshot);
  }, []);

  const applySyncDebugSnapshot = useCallback(
    (snapshot: SyncDebugSnapshot) => {
      if (snapshot.state) {
        setState((prev) => ({
          ...prev,
          ...fromDebugSyncState(snapshot.state),
        }));
      }

      if (Array.isArray(snapshot.uniqueMediaIds)) {
        uniqueMediaIdsRef.current = [...snapshot.uniqueMediaIds];
      }

      if (typeof snapshot.pauseRequested === "boolean") {
        pauseRequestedRef.current = snapshot.pauseRequested;
      }

      if (typeof snapshot.resumeRequested === "boolean") {
        resumeRequestedRef.current = snapshot.resumeRequested;
      }

      if (snapshot.resumeSnapshot !== undefined) {
        resumeSnapshotRef.current = snapshot.resumeSnapshot
          ? {
              ...snapshot.resumeSnapshot,
              entries: cloneEntries(snapshot.resumeSnapshot.entries || []),
            }
          : null;
        initialEntriesRef.current = snapshot.resumeSnapshot
          ? cloneEntries(snapshot.resumeSnapshot.entries || [])
          : [];
      }

      syncSnapshotRef.current = getSyncSnapshotRef.current();
      emitSyncSnapshot();
    },
    [emitSyncSnapshot, setState],
  );

  useEffect(() => {
    emitSyncSnapshot();
  }, [state, emitSyncSnapshot]);

  useEffect(() => {
    if (!registerSyncStateInspector) return;

    syncSnapshotRef.current = getSyncSnapshotRef.current();

    const handle = registerSyncStateInspector<SyncDebugSnapshot>({
      id: "sync-state",
      label: "Synchronization",
      description:
        "AniList sync engine status, resume metadata, and control signals.",
      group: "Application",
      getSnapshot: () =>
        syncSnapshotRef.current ?? getSyncSnapshotRef.current(),
      setSnapshot: applySyncDebugSnapshot,
    });

    syncInspectorHandleRef.current = handle;

    return () => {
      handle.unregister();
      syncInspectorHandleRef.current = null;
      syncSnapshotRef.current = null;
    };
  }, [registerSyncStateInspector, applySyncDebugSnapshot]);

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

    emitSyncSnapshot();
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

    emitSyncSnapshot();
  };

  useEffect(() => {
    if (hasLoadedSnapshotRef.current) return;
    hasLoadedSnapshotRef.current = true;

    const storedSnapshot = storage.getItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
    if (!storedSnapshot) {
      console.debug("[Synchronization] 🔍 No stored sync snapshot found");
      return;
    }

    console.debug("[Synchronization] 🔍 Loading stored sync snapshot...");

    try {
      const parsed: SyncResumeSnapshot = JSON.parse(storedSnapshot);

      if (!parsed?.remainingMediaIds?.length) {
        console.debug(
          "[Synchronization] 🔍 Snapshot has no remaining entries, removing...",
        );
        storage.removeItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
        return;
      }

      console.info(
        `[Synchronization] ✅ Loaded sync snapshot: ${parsed.remainingMediaIds.length} remaining entries`,
      );

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
      console.error(
        "[Synchronization] ❌ Failed to load stored sync snapshot:",
        error,
      );
      storage.removeItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
    }
  }, []);

  /**
   * Starts a new synchronization for the provided AniList media entries.
   * @param entries - AniList media entries to synchronize.
   * @param token - AniList authentication token.
   * @param _unused - Reserved for future use.
   * @param displayOrderMediaIds - Optional IDs to control sync order.
   * @returns Promise resolving when sync completes or fails.
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
        console.warn("[Synchronization] ⚠️ Sync is already in progress");
        return;
      }
      if (!entries.length) {
        console.warn("[Synchronization] ⚠️ No entries to synchronize");
        setState((prev) => ({ ...prev, error: "No entries to synchronize" }));
        return;
      }
      if (!token) {
        console.error("[Synchronization] ❌ No authentication token available");
        setState((prev) => ({
          ...prev,
          error: "No authentication token available",
        }));
        return;
      }

      const isResume = resumeRequestedRef.current;
      resumeRequestedRef.current = false;

      console.info(
        `[Synchronization] ${isResume ? "▶️ Resuming" : "🚀 Starting"} sync for ${entries.length} entries`,
      );

      recordEvent({
        type: isResume ? "sync.resume" : "sync.start",
        message: `${isResume ? "Resumed" : "Started"} sync for ${entries.length} entries`,
        level: "info",
        metadata: { entryCount: entries.length, isResume },
      });

      if (!isResume && resumeSnapshotRef.current) {
        console.debug(
          "[Synchronization] 🔍 Clearing existing resume snapshot for fresh sync",
        );
        clearResumeSnapshot();
      }

      const existingReportFragment = isResume
        ? fromPersistedReport(resumeSnapshotRef.current?.reportFragment ?? null)
        : null;

      pauseRequestedRef.current = false;

      // Main orchestration
      try {
        // Initialize controller, ids, progress
        const abortController = new AbortController();
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

        // Execute sync mode
        const executed = await executeSyncModeImpl(
          entries,
          token,
          abortController,
          uniqueMediaIds,
          setState,
          updateSnapshotFromProgress,
          initialEntriesRef,
        );

        const syncReport = executed.syncReport;
        const lastReportedProgress = executed.lastReportedProgress;

        // If pause was requested, persist partial report and snapshot
        if (pauseRequestedRef.current) {
          console.info(
            "[Synchronization] ⏸️ Pausing sync and saving state for resume...",
          );
          handlePausedSync(
            existingReportFragment,
            syncReport,
            lastReportedProgress,
            resumeSnapshotRef,
            updateSnapshotFromProgress,
            initialEntriesRef,
            setState,
          );
          console.info("[Synchronization] ✅ Sync paused successfully");
          return;
        }

        // Finalize the sync operation
        console.debug("[Synchronization] 🔍 Finalizing sync operation...");
        finalizeSyncOperation(
          existingReportFragment,
          syncReport,
          pauseRequestedRef.current,
          clearResumeSnapshot,
          setState,
        );

        const finalReport = mergeReports(existingReportFragment, syncReport);
        recordEvent({
          type: "sync.complete",
          message: `Sync completed: ${finalReport.successfulUpdates} success, ${finalReport.failedUpdates} failed`,
          level: finalReport.failedUpdates > 0 ? "warn" : "success",
          metadata: {
            totalEntries: finalReport.totalEntries,
            successfulUpdates: finalReport.successfulUpdates,
            failedUpdates: finalReport.failedUpdates,
            skippedEntries: finalReport.skippedEntries,
          },
        });
      } catch (error) {
        console.error("[Synchronization] Sync operation failed:", error);
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
   * Cancels the active synchronization, aborting all in-progress requests immediately.
   * Clears pending partial results and disables resume.
   * @source
   */
  const cancelSync = useCallback(() => {
    if (state.abortController) {
      console.info(
        "[Synchronization] Cancellation requested - aborting all sync operations",
      );
      recordEvent({
        type: "sync.cancel",
        message: "Sync cancelled by user",
        level: "warn",
        metadata: {
          progress: state.progress,
        },
      });
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
      console.info(
        "%c🛑 [Synchronization] SYNC CANCELLED - All operations stopped",
        "color: red; font-weight: bold",
      );
    }
  }, [clearResumeSnapshot, state.abortController]);

  const pauseSync = useCallback(() => {
    if (state.abortController) {
      console.info(
        "[Synchronization] ⏸️ Pause requested - stopping current sync after current task",
      );
      recordEvent({
        type: "sync.pause",
        message: "Sync paused by user",
        level: "info",
        metadata: {
          progress: state.progress,
        },
      });
      pauseRequestedRef.current = true;
      state.abortController.abort();
      emitSyncSnapshot();
    } else {
      console.warn(
        "[Synchronization] ⚠️ Cannot pause - no active sync operation",
      );
    }
  }, [state.abortController, emitSyncSnapshot]);

  /**
   * Resumes a previously paused synchronization with remaining entries.
   * Restores state from pause snapshot and continues processing.
   * @param entries - AniList media entries (used if snapshot entries unavailable).
   * @param token - AniList authentication token.
   * @param _unused - Reserved for future use.
   * @param displayOrderMediaIds - Optional IDs to override display order during resume.
   * @returns Promise resolving when resume completes or fails.
   * @source
   */
  const resumeSync = useCallback(
    async (
      entries: AniListMediaEntry[],
      token: string,
      _unused?: undefined,
      displayOrderMediaIds?: number[],
    ) => {
      const snapshot = resumeSnapshotRef.current;

      if (!snapshot) {
        console.warn(
          "[Synchronization] ⚠️ No paused synchronization state available to resume",
        );
        return;
      }

      const remainingIds = snapshot.remainingMediaIds;
      if (!remainingIds || remainingIds.length === 0) {
        console.warn(
          "[Synchronization] ⚠️ Paused state contains no remaining entries",
        );
        clearResumeSnapshot();
        return;
      }

      console.info(
        `[Synchronization] ▶️ Resuming sync with ${remainingIds.length} remaining entries`,
      );

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
        console.warn(
          "[Synchronization] ⚠️ No matching entries found to resume",
        );
        clearResumeSnapshot();
        return;
      }

      console.debug(
        `[Synchronization] 🔍 Prepared ${entriesToResume.length} entries for resume`,
      );

      resumeRequestedRef.current = true;
      emitSyncSnapshot();

      await startSync(
        entriesToResume,
        token,
        _unused,
        displayOrderMediaIds?.length ? displayOrderMediaIds : remainingIds,
      );
    },
    [clearResumeSnapshot, emitSyncSnapshot, startSync],
  );

  /**
   * Exports the error log from the last synchronization report.
   * If no report is available, this function does nothing.
   * @source
   */
  const exportErrors = useCallback(() => {
    if (state.report) {
      console.info("[Synchronization] 📤 Exporting error log...");
      exportSyncErrorLog(state.report);
      console.info("[Synchronization] ✅ Error log exported successfully");
    } else {
      console.warn("[Synchronization] ⚠️ No sync report available to export");
    }
  }, [state.report]);

  /**
   * Exports the complete synchronization report to a file.
   * If no report is available, this function does nothing.
   * @source
   */
  const exportReport = useCallback(() => {
    if (state.report) {
      console.info("[Synchronization] 📤 Exporting sync report...");
      exportSyncReport(state.report);
      console.info("[Synchronization] ✅ Sync report exported successfully");
    } else {
      console.warn("[Synchronization] ⚠️ No sync report available to export");
    }
  }, [state.report]);

  /**
   * Resets synchronization state to initial values, clearing all progress and reports.
   * @source
   */
  const reset = useCallback(() => {
    console.info("[Synchronization] 🔄 Resetting synchronization state...");
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
    emitSyncSnapshot();
  }, [clearResumeSnapshot, emitSyncSnapshot]);

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
