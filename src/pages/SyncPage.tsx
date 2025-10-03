/**
 * @packageDocumentation
 * @module SyncPage
 * @description Sync page component for the Kenmei to AniList sync tool. Handles synchronization preview, configuration, execution, and results display.
 */

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { useSynchronization } from "../hooks/useSynchronization";
import { useRateLimit } from "../contexts/RateLimitContext";
import { UserMediaList, MangaMatchResult } from "../api/anilist/types";
import {
  getSavedMatchResults,
  getSyncConfig,
  saveSyncConfig,
  SyncConfig,
} from "../utils/storage";
import { getUserMangaList } from "../api/anilist/client";
import SyncManager from "../components/sync/SyncManager";
import SyncResultsView from "../components/sync/SyncResultsView";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { AlertCircle, Loader2 } from "lucide-react";
import { exportSyncErrorLog } from "../utils/export-utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  pageVariants,
  cardVariants,
  staggerContainerVariants,
  viewModeTransition,
  fadeVariants,
} from "../components/sync/animations";
import {
  ViewMode,
  DisplayMode,
  SortOption,
  FilterOptions,
} from "../components/sync/types";
import {
  getEffectiveStatus,
  calculateSyncChanges,
} from "../components/sync/sync-utils";
import {
  handleLibraryRefresh as handleLibraryRefreshUtil,
  refreshUserLibrary as refreshUserLibraryUtil,
} from "../components/sync/library-handlers";
import {
  filterMangaMatches,
  sortMangaMatches,
} from "../components/sync/filtering";
import {
  prepareAllEntriesToSync,
  hasChanges,
} from "../components/sync/entry-preparation";
import { ErrorStateDisplay } from "../components/sync/ErrorStateDisplay";
import { LoadingStateDisplay } from "../components/sync/LoadingStateDisplay";
import { SyncConfigurationPanel } from "../components/sync/SyncConfigurationPanel";
import { ChangesSummary } from "../components/sync/ChangesSummary";
import { ViewControls } from "../components/sync/ViewControls";

/**
 * Sync page component for the Kenmei to AniList sync tool.
 *
 * Handles synchronization preview, configuration, execution, and results display for the user.
 *
 * @source
 */
