/**
 * @packageDocumentation
 * @module useMatchHandlers
 * @description Custom React hook providing handler functions for managing manga match results and user interactions, supporting both single and batch operations with undo/redo capabilities.
 */

import { useCallback } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { AniListManga, MangaMatchResult } from "../api/anilist/types";
import { STORAGE_KEYS, storage } from "../utils/storage";
import { useDebugActions } from "../contexts/debug-context";
import type { UndoRedoManager } from "../utils/undo-redo";
import {
  AcceptMatchCommand,
  RejectMatchCommand,
  SelectAlternativeCommand,
  ResetToPendingCommand,
  SelectSearchMatchCommand,
  BulkUpdateCommand,
} from "../utils/undo-redo";
import { processInChunks, AbortError } from "../utils/chunked-processing";

/**
 * Provides handler functions for managing manga match results and user interactions during the matching workflow.
 * @param matchResults - Current array of manga match results.
 * @param setMatchResults - State setter for updating match results.
 * @param searchTargetRef - Ref to track the current manga being searched (owned by caller).
 * @param setSearchTarget - State setter for the current manga being searched (for cleanup).
 * @param setIsSearchOpen - State setter for toggling the search panel.
 * @param setBypassCache - State setter for bypassing cache during manual search.
 * @param undoRedoManager - Optional undo/redo manager for recording commands.
 * @returns Object with handler functions for accepting/rejecting matches, manual search, alternative selection, and reset operations.
 * @source
 */
