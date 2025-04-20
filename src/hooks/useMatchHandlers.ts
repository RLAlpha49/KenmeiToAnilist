import { useCallback } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { AniListManga, MangaMatchResult } from "../api/anilist/types";
import { STORAGE_KEYS, storage } from "../utils/storage";

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
   * Find the index of a match in the results
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
   * Handle manual search request
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
   * Update match results and save to storage
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
   * Handle accepting a match
   * Now supports batch operations for accepting multiple matches at once
   */
  const handleAcceptMatch = useCallback(
    (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
    ) => {
      // Check if this is a batch operation
      if ("isBatchOperation" in match && match.isBatchOperation) {
        console.log(
          `Processing batch accept operation for ${match.matches.length} matches`,
        );

        // For batch operations, we simply replace the entire match results array
        // with the new one that already has the matched statuses applied
        updateMatchResults(match.matches);
        return;
      }

      // Regular single match processing (existing code)
      console.log("handleAcceptMatch called with match:", match);

      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      console.log(
        `Accepting match for ${(match as MangaMatchResult).kenmeiManga.title}, current status: ${(match as MangaMatchResult).status}`,
      );

      // Create a copy of the results and update the status
      const updatedResults = [...matchResults];

      // Create a new object reference to ensure React detects the change
      const updatedMatch = {
        ...(match as MangaMatchResult),
        status: "matched" as const,
        selectedMatch: (match as MangaMatchResult).anilistMatches?.[0]?.manga,
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
   * Handle rejecting/skipping a match
   * Now supports batch operations for skipping multiple matches at once
   */
  const handleRejectMatch = useCallback(
    (
      match:
        | MangaMatchResult
        | { isBatchOperation: boolean; matches: MangaMatchResult[] },
    ) => {
      // Check if this is a batch operation
      if ("isBatchOperation" in match && match.isBatchOperation) {
        console.log(
          `Processing batch reject operation for ${match.matches.length} matches`,
        );

        // For batch operations, we simply replace the entire match results array
        // with the new one that already has the skipped statuses applied
        updateMatchResults(match.matches);
        return;
      }

      // Regular single match processing (existing code)
      console.log("handleRejectMatch called with match:", match);

      // Find the match
      const index = findMatchIndex(match as MangaMatchResult);
      if (index === -1) return;

      console.log(
        `Skipping match for ${(match as MangaMatchResult).kenmeiManga.title}, current status: ${(match as MangaMatchResult).status}`,
      );

      // Create a copy of the results and update the status
      const updatedResults = [...matchResults];

      // Create a new object reference to ensure React detects the change
      const updatedMatch = {
        ...(match as MangaMatchResult),
        status: "skipped" as const,
        selectedMatch: undefined,
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
   * Handle selecting an alternative match - completely refactored
   */
  const handleSelectAlternative = useCallback(
    (
      match: MangaMatchResult,
      alternativeIndex: number,
      autoAccept = false,
      directAccept = false,
    ) => {
      console.log(
        `${directAccept ? "Directly accepting" : "Switching main match with"} alternative #${alternativeIndex} for "${match.kenmeiManga.title}"${autoAccept && !directAccept ? " and auto-accepting" : ""}`,
      );

      // Find the match index in the current state
      const index = findMatchIndex(match);
      if (index === -1) {
        console.error(`Match not found for ${match.kenmeiManga.title}`);
        return;
      }

      // Get the up-to-date match from the current state
      const currentMatch = matchResults[index];

      // Safety check - verify alternatives exist
      if (
        !currentMatch.anilistMatches ||
        currentMatch.anilistMatches.length <= alternativeIndex
      ) {
        console.error(`Alternative at index ${alternativeIndex} doesn't exist`);
        return;
      }

      // Get the selected alternative
      const selectedAlternative = currentMatch.anilistMatches[alternativeIndex];

      if (!selectedAlternative || !selectedAlternative.manga) {
        console.error("Selected alternative is invalid");
        return;
      }

      // Create a copy of all match results
      const updatedResults = [...matchResults];

      if (directAccept) {
        // Direct accept mode - just select the alternative as the match without swapping
        console.log(
          `Directly accepting alternative "${
            selectedAlternative.manga.title?.english ||
            selectedAlternative.manga.title?.romaji ||
            "Unknown"
          }" as the match with confidence ${selectedAlternative.confidence}%`,
        );

        // Update the match with the selected alternative, don't change alternatives array
        // Move the selected alternative to the front of the array to ensure its confidence is preserved
        const rearrangedMatches = [...currentMatch.anilistMatches];
        rearrangedMatches.splice(alternativeIndex, 1); // Remove from current position
        rearrangedMatches.unshift(selectedAlternative); // Add to beginning

        updatedResults[index] = {
          ...currentMatch,
          selectedMatch: { ...selectedAlternative.manga },
          anilistMatches: rearrangedMatches, // Use the rearranged array where selected alt is first
          status: "matched" as const,
          matchDate: new Date(),
        };
      } else {
        // Standard swap mode
        // Get the current main match (which could be the first alternative if selectedMatch is not set)
        const currentMainMatch =
          currentMatch.selectedMatch ||
          (currentMatch.anilistMatches.length > 0
            ? currentMatch.anilistMatches[0].manga
            : null);

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

        // Create a fresh copy of the alternatives array
        const newAnilistMatches = [...currentMatch.anilistMatches];

        // Calculate confidence for the current main match (for when we put it in alternatives)
        const mainMatchConfidence =
          currentMatch.anilistMatches[0]?.confidence || 75;

        // Create an entry for the current main match to add to alternatives
        const mainAsAlternative = {
          id: currentMainMatch.id,
          manga: { ...currentMainMatch },
          confidence: mainMatchConfidence,
        };

        // Remove the selected alternative from the list
        newAnilistMatches.splice(alternativeIndex, 1);

        // Insert the current main match as the first alternative
        newAnilistMatches.unshift(mainAsAlternative);

        // Insert the selected alternative's confidence as the first item's confidence
        // This ensures the confidence is displayed in the main match section
        if (selectedAlternative.confidence !== undefined) {
          newAnilistMatches[0] = {
            ...selectedAlternative,
            manga: { ...selectedAlternative.manga },
          };
        }

        // Update the match object with the new selected match and alternatives
        updatedResults[index] = {
          ...currentMatch,
          selectedMatch: { ...selectedAlternative.manga },
          anilistMatches: newAnilistMatches,
          // If autoAccept is true, immediately set the status to "matched"
          status: autoAccept ? "matched" : currentMatch.status,
          matchDate: new Date(),
        };
      }

      // Save the updates
      updateMatchResults(updatedResults);
    },
    [findMatchIndex, matchResults, updateMatchResults],
  );

  /**
   * Handle resetting a match status back to pending
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
   * Handle selecting a manga from the search panel
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
