import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { KenmeiManga } from "../api/kenmei/types";
import { MangaMatchResult } from "../api/anilist/types";
import { MangaMatchingPanel } from "../components/matching/MangaMatchingPanel";
import { useAuth } from "../hooks/useAuth";
import { getKenmeiData } from "../utils/storage";
import { StatusFilterOptions } from "../types/matching";
import { useMatchingProcess } from "../hooks/useMatchingProcess";
import { usePendingManga } from "../hooks/usePendingManga";
import { useMatchHandlers } from "../hooks/useMatchHandlers";
import { getSavedMatchResults } from "../utils/storage";
import { clearCacheForTitles } from "../api/matching/manga-search-service";
import { useRateLimit } from "../contexts/RateLimitContext";

// Components
import { MatchingProgressPanel } from "../components/matching/MatchingProgress";
import { ErrorDisplay } from "../components/matching/ErrorDisplay";
import { ResumeNotification } from "../components/matching/ResumeNotification";
import { RematchOptions } from "../components/matching/RematchOptions";
import { CacheClearingNotification } from "../components/matching/CacheClearingNotification";
import { SearchModal } from "../components/matching/SearchModal";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

// Animation variants
const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      when: "beforeChildren",
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

const contentVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      delay: 0.15,
      when: "beforeChildren",
    },
  },
};

