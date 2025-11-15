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
 * Manages pending manga that need to be processed in the matching workflow.
 * Persists and restores pending manga state from electron-store for resume support.
 * @returns Object with pending manga state, loading state, and management functions.
 * @source
 */
export const usePendingManga = () => {
  const [pendingManga, setPendingManga] = useState<KenmeiManga[]>([]);
  const [pendingMangaLoading, setPendingMangaLoading] = useState(true);

  // Debug effect for pendingManga
  useEffect(() => {
    console.debug(
      `[PendingManga] pendingManga state updated: ${pendingManga.length} manga pending`,
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
                "[PendingManga] Failed to parse pending manga from async storage:",
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
      if (
        pendingManga.length > 0 &&
        !globalThis.matchingProcessState?.isRunning
      ) {
        console.debug(
          `[PendingManga] Component unmounting - ensuring ${pendingManga.length} pending manga are saved to storage`,
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
        console.debug(
          `[PendingManga] Saving ${mangaList.length} unprocessed manga for potential resume`,
        );
        storage.setItem(STORAGE_KEYS.PENDING_MANGA, JSON.stringify(mangaList));
        setPendingManga(mangaList);
        console.debug(
          `[PendingManga] Successfully saved ${mangaList.length} pending manga to storage`,
        );
      } else {
        // Clear pending manga when empty
        console.debug("[PendingManga] Clearing pending manga from storage");
        storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
        setPendingManga([]);
        console.debug(
          "[PendingManga] Successfully cleared pending manga from storage",
        );
      }
    } catch (error) {
      console.error(
        "[PendingManga] Failed to save pending manga to storage:",
        error,
      );
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
    console.debug(
      `[PendingManga] Calculating pending manga: all manga count = ${allManga.length}, processed results = ${processedResults.length}`,
    );

    // Build sets for both IDs and titles with proper null/undefined handling - convert IDs to strings for consistent comparison
    const processedIds = new Set(
      processedResults
        .map((r) => r.kenmeiManga.id?.toString())
        .filter((id) => id != null),
    );
    const processedTitles = new Set(
      processedResults
        .map((r) => r.kenmeiManga.title)
        .filter((title) => title != null)
        .map((title) => title.toLowerCase()),
    );

    console.debug(
      `[PendingManga] Found ${processedIds.size} processed IDs and ${processedTitles.size} processed titles`,
    );

    // Filter manga that are NOT in either set (comprehensive matching)
    let debugCount = 0; // Counter for debug logging
    const pending = allManga.filter((m) => {
      // Check if this manga is already processed by ID - convert to string for consistent comparison
      const idMatch = m.id != null && processedIds.has(m.id.toString());

      // Check if this manga is already processed by title
      const titleMatch =
        m.title != null && processedTitles.has(m.title.toLowerCase());

      // Only include if it's NOT matched by either ID or title
      const shouldInclude = !idMatch && !titleMatch;

      // Debug logging for the first few manga
      if (debugCount < 3 && shouldInclude) {
        console.debug(
          `[PendingManga] Manga "${m.title}" (ID: ${m.id}): idMatch=${idMatch}, titleMatch=${titleMatch}, shouldInclude=${shouldInclude}`,
        );
        debugCount++;
      }

      return shouldInclude;
    });

    console.debug(
      `[PendingManga] Comprehensive ID/title approach found ${pending.length} pending manga`,
    );
    if (pending.length > 0) {
      console.debug(
        "[PendingManga] Sample pending manga:",
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
    console.debug("[PendingManga] Checking for pending manga in storage...");
    const pendingMangaJson = storage.getItem(STORAGE_KEYS.PENDING_MANGA);

    if (!pendingMangaJson) {
      console.debug("[PendingManga] No pending manga found in storage");
      setPendingManga([]);
      return null;
    }

    let pendingMangaData: unknown;
    try {
      pendingMangaData = JSON.parse(pendingMangaJson);
    } catch (e) {
      console.error(
        "[PendingManga] Failed to parse pending manga from storage:",
        e,
      );
      storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
      setPendingManga([]);
      return null;
    }

    if (!Array.isArray(pendingMangaData) || pendingMangaData.length === 0) {
      console.debug(
        "[PendingManga] Pending manga list was empty or not an array - clearing storage",
      );
      storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
      setPendingManga([]);
      return null;
    }

    const isValidManga = (m: unknown): m is KenmeiManga =>
      !!m &&
      typeof m === "object" &&
      "id" in m &&
      "title" in (m as Record<string, unknown>);

    const validManga = pendingMangaData.filter(isValidManga);

    if (validManga.length === 0) {
      console.debug(
        "[PendingManga] No valid manga objects found in pending manga data - clearing storage",
      );
      storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
      setPendingManga([]);
      return null;
    }

    console.info(
      `[PendingManga] Found ${validManga.length} valid pending manga from interrupted operation` +
        (validManga.length === pendingMangaData.length
          ? ""
          : ` (filtered out ${pendingMangaData.length - validManga.length} invalid entries)`),
    );

    setPendingManga(validManga);
    console.debug(
      "[PendingManga] Setting pendingManga state with found valid pending manga",
    );

    if (validManga.length !== pendingMangaData.length) {
      savePendingManga(validManga);
    }

    return validManga;
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
