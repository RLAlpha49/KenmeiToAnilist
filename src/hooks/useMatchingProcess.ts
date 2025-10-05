/**
 * @packageDocumentation
 * @module useMatchingProcess
 * @description Custom React hook for managing the manga matching process, including batch matching, progress tracking, error handling, and resume/cancel operations in the Kenmei to AniList sync tool.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { KenmeiManga } from "../api/kenmei/types";
import { MangaMatchResult } from "../api/anilist/types";
import {
  batchMatchManga,
  setManualMatchingPause,
  isManualMatchingPaused,
} from "../api/matching/manga-search-service";
import { RateLimitState } from "../contexts/RateLimitContext";
import {
  STORAGE_KEYS,
  storage,
  mergeMatchResults,
  MatchResult,
} from "../utils/storage";
import { ApiError, MatchingProgress } from "../types/matching";
import { useTimeEstimate } from "./useTimeEstimate";
import { usePendingManga } from "./usePendingManga";

/**
 * Custom hook to manage the manga matching process, including batch matching, progress tracking, error handling, and resume/cancel operations.
 *
 * @param options - Options containing the AniList access token and optional rate limit state.
 * @returns An object containing state, progress, error, and handler functions for the matching process.
 * @example
 * ```ts
 * const {
 *   isLoading, progress, error, startMatching, handleResumeMatching, handleCancelProcess
 * } = useMatchingProcess({ accessToken });
 * startMatching(mangaList);
 * ```
 * @source
 */
