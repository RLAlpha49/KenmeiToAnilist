/**
 * @packageDocumentation
 * @module useMatchHandlers
 * @description Custom React hook providing handler functions for managing manga match results and user interactions in the Kenmei to AniList sync tool.
 */

import { useCallback } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { AniListManga, MangaMatchResult } from "../api/anilist/types";
import { STORAGE_KEYS, storage } from "../utils/storage";

/**
 * Custom React hook providing handler functions for managing manga match results and user interactions.
 *
 * @param matchResults - The current array of manga match results.
 * @param setMatchResults - State setter for updating manga match results.
 * @param setSearchTarget - State setter for the current Kenmei manga being searched.
 * @param setIsSearchOpen - State setter for toggling the search panel.
 * @param setBypassCache - State setter for bypassing cache during manual search.
 * @returns An object containing handler functions for match management.
 * @source
 */
export const useMatchHandlers = (
  matchResults: MangaMatchResult[],
  setMatchResults: React.Dispatch<React.SetStateAction<MangaMatchResult[]>>,
  setSearchTarget: React.Dispatch<
    React.SetStateAction<KenmeiManga | undefined>
  >,
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setBypassCache: React.Dispatch<React.SetStateAction<boolean>>,
) => {
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
        console.log(
          `Could not find match with ID ${kenmeiManga.id}, trying fallback methods...`,
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
              `Could not find match for "${kenmeiManga.title}" to update`,
            );
            return -1;
          } else {
            console.log(
              `Found match by case-insensitive title at index ${index}`,
            );
          }
        } else {
          console.log(`Found match by exact title at index ${index}`);
        }
      } else {
        console.log(`Found match by ID at index ${index}`);
      }

      return index;
    },
    [matchResults],
  );

  /**
   * Handles a manual search request for a manga, opening the search panel and bypassing cache.
   *
   * @param manga - The Kenmei manga to search for.
   * @source
   */
  const handleManualSearch = useCallback(
    (manga: KenmeiManga) => {
      console.log("handleManualSearch called with manga:", manga);

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
        console.log("Successfully saved updated match results to storage");
      } catch (storageError) {
        console.error("Failed to save match results to storage:", storageError);
      }
    },
    [setMatchResults],
  );

  /**
   * Handles updating a match or batch of matches with a new status.
   *
   * @param match - The match result or batch operation object to update.
   * @param newStatus - The new status to set.
   * @param actionName - The name of the action for logging purposes.
   * @param getSelectedMatch - Function to determine the selected match based on the operation.
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
    ) => {
      // Check if this is a batch operation
      if ("isBatchOperation" in match && match.isBatchOperation) {
        console.log(
          `Processing batch ${actionName} operation for ${match.matches.length} matches`,
        );

        // For batch operations, we simply replace the entire match results array
        // with the new one that already has the statuses applied
        updateMatchResults(match.matches);
        return;
      }

      // Regular single match processing
      console.log(`handle${actionName} called with match:`, match);

      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      const singleMatch = match as MangaMatchResult;
      console.log(
        `${actionName === "Accept" ? "Accepting" : "Skipping"} match for ${singleMatch.kenmeiManga.title}, current status: ${singleMatch.status}`,
      );

      // Create a copy of the results and update the status
      const updatedResults = [...matchResults];

      // Create a new object reference to ensure React detects the change
      const updatedMatch = {
        ...singleMatch,
        status: newStatus,
        selectedMatch: getSelectedMatch(singleMatch),
        matchDate: new Date(),
      };

      // Update the array with the new object
      updatedResults[index] = updatedMatch;

      console.log(
        `Updated match status to: ${updatedMatch.status}, title: ${updatedMatch.kenmeiManga.title}`,
      );

      updateMatchResults(updatedResults);
    },
    [findMatchIndex, matchResults, updateMatchResults],
  );

  /**
   * Handles accepting a match or batch of matches, updating their status to "matched".
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
      );
    },
    [handleMatchStatusUpdate],
  );

  /**
   * Handles rejecting/skipping a match or batch of matches, updating their status to "skipped".
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
      handleMatchStatusUpdate(match, "skipped", "Reject", () => undefined);
    },
    [handleMatchStatusUpdate],
  );

  /**
   * Handles selecting an alternative match for a manga, optionally auto-accepting or directly accepting it.
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
      console.log(
        `${directAccept ? "Directly accepting" : "Switching main match with"} alternative #${alternativeIndex} for "${match.kenmeiManga.title}"${
          autoAccept && !directAccept ? " and auto-accepting" : ""
        }`,
      );

      // Find the match index in the current state
      const index = findMatchIndex(match);
      if (index === -1) {
        console.error(`Match not found for ${match.kenmeiManga.title}`);
        return;
      }

      // Get up-to-date match and validate alternatives
      const currentMatch = matchResults[index];
      const alternatives = currentMatch.anilistMatches ?? [];
      if (alternativeIndex < 0 || alternativeIndex >= alternatives.length) {
        console.error(`Alternative at index ${alternativeIndex} doesn't exist`);
        return;
      }

      const selectedAlternative = alternatives[alternativeIndex];
      if (!selectedAlternative?.manga) {
        console.error("Selected alternative is invalid");
        return;
      }

      const updatedResults = [...matchResults];

      const directAcceptHandler = () => {
        console.log(
          `Directly accepting alternative "${
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
          matchDate: new Date(),
        };
      };

      const swapHandler = () => {
        const currentMainMatch =
          currentMatch.selectedMatch ||
          (alternatives.length > 0 ? alternatives[0].manga : null);

        if (!currentMainMatch) {
          console.error("No main match to swap with");
          return;
        }

        console.log(
          `Swapping main match "${
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
          matchDate: new Date(),
        };
      };

      if (directAccept) {
        directAcceptHandler();
      } else {
        swapHandler();
      }

      updateMatchResults(updatedResults);
    },
    [findMatchIndex, matchResults, updateMatchResults],
  );

  /**
   * Handles resetting a match or batch of matches back to the "pending" status.
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
      console.log("handleResetToPending called with match:", match);

      // Check if this is a batch operation
      if ("isBatchOperation" in match && match.isBatchOperation) {
        console.log(
          `Processing batch reset operation for ${match.matches.length} matches`,
        );

        // For batch operations, we simply replace the entire match results array
        // with the new one that already has the pending statuses applied
        updateMatchResults(match.matches);
        return;
      }

      // Regular single match processing (existing code)
      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      console.log(
        `Resetting match for ${(match as MangaMatchResult).kenmeiManga.title} from ${(match as MangaMatchResult).status} to pending`,
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

      console.log(
        `Restoring original main match: ${originalMainMatch?.title?.english || originalMainMatch?.title?.romaji || "None"}`,
      );

      // Create a new object reference to ensure React detects the change
      const updatedMatch = {
        ...(match as MangaMatchResult),
        status: "pending" as const,
        // Restore the original main match as the selectedMatch
        selectedMatch: originalMainMatch,
        matchDate: new Date(),
      };

      // Update the array with the new object
      updatedResults[index] = updatedMatch;

      console.log(
        `Updated match status from ${(match as MangaMatchResult).status} to pending for: ${updatedMatch.kenmeiManga.title}`,
      );

      updateMatchResults(updatedResults);
    },
    [findMatchIndex, matchResults, updateMatchResults],
  );

  /**
   * Handles selecting a manga from the search panel and updating the match result accordingly.
   *
   * @param manga - The AniList manga selected from the search panel.
   * @source
   */
  const handleSelectSearchMatch = useCallback(
    (manga: AniListManga) => {
      // Get the current search target - this was causing the linter error
      let searchTarget: KenmeiManga | undefined;
      setSearchTarget((current) => {
        searchTarget = current;
        return current;
      });

      if (!searchTarget) {
        console.error("No manga target was set for search");
        return;
      }

      console.log("Handling selection of manga from search:", manga.title);

      // Find the match
      const matchIndex = findMatchIndex(searchTarget);
      if (matchIndex === -1) return;

      // Get the existing match
      const existingMatch = matchResults[matchIndex];
      console.log(
        `Updating manga: "${existingMatch.kenmeiManga.title}" with selected match: "${manga.title.english || manga.title.romaji}"`,
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

      if (alternativeIndex >= 0 && existingMatch.anilistMatches) {
        // The selected manga is already in the alternatives, so just switch to it
        console.log(
          `Selected manga is alternative #${alternativeIndex}, switching instead of creating manual match`,
        );

        updatedResults[matchIndex] = {
          ...existingMatch,
          status: "matched", // Use "matched" status instead of "manual" since it's an existing alternative
          selectedMatch: existingMatch.anilistMatches[alternativeIndex].manga,
          matchDate: new Date(),
        };
      } else {
        // It's a new match not in the alternatives, create a manual match
        updatedResults[matchIndex] = {
          ...existingMatch, // Keep all existing properties
          status: "manual", // Change status to manual
          selectedMatch: manga, // Update with the new selected match
          matchDate: new Date(),
        };
      }

      // Set the results first before clearing the search state
      updateMatchResults(updatedResults);

      // Then close the search panel
      setIsSearchOpen(false);
      setSearchTarget(undefined);
    },
    [
      findMatchIndex,
      matchResults,
      updateMatchResults,
      setIsSearchOpen,
      setSearchTarget,
    ],
  );

  return {
    handleManualSearch,
    handleAcceptMatch,
    handleRejectMatch,
    handleSelectAlternative,
    handleResetToPending,
    handleSelectSearchMatch,
  };
};