export function SyncPage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const token = authState.accessToken || "";
  const [state, actions] = useSynchronization();
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const { rateLimitState, setRateLimit } = useRateLimit();

  // Authentication and validation states
  const [authError, setAuthError] = useState(false);
  const [matchDataError, setMatchDataError] = useState(false);
  const [validMatchesError, setValidMatchesError] = useState(false);

  // Authentication and data validation check
  useEffect(() => {
    // Check if user is authenticated
    if (!authState.isAuthenticated || !token) {
      console.log("User not authenticated, showing auth error");
      setAuthError(true);
      return;
    } else {
      setAuthError(false);
    }

    // Check if there are match results to sync
    const savedResults = getSavedMatchResults();
    if (
      !savedResults ||
      !Array.isArray(savedResults) ||
      savedResults.length === 0
    ) {
      console.log("No match results found, showing match data error");
      setMatchDataError(true);
      return;
    } else {
      setMatchDataError(false);
    }

    // Validate that there are actual matches (not just skipped entries)
    const validMatches = savedResults.filter(
      (match) => match.status === "matched" || match.status === "manual",
    );

    if (validMatches.length === 0) {
      console.log("No valid matches found, showing valid matches error");
      setValidMatchesError(true);
      return;
    } else {
      setValidMatchesError(false);
    }

    console.log(
      `Found ${validMatches.length} valid matches for synchronization`,
    );
  }, [authState.isAuthenticated, token]);

  // Sync configuration options
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(getSyncConfig());
  // Track if we're using a custom threshold
  const [useCustomThreshold, setUseCustomThreshold] = useState<boolean>(
    ![1, 7, 14, 30, 60, 90, 180, 365].includes(syncConfig.autoPauseThreshold),
  );

  // Toggle handler for sync options
  const handleToggleOption = (option: keyof SyncConfig) => {
    setSyncConfig((prev) => {
      const newConfig = {
        ...prev,
        [option]: !prev[option],
      };

      // Save the updated config to storage
      saveSyncConfig(newConfig);

      return newConfig;
    });
  };

  // Handler for refreshing user library (shared between Try Again and Refresh buttons)
  const handleLibraryRefresh = () => {
    handleLibraryRefreshUtil({
      token,
      setLibraryLoading,
      setLibraryError,
      setRetryCount,
      setRateLimit,
      setUserLibrary,
    });
  };

  // View mode for displaying manga entries
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");

  // State to hold manga matches
  const [mangaMatches, setMangaMatches] = useState<MangaMatchResult[]>([]);

  // Pagination and loading state
  const [visibleItems, setVisibleItems] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // State to hold user's AniList library
  const [userLibrary, setUserLibrary] = useState<UserMediaList>({});
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Sorting and filtering options
  const [sortOption, setSortOption] = useState<SortOption>({
    field: "title",
    direction: "asc",
  });

  const [filters, setFilters] = useState<FilterOptions>({
    status: "all", // 'all', 'reading', 'completed', 'planned', 'paused', 'dropped'
    changes: "with-changes", // 'all', 'with-changes', 'no-changes'
    library: "all", // 'all', 'new', 'existing'
  });

  // Load manga matches from the app's storage system
  useEffect(() => {
    const savedResults = getSavedMatchResults();
    if (savedResults && Array.isArray(savedResults)) {
      console.log(`Loaded ${savedResults.length} match results from storage`);
      setMangaMatches(savedResults as MangaMatchResult[]);
    } else {
      console.error("No match results found in storage");
    }
  }, []);

  // Fetch the user's AniList library for comparison
  useEffect(() => {
    if (token && mangaMatches.length > 0) {
      setLibraryLoading(true);
      setLibraryError(null);

      const controller = new AbortController();

      const fetchLibrary = (attempt = 0) => {
        console.log(
          `Fetching AniList library (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
        setRetryCount(attempt);

        getUserMangaList(token, controller.signal)
          .then((library) => {
            console.log(
              `Loaded ${Object.keys(library).length} entries from user's AniList library`,
            );
            setUserLibrary(library);
            setLibraryLoading(false);
            setLibraryError(null);
            setRetryCount(0);
          })
          .catch((error) => {
            if (error.name === "AbortError") return;

            console.error("Failed to load user library:", error);
            console.log(
              "Error object structure:",
              JSON.stringify(error, null, 2),
            );

            // Check for rate limiting - with our new client updates, this should be more reliable
            if (error.isRateLimited || error.status === 429) {
              console.warn("📛 DETECTED RATE LIMIT in SyncPage:", {
                isRateLimited: error.isRateLimited,
                status: error.status,
                retryAfter: error.retryAfter,
              });

              const retryDelay = error.retryAfter ? error.retryAfter : 60;

              // Update the global rate limit state
              setRateLimit(
                true,
                retryDelay,
                "AniList API rate limit reached. Waiting to retry...",
              );

              // Set library loading state
              setLibraryLoading(false);
              setLibraryError(
                "AniList API rate limit reached. Waiting to retry...",
              );

              // Set a timer to retry after the delay
              const timer = setTimeout(() => {
                if (!controller.signal.aborted) {
                  console.log("Rate limit timeout complete, retrying...");
                  setLibraryLoading(true);
                  setLibraryError(null);
                  fetchLibrary(0); // Reset retry count for rate limits
                }
              }, retryDelay * 1000);

              return () => clearTimeout(timer);
            }

            // Check for server error (5xx) or network error
            const isServerError =
              error.message?.includes("500") ||
              error.message?.includes("502") ||
              error.message?.includes("503") ||
              error.message?.includes("504") ||
              error.message?.toLowerCase().includes("network error");

            if (isServerError && attempt < maxRetries) {
              // Exponential backoff for retries (1s, 2s, 4s)
              const backoffDelay = Math.pow(2, attempt) * 1000;
              setLibraryError(
                `AniList server error. Retrying in ${backoffDelay / 1000} seconds (${attempt + 1}/${maxRetries})...`,
              );

              // Set a timer to retry
              const timer = setTimeout(() => {
                if (!controller.signal.aborted) {
                  fetchLibrary(attempt + 1);
                }
              }, backoffDelay);

              return () => clearTimeout(timer);
            }

            // If we get here, either it's not a server error or we've exceeded retry attempts
            setLibraryError(
              error.message ||
                "Failed to load your AniList library. Synchronization can still proceed, but comparison data will not be shown.",
            );
            setUserLibrary({});
            setLibraryLoading(false);
          });
      };

      fetchLibrary(0);

      return () => controller.abort();
    }
  }, [token, mangaMatches, maxRetries, setRateLimit]);

  // Reset visible items when changing display mode
  useEffect(() => {
    setVisibleItems(20);
  }, [displayMode]);

  // Apply filters to manga matches
  const filteredMangaMatches = useMemo(() => {
    return filterMangaMatches(mangaMatches, filters, userLibrary, syncConfig);
  }, [mangaMatches, filters, userLibrary, syncConfig]);

  // Apply sorting to filtered manga matches
  const sortedMangaMatches = useMemo(() => {
    return sortMangaMatches(
      filteredMangaMatches,
      sortOption,
      userLibrary,
      syncConfig,
    );
  }, [filteredMangaMatches, sortOption, userLibrary, syncConfig]);

  // Compute all entries to sync (unfiltered, all with changes)
  const allEntriesToSync = useMemo(() => {
    return prepareAllEntriesToSync(mangaMatches, userLibrary, syncConfig);
  }, [mangaMatches, userLibrary, syncConfig]);

  // Only sync entries with actual changes
  const entriesWithChanges = useMemo(
    () => allEntriesToSync.filter((entry) => hasChanges(entry, syncConfig)),
    [allEntriesToSync, syncConfig],
  );

  // Modify handleStartSync to only change the view, not start synchronization
  const handleStartSync = () => {
    if (entriesWithChanges.length === 0) {
      return;
    }
    setViewMode("sync");
  };

  // Handle sync completion
  const handleSyncComplete = () => {
    setViewMode("results");
  };

  // Handle sync cancellation
  const [wasCancelled, setWasCancelled] = useState(false);
  const handleCancel = () => {
    if (viewMode === "sync") {
      // If sync has not started, go back to preview
      if (!state.isActive && !state.report) {
        setViewMode("preview");
        return;
      }
      actions.cancelSync();
      setWasCancelled(true);
      setViewMode("results");
      return;
    }
    // Navigate back to the matching page
    navigate({ to: "/review" });
  };

  // Handle final completion (after viewing results)
  const handleGoHome = () => {
    actions.reset();
    setWasCancelled(false);
    navigate({ to: "/" });
  };
  // Helper to refresh AniList library
  const refreshUserLibrary = () => {
    refreshUserLibraryUtil({
      token,
      setLibraryLoading,
      setLibraryError,
      setRetryCount,
      setRateLimit,
      setUserLibrary,
    });
  };

  const handleBackToReview = () => {
    actions.reset();
    setWasCancelled(false);
    refreshUserLibrary();
    setViewMode("preview");
  };

  // If any error condition is true, show the appropriate error message
  if (authError || matchDataError || validMatchesError) {
    return (
      <ErrorStateDisplay
        authError={authError}
        matchDataError={matchDataError}
        validMatchesError={validMatchesError}
      />
    );
  }

  // If no manga matches are loaded yet, show loading state
  if (mangaMatches.length === 0) {
    return <LoadingStateDisplay type="manga" />;
  }

  // If library is loading, show loading state
  if (libraryLoading) {
    return (
      <LoadingStateDisplay
        type="library"
        isRateLimited={rateLimitState.isRateLimited}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />
    );
  }

  // Render the appropriate view based on state
  const renderContent = () => {
    switch (viewMode) {
      case "preview":
        return (
          <motion.div
            className="space-y-6"
            key="preview"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={staggerContainerVariants}
          >
            <motion.div variants={cardVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Sync Preview</CardTitle>
                  <CardDescription>
                    Review the changes that will be applied to your AniList
                    account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SyncConfigurationPanel
                    syncConfig={syncConfig}
                    setSyncConfig={setSyncConfig}
                    useCustomThreshold={useCustomThreshold}
                    setUseCustomThreshold={setUseCustomThreshold}
                    handleToggleOption={handleToggleOption}
                  />

                  <ChangesSummary
                    entriesWithChanges={entriesWithChanges.length}
                    libraryLoading={libraryLoading}
                    libraryError={libraryError}
                    isRateLimited={rateLimitState.isRateLimited}
                    onLibraryRefresh={handleLibraryRefresh}
                    userLibrary={userLibrary}
                    mangaMatches={mangaMatches}
                    syncConfig={syncConfig}
                  />

                  <ViewControls
                    displayMode={displayMode}
                    setDisplayMode={setDisplayMode}
                    sortOption={sortOption}
                    setSortOption={setSortOption}
                    filters={filters}
                    setFilters={setFilters}
                  />

                  {/* Results counter */}
                  {sortedMangaMatches.length !== mangaMatches.length && (
                    <div className="bg-muted/30 mb-4 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                      <div>
                        Showing{" "}
                        <span className="font-medium">
                          {sortedMangaMatches.length}
                        </span>{" "}
                        of{" "}
                        <span className="font-medium">
                          {
                            mangaMatches.filter(
                              (match) => match.status !== "skipped",
                            ).length
                          }
                        </span>{" "}
                        manga
                        {Object.values(filters).some((v) => v !== "all") && (
                          <span className="text-muted-foreground ml-1">
                            (filtered)
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSortOption({ field: "title", direction: "asc" });
                          setFilters({
                            status: "all",
                            changes: "with-changes",
                            library: "all",
                          });
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}

                  <div className="max-h-[60vh] overflow-y-auto">
                    <AnimatePresence
                      initial={false}
                      mode="wait"
                      key={displayMode}
                    >
                      {displayMode === "cards" ? (
                        <motion.div
                          key="cards-view"
                          variants={fadeVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={viewModeTransition}
                          className="grid grid-cols-1 gap-4"
                        >
                          <AnimatePresence initial={false}>
                            {sortedMangaMatches
                              .slice(0, visibleItems)
                              .map((match, index) => {
                                const kenmei = match.kenmeiManga;
                                const anilist = match.selectedMatch!;

                                // Get the user's existing data for this manga if it exists
                                const userEntry = userLibrary[anilist.id];

                                // Calculate sync changes using helper function
                                const {
                                  statusWillChange,
                                  progressWillChange,
                                  scoreWillChange,
                                  isNewEntry,
                                  isCompleted,
                                  changeCount,
                                } = calculateSyncChanges(
                                  kenmei,
                                  userEntry,
                                  syncConfig,
                                );

                                return (
                                  <motion.div
                                    key={`${anilist.id}-${index}`}
                                    layout="position"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
                                    layoutId={undefined}
                                  >
                                    <Card className="overflow-hidden transition-shadow duration-200 hover:shadow-md">
                                      <div className="flex">
                                        {/* Manga Cover Image - Updated styling */}
                                        <div className="relative flex h-[200px] flex-shrink-0 items-center justify-center pl-3">
                                          {anilist.coverImage?.large ||
                                          anilist.coverImage?.medium ? (
                                            <motion.div
                                              layout="position"
                                              animate={{
                                                transition: { type: false },
                                              }}
                                            >
                                              <img
                                                src={
                                                  anilist.coverImage?.large ||
                                                  anilist.coverImage?.medium
                                                }
                                                alt={anilist.title.romaji || ""}
                                                className="h-full w-[145px] rounded-sm object-cover"
                                              />
                                            </motion.div>
                                          ) : (
                                            <div className="flex h-[200px] items-center justify-center rounded-sm bg-slate-200 dark:bg-slate-800">
                                              <span className="text-muted-foreground text-xs">
                                                No Cover
                                              </span>
                                            </div>
                                          )}

                                          {/* Status Badges - Removed Manual badge */}
                                          <div className="absolute top-2 left-4 flex flex-col gap-1">
                                            {isNewEntry && (
                                              <Badge className="bg-emerald-500">
                                                New
                                              </Badge>
                                            )}
                                            {isCompleted && (
                                              <Badge
                                                variant="outline"
                                                className="border-amber-500 text-amber-700 dark:text-amber-400"
                                              >
                                                Completed
                                              </Badge>
                                            )}
                                          </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 p-4">
                                          <div className="flex items-start justify-between">
                                            <div>
                                              <h3 className="line-clamp-2 max-w-[580px] text-base font-semibold">
                                                {anilist.title.romaji ||
                                                  kenmei.title}
                                              </h3>
                                              {changeCount > 0 &&
                                              !isCompleted ? (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                  {statusWillChange && (
                                                    <Badge
                                                      variant="outline"
                                                      className="border-blue-400 px-1.5 py-0 text-xs text-blue-600 dark:text-blue-400"
                                                    >
                                                      Status
                                                    </Badge>
                                                  )}

                                                  {progressWillChange && (
                                                    <Badge
                                                      variant="outline"
                                                      className="border-green-400 px-1.5 py-0 text-xs text-green-600 dark:text-green-400"
                                                    >
                                                      Progress
                                                    </Badge>
                                                  )}

                                                  {scoreWillChange && (
                                                    <Badge
                                                      variant="outline"
                                                      className="border-amber-400 px-1.5 py-0 text-xs text-amber-600 dark:text-amber-400"
                                                    >
                                                      Score
                                                    </Badge>
                                                  )}

                                                  {userEntry
                                                    ? syncConfig.setPrivate &&
                                                      !userEntry.private && (
                                                        <Badge
                                                          variant="outline"
                                                          className="border-purple-400 px-1.5 py-0 text-xs text-purple-600 dark:text-purple-400"
                                                        >
                                                          Privacy
                                                        </Badge>
                                                      )
                                                    : syncConfig.setPrivate && (
                                                        <Badge
                                                          variant="outline"
                                                          className="border-purple-400 px-1.5 py-0 text-xs text-purple-600 dark:text-purple-400"
                                                        >
                                                          Privacy
                                                        </Badge>
                                                      )}
                                                </div>
                                              ) : (
                                                <div className="mt-1">
                                                  <Badge
                                                    variant="outline"
                                                    className="text-muted-foreground px-1.5 py-0 text-xs"
                                                  >
                                                    {isCompleted
                                                      ? "Preserving Completed"
                                                      : "No Changes"}
                                                  </Badge>
                                                </div>
                                              )}
                                            </div>

                                            {/* Change Indicator */}
                                            {changeCount > 0 &&
                                              !isCompleted && (
                                                <div className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                                                  {changeCount} change
                                                  {changeCount === 1 ? "" : "s"}
                                                </div>
                                              )}
                                          </div>

                                          {/* Comparison Table */}
                                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                            <div className="rounded-md bg-slate-100 p-2 dark:bg-slate-800/60">
                                              <h4 className="text-muted-foreground mb-2 text-xs font-medium">
                                                {isNewEntry
                                                  ? "Not in Library"
                                                  : "Current AniList"}
                                              </h4>

                                              {isNewEntry ? (
                                                <div className="text-muted-foreground py-4 text-center text-xs">
                                                  New addition to your library
                                                </div>
                                              ) : (
                                                <div className="space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground text-xs">
                                                      Status:
                                                    </span>
                                                    <span
                                                      className={`text-xs font-medium ${statusWillChange ? "text-muted-foreground line-through" : ""}`}
                                                    >
                                                      {userEntry?.status ||
                                                        "None"}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground text-xs">
                                                      Progress:
                                                    </span>
                                                    <span
                                                      className={`text-xs font-medium ${progressWillChange ? "text-muted-foreground line-through" : ""}`}
                                                    >
                                                      {userEntry?.progress || 0}{" "}
                                                      ch
                                                      {anilist.chapters
                                                        ? ` / ${anilist.chapters}`
                                                        : ""}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground text-xs">
                                                      Score:
                                                    </span>
                                                    <span
                                                      className={`text-xs font-medium ${scoreWillChange ? "text-muted-foreground line-through" : ""}`}
                                                    >
                                                      {userEntry?.score
                                                        ? `${userEntry.score}/10`
                                                        : "None"}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground text-xs">
                                                      Private:
                                                    </span>
                                                    {(() => {
                                                      let privacyClass =
                                                        "text-xs font-medium";
                                                      if (userEntry) {
                                                        if (
                                                          syncConfig.setPrivate &&
                                                          !userEntry.private
                                                        ) {
                                                          privacyClass +=
                                                            " text-muted-foreground line-through";
                                                        }
                                                      } else if (
                                                        syncConfig.setPrivate
                                                      ) {
                                                        privacyClass +=
                                                          " text-muted-foreground line-through";
                                                      }
                                                      return (
                                                        <span
                                                          className={
                                                            privacyClass
                                                          }
                                                        >
                                                          {userEntry?.private
                                                            ? "Yes"
                                                            : "No"}
                                                        </span>
                                                      );
                                                    })()}
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            <div className="rounded-md bg-blue-50 p-2 dark:bg-blue-900/20">
                                              <h4 className="mb-2 text-xs font-medium text-blue-600 dark:text-blue-300">
                                                After Sync
                                              </h4>

                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-blue-500 dark:text-blue-400">
                                                    Status:
                                                  </span>
                                                  <span
                                                    className={`text-xs font-medium ${statusWillChange ? "text-blue-700 dark:text-blue-300" : ""}`}
                                                  >
                                                    {getEffectiveStatus(
                                                      kenmei,
                                                      syncConfig,
                                                    )}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-blue-500 dark:text-blue-400">
                                                    Progress:
                                                  </span>
                                                  {(() => {
                                                    let afterSyncProgress: number;
                                                    if (
                                                      syncConfig.prioritizeAniListProgress
                                                    ) {
                                                      if (
                                                        userEntry?.progress &&
                                                        userEntry.progress > 0
                                                      ) {
                                                        afterSyncProgress =
                                                          (kenmei.chapters_read ||
                                                            0) >
                                                          userEntry.progress
                                                            ? kenmei.chapters_read ||
                                                              0
                                                            : userEntry.progress;
                                                      } else {
                                                        afterSyncProgress =
                                                          kenmei.chapters_read ||
                                                          0;
                                                      }
                                                    } else {
                                                      afterSyncProgress =
                                                        kenmei.chapters_read ||
                                                        0;
                                                    }
                                                    return (
                                                      <span
                                                        className={`text-xs font-medium ${progressWillChange ? "text-blue-700 dark:text-blue-300" : ""}`}
                                                      >
                                                        {afterSyncProgress} ch
                                                        {anilist.chapters
                                                          ? ` / ${anilist.chapters}`
                                                          : ""}
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-blue-500 dark:text-blue-400">
                                                    Score:
                                                  </span>
                                                  {(() => {
                                                    let scoreDisplay: string;
                                                    if (scoreWillChange) {
                                                      scoreDisplay =
                                                        kenmei.score
                                                          ? `${kenmei.score}/10`
                                                          : "None";
                                                    } else {
                                                      scoreDisplay =
                                                        userEntry?.score
                                                          ? `${userEntry.score}/10`
                                                          : "None";
                                                    }
                                                    return (
                                                      <span
                                                        className={`text-xs font-medium ${scoreWillChange ? "text-blue-700 dark:text-blue-300" : ""}`}
                                                      >
                                                        {scoreDisplay}
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-blue-500 dark:text-blue-400">
                                                    Private:
                                                  </span>
                                                  {(() => {
                                                    let privacyClass =
                                                      "text-xs font-medium";
                                                    if (userEntry) {
                                                      if (
                                                        syncConfig.setPrivate &&
                                                        !userEntry.private
                                                      ) {
                                                        privacyClass +=
                                                          " text-blue-700 dark:text-blue-300";
                                                      }
                                                    } else if (
                                                      syncConfig.setPrivate
                                                    ) {
                                                      privacyClass +=
                                                        " text-blue-700 dark:text-blue-300";
                                                    }
                                                    let privacyDisplay: string;
                                                    if (userEntry) {
                                                      if (
                                                        syncConfig.setPrivate
                                                      ) {
                                                        privacyDisplay = "Yes";
                                                      } else if (
                                                        userEntry.private
                                                      ) {
                                                        privacyDisplay = "Yes";
                                                      } else {
                                                        privacyDisplay = "No";
                                                      }
                                                    } else {
                                                      privacyDisplay =
                                                        syncConfig.setPrivate
                                                          ? "Yes"
                                                          : "No";
                                                    }
                                                    return (
                                                      <span
                                                        className={privacyClass}
                                                      >
                                                        {privacyDisplay}
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </Card>
                                  </motion.div>
                                );
                              })}
                          </AnimatePresence>

                          {/* Load more button instead of automatic loading */}
                          {sortedMangaMatches.length > visibleItems ? (
                            <div className="py-4 text-center">
                              <Button
                                onClick={() => {
                                  setIsLoadingMore(true);
                                  const newValue = Math.min(
                                    visibleItems + 20,
                                    sortedMangaMatches.length,
                                  );
                                  console.log(
                                    `Loading more items: ${visibleItems} → ${newValue}`,
                                  );

                                  // Add a small delay to show the loading spinner
                                  setTimeout(() => {
                                    setVisibleItems(newValue);
                                    setIsLoadingMore(false);
                                  }, 300);
                                }}
                                variant="outline"
                                className="gap-2"
                                disabled={isLoadingMore}
                              >
                                {isLoadingMore && (
                                  <div className="text-primary inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                )}
                                {isLoadingMore
                                  ? "Loading..."
                                  : `Load More (${visibleItems} of ${sortedMangaMatches.length})`}
                              </Button>
                            </div>
                          ) : null}
                          {sortedMangaMatches.length > 0 &&
                            sortedMangaMatches.length <= visibleItems && (
                              <div className="py-4 text-center">
                                <span className="text-muted-foreground text-xs">
                                  All items loaded
                                </span>
                              </div>
                            )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="compact-view"
                          variants={fadeVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={viewModeTransition}
                          className="space-y-1 overflow-hidden rounded-md border"
                        >
                          <AnimatePresence initial={false}>
                            {sortedMangaMatches
                              .slice(0, visibleItems)
                              .map((match, index) => {
                                const kenmei = match.kenmeiManga;
                                const anilist = match.selectedMatch!;

                                // Get the user's existing data for this manga if it exists
                                const userEntry = userLibrary[anilist.id];

                                // Calculate sync changes using helper function
                                const {
                                  statusWillChange,
                                  progressWillChange,
                                  scoreWillChange,
                                  isNewEntry,
                                  isCompleted,
                                  changeCount,
                                } = calculateSyncChanges(
                                  kenmei,
                                  userEntry,
                                  syncConfig,
                                );

                                return (
                                  <motion.div
                                    key={`${anilist.id}-${index}`}
                                    layout="position"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    layoutId={undefined}
                                  >
                                    <div
                                      className={`hover:bg-muted/50 flex items-center px-3 py-2 ${index % 2 === 0 ? "bg-muted/30" : ""} ${isCompleted ? "bg-amber-50/50 dark:bg-amber-950/20" : ""} ${isNewEntry ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                                    >
                                      {/* Thumbnail - Updated styling */}
                                      <div className="mr-3 flex flex-shrink-0 items-center pl-2">
                                        {anilist.coverImage?.large ||
                                        anilist.coverImage?.medium ? (
                                          <motion.div
                                            layout="position"
                                            animate={{
                                              transition: { type: false },
                                            }}
                                          >
                                            <img
                                              src={
                                                anilist.coverImage?.large ||
                                                anilist.coverImage?.medium
                                              }
                                              alt={anilist.title.romaji || ""}
                                              className="h-12 w-8 rounded-sm object-cover"
                                            />
                                          </motion.div>
                                        ) : (
                                          <div className="flex h-12 w-8 items-center justify-center rounded-sm bg-slate-200 dark:bg-slate-800">
                                            <span className="text-muted-foreground text-[8px]">
                                              No Cover
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Title and status */}
                                      <div className="mr-2 min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">
                                          {anilist.title.romaji || kenmei.title}
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1">
                                          {isNewEntry && (
                                            <Badge className="px-1 py-0 text-[10px]">
                                              New
                                            </Badge>
                                          )}
                                          {isCompleted && (
                                            <Badge
                                              variant="outline"
                                              className="border-amber-500 px-1 py-0 text-[10px] text-amber-700"
                                            >
                                              Completed
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      {/* Changes */}
                                      <div className="flex flex-shrink-0 items-center gap-1">
                                        {!isNewEntry && !isCompleted && (
                                          <>
                                            {(() => {
                                              if (!statusWillChange)
                                                return null;

                                              const fromStatus =
                                                userEntry?.status || "None";
                                              const toStatus =
                                                getEffectiveStatus(
                                                  kenmei,
                                                  syncConfig,
                                                );

                                              // Only show badge if values are actually different
                                              if (fromStatus === toStatus)
                                                return null;

                                              return (
                                                <Badge
                                                  variant="outline"
                                                  className="border-blue-400 px-1 py-0 text-[10px]"
                                                >
                                                  {fromStatus} → {toStatus}
                                                </Badge>
                                              );
                                            })()}

                                            {(() => {
                                              if (!progressWillChange)
                                                return null;

                                              const fromProgress =
                                                userEntry?.progress || 0;
                                              let toProgress: number;
                                              if (
                                                syncConfig.prioritizeAniListProgress
                                              ) {
                                                if (
                                                  userEntry?.progress &&
                                                  userEntry.progress > 0
                                                ) {
                                                  toProgress =
                                                    (kenmei.chapters_read ||
                                                      0) > userEntry.progress
                                                      ? kenmei.chapters_read ||
                                                        0
                                                      : userEntry.progress;
                                                } else {
                                                  toProgress =
                                                    kenmei.chapters_read || 0;
                                                }
                                              } else {
                                                toProgress =
                                                  kenmei.chapters_read || 0;
                                              }

                                              // Only show badge if values are actually different
                                              if (fromProgress === toProgress)
                                                return null;

                                              return (
                                                <Badge
                                                  variant="outline"
                                                  className="border-green-400 px-1 py-0 text-[10px]"
                                                >
                                                  {fromProgress} → {toProgress}{" "}
                                                  ch
                                                </Badge>
                                              );
                                            })()}

                                            {(() => {
                                              if (!scoreWillChange) return null;

                                              const fromScore =
                                                userEntry?.score || 0;
                                              const toScore = kenmei.score || 0;

                                              // Only show badge if values are actually different
                                              if (fromScore === toScore)
                                                return null;

                                              return (
                                                <Badge
                                                  variant="outline"
                                                  className="border-amber-400 px-1 py-0 text-[10px]"
                                                >
                                                  {fromScore} → {toScore}/10
                                                </Badge>
                                              );
                                            })()}

                                            {userEntry
                                              ? syncConfig.setPrivate &&
                                                !userEntry.private && (
                                                  <Badge
                                                    variant="outline"
                                                    className="border-purple-400 px-1 py-0 text-[10px]"
                                                  >
                                                    {userEntry.private
                                                      ? "Yes"
                                                      : "No"}
                                                  </Badge>
                                                )
                                              : syncConfig.setPrivate && (
                                                  <Badge
                                                    variant="outline"
                                                    className="border-purple-400 px-1 py-0 text-[10px]"
                                                  >
                                                    {userEntry ? "Yes" : "No"}
                                                  </Badge>
                                                )}

                                            {changeCount === 0 && (
                                              <span className="text-muted-foreground px-1 text-[10px]">
                                                No Changes
                                              </span>
                                            )}
                                          </>
                                        )}

                                        {isNewEntry && (
                                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                            Adding to Library
                                          </span>
                                        )}

                                        {isCompleted && (
                                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                            Preserving Completed
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                          </AnimatePresence>

                          {/* Load more button for compact view */}
                          {sortedMangaMatches.length > 0 && (
                            <div className="bg-muted/20 py-3 text-center">
                              {sortedMangaMatches.length > visibleItems ? (
                                <Button
                                  onClick={() => {
                                    setIsLoadingMore(true);
                                    const newValue = Math.min(
                                      visibleItems + 20,
                                      sortedMangaMatches.length,
                                    );
                                    console.log(
                                      `Loading more items: ${visibleItems} → ${newValue}`,
                                    );

                                    // Add a small delay to show the loading spinner
                                    setTimeout(() => {
                                      setVisibleItems(newValue);
                                      setIsLoadingMore(false);
                                    }, 300);
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  disabled={isLoadingMore}
                                >
                                  {isLoadingMore && (
                                    <div className="text-primary inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                  )}
                                  {isLoadingMore
                                    ? "Loading..."
                                    : `Load More (${visibleItems} of ${sortedMangaMatches.length})`}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  All items loaded
                                </span>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartSync}
                    disabled={entriesWithChanges.length === 0 || libraryLoading}
                    className="relative"
                  >
                    Sync
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        );

      case "sync":
        return (
          <motion.div
            variants={pageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <SyncManager
              entries={entriesWithChanges}
              token={token || ""}
              onComplete={handleSyncComplete}
              onCancel={handleCancel}
              autoStart={false}
              syncState={state}
              syncActions={{
                ...actions,
                startSync: (entries, token, _unused, displayOrderMediaIds) =>
                  actions.startSync(
                    entries,
                    token,
                    _unused,
                    displayOrderMediaIds,
                  ),
              }}
              incrementalSync={syncConfig.incrementalSync}
              onIncrementalSyncChange={(value) => {
                const newConfig = { ...syncConfig, incrementalSync: value };
                setSyncConfig(newConfig);
                saveSyncConfig(newConfig);
              }}
              displayOrderMediaIds={entriesWithChanges
                .filter(Boolean)
                .map((e) => e.mediaId)}
            />
          </motion.div>
        );

      case "results": {
        if (state.report || wasCancelled) {
          return (
            <motion.div
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {state.report ? (
                <SyncResultsView
                  report={state.report}
                  onClose={handleGoHome}
                  onExportErrors={() =>
                    state.report && exportSyncErrorLog(state.report)
                  }
                />
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center">
                  <div className="mb-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  </div>
                  <div className="text-lg font-medium text-blue-700 dark:text-blue-300">
                    Loading synchronization results...
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-center gap-4">
                <Button onClick={handleGoHome} variant="default">
                  Go Home
                </Button>
                <Button onClick={handleBackToReview} variant="outline">
                  Back to Sync Review
                </Button>
              </div>
              {wasCancelled && (
                <div className="mt-4 text-center text-amber-600 dark:text-amber-400">
                  Synchronization was cancelled. No further entries will be
                  processed.
                </div>
              )}
            </motion.div>
          );
        } else {
          return (
            <motion.div
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Card className="mx-auto w-full max-w-md p-6 text-center">
                <CardContent>
                  <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                  <h3 className="text-lg font-medium">Synchronization Error</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {state.error ||
                      "An unknown error occurred during synchronization."}
                  </p>
                </CardContent>
                <CardFooter className="justify-center gap-4">
                  <Button onClick={handleGoHome}>Go Home</Button>
                  <Button onClick={handleBackToReview} variant="outline">
                    Back to Sync Review
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        }
      }
    }
  };

  return (
    <motion.div
      className="container py-6"
      initial="hidden"
      animate="visible"
      variants={pageVariants}
    >
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
    </motion.div>
  );
}

export default SyncPage;