export function MatchingPage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const { rateLimitState } = useRateLimit();

  // State for manga data
  const [manga, setManga] = useState<KenmeiManga[]>([]);
  const [matchResults, setMatchResults] = useState<MangaMatchResult[]>([]);

  // State for manual search
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<KenmeiManga | undefined>(
    undefined,
  );

  // Add state for status filtering and rematching
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilterOptions>(
    {
      pending: true,
      skipped: true,
      matched: false,
      manual: false,
      unmatched: true,
    },
  );
  const [showRematchOptions, setShowRematchOptions] = useState(false);
  const [rematchWarning, setRematchWarning] = useState<string | null>(null);

  // Get matching process hooks
  const matchingProcess = useMatchingProcess({
    accessToken: authState.accessToken || null,
  });
  const pendingMangaState = usePendingManga();

  // Use match handlers
  const matchHandlers = useMatchHandlers(
    matchResults,
    setMatchResults,
    setSearchTarget,
    setIsSearchOpen,
    matchingProcess.setBypassCache,
  );

  // Add a ref to track if we've already done initialization
  const hasInitialized = useRef(false);

  // Add debug effect for matching results
  useEffect(() => {
    if (matchResults.length > 0) {
      console.log("matchResults updated - Current status counts:");
      const statusCounts = {
        matched: matchResults.filter((m) => m.status === "matched").length,
        pending: matchResults.filter((m) => m.status === "pending").length,
        manual: matchResults.filter((m) => m.status === "manual").length,
        skipped: matchResults.filter((m) => m.status === "skipped").length,
      };
      console.log("Status counts:", statusCounts);
    }
  }, [matchResults]);

  // Initial data loading
  useEffect(() => {
    // Strong initialization guard to prevent multiple runs
    if (hasInitialized.current) {
      console.log("Already initialized, skipping initialization");
      return;
    }

    // Mark as initialized immediately to prevent any possibility of re-runs
    hasInitialized.current = true;

    // Check if user is authenticated but don't redirect
    if (!authState.isAuthenticated || !authState.accessToken) {
      console.log("User not authenticated, showing auth error");
      matchingProcess.setError(
        "Authentication Required. You need to connect your AniList account to match manga.",
      );
      matchingProcess.setDetailMessage(
        "Please go to Settings to authenticate with AniList.",
      );
      return;
    }

    console.log("*** INITIALIZATION START ***");
    console.log("Initial states:", {
      isLoading: matchingProcess.isLoading,
      hasError: !!matchingProcess.error,
      matchResultsLength: matchResults.length,
      pendingMangaLength: pendingMangaState.pendingManga.length,
      isMatchingInitialized: matchingProcess.matchingInitialized.current,
    });

    // Check if there's an ongoing matching process
    if (window.matchingProcessState?.isRunning) {
      console.log("Detected running matching process, restoring state");

      // Restore the matching process state
      matchingProcess.setIsLoading(true);
      matchingProcess.setProgress({
        current: window.matchingProcessState.progress.current,
        total: window.matchingProcessState.progress.total,
        currentTitle: window.matchingProcessState.progress.currentTitle,
      });
      matchingProcess.setStatusMessage(
        window.matchingProcessState.statusMessage,
      );
      matchingProcess.setDetailMessage(
        window.matchingProcessState.detailMessage,
      );

      // Mark as initialized to prevent auto-starting
      matchingProcess.matchingInitialized.current = true;
      matchingProcess.setIsInitializing(false);
      return;
    }

    // Skip if this effect has already been run
    if (matchingProcess.matchingInitialized.current) {
      console.log(
        "Matching already initialized, skipping duplicate initialization",
      );
      matchingProcess.setIsInitializing(false);
      return;
    }

    console.log("Initializing MatchingPage component...");

    // Get imported data from storage to have it available for calculations
    const importedData = getKenmeiData();
    const importedManga = importedData?.manga || [];

    if (importedManga.length > 0) {
      console.log(`Found ${importedManga.length} imported manga from storage`);
      // Store the imported manga data for later use
      setManga(importedManga as KenmeiManga[]);
    } else {
      console.log("No imported manga found in storage");
    }

    // First check for pending manga from a previously interrupted operation
    const pendingMangaData = pendingMangaState.loadPendingManga();

    if (pendingMangaData && pendingMangaData.length > 0) {
      // Clear any error message since we're showing the resume notification instead
      matchingProcess.setError(null);
      // End initialization when we've found pending manga
      matchingProcess.setIsInitializing(false);
    }

    // Preload the cache service to ensure it's initialized
    import("../api/matching/manga-search-service").then((module) => {
      console.log("Preloaded manga search service");
      // Force cache sync
      if (module.cacheDebugger) {
        module.cacheDebugger.forceSyncCaches();
      }

      // Check if we have saved match results before starting a new matching process
      console.log("Checking for saved match results...");
      const savedResults = getSavedMatchResults();
      if (
        savedResults &&
        Array.isArray(savedResults) &&
        savedResults.length > 0
      ) {
        console.log(
          `Found ${savedResults.length} existing match results - loading from cache`,
        );

        // Check how many matches have already been reviewed
        const reviewedCount = savedResults.filter(
          (m) =>
            m.status === "matched" ||
            m.status === "manual" ||
            m.status === "skipped",
        ).length;

        console.log(
          `${reviewedCount} manga have already been reviewed (${Math.round((reviewedCount / savedResults.length) * 100)}% complete)`,
        );

        // If we don't have pending manga from storage but do have imported manga, calculate what might still need processing
        if (!pendingMangaData && importedManga.length > 0) {
          console.log(
            "No pending manga in storage but we have imported manga - calculating unmatched manga",
          );
          const calculatedPendingManga =
            pendingMangaState.calculatePendingManga(
              savedResults as MangaMatchResult[],
              importedManga as KenmeiManga[],
            );
          if (calculatedPendingManga.length > 0) {
            console.log(
              `Calculated ${calculatedPendingManga.length} manga that still need to be processed`,
            );
            pendingMangaState.savePendingManga(calculatedPendingManga);
            console.log(
              `Saved ${calculatedPendingManga.length} pending manga to storage for resume`,
            );
          } else {
            console.log("No pending manga found in calculation");

            // If there's a clear discrepancy between total manga and processed manga,
            // force a calculation of pending manga based on the numerical difference
            if (importedManga.length > savedResults.length) {
              console.log(
                `⚠️ Discrepancy detected! Total manga: ${importedManga.length}, Processed: ${savedResults.length}`,
              );
              console.log(
                "Forcing pending manga calculation based on numerical difference",
              );

              // Calculate how many manga are missing from the results
              const pendingCount = importedManga.length - savedResults.length;
              // Get manga that aren't in savedResults
              const pendingManga = importedManga.slice(0, pendingCount);

              if (pendingManga.length > 0) {
                console.log(
                  `Forced calculation found ${pendingManga.length} pending manga`,
                );
                pendingMangaState.savePendingManga(
                  pendingManga as KenmeiManga[],
                );
              }
            }
          }
        }

        // Mark as initialized
        matchingProcess.matchingInitialized.current = true;
        // Set the saved results directly
        setMatchResults(savedResults as MangaMatchResult[]);
        console.log("*** INITIALIZATION COMPLETE - Using saved results ***");
        return; // Skip further initialization
      } else {
        console.log("No saved match results found");
      }

      if (
        importedManga.length &&
        !matchingProcess.matchingInitialized.current
      ) {
        console.log("Starting initial matching process with imported manga");
        matchingProcess.matchingInitialized.current = true;

        // Start matching process automatically
        matchingProcess.startMatching(
          importedManga as KenmeiManga[],
          false,
          setMatchResults,
        );
      } else if (!importedManga.length) {
        console.log("No imported manga found, redirecting to import page");
        matchingProcess.setError(
          "No manga data found. Please import your data first.",
        );
      }

      // Make sure we mark initialization as complete
      matchingProcess.setIsInitializing(false);
      console.log("*** INITIALIZATION COMPLETE ***");
    });

    // Cleanup function to ensure initialization state is reset
    return () => {
      matchingProcess.setIsInitializing(false);
    };
  }, [navigate, matchingProcess, pendingMangaState]); // Remove matchResults from dependencies

  // Add an effect to sync with the global process state while the page is mounted
  useEffect(() => {
    // Skip if we're not in the middle of a process
    if (!window.matchingProcessState?.isRunning) return;

    // Create a function to sync the UI with the global state
    const syncUIWithGlobalState = () => {
      if (window.matchingProcessState?.isRunning) {
        const currentState = window.matchingProcessState;

        console.log("Syncing UI with global process state:", {
          current: currentState.progress.current,
          total: currentState.progress.total,
          statusMessage: currentState.statusMessage,
        });

        // Update our local state with the global state
        matchingProcess.setIsLoading(true);
        matchingProcess.setProgress({
          current: currentState.progress.current,
          total: currentState.progress.total,
          currentTitle: currentState.progress.currentTitle,
        });
        matchingProcess.setStatusMessage(currentState.statusMessage);
        matchingProcess.setDetailMessage(currentState.detailMessage);
      } else {
        // If the process is no longer running, update our loading state
        console.log("Global process complete, syncing final state");
        matchingProcess.setIsLoading(false);
      }
    };

    // Create a visibility change listener to ensure UI updates when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Page became visible, syncing state immediately");
        syncUIWithGlobalState();
      }
    };

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Create an interval to check for updates to the global state (less frequently since we also have visibility events)
    const syncInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncUIWithGlobalState();
      }
    }, 2000); // Check every 2 seconds when visible

    // Clean up the interval and event listener when the component unmounts
    return () => {
      clearInterval(syncInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []); // Only run once when component mounts

  // Add an effect to listen for re-search empty matches events
  useEffect(() => {
    // Handler for the reSearchEmptyMatches custom event
    const handleReSearchEmptyMatches = (
      event: CustomEvent<{ mangaToResearch: KenmeiManga[] }>,
    ) => {
      const { mangaToResearch } = event.detail;

      console.log(
        `Received request to re-search ${mangaToResearch.length} manga without matches`,
      );

      // Reset any previous warnings or cancel state
      setRematchWarning(null);
      matchingProcess.cancelMatchingRef.current = false;
      matchingProcess.setDetailMessage(null);

      if (mangaToResearch.length === 0) {
        console.log("No manga to re-search, ignoring request");
        return;
      }

      // Show cache clearing notification with count
      matchingProcess.setIsCacheClearing(true);
      matchingProcess.setCacheClearingCount(mangaToResearch.length);
      matchingProcess.setStatusMessage(
        "Preparing to clear cache for manga without matches...",
      );

      // Use a Promise to handle the async operations
      (async () => {
        try {
          // Small delay to ensure UI updates
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Get the cache service to clear specific entries
          await import("../api/matching/manga-search-service");

          // Clear cache entries for each manga being re-searched
          const mangaTitles = mangaToResearch.map((manga) => manga.title);
          console.log(
            `🔄 Clearing cache for ${mangaTitles.length} manga titles`,
          );
          matchingProcess.setStatusMessage(
            `Clearing cache for ${mangaTitles.length} manga titles...`,
          );

          // Use the clearCacheForTitles function to clear entries efficiently
          const clearResult = clearCacheForTitles(mangaTitles);

          // Log results
          console.log(
            `🧹 Cleared ${clearResult.clearedCount} cache entries for re-search`,
          );

          // Before starting fresh search, preserve existing results but reset re-searched manga to pending
          if (matchResults.length > 0) {
            // Create a set of titles being re-searched (for quick lookup)
            const reSearchTitles = new Set(
              mangaTitles.map((title) => title.toLowerCase()),
            );

            // Update the match results to set re-searched items back to pending
            const updatedResults = matchResults.map((match) => {
              // If this manga is being re-searched, reset its status to pending
              if (reSearchTitles.has(match.kenmeiManga.title.toLowerCase())) {
                return {
                  ...match,
                  status: "pending" as const,
                  selectedMatch: undefined, // Clear any previously selected match
                  matchDate: new Date(),
                };
              }
              // Otherwise, keep it as is
              return match;
            });

            // Update the results state
            setMatchResults(updatedResults);
            console.log(
              `Reset status to pending for ${reSearchTitles.size} manga before re-searching`,
            );
          }

          // Hide cache clearing notification
          matchingProcess.setIsCacheClearing(false);
          matchingProcess.setStatusMessage(
            `Cleared cache entries - starting fresh searches...`,
          );

          // Start fresh search for the manga
          matchingProcess.startMatching(mangaToResearch, true, setMatchResults);
        } catch (error) {
          console.error("Failed to clear manga cache entries:", error);
          matchingProcess.setIsCacheClearing(false);

          // Continue with re-search even if cache clearing fails
          matchingProcess.startMatching(mangaToResearch, true, setMatchResults);
        }
      })();
    };

    // Add event listener for the custom event
    window.addEventListener(
      "reSearchEmptyMatches",
      handleReSearchEmptyMatches as EventListener,
    );

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener(
        "reSearchEmptyMatches",
        handleReSearchEmptyMatches as EventListener,
      );
    };
  }, [matchingProcess, setMatchResults]);

  /**
   * Handle retry button click
   */
  const handleRetry = () => {
    // Clear any pending manga data
    pendingMangaState.savePendingManga([]);

    if (manga.length > 0) {
      matchingProcess.startMatching(manga, false, setMatchResults);
    }
  };

  /**
   * Format future sync path
   */
  const getSyncPath = () => {
    // When we have a sync route, return that instead
    return "/sync";
  };

  /**
   * Proceed to synchronization
   */
  const handleProceedToSync = () => {
    // Count how many matches we have
    const matchedCount = matchResults.filter(
      (m) => m.status === "matched" || m.status === "manual",
    ).length;

    if (matchedCount === 0) {
      matchingProcess.setError(
        "No matches have been approved. Please review and accept matches before proceeding.",
      );
      return;
    }

    navigate({ to: getSyncPath() });
  };

  /**
   * Handle rematch by status
   */
  const handleRematchByStatus = async () => {
    // Reset any previous warnings
    setRematchWarning(null);

    // Reset any previous cancel state
    matchingProcess.cancelMatchingRef.current = false;
    matchingProcess.setDetailMessage(null);

    console.log("=== REMATCH DEBUG INFO ===");
    console.log(`Total manga in state: ${manga.length}`);
    console.log(`Total match results: ${matchResults.length}`);
    console.log(
      `Displayed unmatched count: ${manga.length - matchResults.length}`,
    );

    // Get manga that have been processed but match selected statuses
    const filteredManga = matchResults.filter(
      (manga) =>
        selectedStatuses[manga.status as keyof typeof selectedStatuses] ===
        true,
    );
    console.log(`Filtered manga from results: ${filteredManga.length}`);

    // Find unmatched manga that aren't in matchResults yet
    let unmatchedManga: KenmeiManga[] = [];
    if (selectedStatuses.unmatched) {
      console.log("Finding unmatched manga using title-based matching first");

      // Create a set of processed manga titles (lowercase for case-insensitive comparison)
      const processedTitles = new Set(
        matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
      );
      console.log(
        `Created set with ${processedTitles.size} processed manga titles`,
      );

      // Find manga that don't have matching titles in the processed set
      unmatchedManga = manga.filter(
        (m) => !processedTitles.has(m.title.toLowerCase()),
      );
      console.log(
        `Title-based approach found ${unmatchedManga.length} unmatched manga to process`,
      );

      // If we didn't find any unmatched manga with title matching, try ID-based matching as fallback
      if (unmatchedManga.length === 0) {
        console.log(
          "Title matching found no manga, trying ID-based matching as fallback",
        );

        // Create a set of processed manga IDs for faster lookup
        const processedIds = new Set(matchResults.map((r) => r.kenmeiManga.id));
        console.log(`Found ${processedIds.size} processed manga IDs`);

        // Find manga that haven't been processed at all
        unmatchedManga = manga.filter((m) => !processedIds.has(m.id));
        console.log(
          `ID-based approach found ${unmatchedManga.length} unmatched manga to process`,
        );
      }

      // Debug info to help diagnose the issue
      console.log(
        `Total manga titles in state: ${manga.map((m) => m.title).length}`,
      );
      console.log(
        `Unique manga titles in state: ${new Set(manga.map((m) => m.title.toLowerCase())).size}`,
      );
      console.log(
        `Total results titles: ${matchResults.map((r) => r.kenmeiManga.title).length}`,
      );
      console.log(
        `Unique results titles: ${new Set(matchResults.map((r) => r.kenmeiManga.title.toLowerCase())).size}`,
      );

      // Log any duplicate manga titles in the state
      const titleOccurrences = manga.reduce(
        (acc, m) => {
          const title = m.title.toLowerCase();
          acc[title] = (acc[title] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const duplicates = Object.entries(titleOccurrences)
        .filter(([, count]) => count > 1)
        .map(([title, count]) => ({ title, count }));

      if (duplicates.length > 0) {
        console.log(
          `Found ${duplicates.length} duplicate titles in the manga list:`,
        );
        console.log(duplicates);
      }

      // If we still didn't find any unmatched manga but there's a clear numerical difference,
      // use a fallback approach to ensure we're processing something
      if (unmatchedManga.length === 0 && manga.length > matchResults.length) {
        console.log("Using fallback numerical difference approach");

        // Calculate how many manga should be unmatched
        const expectedUnmatched = manga.length - matchResults.length;
        console.log(
          `Expected unmatched count based on total difference: ${expectedUnmatched}`,
        );

        // Last resort - just take the first N manga
        unmatchedManga = manga.slice(0, expectedUnmatched);
        console.log(
          `Last resort: using first ${unmatchedManga.length} manga as unmatched`,
        );
      }
    }

    // Combine the filtered manga with unmatched manga
    const pendingMangaToProcess = [
      ...filteredManga.map((item) => item.kenmeiManga),
      ...unmatchedManga,
    ];

    console.log(`Total manga to process: ${pendingMangaToProcess.length}`);
    console.log(
      "IMPORTANT: Will clear cache entries for selected manga to ensure fresh searches",
    );
    console.log("=== END DEBUG INFO ===");

    // Show more specific error message depending on what's selected
    if (pendingMangaToProcess.length === 0) {
      if (selectedStatuses.unmatched && unmatchedManga.length === 0) {
        // If unmatched is selected but there are no unmatched manga
        setRematchWarning(
          "There are no unmatched manga to process. All manga have been processed previously.",
        );
      } else {
        // Generic message for other cases
        setRematchWarning(
          "No manga found with the selected statuses. Please select different statuses.",
        );
      }
      return;
    }

    console.log(
      `Rematching ${filteredManga.length} status-filtered manga and ${unmatchedManga.length} unmatched manga`,
    );

    try {
      // Show cache clearing notification with count
      matchingProcess.setIsCacheClearing(true);
      matchingProcess.setCacheClearingCount(pendingMangaToProcess.length);
      matchingProcess.setStatusMessage(
        "Preparing to clear cache for selected manga...",
      );

      // Small delay to ensure UI updates before potentially intensive operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the cache service to clear specific entries
      const { cacheDebugger } = await import(
        "../api/matching/manga-search-service"
      );

      // Get initial cache status for comparison
      const initialCacheStatus = cacheDebugger.getCacheStatus();
      console.log(
        `📊 Initial cache status: ${initialCacheStatus.inMemoryCache} entries in memory, ${initialCacheStatus.localStorage.mangaCache} in localStorage`,
      );

      // Clear cache entries for each manga being rematched - use our new dedicated function
      const mangaTitles = pendingMangaToProcess.map((manga) => manga.title);
      console.log(
        `🔄 Clearing cache for ${mangaTitles.length} manga titles at once`,
      );
      matchingProcess.setStatusMessage(
        `Clearing cache for ${mangaTitles.length} manga titles...`,
      );

      // Use our new function to clear cache entries efficiently
      const clearResult = clearCacheForTitles(mangaTitles);

      // Log the results
      console.log(
        `🧹 Cleared ${clearResult.clearedCount} cache entries for selected manga`,
      );
      if (clearResult.clearedCount > 0 && mangaTitles.length > 0) {
        console.log(
          "Cleared titles:",
          mangaTitles.slice(0, 5).join(", ") +
            (mangaTitles.length > 5
              ? ` and ${mangaTitles.length - 5} more...`
              : ""),
        );
      }

      // Log final cache status
      console.log(
        `📊 Final cache status: ${clearResult.remainingCacheSize} entries in memory (removed ${clearResult.clearedCount})`,
      );

      // Hide cache clearing notification
      matchingProcess.setIsCacheClearing(false);
      matchingProcess.setStatusMessage(
        `Cleared ${clearResult.clearedCount} cache entries - preparing fresh searches from AniList...`,
      );

      // Reset the options panel and start matching
      setShowRematchOptions(false);

      // Before starting the matching process, save the existing matchResults
      // Filter out the ones we're about to rematch to avoid duplicates
      const mangaIdsToRematch = new Set(pendingMangaToProcess.map((m) => m.id));
      const existingResults = matchResults.filter(
        (m) => !mangaIdsToRematch.has(m.kenmeiManga.id),
      );

      console.log(
        `Preserved ${existingResults.length} existing match results that aren't being rematched`,
      );

      // Start fresh search
      matchingProcess.startMatching(
        pendingMangaToProcess,
        true,
        setMatchResults,
      );
    } catch (error) {
      console.error("Failed to clear manga cache entries:", error);
      matchingProcess.setIsCacheClearing(false);
      // Continue with rematch even if cache clearing fails
      matchingProcess.startMatching(
        pendingMangaToProcess,
        true,
        setMatchResults,
      );
    }
  };

  // Loading state
  if (matchingProcess.isLoading) {
    return (
      <motion.div
        className="container mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="space-y-2" variants={headerVariants}>
          <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent">
            Match Your Manga
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Automatically match your imported manga with AniList entries
          </p>
        </motion.div>

        {/* Loading State with Progress and Cancel Button */}
        <motion.div variants={contentVariants}>
          <MatchingProgressPanel
            isCancelling={matchingProcess.isCancelling}
            progress={matchingProcess.progress}
            statusMessage={matchingProcess.statusMessage}
            detailMessage={matchingProcess.detailMessage}
            timeEstimate={matchingProcess.timeEstimate}
            onCancelProcess={matchingProcess.handleCancelProcess}
            bypassCache={matchingProcess.bypassCache}
            freshSearch={matchingProcess.freshSearch}
            disableControls={rateLimitState.isRateLimited}
          />
        </motion.div>

        {/* Error Display */}
        {matchingProcess.error && !matchResults.length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.3 }}
          >
            {matchingProcess.error.includes("Authentication Required") ? (
              <Card className="mx-auto w-full max-w-lg overflow-hidden border-amber-200 bg-amber-50/30 text-center dark:border-amber-800/30 dark:bg-amber-900/10">
                <CardContent className="pt-6 pb-4">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-lg font-medium">
                    Authentication Required
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    You need to be authenticated with AniList to match your
                    manga.
                  </p>
                  <Button
                    onClick={() => navigate({ to: "/settings" })}
                    className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Go to Settings
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ErrorDisplay
                error={matchingProcess.error}
                detailedError={matchingProcess.detailedError}
                onRetry={handleRetry}
                onClearPendingManga={() =>
                  pendingMangaState.savePendingManga([])
                }
              />
            )}
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="container mx-auto flex h-full max-w-full flex-col px-4 py-6 md:px-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Authentication Error - Display regardless of loading state */}
      {matchingProcess.error &&
      matchingProcess.error.includes("Authentication Required") ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          <Card className="mx-auto w-full max-w-lg overflow-hidden border-amber-200 bg-amber-50/30 text-center dark:border-amber-800/30 dark:bg-amber-900/10">
            <CardContent className="pt-6 pb-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-medium">Authentication Required</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                You need to be authenticated with AniList to match your manga.
              </p>
              <Button
                onClick={() => navigate({ to: "/settings" })}
                className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          <motion.header className="mb-6 space-y-2" variants={headerVariants}>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent">
                Review Your Manga
              </h1>
              {matchResults.length > 0 && !matchingProcess.isLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.25 }}
                >
                  <Button
                    onClick={() => setShowRematchOptions(!showRematchOptions)}
                    variant="default"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {showRematchOptions
                      ? "Hide Rematch Options"
                      : "Fresh Search (Clear Cache)"}
                  </Button>
                </motion.div>
              )}
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Review the matches found between your Kenmei manga and AniList.
            </p>
          </motion.header>

          {/* Rematch by status options */}
          <AnimatePresence>
            {showRematchOptions &&
              !matchingProcess.isLoading &&
              matchResults.length > 0 && (
                <RematchOptions
                  selectedStatuses={selectedStatuses}
                  onChangeSelectedStatuses={setSelectedStatuses}
                  matchResults={matchResults}
                  rematchWarning={rematchWarning}
                  onRematchByStatus={handleRematchByStatus}
                  onCloseOptions={() => setShowRematchOptions(false)}
                />
              )}
          </AnimatePresence>

          {/* Initialization state - only show if not already loading and we have pending manga */}
          {matchingProcess.isInitializing &&
            !matchingProcess.isLoading &&
            pendingMangaState.pendingManga.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <Card className="mb-6 border-blue-100 bg-blue-50/50 shadow-md dark:border-blue-900/50 dark:bg-blue-900/20">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative flex h-8 w-8 items-center justify-center">
                        <div className="absolute h-full w-full animate-ping rounded-full bg-blue-400 opacity-20"></div>
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-blue-700 dark:text-blue-300">
                          Checking for pending manga to resume...
                        </p>
                        <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
                          Please wait while we analyze your previous session
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          {/* Resume message when we have pending manga but aren't already in the loading state */}
          {(pendingMangaState.pendingManga.length > 0 ||
            manga.length > matchResults.length) &&
            !matchingProcess.isLoading &&
            !matchingProcess.isInitializing &&
            (() => {
              console.log(
                `Checking if ${pendingMangaState.pendingManga.length || manga.length - matchResults.length} pending manga need processing...`,
              );

              let needsProcessing = false;
              let unprocessedCount = 0;

              // First check: Pending manga from storage
              if (pendingMangaState.pendingManga.length > 0) {
                // Since IDs are undefined, use title-based matching instead
                const processedTitles = new Set(
                  matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
                );

                // Check if any of the pending manga aren't already processed by title
                const pendingTitles = pendingMangaState.pendingManga.map((m) =>
                  m.title.toLowerCase(),
                );
                needsProcessing = pendingTitles.some(
                  (title) => !processedTitles.has(title),
                );

                // Calculate how many manga still need processing
                unprocessedCount = pendingMangaState.pendingManga.filter(
                  (manga) => !processedTitles.has(manga.title.toLowerCase()),
                ).length;

                console.log(
                  `Title-based check on stored pending manga: ${needsProcessing ? "Pending manga need processing" : "All pending manga are already processed"}`,
                );
                console.log(
                  `${unprocessedCount} manga from stored pending manga need processing`,
                );

                if (
                  !needsProcessing &&
                  pendingMangaState.pendingManga.length > 0
                ) {
                  console.log(
                    "All pending manga titles are already in matchResults - clearing pending manga",
                  );
                  pendingMangaState.savePendingManga([]);
                }
              }

              // Second check: Count difference between all manga and processed results
              if (manga.length > matchResults.length) {
                console.log(
                  `${manga.length - matchResults.length} manga still need processing based on count difference`,
                );

                // Use title-based matching to find unprocessed manga
                const processedTitles = new Set(
                  matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
                );

                const stillNeedProcessing = manga.filter(
                  (m) => !processedTitles.has(m.title.toLowerCase()),
                ).length;

                console.log(
                  `${stillNeedProcessing} manga actually need processing based on title comparison`,
                );

                if (stillNeedProcessing > 0) {
                  needsProcessing = true;
                  unprocessedCount = Math.max(
                    unprocessedCount,
                    stillNeedProcessing,
                  );
                }
              }

              return needsProcessing;
            })() && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <ResumeNotification
                  // Only count manga that actually need processing
                  pendingMangaCount={(() => {
                    const processedTitles = new Set(
                      matchResults.map((r) =>
                        r.kenmeiManga.title.toLowerCase(),
                      ),
                    );

                    // Check stored pending manga
                    const unprocessedFromPending =
                      pendingMangaState.pendingManga.filter(
                        (manga) =>
                          !processedTitles.has(manga.title.toLowerCase()),
                      ).length;

                    // Check all manga
                    const unprocessedFromAll = manga.filter(
                      (m) => !processedTitles.has(m.title.toLowerCase()),
                    ).length;

                    // Return the larger of the two counts
                    return Math.max(unprocessedFromPending, unprocessedFromAll);
                  })()}
                  onResumeMatching={() => {
                    console.log(
                      "Resume matching clicked - ensuring unprocessed manga are processed",
                    );

                    // Get ALL unprocessed manga by comparing the full manga list with processed titles
                    const processedTitles = new Set(
                      matchResults.map((r) =>
                        r.kenmeiManga.title.toLowerCase(),
                      ),
                    );

                    // Find unprocessed manga by title comparison from the ENTIRE manga list
                    const unprocessedManga = manga.filter(
                      (m) => !processedTitles.has(m.title.toLowerCase()),
                    );

                    if (unprocessedManga.length > 0) {
                      console.log(
                        `Found ${unprocessedManga.length} unprocessed manga from the full manga list`,
                      );

                      // ALWAYS update the pendingManga with ALL unprocessed manga before resuming
                      // This ensures we're processing all 870 manga not just the 21
                      console.log(
                        `Setting pendingManga to ${unprocessedManga.length} unprocessed manga before resuming`,
                      );
                      pendingMangaState.savePendingManga(unprocessedManga);

                      // Small delay to ensure state is updated before continuing
                      setTimeout(() => {
                        // Now call the resume function, which will use the newly updated pendingManga
                        matchingProcess.handleResumeMatching(
                          matchResults,
                          setMatchResults,
                        );
                      }, 100);
                    } else {
                      console.log(
                        "No unprocessed manga found, trying to resume anyway",
                      );
                      matchingProcess.handleResumeMatching(
                        matchResults,
                        setMatchResults,
                      );
                    }
                  }}
                  onCancelResume={matchingProcess.handleCancelResume}
                />
              </motion.div>
            )}

          {/* Main content */}
          <motion.div className="relative flex-1" variants={contentVariants}>
            {matchResults.length > 0 ? (
              <>
                {/* The main matching panel */}
                {
                  <motion.div
                    className="mb-6 flex h-full flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.3 }}
                  >
                    <MangaMatchingPanel
                      matches={matchResults}
                      onManualSearch={matchHandlers.handleManualSearch}
                      onAcceptMatch={matchHandlers.handleAcceptMatch}
                      onRejectMatch={matchHandlers.handleRejectMatch}
                      onSelectAlternative={
                        matchHandlers.handleSelectAlternative
                      }
                      onResetToPending={matchHandlers.handleResetToPending}
                    />

                    {/* Action buttons */}
                    <motion.div
                      className="mt-6 flex flex-col-reverse justify-end space-y-4 space-y-reverse sm:flex-row sm:space-y-0 sm:space-x-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35, duration: 0.3 }}
                    >
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Clear any pending manga data
                          pendingMangaState.savePendingManga([]);
                          navigate({ to: "/import" });
                        }}
                      >
                        Back to Import
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        onClick={handleProceedToSync}
                      >
                        Proceed to Sync
                      </Button>
                    </motion.div>
                  </motion.div>
                }
              </>
            ) : (
              // No results state
              <motion.div
                className="bg-background/50 flex h-full min-h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-12 text-center backdrop-blur-sm dark:border-gray-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <motion.div
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: 0.3,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-blue-600 dark:text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <h3 className="mb-2 text-xl font-semibold">
                    No Manga To Match
                  </h3>
                  <p className="text-muted-foreground mb-6 text-sm">
                    No manga data to match. Return to the import page to load
                    your data.
                  </p>
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    onClick={() => {
                      // Clear any pending manga data
                      pendingMangaState.savePendingManga([]);
                      navigate({ to: "/import" });
                    }}
                  >
                    Go to Import Page
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </motion.div>

          {/* Search Modal */}
          <SearchModal
            isOpen={isSearchOpen}
            searchTarget={searchTarget}
            accessToken={authState.accessToken || ""}
            bypassCache={true}
            onClose={() => {
              setIsSearchOpen(false);
              setSearchTarget(undefined);
              matchingProcess.setBypassCache(false);
            }}
            onSelectMatch={matchHandlers.handleSelectSearchMatch}
          />

          {/* Cache Clearing Notification */}
          {matchingProcess.isCacheClearing && (
            <CacheClearingNotification
              cacheClearingCount={matchingProcess.cacheClearingCount}
            />
          )}

          {/* Error display when we have an error but also have results */}
          <AnimatePresence>
            {matchingProcess.error &&
              !matchingProcess.error.includes("Authentication Required") &&
              matchResults.length > 0 &&
              !rateLimitState.isRateLimited && (
                <motion.div
                  className="fixed right-4 bottom-4 max-w-sm rounded-md bg-red-50 p-4 shadow-lg dark:bg-red-900/30"
                  initial={{ opacity: 0, x: 20, y: 20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        {matchingProcess.error}
                      </p>
                      <div className="mt-2 flex space-x-2">
                        <button
                          onClick={() => matchingProcess.setError(null)}
                          className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-800 dark:text-red-100 dark:hover:bg-red-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
