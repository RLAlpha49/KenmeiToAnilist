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
  cacheDebugger,
} from "../api/matching/search-service";
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
 * Manages the manga matching process with batch operations, progress tracking, and pause/resume support.
 * @param options.accessToken - AniList OAuth access token for API requests.
 * @param options.rateLimitState - Optional rate limit state from RateLimitContext.
 * @returns Object containing matching state, handlers, and utility functions.
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
  const progressRef = useRef<MatchingProgress>({
    current: 0,
    total: 0,
    currentTitle: "",
  });
  const lastProgressUpdateRef = useRef<number>(Date.now());
  const schedulePauseFinalizationRef = useRef<() => void>(() => {});
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
  const [isPauseTransitioning, setIsPauseTransitioning] = useState(false);
  const pauseFinalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const setProgressSafely = useCallback(
    (
      value:
        | MatchingProgress
        | ((previous: MatchingProgress) => MatchingProgress),
    ) => {
      setProgress((prev) => {
        const nextValue =
          typeof value === "function"
            ? (value as (previous: MatchingProgress) => MatchingProgress)(prev)
            : value;
        progressRef.current = nextValue;
        lastProgressUpdateRef.current = Date.now();
        return nextValue;
      });
    },
    [],
  );

  const notifyMatchingState = useCallback((isRunning: boolean) => {
    if (typeof globalThis.dispatchEvent !== "function") return;
    globalThis.dispatchEvent(
      new CustomEvent("matching:state", {
        detail: { isRunning },
      }),
    );
  }, []);

  const updateGlobalState = useCallback(
    (patch: Partial<NonNullable<typeof globalThis.matchingProcessState>>) => {
      if (!globalThis.matchingProcessState) return;
      Object.assign(globalThis.matchingProcessState, patch, {
        lastUpdated: Date.now(),
      });
    },
    [],
  );

  /**
   * Creates a progress callback handler for tracking batch matching progress.
   * Updates status messages, time estimates, and global state during matching operations.
   * @param withKnownIdsCount - Number of manga with pre-existing AniList IDs for batch fetching.
   * @returns A callback function accepting current index, total count, and optional current title.
   * @source
   */
  const createProgressHandler = useCallback(
    (withKnownIdsCount: number) => {
      return (current: number, total: number, currentTitle?: string) => {
        const manualPauseActive = isManualMatchingPaused();

        // Pause/resume time tracking depending on manual pause flag
        if (manualPauseActive) {
          pauseTimeTracking();
        } else {
          resumeTimeTracking();
        }

        setProgressSafely(() => ({
          current,
          total,
          currentTitle: currentTitle || "",
        }));
        updateGlobalState({
          progress: { current, total, currentTitle: currentTitle || "" },
        });

        if (manualPauseActive) {
          let shouldUpdateStatus = false;

          if (isManuallyPaused) {
            setIsManuallyPaused(false);
            shouldUpdateStatus = true;
          }

          if (!isPauseTransitioning) {
            setIsPauseTransitioning(true);
            shouldUpdateStatus = true;
          }

          if (shouldUpdateStatus) {
            setStatusMessage("Pausing matching...");
            setDetailMessage("Finishing the current manga before pausing.");
          }

          if (shouldUpdateStatus) {
            updateGlobalState({
              isManuallyPaused: false,
              isPauseTransitioning: true,
              statusMessage: "Pausing matching...",
              detailMessage: "Finishing the current manga before pausing.",
            });
          }

          if (schedulePauseFinalizationRef.current) {
            schedulePauseFinalizationRef.current();
          }
        }

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
    },
    [
      isManuallyPaused,
      isPauseTransitioning,
      pauseTimeTracking,
      resumeTimeTracking,
      calculateTimeEstimate,
      setProgressSafely,
      setIsManuallyPaused,
      setIsPauseTransitioning,
      setStatusMessage,
      setDetailMessage,
      updateGlobalState,
    ],
  );

  /**
   * Persists merged match results to state and storage, updates pending manga list.
   * @param results - Array of match results from the matching service.
   * @param originalList - Original list of Kenmei manga being matched.
   * @param setMatchResults - State setter for updating match results.
   * @source
   */
  const persistMergedResults = useCallback(
    async (
      results: MatchResult[],
      originalList: KenmeiManga[],
      setMatchResults: React.Dispatch<React.SetStateAction<MangaMatchResult[]>>,
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
        console.error("[MatchingProcess] Failed to persist match results:", e);
      }
    },
    [calculatePendingManga, savePendingManga, setPendingManga],
  );

  /**
   * Sets the initial status message based on cache status and pre-matched manga availability.
   * @param cacheStatus - Object containing in-memory and localStorage cache entry counts.
   * @param withKnownIds - Number of manga with pre-existing AniList IDs.
   * @source
   */
  const setInitialStatusMessage = useCallback(
    (
      cacheStatus: {
        inMemoryCache: number;
        localStorage: { mangaCache: number };
      },
      withKnownIds: number,
    ) => {
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
    },
    [],
  );

  /**
   * Handles and formats matching process errors, providing user-friendly error messages.
   * Distinguishes between network, authentication, rate limit, and server errors.
   * @param err - The error object caught during matching operations.
   * @source
   */
  const handleMatchingError = useCallback((err: unknown) => {
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
  }, []);

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

      if (pauseFinalizeTimeoutRef.current) {
        clearTimeout(pauseFinalizeTimeoutRef.current);
        pauseFinalizeTimeoutRef.current = null;
      }
      setManualMatchingPause(false);
      setIsManuallyPaused(false);
      setIsPauseTransitioning(false);
      resumeTimeTracking();
      lastProgressUpdateRef.current = Date.now();

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
      setProgressSafely(() => ({
        current: 0,
        total: mangaList.length,
        currentTitle: "",
      }));
      setDetailMessage(null);

      const initialEstimate = initializeTimeTracking();
      setPendingManga(mangaList);

      globalThis.matchingProcessState = {
        isRunning: true,
        progress: { current: 0, total: mangaList.length, currentTitle: "" },
        statusMessage: "Preparing to match manga...",
        detailMessage: null,
        timeEstimate: initialEstimate,
        isManuallyPaused: false,
        isPauseTransitioning: false,
        lastUpdated: Date.now(),
      };
      notifyMatchingState(true);

      const abortController = new AbortController();
      globalThis.activeAbortController = abortController;

      // Cancellation check used inside batch
      const checkCancellation = () => {
        if (cancelMatchingRef.current) {
          abortController.abort();
          throw new Error("Matching process was cancelled by user");
        }
      };

      try {
        const cacheStatus = cacheDebugger.getCacheStatus();
        cacheDebugger.forceSyncCaches();

        const withKnownIds = mangaList.filter(
          (m) => m.anilistId && Number.isInteger(m.anilistId),
        ).length;

        setInitialStatusMessage(cacheStatus, withKnownIds);

        const onProgress = createProgressHandler(withKnownIds);

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
            onProgress(current, total, currentTitle);
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
            await persistMergedResults(
              results as MatchResult[],
              mangaList,
              setMatchResults,
            );
          }
          setError(
            "Matching process was cancelled. You can resume from where you left off using the Resume button.",
          );
          return;
        }

        const finalCacheStatus = cacheDebugger.getCacheStatus();
        console.debug(
          "[MatchingProcess] Cache status after matching:",
          finalCacheStatus,
        );

        // Normal completion: merge, persist, and clear pending
        await persistMergedResults(
          results as MatchResult[],
          mangaList,
          setMatchResults,
        );
      } catch (err: unknown) {
        handleMatchingError(err);
      } finally {
        setIsLoading(false);
        setIsCancelling(false);
        cancelMatchingRef.current = false;
        setFreshSearch(false);
        if (globalThis.matchingProcessState) {
          globalThis.matchingProcessState.isRunning = false;
        }
        notifyMatchingState(false);
      }
    },
    [
      accessToken,
      initializeTimeTracking,
      setPendingManga,
      resumeTimeTracking,
      setProgressSafely,
      notifyMatchingState,
      updateGlobalState,
      createProgressHandler,
      persistMergedResults,
      setInitialStatusMessage,
      handleMatchingError,
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

          console.info(
            `[MatchingProcess] Found ${allManga.length} total manga in storage`,
          );

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
              console.info(
                `[MatchingProcess] Found ${comprehensiveUnmatched.length} unmatched manga using comprehensive ID and title comparison`,
              );
              console.debug(
                "[MatchingProcess] Sample unmatched manga:",
                comprehensiveUnmatched
                  .slice(0, 5)
                  .map((m: KenmeiManga) => ({ id: m.id, title: m.title })),
              );
              console.info(
                "[MatchingProcess] Starting matching process with all unmatched manga",
              );

              // Set the pendingManga explicitly to the full list of unmatched manga
              // This ensures the correct count is shown in the UI
              setPendingManga(comprehensiveUnmatched);

              startMatching(comprehensiveUnmatched, false, setMatchResults);
              return;
            }
          }
        }
      } catch (error) {
        console.error(
          "[MatchingProcess] Error processing all manga for resume:",
          error,
        );
      }

      // If we couldn't find unmatched manga by comparing all manga, try using pendingManga state
      if (pendingManga.length > 0) {
        console.info(
          `[MatchingProcess] Resuming matching process with ${pendingManga.length} remaining manga from pendingManga state`,
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

        console.info(
          `[MatchingProcess] Filtered out ${pendingManga.length - uniquePendingManga.length} already processed manga, remaining: ${uniquePendingManga.length}`,
        );

        if (uniquePendingManga.length > 0) {
          // If we still have manga to process after filtering, start the matching process
          startMatching(uniquePendingManga, false, setMatchResults);
          return;
        } else {
          console.info(
            "[MatchingProcess] All pending manga have already been processed",
          );
          savePendingManga([]); // Clear the pending manga since they're already processed
        }
      }

      // Last resort: check for unmatched manga in the results
      const unmatchedFromResults = matchResults
        .filter((r) => r.status === "pending")
        .map((r) => r.kenmeiManga);

      if (unmatchedFromResults.length > 0) {
        console.info(
          `[MatchingProcess] Resuming with ${unmatchedFromResults.length} unmatched manga from results as last resort`,
        );
        startMatching(unmatchedFromResults, false, setMatchResults);
      } else {
        // If we got here, there's nothing to resume
        console.info(
          "[MatchingProcess] No pending manga found to resume matching",
        );
        savePendingManga([]); // Ensure pending manga is cleared
        setError("No pending manga found to resume matching.");
      }
    },
    [pendingManga, startMatching, savePendingManga, setPendingManga],
  );

  /**
   * Cancels the resume mode and clears pending manga.
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
      console.info("[MatchingProcess] Resume cancelled, pending manga cleared");
    }
  }, [savePendingManga]);

  /**
   * Cancels the matching process, aborting all in-progress operations.
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
      console.info(
        "[MatchingProcess] User requested cancellation - stopping all operations",
      );

      // Update global tracking state
      if (globalThis.matchingProcessState) {
        globalThis.matchingProcessState.statusMessage = "Cancelling process...";
        globalThis.matchingProcessState.detailMessage =
          "Immediately stopping all operations";
      }

      // If we have an active abort controller, use it to abort immediately
      if (globalThis.activeAbortController) {
        console.info("[MatchingProcess] Aborting all in-progress requests");
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
   * Completes the initialization phase of the matching process.
   * Called after setup and before starting batch matching operations.
   * @source
   */
  const completeInitialization = useCallback(() => {
    setIsInitializing(false);
    matchingInitialized.current = true;
  }, []);

  const finalizePauseState = useCallback(() => {
    setIsPauseTransitioning(false);
    setIsManuallyPaused(true);
    setStatusMessage("Matching paused");
    setDetailMessage("Resume when you're ready to continue");
    updateGlobalState({
      statusMessage: "Matching paused",
      detailMessage: "Resume when you're ready to continue",
      isManuallyPaused: true,
      isPauseTransitioning: false,
    });
    pauseFinalizeTimeoutRef.current = null;
  }, [updateGlobalState]);

  const schedulePauseFinalization = useCallback(() => {
    if (pauseFinalizeTimeoutRef.current) {
      clearTimeout(pauseFinalizeTimeoutRef.current);
      pauseFinalizeTimeoutRef.current = null;
    }

    const quietPeriodMs = 750;

    const awaitQuietPeriod = () => {
      if (!isManualMatchingPaused()) {
        pauseFinalizeTimeoutRef.current = null;
        return;
      }

      const elapsed = Date.now() - lastProgressUpdateRef.current;
      if (elapsed >= quietPeriodMs) {
        finalizePauseState();
        return;
      }

      pauseFinalizeTimeoutRef.current = setTimeout(
        awaitQuietPeriod,
        quietPeriodMs - elapsed + 50,
      );
    };

    awaitQuietPeriod();
  }, [finalizePauseState]);

  useEffect(() => {
    schedulePauseFinalizationRef.current = schedulePauseFinalization;
  }, [schedulePauseFinalization]);

  const handlePauseMatching = useCallback(() => {
    if (isPauseTransitioning || isManuallyPaused) {
      return;
    }

    setIsPauseTransitioning(true);
    setStatusMessage("Pausing matching...");
    setDetailMessage("Finishing the current manga before pausing.");
    updateGlobalState({
      statusMessage: "Pausing matching...",
      detailMessage: "Finishing the current manga before pausing.",
      isPauseTransitioning: true,
      isManuallyPaused: false,
    });

    setManualMatchingPause(true);
    pauseTimeTracking();
    schedulePauseFinalization();
  }, [
    isPauseTransitioning,
    isManuallyPaused,
    pauseTimeTracking,
    schedulePauseFinalization,
    updateGlobalState,
  ]);

  const handleResumeMatchingRequests = useCallback(() => {
    if (rateLimitState?.isRateLimited) {
      const detail =
        "AniList rate limit is active. We'll resume automatically once it's cleared.";
      setStatusMessage("AniList rate limit reached");
      setDetailMessage(detail);
      return;
    }

    if (pauseFinalizeTimeoutRef.current) {
      clearTimeout(pauseFinalizeTimeoutRef.current);
      pauseFinalizeTimeoutRef.current = null;
    }

    setManualMatchingPause(false);
    resumeTimeTracking();
    setIsManuallyPaused(false);
    setIsPauseTransitioning(false);
    setStatusMessage("Resuming matching...");
    setDetailMessage("Reconnecting to the matching queue.");
    lastProgressUpdateRef.current = Date.now();
    updateGlobalState({
      statusMessage: "Resuming matching...",
      detailMessage: "Reconnecting to the matching queue.",
      isManuallyPaused: false,
      isPauseTransitioning: false,
    });
  }, [rateLimitState?.isRateLimited, resumeTimeTracking, updateGlobalState]);

  useEffect(() => {
    return () => {
      if (pauseFinalizeTimeoutRef.current) {
        clearTimeout(pauseFinalizeTimeoutRef.current);
        pauseFinalizeTimeoutRef.current = null;
      }
    };
  }, []);

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

  useEffect(() => {
    const state = globalThis.matchingProcessState;
    if (!state) {
      return;
    }

    if (state.progress) {
      const { current, total, currentTitle } = state.progress;
      progressRef.current = { current, total, currentTitle };
    }

    const shouldForcePause = Boolean(
      state.isManuallyPaused || state.isPauseTransitioning,
    );

    if (typeof state.isManuallyPaused === "boolean") {
      setIsManuallyPaused(state.isManuallyPaused);
    }

    if (typeof state.isPauseTransitioning === "boolean") {
      setIsPauseTransitioning(state.isPauseTransitioning);
      if (state.isPauseTransitioning) {
        schedulePauseFinalization();
      }
    }

    if (shouldForcePause) {
      setManualMatchingPause(true);
      pauseTimeTracking();
    }
  }, [pauseTimeTracking, schedulePauseFinalization]);

  useEffect(() => {
    if (isPauseTransitioning && !isManuallyPaused) {
      schedulePauseFinalization();
    }
  }, [isPauseTransitioning, isManuallyPaused, schedulePauseFinalization]);

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
    setProgress: setProgressSafely,
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
    isPauseTransitioning,
    setIsManuallyPaused,
    setIsPauseTransitioning,
    isTimeEstimatePaused,
    pauseTimeTracking,
    resumeTimeTracking,
    isRateLimitPaused,
    setTimeEstimate,
  };
};
