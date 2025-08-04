/**
 * @packageDocumentation
 * @module MatchingPage
 * @description Matching page component for the Kenmei to AniList sync tool. Handles manga matching, review, rematch, and sync preparation.
 */

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

/**
 * Matching page component for the Kenmei to AniList sync tool.
 *
 * Handles manga matching, review, rematch, and sync preparation for the user.
 *
 * @source
 */
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

  // New: Set all matched (including manual) entries to pending
  const handleSetAllMatchedToPending = () => {
    if (!matchResults.length) return;
    const updated = matchResults.map((m) =>
      m.status === "matched" || m.status === "manual"
        ? {
            ...m,
            status: "pending" as const,
            selectedMatch: undefined,
            matchDate: new Date(),
          }
        : m,
    );
    setMatchResults(updated);
  };

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

    // Load saved match results IMMEDIATELY to avoid showing false resume notifications
    console.log("Loading saved match results immediately...");
    const savedResults = getSavedMatchResults();
    if (
      savedResults &&
      Array.isArray(savedResults) &&
      savedResults.length > 0
    ) {
      console.log(
        `Found ${savedResults.length} existing match results - loading immediately`,
      );
      setMatchResults(savedResults as MangaMatchResult[]);

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

      // Calculate what might still need processing if we have imported manga
      if (importedManga.length > 0) {
        console.log(
          "Have both saved results and imported manga - calculating unmatched manga",
        );
        const calculatedPendingManga = pendingMangaState.calculatePendingManga(
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
          // force a calculation of pending manga by finding the actual missing manga
          if (importedManga.length > savedResults.length) {
            console.log(
              `⚠️ Discrepancy detected! Total manga: ${importedManga.length}, Processed: ${savedResults.length}`,
            );
            console.log(
              "Finding actual missing manga using comprehensive title and ID matching",
            );

            // Create sets of processed manga for quick lookup - convert IDs to strings for consistent comparison
            const processedIds = new Set(
              savedResults
                .map((r) => r.kenmeiManga.id?.toString())
                .filter(Boolean),
            );
            const processedTitles = new Set(
              savedResults.map((r) => r.kenmeiManga.title.toLowerCase()),
            );

            console.log(
              `Processed IDs (first 10):`,
              Array.from(processedIds).slice(0, 10),
            );
            console.log(
              `Processed titles (first 5):`,
              Array.from(processedTitles).slice(0, 5),
            );

            // Find manga that aren't in savedResults using proper matching
            const actualMissingManga = importedManga.filter((manga) => {
              const idMatch =
                manga.id != null && processedIds.has(manga.id.toString());
              const titleMatch = processedTitles.has(manga.title.toLowerCase());

              // Debug log for first few manga being checked
              if (actualMissingManga.length < 5) {
                console.log(
                  `Checking manga "${manga.title}" (ID: ${manga.id}): idMatch=${idMatch}, titleMatch=${titleMatch}, shouldInclude=${!idMatch && !titleMatch}`,
                );
              }

              return !idMatch && !titleMatch;
            });

            if (actualMissingManga.length > 0) {
              console.log(
                `Found ${actualMissingManga.length} actual missing manga that need processing`,
              );
              console.log(
                "Sample missing manga:",
                actualMissingManga
                  .slice(0, 5)
                  .map((m) => ({ id: m.id, title: m.title })),
              );
              pendingMangaState.savePendingManga(
                actualMissingManga as KenmeiManga[],
              );
            } else {
              console.log(
                "No actual missing manga found despite count discrepancy - all manga may already be processed",
              );
            }
          }
        }
      }

      // Mark as initialized since we have results
      matchingProcess.matchingInitialized.current = true;
      matchingProcess.setIsInitializing(false);

      console.log("*** INITIALIZATION COMPLETE - Using saved results ***");
      return; // Skip further initialization
    } else {
      console.log("No saved match results found");
    }

    // Check for pending manga from a previously interrupted operation (only if no saved results)
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

      // If we haven't already loaded saved results and have imported manga, start matching
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
      console.log(
        "Finding unmatched manga from pending manga list using title-based matching",
      );

      // Use pendingManga instead of the entire manga collection for fresh search
      unmatchedManga = pendingMangaState.pendingManga;
      console.log(
        `Using pending manga list: ${unmatchedManga.length} manga to process`,
      );
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => setShowRematchOptions(!showRematchOptions)}
                      variant="default"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {showRematchOptions
                        ? "Hide Rematch Options"
                        : "Fresh Search (Clear Cache)"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSetAllMatchedToPending}
                      disabled={
                        matchingProcess.isLoading ||
                        rateLimitState.isRateLimited
                      }
                    >
                      Set Matched To Pending
                    </Button>
                  </div>
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
                // Use comprehensive matching with both IDs and titles for maximum accuracy
                const processedIds = new Set(
                  matchResults.map((r) => r.kenmeiManga.id).filter(Boolean),
                );
                const processedTitles = new Set(
                  matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
                );

                // Check if any of the pending manga aren't already processed using comprehensive matching
                const pendingTitlesAndIds = pendingMangaState.pendingManga.map(
                  (m) => ({
                    id: m.id,
                    title: m.title.toLowerCase(),
                  }),
                );

                needsProcessing = pendingTitlesAndIds.some((manga) => {
                  const idMatch = manga.id && processedIds.has(manga.id);
                  const titleMatch = processedTitles.has(manga.title);
                  return !idMatch && !titleMatch;
                });

                // Calculate how many manga still need processing using comprehensive matching
                unprocessedCount = pendingMangaState.pendingManga.filter(
                  (manga) => {
                    const idMatch = manga.id && processedIds.has(manga.id);
                    const titleMatch = processedTitles.has(
                      manga.title.toLowerCase(),
                    );
                    return !idMatch && !titleMatch;
                  },
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

                // Use comprehensive matching with both IDs and titles to find unprocessed manga
                const processedIds = new Set(
                  matchResults.map((r) => r.kenmeiManga.id).filter(Boolean),
                );
                const processedTitles = new Set(
                  matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
                );

                const stillNeedProcessing = manga.filter((m) => {
                  const idMatch = m.id && processedIds.has(m.id);
                  const titleMatch = processedTitles.has(m.title.toLowerCase());
                  return !idMatch && !titleMatch;
                }).length;

                console.log(
                  `${stillNeedProcessing} manga actually need processing based on comprehensive ID and title comparison`,
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
                    const processedIds = new Set(
                      matchResults.map((r) => r.kenmeiManga.id).filter(Boolean),
                    );
                    const processedTitles = new Set(
                      matchResults.map((r) =>
                        r.kenmeiManga.title.toLowerCase(),
                      ),
                    );

                    // Check stored pending manga using comprehensive matching
                    const unprocessedFromPending =
                      pendingMangaState.pendingManga.filter((manga) => {
                        const idMatch = manga.id && processedIds.has(manga.id);
                        const titleMatch = processedTitles.has(
                          manga.title.toLowerCase(),
                        );
                        return !idMatch && !titleMatch;
                      }).length;

                    // Check all manga using comprehensive matching
                    const unprocessedFromAll = manga.filter((m) => {
                      const idMatch = m.id && processedIds.has(m.id);
                      const titleMatch = processedTitles.has(
                        m.title.toLowerCase(),
                      );
                      return !idMatch && !titleMatch;
                    }).length;

                    // Return the larger of the two counts
                    return Math.max(unprocessedFromPending, unprocessedFromAll);
                  })()}
                  onResumeMatching={() => {
                    console.log(
                      "Resume matching clicked - ensuring unprocessed manga are processed",
                    );

                    // Get ALL unprocessed manga by comparing the full manga list with processed titles and IDs
                    const processedIds = new Set(
                      matchResults.map((r) => r.kenmeiManga.id).filter(Boolean),
                    );
                    const processedTitles = new Set(
                      matchResults.map((r) =>
                        r.kenmeiManga.title.toLowerCase(),
                      ),
                    );

                    // Find unprocessed manga using both ID and title matching for maximum accuracy
                    const unprocessedManga = manga.filter((m) => {
                      const idMatch = m.id && processedIds.has(m.id);
                      const titleMatch = processedTitles.has(
                        m.title.toLowerCase(),
                      );
                      return !idMatch && !titleMatch;
                    });

                    if (unprocessedManga.length > 0) {
                      console.log(
                        `Found ${unprocessedManga.length} unprocessed manga from the full manga list`,
                      );
                      console.log(
                        "Sample unprocessed manga:",
                        unprocessedManga
                          .slice(0, 5)
                          .map((m) => ({ id: m.id, title: m.title })),
                      );

                      // ALWAYS update the pendingManga with ALL unprocessed manga before resuming
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
                        "No unprocessed manga found - all manga appear to be processed already",
                      );
                      // Clear pending manga and show appropriate message
                      pendingMangaState.savePendingManga([]);
                      matchingProcess.setError(
                        "All manga have already been processed. No additional matching is needed.",
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
