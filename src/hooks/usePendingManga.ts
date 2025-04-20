import { useState, useEffect } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { MangaMatchResult } from "../api/anilist/types";
import { STORAGE_KEYS, storage } from "../utils/storage";

/**
 * Custom hook to manage pending manga that need to be processed
 */
export const usePendingManga = () => {
  const [pendingManga, setPendingManga] = useState<KenmeiManga[]>([]);

  // Debug effect for pendingManga
  useEffect(() => {
    console.log(
      `pendingManga state updated: ${pendingManga.length} manga pending`,
    );
  }, [pendingManga]);

  // Persist pendingManga on unmount if process wasn't completed
  useEffect(() => {
    return () => {
      // Only save if we have pending manga and we're not in an active process
      if (pendingManga.length > 0 && !window.matchingProcessState?.isRunning) {
        console.log(
          `Component unmounting - ensuring ${pendingManga.length} pending manga are saved to storage`,
        );
        // Save the current pending manga to ensure it persists
        storage.setItem(
          STORAGE_KEYS.PENDING_MANGA,
          JSON.stringify(pendingManga),
        );
      }
    };
  }, [pendingManga]);

  /**
   * Save pending manga to storage
   */
  const savePendingManga = (mangaList: KenmeiManga[]) => {
    try {
      if (mangaList.length > 0) {
        console.log(
          `Saving ${mangaList.length} unprocessed manga for potential resume`,
        );
        storage.setItem(STORAGE_KEYS.PENDING_MANGA, JSON.stringify(mangaList));
        setPendingManga(mangaList);
        console.log(
          `Successfully saved ${mangaList.length} pending manga to storage`,
        );
      } else {
        // Clear pending manga when empty
        console.log("Clearing pending manga from storage");
        storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
        setPendingManga([]);
        console.log("Successfully cleared pending manga from storage");
      }
    } catch (error) {
      console.error("Failed to save pending manga to storage:", error);
    }
  };

  /**
   * Calculate pending manga that still need to be processed
   */
  const calculatePendingManga = (
    processedResults: MangaMatchResult[],
    allManga: KenmeiManga[],
  ) => {
    console.log(
      `Calculating pending manga: all manga count = ${allManga.length}, processed results = ${processedResults.length}`,
    );

    // Since we've discovered IDs are undefined, prioritize title-based matching
    console.log(
      "Using title-based approach as primary method to find pending manga",
    );

    // Create a set of processed manga titles (lowercase)
    const processedTitles = new Set(
      processedResults.map((r) => r.kenmeiManga.title.toLowerCase()),
    );

    // Find manga that don't have matching titles
    const titleBasedPending = allManga.filter(
      (m) => !processedTitles.has(m.title.toLowerCase()),
    );

    console.log(
      `Title-based approach found ${titleBasedPending.length} pending manga`,
    );

    // Diagnostic log - output some sample manga for verification
    if (titleBasedPending.length > 0) {
      console.log("Sample pending manga titles:");
      titleBasedPending.slice(0, 5).forEach((manga, index) => {
        console.log(`${index + 1}. "${manga.title}"`);
      });

      if (titleBasedPending.length > 5) {
        console.log(`... and ${titleBasedPending.length - 5} more`);
      }
    }

    // Use title-based results if we found any
    if (titleBasedPending.length > 0) {
      console.log(
        `Using ${titleBasedPending.length} unmatched manga from title-based matching`,
      );
      return titleBasedPending;
    }

    // Only use ID-based matching as a backup since IDs might be undefined
    // Create a set of all processed manga IDs for faster lookup
    const processedIds = new Set(processedResults.map((r) => r.kenmeiManga.id));
    console.log(`Created set with ${processedIds.size} processed manga IDs`);

    // Log some sample IDs to help with debugging
    const sampleProcessedIds = [...processedIds].slice(0, 3);
    console.log("Sample processed IDs:", sampleProcessedIds);

    const sampleAllMangaIds = allManga.slice(0, 3).map((m) => m.id);
    console.log("Sample all manga IDs:", sampleAllMangaIds);

    // Check for ID type mismatches that might cause comparison issues
    const processedIdTypes = new Set([...processedIds].map((id) => typeof id));
    const allMangaIdTypes = new Set(allManga.map((m) => typeof m.id));

    console.log("Processed ID types:", [...processedIdTypes]);
    console.log("All manga ID types:", [...allMangaIdTypes]);

    // Find manga that haven't been processed yet
    const idBasedPending = allManga.filter((m) => !processedIds.has(m.id));

    console.log(
      `ID-based filter found ${idBasedPending.length} manga that need processing`,
    );

    if (idBasedPending.length > 0) {
      return idBasedPending;
    }

    // Final fallback - just use the numerical difference
    if (allManga.length > processedResults.length) {
      console.log("Using numerical difference fallback");
      const difference = allManga.slice(
        0,
        allManga.length - processedResults.length,
      );
      console.log(
        `Numerical difference provided ${difference.length} manga to process`,
      );
      return difference;
    }

    // No pending manga found
    console.log("No pending manga found through any matching method");
    return [];
  };

  /**
   * Load pending manga from storage
   */
  const loadPendingManga = (): KenmeiManga[] | null => {
    console.log("Checking for pending manga in storage...");
    const pendingMangaJson = storage.getItem(STORAGE_KEYS.PENDING_MANGA);

    if (pendingMangaJson) {
      try {
        const pendingMangaData = JSON.parse(pendingMangaJson) as KenmeiManga[];

        // Validate that we have a proper array with manga objects
        if (Array.isArray(pendingMangaData) && pendingMangaData.length > 0) {
          // Validate that each item has minimum required properties for a manga
          const validManga = pendingMangaData.filter(
            (manga) =>
              manga &&
              typeof manga === "object" &&
              "id" in manga &&
              "title" in manga,
          );

          if (validManga.length > 0) {
            console.log(
              `Found ${validManga.length} valid pending manga from interrupted operation` +
                (validManga.length !== pendingMangaData.length
                  ? ` (filtered out ${pendingMangaData.length - validManga.length} invalid entries)`
                  : ""),
            );

            // Only set valid manga
            setPendingManga(validManga);
            console.log(
              "Setting pendingManga state with found valid pending manga",
            );

            // Clear storage if we filtered out invalid entries
            if (validManga.length !== pendingMangaData.length) {
              savePendingManga(validManga);
            }

            return validManga;
          } else {
            console.log(
              "No valid manga objects found in pending manga data - clearing storage",
            );
            storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
          }
        } else {
          console.log(
            "Pending manga list was empty or not an array - clearing storage",
          );
          storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
        }
      } catch (e) {
        console.error("Failed to parse pending manga from storage:", e);
        // Clear invalid data
        storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
      }
    } else {
      console.log("No pending manga found in storage");
    }

    // Reset state if we didn't find valid data
    setPendingManga([]);
    return null;
  };

  return {
    pendingManga,
    setPendingManga,
    savePendingManga,
    calculatePendingManga,
    loadPendingManga,
  };
};