export const useMatchingProcess = ({
  accessToken,
  rateLimitState,
}: {
  accessToken: string | null;
  rateLimitState?: RateLimitState;
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
  const [isRateLimitPaused, setIsRateLimitPaused] = useState(false);

  // Cancel ref
  const cancelMatchingRef = useRef(false);

  // Flag to prevent multiple startMatching calls
  const matchingInitialized = useRef(false);

  // Add a state to track if component is initializing
  const [isInitializing, setIsInitializing] = useState(true);

  // Time estimate
  const {
    timeEstimate,
    calculateTimeEstimate,
    initializeTimeTracking,
    pauseTimeTracking,
    resumeTimeTracking,
    isPaused: isTimeEstimatePaused,
    setTimeEstimate,
  } = useTimeEstimate();

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
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);

  /**
   * Starts the batch matching process for the provided manga list.
   *
   * @param mangaList - The list of Kenmei manga to match.
   * @param forceSearch - Whether to force a fresh search and bypass cache (default: false).
   * @param setMatchResults - State setter for updating manga match results (default: no-op).
   * @returns A promise that resolves when the matching process completes.
   * @throws If the matching process is cancelled or encounters an error.
   * @source
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

      // If another matching process is running, sync local UI with global state and return.
      if (globalThis.matchingProcessState?.isRunning) {
        setIsLoading(true);
        setProgress({
          current: globalThis.matchingProcessState.progress.current,
          total: globalThis.matchingProcessState.progress.total,
          currentTitle: globalThis.matchingProcessState.progress.currentTitle,
        });
        setStatusMessage(globalThis.matchingProcessState.statusMessage);
        setDetailMessage(globalThis.matchingProcessState.detailMessage);

        if (globalThis.matchingProcessState.timeEstimate) {
          setTimeEstimate(globalThis.matchingProcessState.timeEstimate);
        }
        return;
      }

      // Reset cancellation state
      cancelMatchingRef.current = false;
      setIsCancelling(false);

      // Auth check
      if (!accessToken) {
        setError(
          "You need to be authenticated with AniList to match manga. Please go to Settings and connect your AniList account.",
        );
        return;
      }

      setBypassCache(Boolean(forceSearch));
      setIsLoading(true);
      setError(null);
      setDetailedError(null);
      setProgress({ current: 0, total: mangaList.length, currentTitle: "" });
      setDetailMessage(null);

      const initialEstimate = initializeTimeTracking();
      setPendingManga(mangaList);

      globalThis.matchingProcessState = {
        isRunning: true,
        progress: { current: 0, total: mangaList.length, currentTitle: "" },
        statusMessage: "Preparing to match manga...",
        detailMessage: null,
        timeEstimate: initialEstimate,
        lastUpdated: Date.now(),
      };

      const abortController = new AbortController();
      globalThis.activeAbortController = abortController;

      // Update global state conveniently
      const updateGlobalState = (
        patch: Partial<typeof globalThis.matchingProcessState>,
      ) => {
        if (!globalThis.matchingProcessState) return;
        Object.assign(globalThis.matchingProcessState, patch, {
          lastUpdated: Date.now(),
        });
      };

      // Progress update logic extracted to simplify branching
      const onProgress = (
        current: number,
        total: number,
        currentTitle?: string,
        withKnownIdsCount = 0,
      ) => {
        // Pause/resume time tracking depending on manual pause flag
        if (isManualMatchingPaused()) {
          pauseTimeTracking();
        } else {
          resumeTimeTracking();
        }

        setProgress({ current, total, currentTitle: currentTitle || "" });
        updateGlobalState({
          progress: { current, total, currentTitle: currentTitle || "" },
        });

        const completionPercent = Math.min(
          100,
          Math.round((current / total) * 100),
        );
        const baseDetail = `Processing: ${Math.min(current, total)} of ${total}`;
        calculateTimeEstimate(current, total);

        if (withKnownIdsCount > 0 && current <= withKnownIdsCount) {
          const statusMsg = "Batch fetching manga with known IDs";
          setStatusMessage(statusMsg);
          setDetailMessage(`${current} of ${withKnownIdsCount}`);
          updateGlobalState({
            statusMessage: statusMsg,
            detailMessage: `${current} of ${withKnownIdsCount}`,
          });
          return;
        }

        const statusMsg = `Matching manga (${completionPercent}% complete)`;
        setStatusMessage(statusMsg);
        setDetailMessage(baseDetail);
        updateGlobalState({
          statusMessage: statusMsg,
          detailMessage: `${baseDetail} (${Math.max(0, total - current)} remaining)`,
        });
      };

      // Cancellation check used inside batch
      const checkCancellation = () => {
        if (cancelMatchingRef.current) {
          abortController.abort();
          throw new Error("Matching process was cancelled by user");
        }
      };

      // Save merged results after (partial) run
      const persistMergedResults = async (
        results: MatchResult[],
        originalList: KenmeiManga[],
      ) => {
        try {
          const merged = mergeMatchResults(results);
          setMatchResults(merged as MangaMatchResult[]);
          storage.setItem(STORAGE_KEYS.MATCH_RESULTS, JSON.stringify(merged));

          const remaining = calculatePendingManga(
            merged as MangaMatchResult[],
            originalList,
          );
          if (remaining.length > 0) {
            savePendingManga(remaining);
          } else {
            storage.removeItem(STORAGE_KEYS.PENDING_MANGA);
            setPendingManga([]);
          }
        } catch (e) {
          console.error("Failed to persist match results:", e);
        }
      };

      try {
        const { cacheDebugger } = await import(
          "../api/matching/manga-search-service"
        );

        const cacheStatus = cacheDebugger.getCacheStatus();
        cacheDebugger.forceSyncCaches();

        const withKnownIds = mangaList.filter(
          (m) => m.anilistId && Number.isInteger(m.anilistId),
        ).length;

        if (
          cacheStatus.inMemoryCache > 0 ||
          cacheStatus.localStorage.mangaCache > 0
        ) {
          const totalCachedItems =
            cacheStatus.inMemoryCache +
            (cacheStatus.localStorage.mangaCache > cacheStatus.inMemoryCache
              ? cacheStatus.localStorage.mangaCache - cacheStatus.inMemoryCache
              : 0);
          setStatusMessage(
            `Found ${totalCachedItems} cached manga entries from previous searches...`,
          );
        } else if (withKnownIds > 0) {
          setStatusMessage(
            `Found ${withKnownIds} manga with known AniList IDs - using efficient batch fetching`,
          );
        } else {
          setStatusMessage("Starting matching process...");
        }

        const results = await batchMatchManga(
          mangaList,
          accessToken || "",
          {
            batchSize: 5,
            searchPerPage: 50,
            maxSearchResults: 20,
            matchConfig: {
              confidenceThreshold: 75,
              preferEnglishTitles: true,
              useAlternativeTitles: true,
            },
            bypassCache: forceSearch,
          },
          (current, total, currentTitle) => {
            checkCancellation();
            onProgress(current, total, currentTitle, withKnownIds);
          },
          () => {
            if (cancelMatchingRef.current) {
              abortController.abort();
            }
            return cancelMatchingRef.current;
          },
          abortController.signal,
        );

        // If the run was cancelled, preserve partial results and inform user
        if (cancelMatchingRef.current) {
          if (results.length > 0) {
            await persistMergedResults(results as MatchResult[], mangaList);
          }
          setError(
            "Matching process was cancelled. You can resume from where you left off using the Resume button.",
          );
          return;
        }

        const finalCacheStatus = cacheDebugger.getCacheStatus();
        console.log("Cache status after matching:", finalCacheStatus);

        // Normal completion: merge, persist, and clear pending
        await persistMergedResults(results as MatchResult[], mangaList);
      } catch (err: unknown) {
        console.error("Matching error:", err);

        if (cancelMatchingRef.current) {
          setError("Matching process was cancelled");
          return;
        }

        let errorMessage = "An error occurred during the matching process.";
        const apiError = err as ApiError;

        if (apiError?.message) {
          errorMessage += ` Error: ${apiError.message}`;
        }

        if (
          apiError?.name === "TypeError" &&
          apiError?.message?.includes("fetch")
        ) {
          errorMessage =
            "Failed to connect to AniList API. Please check your internet connection and try again.";
        } else if (apiError?.status) {
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
        setFreshSearch(false);
        if (globalThis.matchingProcessState) {
          globalThis.matchingProcessState.isRunning = false;
        }
      }
    },
    [
      accessToken,
      calculateTimeEstimate,
      calculatePendingManga,
      initializeTimeTracking,
      savePendingManga,
      setPendingManga,
    ],
  );

  /**
   * Resumes the matching process from where it left off, using pending manga or unmatched results.
   *
   * @param matchResults - The current array of manga match results.
   * @param setMatchResults - State setter for updating manga match results.
   * @source
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
            // Find manga that haven't been processed yet using comprehensive ID and title matching
            const processedIds = new Set(
              matchResults
                .map((r) => r.kenmeiManga.id)
                .filter((id) => id != null),
            );
            const processedTitles = new Set(
              matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
            );

            const comprehensiveUnmatched = allManga.filter(
              (manga: KenmeiManga) => {
                const idMatch = manga.id != null && processedIds.has(manga.id);
                const titleMatch = processedTitles.has(
                  manga.title.toLowerCase(),
                );
                return !idMatch && !titleMatch;
              },
            );

            if (comprehensiveUnmatched.length > 0) {
              console.log(
                `Found ${comprehensiveUnmatched.length} unmatched manga using comprehensive ID and title comparison`,
              );
              console.log(
                "Sample unmatched manga:",
                comprehensiveUnmatched
                  .slice(0, 5)
                  .map((m: KenmeiManga) => ({ id: m.id, title: m.title })),
              );
              console.log("Starting matching process with all unmatched manga");

              // Set the pendingManga explicitly to the full list of unmatched manga
              // This ensures the correct count is shown in the UI
              setPendingManga(comprehensiveUnmatched);

              startMatching(comprehensiveUnmatched, false, setMatchResults);
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

        // Add a check to ensure we're not duplicating already processed manga using comprehensive matching
        const processedIds = new Set(
          matchResults.map((r) => r.kenmeiManga.id).filter((id) => id != null),
        );
        const processedTitles = new Set(
          matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
        );

        // Filter out any manga that have already been processed using comprehensive matching
        const uniquePendingManga = pendingManga.filter((manga) => {
          const idMatch = manga.id != null && processedIds.has(manga.id);
          const titleMatch = processedTitles.has(manga.title.toLowerCase());
          return !idMatch && !titleMatch;
        });

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
   * Cancels the resume mode and clears pending manga.
   *
   * @source
   */
  const handleCancelResume = useCallback(() => {
    if (
      globalThis.confirm(
        "Are you sure you want to cancel the resume process? This will clear any pending manga and you'll have to start over.",
      )
    ) {
      savePendingManga([]);
      setError(null);
      console.log("Resume cancelled, pending manga cleared");
    }
  }, [savePendingManga]);

  /**
   * Cancels the matching process, aborting all in-progress operations.
   *
   * @source
   */
  const handleCancelProcess = useCallback(() => {
    if (!isCancelling) {
      setManualMatchingPause(false);
      setIsManuallyPaused(false);
      setIsRateLimitPaused(false);
      resumeTimeTracking();
      setIsCancelling(true);
      cancelMatchingRef.current = true;
      setStatusMessage("Cancelling process...");
      setDetailMessage("Immediately stopping all operations");
      console.log("User requested cancellation - stopping all operations");

      // Update global tracking state
      if (globalThis.matchingProcessState) {
        globalThis.matchingProcessState.statusMessage = "Cancelling process...";
        globalThis.matchingProcessState.detailMessage =
          "Immediately stopping all operations";
      }

      // If we have an active abort controller, use it to abort immediately
      if (globalThis.activeAbortController) {
        console.log("Aborting all in-progress requests");
        globalThis.activeAbortController.abort();
      }
    }
  }, [
    isCancelling,
    resumeTimeTracking,
    setIsRateLimitPaused,
    setIsManuallyPaused,
  ]);

  /**
   * Marks the completion of the initialization phase for the matching process.
   *
   * @source
   */
  const completeInitialization = useCallback(() => {
    setIsInitializing(false);
    matchingInitialized.current = true;
  }, []);

  const handlePauseMatching = useCallback(() => {
    setManualMatchingPause(true);
    pauseTimeTracking();
    setIsManuallyPaused(true);
    setStatusMessage("Matching paused");
    setDetailMessage("Resume when you're ready to continue");
  }, [pauseTimeTracking]);

  const handleResumeMatchingRequests = useCallback(() => {
    if (rateLimitState?.isRateLimited) {
      const detail =
        "AniList rate limit is active. We'll resume automatically once it's cleared.";
      setStatusMessage("AniList rate limit reached");
      setDetailMessage(detail);
      return;
    }

    setManualMatchingPause(false);
    resumeTimeTracking();
    setIsManuallyPaused(false);
    setStatusMessage("Resuming matching...");
  }, [rateLimitState?.isRateLimited, resumeTimeTracking]);

  // Helper to build rate limit detail message
  const buildRateLimitDetail = useCallback(() => {
    if (!rateLimitState?.retryAfter) {
      return "Waiting for AniList to lift the rate limit...";
    }
    const remainingSeconds = Math.max(
      0,
      Math.ceil((rateLimitState.retryAfter - Date.now()) / 1000),
    );
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    return `Waiting for AniList to lift the rate limit (retry in ~${formatted}).`;
  }, [rateLimitState?.retryAfter]);

  // Handles entering rate limit state
  const handleEnterRateLimit = useCallback(
    (detail: string) => {
      setIsRateLimitPaused(true);
      setStatusMessage("AniList rate limit reached");
      setDetailMessage(detail);
      setManualMatchingPause(true);
      pauseTimeTracking();
      if (globalThis.matchingProcessState) {
        globalThis.matchingProcessState.statusMessage =
          "AniList rate limit reached";
        globalThis.matchingProcessState.detailMessage = detail;
        globalThis.matchingProcessState.lastUpdated = Date.now();
      }
    },
    [pauseTimeTracking],
  );

  // Handles updating rate limit detail
  const handleUpdateRateLimitDetail = useCallback((detail: string) => {
    setDetailMessage(detail);
    if (globalThis.matchingProcessState) {
      globalThis.matchingProcessState.detailMessage = detail;
      globalThis.matchingProcessState.lastUpdated = Date.now();
    }
  }, []);

  // Handles exiting rate limit state
  const handleExitRateLimit = useCallback(() => {
    setIsRateLimitPaused(false);
    resumeTimeTracking();
    if (!isManuallyPaused) {
      setManualMatchingPause(false);
    }
    const detail = isManuallyPaused
      ? "Matching remains paused. Resume when you're ready to continue."
      : "Back to matching remaining manga. We'll continue processing the queue.";
    const status = isManuallyPaused
      ? "Matching paused"
      : "Resuming matching...";
    setStatusMessage(status);
    setDetailMessage(detail);
    if (globalThis.matchingProcessState) {
      globalThis.matchingProcessState.statusMessage = status;
      globalThis.matchingProcessState.detailMessage = detail;
      globalThis.matchingProcessState.lastUpdated = Date.now();
    }
  }, [resumeTimeTracking, isManuallyPaused]);

  useEffect(() => {
    if (
      !rateLimitState ||
      isCancelling ||
      !(isLoading || globalThis.matchingProcessState?.isRunning)
    ) {
      return;
    }

    if (rateLimitState.isRateLimited) {
      const detail = buildRateLimitDetail();
      if (isRateLimitPaused) {
        handleUpdateRateLimitDetail(detail);
      } else {
        handleEnterRateLimit(detail);
      }
    } else if (isRateLimitPaused) {
      handleExitRateLimit();
    }
  }, [
    rateLimitState,
    isLoading,
    isRateLimitPaused,
    isManuallyPaused,
    isCancelling,
    pauseTimeTracking,
    resumeTimeTracking,
    buildRateLimitDetail,
    handleEnterRateLimit,
    handleUpdateRateLimitDetail,
    handleExitRateLimit,
  ]);

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
    handlePauseMatching,
    handleResumeMatchingRequests,
    completeInitialization,
    setManualMatchingPause,
    isManuallyPaused,
    setIsManuallyPaused,
    isTimeEstimatePaused,
    pauseTimeTracking,
    resumeTimeTracking,
    isRateLimitPaused,
    setTimeEstimate,
  };
};