export const useMatchHandlers = (
  matchResults: MangaMatchResult[],
  setMatchResults: React.Dispatch<React.SetStateAction<MangaMatchResult[]>>,
  searchTargetRef: { current: KenmeiManga | undefined },
  setSearchTarget: React.Dispatch<
    React.SetStateAction<KenmeiManga | undefined>
  >,
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setBypassCache: React.Dispatch<React.SetStateAction<boolean>>,
  undoRedoManager?: UndoRedoManager,
) => {
  const { recordEvent } = useDebugActions();

  /**
   * Updates both the search target ref and state.
   * Used by callers to properly set the search target before opening search panel.
   *
   * @param manga - The manga to set as search target
   * @source
   */
  const setSearchTargetExternal = useCallback(
    (manga: KenmeiManga | undefined) => {
      // eslint-disable-next-line
      searchTargetRef.current = manga;
      setSearchTarget(manga);
    },
    [searchTargetRef, setSearchTarget],
  );

  /**
   * Finds the index of a match in the results array by ID or title.
   *
   * @param match - The match result or Kenmei manga to find.
   * @returns The index of the match in the results array, or -1 if not found.
   * @source
   */
  const findMatchIndex = useCallback(
    (match: MangaMatchResult | KenmeiManga) => {
      // Determine if we're dealing with a MangaMatchResult or a KenmeiManga
      const kenmeiManga = "kenmeiManga" in match ? match.kenmeiManga : match;

      // First try to find the match by ID
      let index = matchResults.findIndex(
        (m) => m.kenmeiManga.id === kenmeiManga.id,
      );

      // If not found by ID, try alternative methods
      if (index === -1) {
        console.debug(
          `[MatchHandlers] Could not find match with ID ${kenmeiManga.id}, trying fallback methods...`,
        );

        // Fallback 1: Try finding by exact title match
        index = matchResults.findIndex(
          (m) => m.kenmeiManga.title === kenmeiManga.title,
        );

        if (index === -1) {
          // Fallback 2: Try finding by case-insensitive title match
          index = matchResults.findIndex(
            (m) =>
              m.kenmeiManga.title?.toLowerCase() ===
              kenmeiManga.title?.toLowerCase(),
          );

          if (index === -1) {
            console.error(
              `[MatchHandlers] Could not find match for "${kenmeiManga.title}" to update`,
            );
            return -1;
          } else {
            console.debug(
              `[MatchHandlers] Found match by case-insensitive title at index ${index}`,
            );
          }
        } else {
          console.debug(
            `[MatchHandlers] Found match by exact title at index ${index}`,
          );
        }
      } else {
        console.debug(`[MatchHandlers] Found match by ID at index ${index}`);
      }

      return index;
    },
    [matchResults],
  );

  /**
   * Helper function to apply a command patch against the latest state.
   * Uses functional state update to apply changes and persists to storage.
   *
   * @param state - The updated match state to apply.
   * @source
   */
  const applyCommandPatch = useCallback((state: MangaMatchResult) => {
    setMatchResults((prev) => {
      // Find the match by ID using the helper logic
      let idx = prev.findIndex(
        (m) => m.kenmeiManga.id === state.kenmeiManga.id,
      );

      // Fallback to title matching if ID not found
      if (idx === -1) {
        idx = prev.findIndex(
          (m) => m.kenmeiManga.title === state.kenmeiManga.title,
        );
      }

      // If still not found, try case-insensitive match
      if (idx === -1) {
        idx = prev.findIndex(
          (m) =>
            m.kenmeiManga.title?.toLowerCase() ===
            state.kenmeiManga.title?.toLowerCase(),
        );
      }

      // If match found, apply the patch
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = state;
        // Persist to storage
        try {
          storage.setItem(STORAGE_KEYS.MATCH_RESULTS, JSON.stringify(next));
        } catch (storageError) {
          console.error(
            "[MatchHandlers] Failed to persist match results to storage:",
            storageError,
          );
        }
        return next;
      }

      // If not found, return unchanged
      return prev;
    });
  }, []);
  const handleManualSearch = useCallback(
    (manga: KenmeiManga) => {
      console.debug(
        "[MatchHandlers] handleManualSearch called with manga:",
        manga,
      );

      recordEvent({
        type: "match.manual-search",
        message: `Manual search initiated: ${manga.title}`,
        level: "info",
        metadata: { kenmeiTitle: manga.title },
      });

      // Find the match
      const index = findMatchIndex(manga);
      if (index === -1) return;

      // First close any existing panel to ensure it fully remounts
      setIsSearchOpen(false);

      // Small delay to ensure state updates before reopening
      setTimeout(() => {
        setSearchTarget(manga);
        setIsSearchOpen(true);

        // Enable bypass cache for manual searches
        setBypassCache(true);
      }, 10); // Very small delay is sufficient for React to process state updates
    },
    [findMatchIndex, setIsSearchOpen, setSearchTarget, setBypassCache],
  );

  /**
   * Updates match results state and persists them to storage asynchronously.
   * Uses optimistic UI updates: state is updated immediately while storage persistence
   * happens in the background to prevent UI blocking.
   *
   * @param updatedResults - The updated array of manga match results.
   * @source
   */
  const updateMatchResults = useCallback(
    (updatedResults: MangaMatchResult[]) => {
      // Update state immediately (optimistic UI update)
      setMatchResults(updatedResults);

      // Defer storage persistence to avoid blocking UI
      // Schedule as a low-priority task after rendering
      queueMicrotask(() => {
        try {
          const jsonString = JSON.stringify(updatedResults);
          console.debug(
            `[MatchHandlers] 💾 Persisting ${updatedResults.length} match results (${jsonString.length} bytes) to storage in background`,
          );

          // Try async storage first (electron-store)
          if (storage.setItemAsync) {
            storage
              .setItemAsync(STORAGE_KEYS.MATCH_RESULTS, jsonString)
              .catch((storageError) => {
                console.error(
                  "[MatchHandlers] Failed to persist match results to async storage:",
                  storageError,
                );
              });
          } else {
            // Fallback to sync storage (localStorage)
            storage.setItem(STORAGE_KEYS.MATCH_RESULTS, jsonString);
            console.debug(
              `[MatchHandlers] ✅ Match results persisted to localStorage`,
            );
          }
        } catch (storageError) {
          console.error(
            "[MatchHandlers] Failed to persist match results to storage:",
            storageError,
          );
        }
      });
    },
    [],
  );

  /**
   * Validates batch operation has matches.
   * @source
   */
  const validateBatchOperation = useCallback(
    (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
      actionName: string,
    ): boolean => {
      if (!("isBatchOperation" in match) || !match.isBatchOperation) {
        return false;
      }

      if (!match.matches || match.matches.length === 0) {
        console.warn(
          `[MatchHandlers] Batch ${actionName} operation called with empty matches array`,
        );
        return false;
      }

      return true;
    },
    [],
  );

  /**
   * Common batch processing logic shared by both undo/redo and non-undo/redo operations.
   * Handles chunked processing and result transformation.
   * @source
   */
  const processBatchCommon = useCallback(
    async (
      batchMatches: MangaMatchResult[],
      newStatus: "matched" | "skipped",
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      // Yield to UI while processing chunks
      await processInChunks(batchMatches, async () => [], {
        chunkSize: 20,
        delayBetweenChunks: 8,
        onProgress,
        signal: abortSignal,
      });

      // Build updated results
      return matchResults.map((m) => {
        const isInBatch = batchMatches.some(
          (bm) => bm.kenmeiManga.id === m.kenmeiManga.id,
        );
        if (isInBatch) {
          return {
            ...m,
            status: newStatus,
            selectedMatch: getSelectedMatch(m),
            matchDate: new Date().toISOString(),
          };
        }
        return m;
      });
    },
    [matchResults],
  );

  /**
   * Processes a batch operation with undo/redo support.
   * @source
   */
  const processBatchWithUndoRedo = useCallback(
    async (
      batchMatches: MangaMatchResult[],
      newStatus: "matched" | "skipped",
      actionName: string,
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      const beforeState = structuredClone(matchResults);
      const updatedResults = await processBatchCommon(
        batchMatches,
        newStatus,
        getSelectedMatch,
        onProgress,
        abortSignal,
      );

      // Create bulk command
      const bulkCommand = new BulkUpdateCommand(
        beforeState,
        updatedResults,
        updateMatchResults,
        `Batch ${actionName.toLowerCase()}`,
      );

      undoRedoManager!.executeCommand(bulkCommand);
    },
    [matchResults, updateMatchResults, undoRedoManager, processBatchCommon],
  );

  /**
   * Processes a batch operation without undo/redo support.
   * @source
   */
  const processBatchWithoutUndoRedo = useCallback(
    async (
      batchMatches: MangaMatchResult[],
      newStatus: "matched" | "skipped",
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      const updatedResults = await processBatchCommon(
        batchMatches,
        newStatus,
        getSelectedMatch,
        onProgress,
        abortSignal,
      );
      updateMatchResults(updatedResults);
    },
    [updateMatchResults, processBatchCommon],
  );

  /**
   * Common single match update logic shared by both undo/redo and non-undo/redo operations.
   * @source
   */
  const createUpdatedMatch = useCallback(
    (
      singleMatch: MangaMatchResult,
      newStatus: "matched" | "skipped",
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
    ) => {
      return {
        ...singleMatch,
        status: newStatus,
        selectedMatch: getSelectedMatch(singleMatch),
        matchDate: new Date().toISOString(),
      };
    },
    [],
  );

  /**
   * Processes a single match update with undo/redo support.
   * @source
   */
  const processSingleMatchWithUndoRedo = useCallback(
    (
      singleMatch: MangaMatchResult,
      index: number,
      newStatus: "matched" | "skipped",
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
      commandType: typeof AcceptMatchCommand | typeof RejectMatchCommand,
    ) => {
      const updatedMatch = createUpdatedMatch(
        singleMatch,
        newStatus,
        getSelectedMatch,
      );

      const command = new commandType(
        index,
        structuredClone(singleMatch),
        updatedMatch,
        applyCommandPatch,
      );
      undoRedoManager!.executeCommand(command);
    },
    [undoRedoManager, applyCommandPatch, createUpdatedMatch],
  );

  /**
   * Processes a single match update without undo/redo support.
   * @source
   */
  const processSingleMatchWithoutUndoRedo = useCallback(
    (
      singleMatch: MangaMatchResult,
      index: number,
      newStatus: "matched" | "skipped",
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
    ) => {
      const updatedResults = [...matchResults];
      const updatedMatch = createUpdatedMatch(
        singleMatch,
        newStatus,
        getSelectedMatch,
      );
      updatedResults[index] = updatedMatch;
      updateMatchResults(updatedResults);
    },
    [matchResults, updateMatchResults, createUpdatedMatch],
  );

  /**
   * Handles updating a match or batch of matches with a new status.
   * Integrates with undo/redo manager if provided.
   *
   * @param match - The match result or batch operation object to update.
   * @param newStatus - The new status to set.
   * @param actionName - The name of the action for logging purposes.
   * @param getSelectedMatch - Function to determine the selected match based on the operation.
   * @param commandType - The type of command for undo/redo tracking.
   * @source
   */

  /**
   * Logs batch operation details for debugging and event tracking.
   * @source
   */
  const logBatchOperation = useCallback(
    (matchCount: number, actionName: string): void => {
      console.debug(
        `[MatchHandlers] Processing batch ${actionName} operation for ${matchCount} matches`,
      );

      recordEvent({
        type: `match.batch-${actionName.toLowerCase()}`,
        message: `Batch ${actionName.toLowerCase()}: ${matchCount} matches`,
        level: "info",
        metadata: {
          matchCount,
          action: actionName.toLowerCase(),
        },
      });
    },
    [recordEvent],
  );

  /**
   * Logs single match operation details for debugging and event tracking.
   * @source
   */
  const logSingleMatchOperation = useCallback(
    (
      match: MangaMatchResult,
      actionName: string,
      newStatus: "matched" | "skipped",
    ): void => {
      console.debug(
        `[MatchHandlers] ${actionName === "Accept" ? "Accepting" : "Skipping"} match for ${match.kenmeiManga.title}, current status: ${match.status}`,
      );

      recordEvent({
        type: `match.${newStatus === "matched" ? "accept" : "skip"}`,
        message: `${actionName} match: ${match.kenmeiManga.title}`,
        level: "info",
        metadata: {
          kenmeiTitle: match.kenmeiManga.title,
          anilistId: match.selectedMatch?.id,
          anilistTitle: match.selectedMatch?.title?.romaji,
          status: newStatus,
        },
      });
    },
    [recordEvent],
  );

  const handleMatchStatusUpdate = useCallback(
    async (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
      newStatus: "matched" | "skipped",
      actionName: string,
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
      commandType?: typeof AcceptMatchCommand | typeof RejectMatchCommand,
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      // Check if this is a batch operation
      if (validateBatchOperation(match, actionName)) {
        const batchMatch = match as {
          isBatchOperation: boolean;
          matches: MangaMatchResult[];
        };
        const startTime = performance.now();
        logBatchOperation(batchMatch.matches.length, actionName);

        try {
          // For batch operations with undo/redo
          if (undoRedoManager && commandType) {
            await processBatchWithUndoRedo(
              batchMatch.matches,
              newStatus,
              actionName,
              getSelectedMatch,
              onProgress,
              abortSignal,
            );
          } else {
            // Fallback: update results directly without undo/redo
            await processBatchWithoutUndoRedo(
              batchMatch.matches,
              newStatus,
              getSelectedMatch,
              onProgress,
              abortSignal,
            );
          }

          const endTime = performance.now();
          console.debug(
            `[MatchHandlers] Batch ${actionName} completed in ${(endTime - startTime).toFixed(2)}ms`,
          );
        } catch (error) {
          if (error instanceof AbortError) {
            console.debug(`[MatchHandlers] Batch ${actionName} cancelled`);
            throw error;
          }
          console.error(`[MatchHandlers] Batch ${actionName} error:`, error);
          throw error;
        }
        return;
      }

      // Regular single match processing
      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      const singleMatch = match as MangaMatchResult;
      logSingleMatchOperation(singleMatch, actionName, newStatus);

      // Handle undo/redo if manager is available
      if (undoRedoManager && commandType) {
        processSingleMatchWithUndoRedo(
          singleMatch,
          index,
          newStatus,
          getSelectedMatch,
          commandType,
        );
      } else {
        processSingleMatchWithoutUndoRedo(
          singleMatch,
          index,
          newStatus,
          getSelectedMatch,
        );
      }
    },
    [
      findMatchIndex,
      recordEvent,
      undoRedoManager,
      validateBatchOperation,
      processBatchWithUndoRedo,
      processBatchWithoutUndoRedo,
      processSingleMatchWithUndoRedo,
      processSingleMatchWithoutUndoRedo,
      logBatchOperation,
      logSingleMatchOperation,
    ],
  );

  /**
   * Handles accepting a match or batch of matches, updating their status to "matched".
   * Creates an AcceptMatchCommand for undo/redo tracking if manager is available.
   *
   * @param match - The match result or batch operation object to accept.
   * @param onProgress - Optional callback for batch operation progress.
   * @param abortSignal - Optional signal for batch operation cancellation.
   * @source
   */
  const handleAcceptMatch = useCallback(
    async (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      await handleMatchStatusUpdate(
        match,
        "matched",
        "Accept",
        (singleMatch) => singleMatch.anilistMatches?.[0]?.manga,
        AcceptMatchCommand,
        onProgress,
        abortSignal,
      );
    },
    [handleMatchStatusUpdate],
  );

  /**
   * Handles rejecting/skipping a match or batch of matches, updating their status to "skipped".
   * Creates a RejectMatchCommand for undo/redo tracking if manager is available.
   *
   * @param match - The match result or batch operation object to reject.
   * @param onProgress - Optional callback for batch operation progress.
   * @param abortSignal - Optional signal for batch operation cancellation.
   * @source
   */
  const handleRejectMatch = useCallback(
    async (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      await handleMatchStatusUpdate(
        match,
        "skipped",
        "Reject",
        () => undefined,
        RejectMatchCommand,
        onProgress,
        abortSignal,
      );
    },
    [handleMatchStatusUpdate],
  );

  /**
   * Handles selecting an alternative match for a manga, optionally auto-accepting or directly accepting it.
   * Creates a SelectAlternativeCommand for undo/redo tracking if manager is available.
   *
   * @param match - The match result to update.
   * @param alternativeIndex - The index of the alternative to select.
   * @param autoAccept - Whether to automatically accept the selected alternative (default: false).
   * @param directAccept - Whether to directly accept the alternative without swapping (default: false).
   * @source
   */
  const handleSelectAlternative = useCallback(
    (
      match: MangaMatchResult,
      alternativeIndex: number,
      autoAccept = false,
      directAccept = false,
    ) => {
      console.debug(
        `[MatchHandlers] ${directAccept ? "Directly accepting" : "Switching main match with"} alternative #${alternativeIndex} for "${match.kenmeiManga.title}"${
          autoAccept && !directAccept ? " and auto-accepting" : ""
        }`,
      );

      // Find the match index in the current state
      const index = findMatchIndex(match);
      if (index === -1) {
        console.error(
          `[MatchHandlers] Match not found for ${match.kenmeiManga.title}`,
        );
        return;
      }

      // Get up-to-date match and validate alternatives
      const currentMatch = matchResults[index];
      const alternatives = currentMatch.anilistMatches ?? [];
      if (alternativeIndex < 0 || alternativeIndex >= alternatives.length) {
        console.error(
          `[MatchHandlers] Alternative at index ${alternativeIndex} doesn't exist`,
        );
        return;
      }

      const selectedAlternative = alternatives[alternativeIndex];
      if (!selectedAlternative?.manga) {
        console.error("[MatchHandlers] Selected alternative is invalid");
        return;
      }

      const updatedResults = [...matchResults];

      const directAcceptHandler = () => {
        console.debug(
          `[MatchHandlers] Directly accepting alternative "${
            selectedAlternative.manga.title?.english ||
            selectedAlternative.manga.title?.romaji ||
            "Unknown"
          }" as the match with confidence ${selectedAlternative.confidence}%`,
        );

        // Move selected alternative to front to preserve confidence display
        const rearranged = [...alternatives];
        rearranged.splice(alternativeIndex, 1);
        rearranged.unshift(selectedAlternative);

        updatedResults[index] = {
          ...currentMatch,
          selectedMatch: { ...selectedAlternative.manga },
          anilistMatches: rearranged,
          status: "matched" as const,
          matchDate: new Date().toISOString(),
        };
      };

      const swapHandler = () => {
        const currentMainMatch =
          currentMatch.selectedMatch ||
          (alternatives.length > 0 ? alternatives[0].manga : null);

        if (!currentMainMatch) {
          console.error("[MatchHandlers] No main match to swap with");
          return;
        }

        console.debug(
          `[MatchHandlers] Swapping main match "${
            currentMainMatch.title?.english ||
            currentMainMatch.title?.romaji ||
            "Unknown"
          }" with alternative "${
            selectedAlternative.manga.title?.english ||
            selectedAlternative.manga.title?.romaji ||
            "Unknown"
          }" with confidence ${selectedAlternative.confidence}%`,
        );

        const newAnilistMatches = [...alternatives];
        // Determine confidence for the main match when demoted
        const mainMatchConfidence = alternatives[0]?.confidence ?? 75;

        const mainAsAlternative = {
          id: currentMainMatch.id,
          manga: { ...currentMainMatch },
          confidence: mainMatchConfidence,
        };

        // Remove the selected alternative and insert demoted main at front
        newAnilistMatches.splice(alternativeIndex, 1);
        newAnilistMatches.unshift(mainAsAlternative);

        // Ensure the first item represents the selected alternative (with its confidence)
        newAnilistMatches[0] = {
          ...selectedAlternative,
          manga: { ...selectedAlternative.manga },
        };

        updatedResults[index] = {
          ...currentMatch,
          selectedMatch: { ...selectedAlternative.manga },
          anilistMatches: newAnilistMatches,
          status: autoAccept ? "matched" : currentMatch.status,
          matchDate: new Date().toISOString(),
        };
      };

      if (directAccept) {
        directAcceptHandler();
      } else {
        swapHandler();
      }

      // Handle undo/redo if manager is available
      if (undoRedoManager) {
        const command = new SelectAlternativeCommand(
          index,
          structuredClone(currentMatch),
          updatedResults[index],
          applyCommandPatch,
        );
        undoRedoManager.executeCommand(command);
      } else {
        updateMatchResults(updatedResults);
      }
    },
    [
      findMatchIndex,
      matchResults,
      updateMatchResults,
      undoRedoManager,
      applyCommandPatch,
    ],
  );

  /**
   * Common batch reset logic shared by both undo/redo and non-undo/redo operations.
   * Handles chunked processing and restoring original main matches.
   * @source
   */
  const processBatchResetCommon = useCallback(
    async (
      batchMatches: MangaMatchResult[],
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      // Yield to UI while processing chunks
      await processInChunks(batchMatches, async () => [], {
        chunkSize: 20,
        delayBetweenChunks: 8,
        onProgress,
        signal: abortSignal,
      });

      // Build updated results with original main match restored
      return matchResults.map((m) => {
        const isInBatch = batchMatches.some(
          (bm) => bm.kenmeiManga.id === m.kenmeiManga.id,
        );
        if (isInBatch) {
          const originalMainMatch = m.anilistMatches?.length
            ? m.anilistMatches[0].manga
            : undefined;
          return {
            ...m,
            status: "pending" as const,
            selectedMatch: originalMainMatch,
            matchDate: new Date().toISOString(),
          };
        }
        return m;
      });
    },
    [matchResults],
  );

  /**
   * Processes a batch reset operation with undo/redo support.
   * @source
   */
  const processBatchResetWithUndoRedo = useCallback(
    async (
      batchMatches: MangaMatchResult[],
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      const beforeState = structuredClone(matchResults);
      const updatedResults = await processBatchResetCommon(
        batchMatches,
        onProgress,
        abortSignal,
      );

      // Create and execute bulk command
      const bulkCommand = new BulkUpdateCommand(
        beforeState,
        updatedResults,
        updateMatchResults,
        "Batch reset",
      );

      undoRedoManager!.executeCommand(bulkCommand);
    },
    [
      matchResults,
      updateMatchResults,
      undoRedoManager,
      processBatchResetCommon,
    ],
  );

  /**
   * Processes a batch reset operation without undo/redo support.
   * @source
   */
  const processBatchResetWithoutUndoRedo = useCallback(
    async (
      batchMatches: MangaMatchResult[],
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      const updatedResults = await processBatchResetCommon(
        batchMatches,
        onProgress,
        abortSignal,
      );
      updateMatchResults(updatedResults);
    },
    [updateMatchResults, processBatchResetCommon],
  );

  /**
   * Processes a single match reset to pending status with undo/redo support.
   * @source
   */
  const processSingleReset = useCallback(
    (match: MangaMatchResult, index: number) => {
      // Create updated match with original main match restored
      const currentMatch = matchResults[index];
      const originalMainMatch = currentMatch.anilistMatches?.length
        ? currentMatch.anilistMatches[0].manga
        : undefined;

      const updatedMatch = {
        ...match,
        status: "pending" as const,
        selectedMatch: originalMainMatch,
        matchDate: new Date().toISOString(),
      };

      // Handle undo/redo if manager is available
      if (undoRedoManager) {
        const command = new ResetToPendingCommand(
          index,
          structuredClone(currentMatch),
          updatedMatch,
          applyCommandPatch,
        );
        undoRedoManager.executeCommand(command);
      } else {
        const updatedResults = [...matchResults];
        updatedResults[index] = updatedMatch;
        updateMatchResults(updatedResults);
      }
    },
    [matchResults, updateMatchResults, undoRedoManager, applyCommandPatch],
  );

  /**
   * Handles resetting a match or batch of matches back to the "pending" status.
   * Creates a ResetToPendingCommand for undo/redo tracking if manager is available.
   *
   * @param match - The match result or batch operation object to reset.
   * @source
   */
  const handleResetToPending = useCallback(
    async (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
      onProgress?: (current: number, total: number) => void,
      abortSignal?: AbortSignal,
    ) => {
      console.debug(
        "[MatchHandlers] handleResetToPending called with match:",
        match,
      );

      // Check if this is a batch operation
      if ("isBatchOperation" in match && match.isBatchOperation) {
        // Validate batch operation has matches
        if (!match.matches || match.matches.length === 0) {
          console.warn(
            "[MatchHandlers] Batch reset operation called with empty matches array",
          );
          return;
        }

        const startTime = performance.now();
        console.debug(
          `[MatchHandlers] Processing batch reset operation for ${match.matches.length} matches`,
        );

        recordEvent({
          type: "match.batch-reset",
          message: `Batch reset: ${match.matches.length} matches`,
          level: "info",
          metadata: {
            matchCount: match.matches.length,
            action: "reset",
          },
        });

        try {
          // For batch operations with undo/redo
          if (undoRedoManager) {
            await processBatchResetWithUndoRedo(
              match.matches,
              onProgress,
              abortSignal,
            );
          } else {
            // Fallback: update results directly without undo/redo
            await processBatchResetWithoutUndoRedo(
              match.matches,
              onProgress,
              abortSignal,
            );
          }

          const endTime = performance.now();
          console.debug(
            `[MatchHandlers] Batch reset completed in ${(endTime - startTime).toFixed(2)}ms`,
          );
        } catch (error) {
          if (error instanceof AbortError) {
            console.debug("[MatchHandlers] Batch reset cancelled");
            throw error;
          }
          console.error("[MatchHandlers] Batch reset error:", error);
          throw error;
        }
      }

      // Regular single match processing
      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      console.debug(
        `[MatchHandlers] Resetting match for ${(match as MangaMatchResult).kenmeiManga.title} from ${(match as MangaMatchResult).status} to pending`,
      );

      processSingleReset(match as MangaMatchResult, index);
    },
    [
      findMatchIndex,
      recordEvent,
      undoRedoManager,
      processBatchResetWithUndoRedo,
      processBatchResetWithoutUndoRedo,
      processSingleReset,
    ],
  );

  /**
   * Handles selecting a manga from the search panel and updating the match result accordingly.
   * Creates a SelectSearchMatchCommand for undo/redo tracking if manager is available.
   * Reads from searchTargetRef instead of using setState callback for React Compiler compatibility.
   *
   * @param manga - The AniList manga selected from the search panel.
   * @source
   */
  const handleSelectSearchMatch = useCallback(
    (manga: AniListManga) => {
      // Read from ref directly instead of using setState callback
      const searchTarget = searchTargetRef.current;

      if (!searchTarget) {
        console.error("[MatchHandlers] No manga target was set for search");
        return;
      }

      console.debug(
        "[MatchHandlers] Handling selection of manga from search:",
        manga.title,
      );

      // Find the match
      const matchIndex = findMatchIndex(searchTarget);
      if (matchIndex === -1) return;

      // Get the existing match
      const existingMatch = matchResults[matchIndex];
      console.debug(
        `[MatchHandlers] Updating manga: "${existingMatch.kenmeiManga.title}" with selected match: "${manga.title.english || manga.title.romaji}"`,
      );

      // Create a copy of the results
      const updatedResults = [...matchResults];

      // Check if the selected manga is already one of the alternatives
      let alternativeIndex = -1;
      if (
        existingMatch.anilistMatches &&
        existingMatch.anilistMatches.length > 0
      ) {
        alternativeIndex = existingMatch.anilistMatches.findIndex(
          (match) => match.manga.id === manga.id,
        );
      }

      let updatedMatch;
      if (alternativeIndex >= 0 && existingMatch.anilistMatches) {
        // The selected manga is already in the alternatives, so just switch to it
        console.debug(
          `[MatchHandlers] Selected manga is alternative #${alternativeIndex}, switching instead of creating manual match`,
        );

        updatedMatch = {
          ...existingMatch,
          status: "matched" as const, // Use "matched" status instead of "manual" since it's an existing alternative
          selectedMatch: existingMatch.anilistMatches[alternativeIndex].manga,
          matchDate: new Date().toISOString(),
        };
      } else {
        // It's a new match not in the alternatives, create a manual match
        updatedMatch = {
          ...existingMatch, // Keep all existing properties
          status: "manual" as const, // Change status to manual
          selectedMatch: manga, // Update with the new selected match
          matchDate: new Date().toISOString(),
        };
      }

      updatedResults[matchIndex] = updatedMatch;

      // Handle undo/redo if manager is available
      if (undoRedoManager) {
        const command = new SelectSearchMatchCommand(
          matchIndex,
          structuredClone(existingMatch),
          updatedMatch,
          applyCommandPatch,
        );
        undoRedoManager.executeCommand(command);
      } else {
        updateMatchResults(updatedResults);
      }

      // Then close the search panel
      setIsSearchOpen(false);
      setSearchTarget(undefined);
    },
    [
      searchTargetRef,
      findMatchIndex,
      matchResults,
      updateMatchResults,
      setIsSearchOpen,
      setSearchTarget,
      undoRedoManager,
      applyCommandPatch,
    ],
  );

  /**
   * Creates a type-safe batch operation object for processing multiple matches.
   * @param matches - Array of matches to process in batch.
   * @returns Batch operation object with type safety.
   * @throws {Error} If matches array is empty.
   * @source
   */
  const createBatchOperation = useCallback(
    (
      matches: MangaMatchResult[],
    ): { isBatchOperation: true; matches: MangaMatchResult[] } => {
      if (!matches || matches.length === 0) {
        throw new Error(
          "Cannot create batch operation with empty matches array",
        );
      }
      return {
        isBatchOperation: true,
        matches,
      };
    },
    [],
  );

  return {
    handleManualSearch,
    handleAcceptMatch,
    handleRejectMatch,
    handleSelectAlternative,
    handleResetToPending,
    handleSelectSearchMatch,
    createBatchOperation,
    setSearchTargetExternal,
  };
};
