/**
 * @packageDocumentation
 * @module useMatchHandlers
 * @description Custom React hook providing handler functions for managing manga match results and user interactions in the Kenmei to AniList sync tool. Supports both single and batch operations with undo/redo capabilities.
 * @example
 * ```typescript
 * // Single match operation
 * handleAcceptMatch(matchResult);
 *
 * // Batch operation
 * const selectedMatches = matchResults.filter(m => selectedIds.has(m.kenmeiManga.id));
 * handleAcceptMatch({ isBatchOperation: true, matches: selectedMatches });
 *
 * // Using the helper
 * handleAcceptMatch(createBatchOperation(selectedMatches));
 * ```
 */

import { useCallback } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { AniListManga, MangaMatchResult } from "../api/anilist/types";
import { STORAGE_KEYS, storage } from "../utils/storage";
import { useDebugActions } from "../contexts/DebugContext";
import type { UndoRedoManager } from "../utils/undoRedo";
import {
  AcceptMatchCommand,
  RejectMatchCommand,
  SelectAlternativeCommand,
  ResetToPendingCommand,
  SelectSearchMatchCommand,
  BatchCommand,
} from "../utils/undoRedo";

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
              m.kenmeiManga.title.toLowerCase() ===
              kenmeiManga.title.toLowerCase(),
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
            m.kenmeiManga.title.toLowerCase() ===
            state.kenmeiManga.title.toLowerCase(),
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
   * Updates match results state and persists them to storage.
   *
   * @param updatedResults - The updated array of manga match results.
   * @source
   */
  const updateMatchResults = useCallback(
    (updatedResults: MangaMatchResult[]) => {
      // Set the state with the new array
      setMatchResults(updatedResults);

      // Save to storage to ensure it's consistent
      try {
        storage.setItem(
          STORAGE_KEYS.MATCH_RESULTS,
          JSON.stringify(updatedResults),
        );
        console.debug(
          "[MatchHandlers] Successfully saved updated match results to storage",
        );
      } catch (storageError) {
        console.error(
          "[MatchHandlers] Failed to save match results to storage:",
          storageError,
        );
      }
    },
    [setMatchResults],
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
  const handleMatchStatusUpdate = useCallback(
    (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
      newStatus: "matched" | "skipped",
      actionName: string,
      getSelectedMatch: (match: MangaMatchResult) => AniListManga | undefined,
      commandType?: typeof AcceptMatchCommand | typeof RejectMatchCommand,
    ) => {
      // Check if this is a batch operation
      if ("isBatchOperation" in match && match.isBatchOperation) {
        // Validate batch operation has matches
        if (!match.matches || match.matches.length === 0) {
          console.warn(
            `[MatchHandlers] Batch ${actionName} operation called with empty matches array`,
          );
          return;
        }

        const startTime = performance.now();
        console.debug(
          `[MatchHandlers] Processing batch ${actionName} operation for ${match.matches.length} matches`,
        );

        recordEvent({
          type: `match.batch-${actionName.toLowerCase()}`,
          message: `Batch ${actionName.toLowerCase()}: ${match.matches.length} matches`,
          level: "info",
          metadata: {
            matchCount: match.matches.length,
            action: actionName.toLowerCase(),
          },
        });

        // For batch operations, create individual commands wrapped in a BatchCommand
        if (undoRedoManager && commandType) {
          const commands = match.matches.map((m) => {
            // Find the current state of this match in matchResults
            const currentIdx = matchResults.findIndex(
              (mr) => mr.kenmeiManga.id === m.kenmeiManga.id,
            );
            const currentMatch = currentIdx >= 0 ? matchResults[currentIdx] : m;

            // Create the updated match state with new status
            const updatedMatch = {
              ...currentMatch,
              status: newStatus,
              selectedMatch: getSelectedMatch(currentMatch),
              matchDate: new Date().toISOString(),
            };

            return new commandType(
              Math.max(currentIdx, 0),
              structuredClone(currentMatch),
              updatedMatch,
              applyCommandPatch,
            );
          });
          const batchCommand = new BatchCommand(
            commands,
            `Batch ${actionName.toLowerCase()}`,
          );
          undoRedoManager.executeCommand(batchCommand);

          // Update matchResults to trigger state update for UI re-render
          const updatedResults = matchResults.map((m) => {
            const isInBatch = match.matches.some(
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
          updateMatchResults(updatedResults);
        } else {
          // Fallback: update results directly without undo/redo
          const updatedResults = matchResults.map((m) => {
            const isInBatch = match.matches.some(
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
          updateMatchResults(updatedResults);
        }

        const endTime = performance.now();
        console.debug(
          `[MatchHandlers] Batch ${actionName} completed in ${(endTime - startTime).toFixed(2)}ms`,
        );
        return;
      }

      // Regular single match processing
      console.debug(
        `[MatchHandlers] handle${actionName} called with match:`,
        match,
      );

      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      const singleMatch = match as MangaMatchResult;
      console.debug(
        `[MatchHandlers] ${actionName === "Accept" ? "Accepting" : "Skipping"} match for ${singleMatch.kenmeiManga.title}, current status: ${singleMatch.status}`,
      );

      // Create a copy of the results and update the status
      const updatedResults = [...matchResults];

      // Create a new object reference to ensure React detects the change
      const updatedMatch = {
        ...singleMatch,
        status: newStatus,
        selectedMatch: getSelectedMatch(singleMatch),
        matchDate: new Date().toISOString(),
      };

      // Update the array with the new object
      updatedResults[index] = updatedMatch;

      console.debug(
        `[MatchHandlers] Updated match status to: ${updatedMatch.status}, title: ${updatedMatch.kenmeiManga.title}`,
      );

      recordEvent({
        type: `match.${newStatus === "matched" ? "accept" : "skip"}`,
        message: `${actionName} match: ${singleMatch.kenmeiManga.title}`,
        level: "info",
        metadata: {
          kenmeiTitle: singleMatch.kenmeiManga.title,
          anilistId: updatedMatch.selectedMatch?.id,
          anilistTitle: updatedMatch.selectedMatch?.title?.romaji,
          status: newStatus,
        },
      });

      // Handle undo/redo if manager is available
      if (undoRedoManager && commandType) {
        const command = new commandType(
          index,
          structuredClone(singleMatch),
          updatedMatch,
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
      recordEvent,
      updateMatchResults,
      undoRedoManager,
      applyCommandPatch,
    ],
  );

  /**
   * Handles accepting a match or batch of matches, updating their status to "matched".
   * Creates an AcceptMatchCommand for undo/redo tracking if manager is available.
   *
   * @param match - The match result or batch operation object to accept.
   * @source
   */
  const handleAcceptMatch = useCallback(
    (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
    ) => {
      handleMatchStatusUpdate(
        match,
        "matched",
        "Accept",
        (singleMatch) => singleMatch.anilistMatches?.[0]?.manga,
        AcceptMatchCommand,
      );
    },
    [handleMatchStatusUpdate],
  );

  /**
   * Handles rejecting/skipping a match or batch of matches, updating their status to "skipped".
   * Creates a RejectMatchCommand for undo/redo tracking if manager is available.
   *
   * @param match - The match result or batch operation object to reject.
   * @source
   */
  const handleRejectMatch = useCallback(
    (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
    ) => {
      handleMatchStatusUpdate(
        match,
        "skipped",
        "Reject",
        () => undefined,
        RejectMatchCommand,
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
   * Handles resetting a match or batch of matches back to the "pending" status.
   * Creates a ResetToPendingCommand for undo/redo tracking if manager is available.
   *
   * @param match - The match result or batch operation object to reset.
   * @source
   */
  const handleResetToPending = useCallback(
    (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
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

        // For batch operations, create individual commands wrapped in a BatchCommand
        if (undoRedoManager) {
          const commands = match.matches.map((m) => {
            // Find the current state of this match in matchResults
            const currentIdx = matchResults.findIndex(
              (mr) => mr.kenmeiManga.id === m.kenmeiManga.id,
            );
            const currentMatch = currentIdx >= 0 ? matchResults[currentIdx] : m;

            // Create the reset state matching single operation logic
            const originalMainMatch = currentMatch.anilistMatches?.length
              ? currentMatch.anilistMatches[0].manga
              : undefined;

            const resetMatch = {
              ...currentMatch,
              status: "pending" as const,
              selectedMatch: originalMainMatch,
              matchDate: new Date().toISOString(),
            };

            return new ResetToPendingCommand(
              Math.max(currentIdx, 0),
              structuredClone(currentMatch),
              resetMatch,
              applyCommandPatch,
            );
          });
          const batchCommand = new BatchCommand(commands, "Batch reset");
          undoRedoManager.executeCommand(batchCommand);

          // Update matchResults to trigger state update for UI re-render
          const updatedResults = matchResults.map((m) => {
            const isInBatch = match.matches.some(
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
          updateMatchResults(updatedResults);
        } else {
          // Fallback: build full updated results by mapping over all matchResults with inclusion check
          // This ensures all changes are persisted, not just the subset being reset
          const updatedResults = matchResults.map((m) => {
            const isInBatch = match.matches.some(
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
          updateMatchResults(updatedResults);
        }

        const endTime = performance.now();
        console.debug(
          `[MatchHandlers] Batch reset completed in ${(endTime - startTime).toFixed(2)}ms`,
        );
        return;
      }

      // Regular single match processing (existing code)
      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      console.debug(
        `[MatchHandlers] Resetting match for ${(match as MangaMatchResult).kenmeiManga.title} from ${(match as MangaMatchResult).status} to pending`,
      );

      // Create a copy of the results and update the status
      const updatedResults = [...matchResults];

      // Get the current match from the latest state
      const currentMatch = matchResults[index];

      // When resetting to pending, we should restore the original main match
      // The original main match is typically the first item in the anilistMatches array
      const originalMainMatch = currentMatch.anilistMatches?.length
        ? currentMatch.anilistMatches[0].manga
        : undefined;

      console.debug(
        `[MatchHandlers] Restoring original main match: ${originalMainMatch?.title?.english || originalMainMatch?.title?.romaji || "None"}`,
      );

      // Create a new object reference to ensure React detects the change
      const updatedMatch = {
        ...(match as MangaMatchResult),
        status: "pending" as const,
        // Restore the original main match as the selectedMatch
        selectedMatch: originalMainMatch,
        matchDate: new Date().toISOString(),
      };

      // Update the array with the new object
      updatedResults[index] = updatedMatch;

      console.debug(
        `[MatchHandlers] Updated match status from ${(match as MangaMatchResult).status} to pending for: ${updatedMatch.kenmeiManga.title}`,
      );

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
   *
   * @param matches - Array of matches to process in batch
   * @returns Batch operation object with type safety
   * @throws Error if matches array is empty
   * @example
   * ```typescript
   * // Create a batch operation from selected matches
   * const selectedMatches = matchResults.filter(m => selectedIds.has(m.kenmeiManga.id));
   * const batchOp = createBatchOperation(selectedMatches);
   * handleAcceptMatch(batchOp);
   * ```
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
