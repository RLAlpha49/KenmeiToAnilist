/**
 * @packageDocumentation
 * @module usePendingManga
 * @description Custom React hook for managing pending manga that need to be processed in the Kenmei to AniList sync tool.
 */
import { useState, useEffect } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { MangaMatchResult } from "../api/anilist/types";
import { STORAGE_KEYS, storage } from "../utils/storage";

/**
 * Custom hook to manage pending manga that need to be processed.
 *
 * @returns An object containing the pending manga state, setter, and utility functions for managing pending manga.
 * @example
 * ```ts
 * const { pendingManga, savePendingManga, calculatePendingManga, loadPendingManga } = usePendingManga();
 * savePendingManga(mangaList);
 * ```
 * @source
 */
export const usePendingManga = () => {
  const [pendingManga, setPendingManga] = useState<KenmeiManga[]>([]);
  const [pendingMangaLoading, setPendingMangaLoading] = useState(true);

  // Debug effect for pendingManga
  useEffect(() => {
    console.log(
      `pendingManga state updated: ${pendingManga.length} manga pending`,
    );
  }, [pendingManga]);

  // On mount, always load pending manga from Electron storage if available
  useEffect(() => {
    let isMounted = true;
    setPendingMangaLoading(true);
    storage
      .getItemAsync(STORAGE_KEYS.PENDING_MANGA)
      .then((pendingMangaJson) => {
        if (isMounted) {
          if (pendingMangaJson) {
            try {
              const parsed = JSON.parse(pendingMangaJson) as KenmeiManga[];
              setPendingManga(parsed);
            } catch (e) {
              console.error(
                "Failed to parse pending manga from async storage:",
                e,
              );
              setPendingManga([]);
            }
          } else {
            setPendingManga([]);
          }
          setPendingMangaLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

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
   * Saves the provided list of pending manga to storage and updates state.
   *
   * @param mangaList - The list of Kenmei manga to save as pending.
   * @source
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
   * Calculates the list of pending manga that still need to be processed, using BOTH id and title-based matching.
   *
   * @param processedResults - The list of already processed manga match results.
   * @param allManga - The complete list of Kenmei manga.
   * @returns The list of Kenmei manga that are still pending processing.
   * @source
   */
  const calculatePendingManga = (
    processedResults: MangaMatchResult[],
    allManga: KenmeiManga[],
  ) => {
    console.log(
      `Calculating pending manga: all manga count = ${allManga.length}, processed results = ${processedResults.length}`,
    );

    // Build sets for both IDs and titles
    const processedIds = new Set(
      processedResults.map((r) => r.kenmeiManga.id).filter(Boolean),
    );
    const processedTitles = new Set(
      processedResults.map((r) => r.kenmeiManga.title.toLowerCase()),
    );

    console.log("Processed IDs:", Array.from(processedIds).slice(0, 5));
    console.log("Processed Titles:", Array.from(processedTitles).slice(0, 5));

    // Only manga that are not in either set are pending
    const pending = allManga.filter((m) => {
      const idMatch = m.id && processedIds.has(m.id);
      const titleMatch = processedTitles.has(m.title.toLowerCase());
      return !idMatch && !titleMatch;
    });

    console.log(
      `Combined ID/title approach found ${pending.length} pending manga`,
    );
    if (pending.length > 0) {
      console.log(
        "Sample pending manga:",
        pending.slice(0, 5).map((m) => ({ id: m.id, title: m.title })),
      );
    }
    return pending;
  };

  /**
   * Loads pending manga from storage, validates them, and updates state.
   *
   * @returns The list of valid pending Kenmei manga, or null if none found.
   * @source
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
    pendingMangaLoading,
  };
};
