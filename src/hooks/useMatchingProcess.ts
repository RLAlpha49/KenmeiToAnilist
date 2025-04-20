import { useState, useRef, useCallback } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { MangaMatchResult } from "../api/anilist/types";
import { batchMatchManga } from "../api/matching/manga-search-service";
import {
  STORAGE_KEYS,
  storage,
  mergeMatchResults,
  MatchResult,
} from "../utils/storage";
import { ApiError, MatchingProgress } from "../types/matching";
import { useTimeEstimate } from "./useTimeEstimate";
import { usePendingManga } from "./usePendingManga";

export const useMatchingProcess = (authState: {
  accessToken: string | null;
}) => {
  // State for matching process
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<MatchingProgress>({
    current: 0,
    total: 0,
    currentTitle: "",
  });
  const [statusMessage, setStatusMessage] = useState(
    "Preparing to match manga...",
  );
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<ApiError | null>(null);
  const [bypassCache, setBypassCache] = useState(false);
  const [freshSearch, setFreshSearch] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Cancel ref
  const cancelMatchingRef = useRef(false);

  // Flag to prevent multiple startMatching calls
  const matchingInitialized = useRef(false);

  // Add a state to track if component is initializing
  const [isInitializing, setIsInitializing] = useState(true);

  // Time estimate
  const { timeEstimate, calculateTimeEstimate, initializeTimeTracking } =
    useTimeEstimate();

  // Pending manga
  const {
    pendingManga,
    setPendingManga,
    savePendingManga,
    calculatePendingManga,
  } = usePendingManga();

  // Cache clearing state
  const [isCacheClearing, setIsCacheClearing] = useState(false);
  const [cacheClearingCount, setCacheClearingCount] = useState(0);

  /**
   * Start the batch matching process
   */
  const startMatching = useCallback(
    async (
      mangaList: KenmeiManga[],
      forceSearch: boolean = false,
      setMatchResults: React.Dispatch<
        React.SetStateAction<MangaMatchResult[]>
      > = () => {},
    ) => {
      if (!mangaList.length) return;

      // Check if matching is already in progress globally
      if (window.matchingProcessState?.isRunning) {
        console.log(
          "Matching process is already running, using existing process",
        );

        // Just update our local state to match the global state
        setIsLoading(true);
        setProgress({
          current: window.matchingProcessState.progress.current,
          total: window.matchingProcessState.progress.total,
          currentTitle: window.matchingProcessState.progress.currentTitle,
        });
        setStatusMessage(window.matchingProcessState.statusMessage);
        setDetailMessage(window.matchingProcessState.detailMessage);

        return;
      }

      // Reset cancellation flag
      cancelMatchingRef.current = false;
      setIsCancelling(false);

      // Check if we have an access token
      if (!authState.accessToken) {
        setError(
          "You need to be authenticated with AniList to match manga. Please go to Settings and connect your AniList account.",
        );
        return;
      }

      // Set bypass cache flag if we're forcing a fresh search
      if (forceSearch) {
        setBypassCache(true);
        console.log(
          "REMATCH: Bypassing cache for fresh search from AniList API",
        );
      } else {
        setBypassCache(false);
        console.log("Using cached data if available");
      }

      setIsLoading(true);
      setError(null);
      setDetailedError(null);
      setProgress({ current: 0, total: mangaList.length, currentTitle: "" });
      setDetailMessage(null);

      // Initialize time tracking
      const initialEstimate = initializeTimeTracking();

      // Store the list of manga to process for potential resume
      setPendingManga(mangaList);

      // Initialize global tracking state
      window.matchingProcessState = {
        isRunning: true,
        progress: {
          current: 0,
          total: mangaList.length,
          currentTitle: "",
        },
        statusMessage: "Preparing to match manga...",
        detailMessage: null,
        timeEstimate: initialEstimate,
        lastUpdated: Date.now(),
      };

      // Create a new AbortController and store it globally
      const abortController = new AbortController();
      window.activeAbortController = abortController;

      try {
        // Import from the manga search service to check cache status
        const { cacheDebugger } = await import(
          "../api/matching/manga-search-service"
        );

        // Check current cache status
        const cacheStatus = cacheDebugger.getCacheStatus();
        console.log("Cache status before matching:", cacheStatus);

        if (
          cacheStatus.inMemoryCache > 0 ||
          cacheStatus.localStorage.mangaCache > 0
        ) {
          // We have some cached data, report it
          const totalCachedItems =
            cacheStatus.inMemoryCache +
            (cacheStatus.localStorage.mangaCache > cacheStatus.inMemoryCache
              ? cacheStatus.localStorage.mangaCache - cacheStatus.inMemoryCache
              : 0);

          console.log(
            `Found ${totalCachedItems} cached manga entries that may help with matching`,
          );
          setStatusMessage(
            `Found ${totalCachedItems} cached manga entries from previous searches...`,
          );
        } else {
          setStatusMessage(
            "No cached data found, will perform fresh searches for all manga",
          );
        }

        // Force cache sync to ensure we have the latest data
        cacheDebugger.forceSyncCaches();

        // Count how many manga have known AniList IDs for more efficient fetching
        const withKnownIds = mangaList.filter(
          (manga) => manga.anilistId && Number.isInteger(manga.anilistId),
        ).length;

        if (withKnownIds > 0) {
          console.log(
            `Found ${withKnownIds} manga with known AniList IDs - will use batch fetching for these`,
          );
          setStatusMessage(
            `Found ${withKnownIds} manga with known AniList IDs - using efficient batch fetching`,
          );
        } else {
          setStatusMessage("Starting matching process...");
        }

        // Setup cancellation listener
        const handleCancellation = () => {
          if (cancelMatchingRef.current) {
            console.log(
              "Cancellation detected - immediately aborting all operations",
            );
            abortController.abort();
            throw new Error("Matching process was cancelled by user");
          }
        };

        // Process manga in batches
        const results = await batchMatchManga(
          mangaList,
          authState.accessToken || "",
          {
            batchSize: 5,
            searchPerPage: 50,
            maxSearchResults: 20,
            matchConfig: {
              confidenceThreshold: 75,
              preferEnglishTitles: true,
              useAlternativeTitles: true,
            },
            bypassCache: forceSearch, // Pass the forceSearch flag to bypass cache
          },
          (current, total, currentTitle) => {
            // Check for cancellation - immediately abort if cancelled
            handleCancellation();

            // Update progress
            setProgress({ current, total, currentTitle });

            // Update global tracking state
            if (window.matchingProcessState) {
              window.matchingProcessState.progress = {
                current,
                total,
                currentTitle: currentTitle || "",
              };
              window.matchingProcessState.lastUpdated = Date.now();
            }

            // Update status message to show we're doing fresh searches
            const completionPercent = Math.min(
              100,
              Math.round((current / total) * 100),
            );
            const statusMsg = `Fresh search for selected manga (${completionPercent}% complete)`;
            setStatusMessage(statusMsg);
            setDetailMessage(
              `Processing: ${Math.min(current, total)} of ${total}`,
            );

            // Update global tracking state with fresh search message
            if (window.matchingProcessState) {
              window.matchingProcessState.statusMessage = statusMsg;
              window.matchingProcessState.detailMessage = `Processing: ${Math.min(current, total)} of ${total}`;
            }

            calculateTimeEstimate(current, total);

            // Check if we're in the phase of batch fetching known IDs
            if (withKnownIds > 0 && current <= withKnownIds) {
              // We're likely processing the known IDs first
              console.log(
                `Processing manga with known IDs: ${current} of ${withKnownIds}`,
              );
              setStatusMessage(`Batch fetching manga with known IDs`);
              setDetailMessage(`${current} of ${withKnownIds}`);

              // Update global tracking state
              if (window.matchingProcessState) {
                window.matchingProcessState.statusMessage = `Batch fetching manga with known IDs`;
                window.matchingProcessState.detailMessage = `${current} of ${withKnownIds}`;
              }
            } else {
              const remainingItems = Math.max(0, total - current);
              const completionPercent = Math.min(
                100,
                Math.round((current / total) * 100),
              );
              setStatusMessage(
                `Matching manga (${completionPercent}% complete)`,
              );
              setDetailMessage(
                `Processing: ${Math.min(current, total)} of ${total} (${remainingItems} remaining)`,
              );

              // Update global tracking state
              if (window.matchingProcessState) {
                window.matchingProcessState.statusMessage = `Matching manga (${completionPercent}% complete)`;
                window.matchingProcessState.detailMessage = `Processing: ${Math.min(current, total)} of ${total} (${remainingItems} remaining)`;
              }
            }
          },
          () => {
            // Improved cancellation check
            const isCancelled = cancelMatchingRef.current;
            if (isCancelled) {
              console.log(
                "Cancel flag detected, processing will stop after current operation",
              );
              // Signal abort to stop any API requests
              abortController.abort();
            }
            return isCancelled;
          },
          abortController.signal, // Pass the abort signal to the batch process
        );

        // If we were cancelled, handle partial results
        if (cancelMatchingRef.current) {
          console.log("Operation was cancelled - handling partial results");
          if (results.length > 0) {
            // Merge with existing results to preserve user progress
            const mergedResults = mergeMatchResults(results as MatchResult[]);

            // Log details about the merging process
            console.log(
              `Original results count: ${results.length}, Merged results count: ${mergedResults.length}`,
            );

            if (mergedResults.length !== results.length) {
              console.log(
                "Results count changed during merge - this may indicate a merging issue",
              );
            }

            // Update state with the merged results
            setMatchResults(mergedResults as MangaMatchResult[]);

            // Save the merged results to storage
            try {
              storage.setItem(
                STORAGE_KEYS.MATCH_RESULTS,
                JSON.stringify(mergedResults),
              );
              console.log(
                `Saved merged match results after cancellation with ${mergedResults.filter((m) => m.status !== "pending").length} preserved matches`,
              );

              // Calculate and save the remaining manga that weren't processed yet
              // based on the merged results, not just the partial results
              const remainingManga = calculatePendingManga(
                mergedResults as MangaMatchResult[],
                mangaList,
              );

              if (remainingManga.length > 0) {
                console.log(
                  `Saving ${remainingManga.length} remaining manga for future resume`,
                );
                savePendingManga(remainingManga);
              }
            } catch (storageError) {
              console.error(
                "Failed to save merged match results to storage:",
                storageError,
              );
            }
          }
          setError(
            "Matching process was cancelled. You can resume from where you left off using the Resume button.",
          );
          return;
        }

        // Check cache status after matching
        const finalCacheStatus = cacheDebugger.getCacheStatus();
        console.log("Cache status after matching:", finalCacheStatus);
        console.log(
          `Cache growth: ${finalCacheStatus.inMemoryCache - cacheStatus.inMemoryCache} new entries`,
        );

        // Merge with existing results to preserve user progress
        const mergedResults = mergeMatchResults(results as MatchResult[]);

        // Log details about the merging process
        console.log(
          `Original results count: ${results.length}, Merged results count: ${mergedResults.length}`,
        );

        if (mergedResults.length !== results.length) {
          console.log(
            "Results count changed during merge - this may indicate a merging issue",
          );
        }

        // Update state with the merged results
        setMatchResults(mergedResults as MangaMatchResult[]);

        // Save the merged results to storage
        try {
          storage.setItem(
            STORAGE_KEYS.MATCH_RESULTS,
            JSON.stringify(mergedResults),
          );
          console.log(
            `Saved merged match results with ${mergedResults.filter((m) => m.status !== "pending").length} preserved user reviews`,
          );

          // Clean up the pending manga data since process completed successfully
          storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
          setPendingManga([]);
        } catch (storageError) {
          console.error(
            "Failed to save match results to storage:",
            storageError,
          );
        }
      } catch (err: unknown) {
        console.error("Matching error:", err);

        // Check if this was a cancellation
        if (cancelMatchingRef.current) {
          setError("Matching process was cancelled");
          return;
        }

        let errorMessage = "An error occurred during the matching process.";
        const apiError: ApiError = err as ApiError;

        // Extract more detailed error info
        if (apiError?.message) {
          errorMessage += ` Error: ${apiError.message}`;
        }

        // Handle network errors
        if (
          apiError?.name === "TypeError" &&
          apiError?.message?.includes("fetch")
        ) {
          errorMessage =
            "Failed to connect to AniList API. Please check your internet connection and try again.";
        }

        // Handle API errors
        if (apiError?.status) {
          if (apiError.status === 401 || apiError.status === 403) {
            errorMessage =
              "Authentication failed. Please reconnect your AniList account in Settings.";
          } else if (apiError.status === 429) {
            errorMessage =
              "Rate limit exceeded. Please wait a few minutes and try again.";
          } else if (apiError.status >= 500) {
            errorMessage = "AniList server error. Please try again later.";
          }
        }

        setError(errorMessage);
        setDetailedError(apiError);
      } finally {
        setIsLoading(false);
        setIsCancelling(false);
        cancelMatchingRef.current = false;

        // Clear fresh search flag
        setFreshSearch(false);

        // Clear global tracking state when process finishes
        if (window.matchingProcessState) {
          window.matchingProcessState.isRunning = false;
        }
      }
    },
    [
      authState.accessToken,
      calculateTimeEstimate,
      calculatePendingManga,
      initializeTimeTracking,
      savePendingManga,
      setPendingManga,
    ],
  );

  /**
   * Resume the matching process from where it left off
   */
  const handleResumeMatching = useCallback(
    (
      matchResults: MangaMatchResult[],
      setMatchResults: React.Dispatch<React.SetStateAction<MangaMatchResult[]>>,
    ) => {
      // Always clear error state first
      setError(null);

      // Get the full manga list from local storage to find all unprocessed manga
      try {
        // Fix: Use the correct storage key KENMEI_DATA instead of KENMEI_MANGA
        const kenmeiDataJson = storage.getItem(STORAGE_KEYS.KENMEI_DATA);

        if (kenmeiDataJson) {
          const kenmeiData = JSON.parse(kenmeiDataJson);
          const allManga = kenmeiData.manga || [];

          console.log(`Found ${allManga.length} total manga in storage`);

          if (allManga.length > 0) {
            // Find manga that haven't been processed yet based on titles
            const processedTitles = new Set(
              matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
            );

            const titleBasedUnmatched = allManga.filter(
              (manga: KenmeiManga) =>
                !processedTitles.has(manga.title.toLowerCase()),
            );

            if (titleBasedUnmatched.length > 0) {
              console.log(
                `Found ${titleBasedUnmatched.length} unmatched manga by title comparison`,
              );
              console.log("Starting matching process with all unmatched manga");

              // Set the pendingManga explicitly to the full list of unmatched manga
              // This ensures the correct count is shown in the UI
              setPendingManga(titleBasedUnmatched);

              startMatching(titleBasedUnmatched, false, setMatchResults);
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error processing all manga for resume:", error);
      }

      // If we couldn't find unmatched manga by comparing all manga, try using pendingManga state
      if (pendingManga.length > 0) {
        console.log(
          `Resuming matching process with ${pendingManga.length} remaining manga from pendingManga state`,
        );

        // Add a check to ensure we're not duplicating already processed manga
        const processedTitles = new Set(
          matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
        );

        // Filter out any manga that have already been processed
        const uniquePendingManga = pendingManga.filter(
          (manga) => !processedTitles.has(manga.title.toLowerCase()),
        );

        console.log(
          `Filtered out ${pendingManga.length - uniquePendingManga.length} already processed manga, remaining: ${uniquePendingManga.length}`,
        );

        if (uniquePendingManga.length > 0) {
          // If we still have manga to process after filtering, start the matching process
          startMatching(uniquePendingManga, false, setMatchResults);
          return;
        } else {
          console.log("All pending manga have already been processed");
          savePendingManga([]); // Clear the pending manga since they're already processed
        }
      }

      // Last resort: check for unmatched manga in the results
      const unmatchedFromResults = matchResults
        .filter((r) => r.status === "pending")
        .map((r) => r.kenmeiManga);

      if (unmatchedFromResults.length > 0) {
        console.log(
          `Resuming with ${unmatchedFromResults.length} unmatched manga from results as last resort`,
        );
        startMatching(unmatchedFromResults, false, setMatchResults);
      } else {
        // If we got here, there's nothing to resume
        console.log("No pending manga found to resume matching");
        savePendingManga([]); // Ensure pending manga is cleared
        setError("No pending manga found to resume matching.");
      }
    },
    [pendingManga, startMatching, savePendingManga, setPendingManga],
  );

  /**
   * Cancel resume mode and clear pending manga
   */
  const handleCancelResume = useCallback(() => {
    if (
      window.confirm(
        "Are you sure you want to cancel the resume process? This will clear any pending manga and you'll have to start over.",
      )
    ) {
      savePendingManga([]);
      setError(null);
      console.log("Resume cancelled, pending manga cleared");
    }
  }, [savePendingManga]);

  /**
   * Cancels the matching process
   */
  const handleCancelProcess = useCallback(() => {
    if (!isCancelling) {
      setIsCancelling(true);
      cancelMatchingRef.current = true;
      setStatusMessage("Cancelling process...");
      setDetailMessage("Immediately stopping all operations");
      console.log("User requested cancellation - stopping all operations");

      // Update global tracking state
      if (window.matchingProcessState) {
        window.matchingProcessState.statusMessage = "Cancelling process...";
        window.matchingProcessState.detailMessage =
          "Immediately stopping all operations";
      }

      // If we have an active abort controller, use it to abort immediately
      if (window.activeAbortController) {
        console.log("Aborting all in-progress requests");
        window.activeAbortController.abort();
      }
    }
  }, [isCancelling]);

  /**
   * Clear initialization state
   */
  const completeInitialization = useCallback(() => {
    setIsInitializing(false);
    matchingInitialized.current = true;
  }, []);

  return {
    isLoading,
    progress,
    statusMessage,
    detailMessage,
    error,
    detailedError,
    timeEstimate,
    bypassCache,
    freshSearch,
    isCancelling,
    isInitializing,
    isCacheClearing,
    cacheClearingCount,
    cancelMatchingRef,
    matchingInitialized,
    setError,
    setDetailedError,
    setIsLoading,
    setProgress,
    setStatusMessage,
    setDetailMessage,
    setBypassCache,
    setFreshSearch,
    setIsCancelling,
    setIsInitializing,
    setIsCacheClearing,
    setCacheClearingCount,
    startMatching,
    handleResumeMatching,
    handleCancelResume,
    handleCancelProcess,
    completeInitialization,
  };
};
