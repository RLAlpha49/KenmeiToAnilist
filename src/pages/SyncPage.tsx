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
import {
  UserMediaList,
  MangaMatchResult,
  UserMediaEntry,
  AniListManga,
} from "../api/anilist/types";
import { KenmeiManga } from "../api/kenmei/types";
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
import {
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  Layers,
  UserPlus,
} from "lucide-react";
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

  // Handle rate limit errors
  type ApiError = {
    isRateLimited?: boolean;
    status?: number;
    retryAfter?: number;
    message?: string;
    name?: string;
  };

  const handleRateLimitError = (
    error: ApiError,
    controller: AbortController,
    fetchLibrary: (attempt: number) => void,
  ) => {
    const err = error;

    console.warn("📛 DETECTED RATE LIMIT in SyncPage:", {
      isRateLimited: err.isRateLimited,
      status: err.status,
      retryAfter: err.retryAfter,
    });

    const retryDelay = err.retryAfter ? err.retryAfter : 60;

    setRateLimit(
      true,
      retryDelay,
      "AniList API rate limit reached. Waiting to retry...",
    );
    setLibraryLoading(false);
    setLibraryError("AniList API rate limit reached. Waiting to retry...");

    const timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        console.log("Rate limit timeout complete, retrying...");
        setLibraryLoading(true);
        setLibraryError(null);
        fetchLibrary(0);
      }
    }, retryDelay * 1000);

    return () => clearTimeout(timer);
  };

  // Handle server errors with retry logic
  const handleServerError = (
    error: ApiError,
    attempt: number,
    controller: AbortController,
    fetchLibrary: (attempt: number) => void,
  ) => {
    const err = error;

    const message = err.message || "";
    const isServerError =
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.toLowerCase().includes("network error");

    if (!isServerError || attempt >= maxRetries) {
      return false;
    }

    const backoffDelay = Math.pow(2, attempt) * 1000;
    setLibraryError(
      `AniList server error. Retrying in ${backoffDelay / 1000} seconds (${attempt + 1}/${maxRetries})...`,
    );

    const timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        fetchLibrary(attempt + 1);
      }
    }, backoffDelay);

    return () => clearTimeout(timer);
  };

  // Handle fetch library success
  const handleFetchSuccess = (library: UserMediaList) => {
    console.log(
      `Loaded ${Object.keys(library).length} entries from user's AniList library`,
    );
    setUserLibrary(library);
    setLibraryLoading(false);
    setLibraryError(null);
    setRetryCount(0);
  };

  // Handle fetch library error
  const handleFetchError = (
    error: ApiError,
    attempt: number,
    controller: AbortController,
    fetchLibrary: (attempt: number) => void,
  ) => {
    const err = error;
    if (err.name === "AbortError") return;

    console.error("Failed to load user library:", err);
    console.log("Error object structure:", JSON.stringify(err, null, 2));

    // Check for rate limiting
    if (err.isRateLimited || err.status === 429) {
      return handleRateLimitError(err, controller, fetchLibrary);
    }

    // Check for server error
    const serverErrorResult = handleServerError(
      err,
      attempt,
      controller,
      fetchLibrary,
    );
    if (serverErrorResult) {
      return serverErrorResult;
    }

    // Default error handling
    setLibraryError(
      err.message ||
        "Failed to load your AniList library. Synchronization can still proceed, but comparison data will not be shown.",
    );
    setUserLibrary({});
    setLibraryLoading(false);
  };

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
          .then(handleFetchSuccess)
          .catch((error) => {
            handleFetchError(error, attempt, controller, fetchLibrary);
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

  const totalMatchedManga = useMemo(
    () => mangaMatches.filter((match) => match.status !== "skipped").length,
    [mangaMatches],
  );

  const newEntriesCount = useMemo(
    () =>
      mangaMatches.filter(
        (match) => match.selectedMatch && !userLibrary[match.selectedMatch.id],
      ).length,
    [mangaMatches, userLibrary],
  );

  const manualMatchesCount = useMemo(
    () => mangaMatches.filter((match) => match.status === "manual").length,
    [mangaMatches],
  );

  const queuedPercentage = useMemo(() => {
    if (totalMatchedManga === 0) {
      return 0;
    }

    return Math.round((entriesWithChanges.length / totalMatchedManga) * 100);
  }, [entriesWithChanges.length, totalMatchedManga]);

  const heroStats = useMemo(
    () => [
      {
        label: "Ready to sync",
        value: entriesWithChanges.length,
        helper: "entries queued",
        icon: CheckCircle2,
        accent:
          "from-emerald-400/80 via-emerald-400/10 to-transparent dark:from-emerald-500/60 dark:via-emerald-500/5",
      },
      {
        label: "Total matches",
        value: totalMatchedManga,
        helper: `${queuedPercentage}% prepared`,
        icon: Layers,
        accent:
          "from-sky-400/70 via-sky-400/10 to-transparent dark:from-sky-500/50 dark:via-sky-500/5",
      },
      {
        label: "New additions",
        value: newEntriesCount,
        helper: "not yet in AniList",
        icon: UserPlus,
        accent:
          "from-purple-400/80 via-purple-400/10 to-transparent dark:from-purple-500/60 dark:via-purple-500/5",
      },
    ],
    [
      entriesWithChanges.length,
      totalMatchedManga,
      newEntriesCount,
      manualMatchesCount,
      queuedPercentage,
    ],
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

  const renderStatusBadge = (
    statusWillChange: boolean,
    userEntry: UserMediaEntry | undefined,
    kenmei: KenmeiManga,
    syncConfig: SyncConfig,
  ) => {
    if (!statusWillChange) return null;

    const fromStatus = userEntry?.status || "None";
    const toStatus = getEffectiveStatus(kenmei, syncConfig);

    if (fromStatus === toStatus) return null;

    return (
      <Badge
        variant="outline"
        className="border-blue-400/70 bg-blue-50/60 px-2 py-0 text-[10px] text-blue-600 shadow-sm dark:border-blue-500/40 dark:bg-blue-900/40 dark:text-blue-300"
      >
        {fromStatus} → {toStatus}
      </Badge>
    );
  };

  const renderProgressBadge = (
    progressWillChange: boolean,
    userEntry: UserMediaEntry | undefined,
    kenmei: KenmeiManga,
    syncConfig: SyncConfig,
  ) => {
    if (!progressWillChange) return null;

    const fromProgress = userEntry?.progress || 0;
    let toProgress: number;

    if (syncConfig.prioritizeAniListProgress) {
      if (userEntry?.progress && userEntry.progress > 0) {
        toProgress =
          (kenmei.chapters_read || 0) > userEntry.progress
            ? kenmei.chapters_read || 0
            : userEntry.progress;
      } else {
        toProgress = kenmei.chapters_read || 0;
      }
    } else {
      toProgress = kenmei.chapters_read || 0;
    }

    if (fromProgress === toProgress) return null;

    return (
      <Badge
        variant="outline"
        className="border-green-400/70 bg-green-50/60 px-2 py-0 text-[10px] text-green-600 shadow-sm dark:border-green-500/40 dark:bg-green-900/30 dark:text-green-300"
      >
        {fromProgress} → {toProgress} ch
      </Badge>
    );
  };

  const renderScoreBadge = (
    scoreWillChange: boolean,
    userEntry: UserMediaEntry | undefined,
    kenmei: KenmeiManga,
  ) => {
    if (!scoreWillChange) return null;

    const fromScore = userEntry?.score || 0;
    const toScore = kenmei.score || 0;

    if (fromScore === toScore) return null;

    return (
      <Badge
        variant="outline"
        className="border-amber-400/70 bg-amber-50/60 px-2 py-0 text-[10px] text-amber-600 shadow-sm dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-300"
      >
        {fromScore} → {toScore}/10
      </Badge>
    );
  };

  const renderPrivacyBadge = (
    userEntry: UserMediaEntry | undefined,
    syncConfig: SyncConfig,
  ) => {
    const shouldShowBadge = userEntry
      ? syncConfig.setPrivate && !userEntry.private
      : syncConfig.setPrivate;

    if (!shouldShowBadge) return null;

    return (
      <Badge
        variant="outline"
        className="border-purple-400/70 bg-purple-50/60 px-2 py-0 text-[10px] text-purple-600 shadow-sm dark:border-purple-500/40 dark:bg-purple-900/30 dark:text-purple-300"
      >
        {userEntry ? "Yes" : "No"}
      </Badge>
    );
  };

  const renderPrivacyDisplay = (
    userEntry: UserMediaEntry | undefined,
    syncConfig: SyncConfig,
    isCurrentAniList: boolean,
  ) => {
    let privacyClass = "text-xs font-medium";
    const willChange = userEntry
      ? syncConfig.setPrivate && !userEntry.private
      : syncConfig.setPrivate;

    if (isCurrentAniList) {
      if (willChange) {
        privacyClass += " text-muted-foreground line-through";
      }
      return (
        <span className={privacyClass}>
          {userEntry?.private ? "Yes" : "No"}
        </span>
      );
    } else {
      if (willChange) {
        privacyClass += " text-blue-700 dark:text-blue-300";
      }
      const privacyDisplay =
        syncConfig.setPrivate || userEntry?.private ? "Yes" : "No";
      return <span className={privacyClass}>{privacyDisplay}</span>;
    }
  };

  const renderAfterSyncProgress = (
    userEntry: UserMediaEntry | undefined,
    kenmei: KenmeiManga,
    anilist: AniListManga | undefined,
    syncConfig: SyncConfig,
    progressWillChange: boolean,
  ) => {
    let afterSyncProgress: number;
    if (syncConfig.prioritizeAniListProgress) {
      if (userEntry?.progress && userEntry.progress > 0) {
        afterSyncProgress =
          (kenmei.chapters_read || 0) > userEntry.progress
            ? kenmei.chapters_read || 0
            : userEntry.progress;
      } else {
        afterSyncProgress = kenmei.chapters_read || 0;
      }
    } else {
      afterSyncProgress = kenmei.chapters_read || 0;
    }

    return (
      <span
        className={`text-xs font-medium ${
          progressWillChange ? "text-blue-700 dark:text-blue-300" : ""
        }`}
      >
        {afterSyncProgress} ch
        {anilist?.chapters ? ` / ${anilist.chapters}` : ""}
      </span>
    );
  };

  const renderAfterSyncScore = (
    userEntry: UserMediaEntry | undefined,
    kenmei: KenmeiManga,
    scoreWillChange: boolean,
  ) => {
    let scoreDisplay: string;
    if (scoreWillChange) {
      scoreDisplay = kenmei.score ? `${kenmei.score}/10` : "None";
    } else {
      scoreDisplay = userEntry?.score ? `${userEntry.score}/10` : "None";
    }

    return (
      <span
        className={`text-xs font-medium ${
          scoreWillChange ? "text-blue-700 dark:text-blue-300" : ""
        }`}
      >
        {scoreDisplay}
      </span>
    );
  };

  // Helper function to render manga cover image
  const renderMangaCover = (
    anilist: AniListManga | undefined,
    isNewEntry: boolean,
    isCompleted: boolean,
  ) => {
    return (
      <div className="relative flex h-[200px] flex-shrink-0 items-center justify-center pl-3">
        {anilist?.coverImage?.large || anilist?.coverImage?.medium ? (
          <motion.div
            layout="position"
            animate={{
              transition: { type: false },
            }}
          >
            <img
              src={anilist?.coverImage?.large || anilist?.coverImage?.medium}
              alt={anilist?.title?.romaji || ""}
              className="h-full w-[145px] rounded-sm object-cover"
            />
          </motion.div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-sm bg-slate-200 dark:bg-slate-800">
            <span className="text-muted-foreground text-xs">No Cover</span>
          </div>
        )}

        {/* Status Badges */}
        <div className="absolute top-2 left-4 flex flex-col gap-1">
          {isNewEntry && <Badge className="bg-emerald-500">New</Badge>}
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
    );
  };

  // Helper function to render change badges
  const renderChangeBadges = (
    statusWillChange: boolean,
    progressWillChange: boolean,
    scoreWillChange: boolean,
    userEntry: UserMediaEntry | undefined,
    syncConfig: SyncConfig,
  ) => {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {statusWillChange && (
          <Badge
            variant="outline"
            className="border-blue-400/70 bg-blue-50/60 px-1.5 py-0 text-xs text-blue-600 shadow-sm dark:border-blue-500/50 dark:bg-blue-900/40 dark:text-blue-300"
          >
            Status
          </Badge>
        )}
        {progressWillChange && (
          <Badge
            variant="outline"
            className="border-green-400/70 bg-green-50/60 px-1.5 py-0 text-xs text-green-600 shadow-sm dark:border-green-500/50 dark:bg-green-900/30 dark:text-green-300"
          >
            Progress
          </Badge>
        )}
        {scoreWillChange && (
          <Badge
            variant="outline"
            className="border-amber-400/70 bg-amber-50/60 px-1.5 py-0 text-xs text-amber-600 shadow-sm dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-300"
          >
            Score
          </Badge>
        )}
        {userEntry
          ? syncConfig.setPrivate &&
            !userEntry.private && (
              <Badge
                variant="outline"
                className="border-purple-400/70 bg-purple-50/60 px-1.5 py-0 text-xs text-purple-600 shadow-sm dark:border-purple-500/50 dark:bg-purple-900/30 dark:text-purple-300"
              >
                Privacy
              </Badge>
            )
          : syncConfig.setPrivate && (
              <Badge
                variant="outline"
                className="border-purple-400/70 bg-purple-50/60 px-1.5 py-0 text-xs text-purple-600 shadow-sm dark:border-purple-500/50 dark:bg-purple-900/30 dark:text-purple-300"
              >
                Privacy
              </Badge>
            )}
      </div>
    );
  };

  // Helper function to render current AniList data
  const renderCurrentAniListData = (
    userEntry: UserMediaEntry | undefined,
    anilist: AniListManga | undefined,
    statusWillChange: boolean,
    progressWillChange: boolean,
    scoreWillChange: boolean,
    syncConfig: SyncConfig,
  ) => {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Status:</span>
          <span
            className={`text-xs font-medium ${statusWillChange ? "text-muted-foreground line-through" : ""}`}
          >
            {userEntry?.status || "None"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Progress:</span>
          <span
            className={`text-xs font-medium ${progressWillChange ? "text-muted-foreground line-through" : ""}`}
          >
            {userEntry?.progress || 0} ch
            {anilist?.chapters ? ` / ${anilist.chapters}` : ""}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Score:</span>
          <span
            className={`text-xs font-medium ${scoreWillChange ? "text-muted-foreground line-through" : ""}`}
          >
            {userEntry?.score ? `${userEntry.score}/10` : "None"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Private:</span>
          {renderPrivacyDisplay(userEntry, syncConfig, true)}
        </div>
      </div>
    );
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
            <motion.div variants={cardVariants} className="space-y-6">
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/60"
              >
                <div className="pointer-events-none absolute inset-0 opacity-80">
                  <div className="absolute top-[-6rem] left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/50 to-indigo-400/50 blur-3xl dark:from-blue-500/25 dark:to-indigo-500/25" />
                  <div className="absolute right-[-3rem] bottom-[-4rem] h-40 w-40 rounded-full bg-gradient-to-br from-slate-200/70 to-transparent blur-3xl dark:from-slate-800/40" />
                </div>
                <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-xl space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      Finalize your AniList library updates
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Review detected changes, tune your syncing preferences,
                      and push a polished update to AniList.
                    </p>
                  </div>
                  <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto">
                    {heroStats.map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={stat.label}
                          className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/70"
                        >
                          <div
                            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.accent} opacity-80`}
                          />
                          <div className="relative flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="pr-2 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                                {stat.label}
                              </span>
                              <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            </div>
                            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                              {stat.value}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {stat.helper}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.section>

              <Card className="border border-slate-200/70 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/60">
                <CardHeader className="space-y-2">
                  <CardTitle className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-2xl font-semibold text-transparent dark:from-slate-100 dark:via-slate-300 dark:to-slate-100">
                    Sync Preview
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                    Review the changes that will be applied to your AniList
                    account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/40">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            Sync readiness
                          </span>
                          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {entriesWithChanges.length} of {totalMatchedManga}{" "}
                            entries prepared
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Automatically excludes skipped matches and completed
                            entries preserved per your settings.
                          </p>
                        </div>
                        <div className="flex w-full items-center gap-3 sm:w-auto">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-200/80 bg-white/80 text-sm font-semibold text-blue-600 dark:border-blue-700/80 dark:bg-blue-900/20 dark:text-blue-300">
                            {queuedPercentage}%
                          </div>
                          <div className="min-w-[140px] flex-1">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/60">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
                                style={{
                                  width: `${Math.min(queuedPercentage, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

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

                    {sortedMangaMatches.length !== mangaMatches.length && (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-sm shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
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
                          className="h-7 rounded-full border border-transparent px-3 text-xs hover:border-slate-300 hover:bg-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
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
                                      <Card className="group overflow-hidden border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200/70 hover:shadow-xl dark:border-slate-800/60 dark:bg-slate-950/60">
                                        <div className="flex">
                                          {/* Manga Cover Image */}
                                          {renderMangaCover(
                                            anilist,
                                            isNewEntry,
                                            isCompleted,
                                          )}

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
                                                  renderChangeBadges(
                                                    statusWillChange,
                                                    progressWillChange,
                                                    scoreWillChange,
                                                    userEntry,
                                                    syncConfig,
                                                  )
                                                ) : (
                                                  <div className="mt-1">
                                                    <Badge
                                                      variant="outline"
                                                      className="border-slate-200/70 bg-slate-100/70 px-1.5 py-0 text-xs text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-400"
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
                                                  <div className="rounded-full bg-blue-100/80 px-2 py-1 text-xs font-medium text-blue-600 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
                                                    {changeCount} change
                                                    {changeCount === 1
                                                      ? ""
                                                      : "s"}
                                                  </div>
                                                )}
                                            </div>

                                            {/* Comparison Table */}
                                            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                              <div className="rounded-xl border border-slate-200/60 bg-white/70 p-3 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/40">
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
                                                  renderCurrentAniListData(
                                                    userEntry,
                                                    anilist,
                                                    statusWillChange,
                                                    progressWillChange,
                                                    scoreWillChange,
                                                    syncConfig,
                                                  )
                                                )}
                                              </div>

                                              <div className="rounded-xl border border-blue-100/60 bg-blue-50/70 p-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-900/20">
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
                                                    {renderAfterSyncProgress(
                                                      userEntry,
                                                      kenmei,
                                                      anilist,
                                                      syncConfig,
                                                      progressWillChange,
                                                    )}
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-xs text-blue-500 dark:text-blue-400">
                                                      Score:
                                                    </span>
                                                    {renderAfterSyncScore(
                                                      userEntry,
                                                      kenmei,
                                                      scoreWillChange,
                                                    )}
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-xs text-blue-500 dark:text-blue-400">
                                                      Private:
                                                    </span>
                                                    {renderPrivacyDisplay(
                                                      userEntry,
                                                      syncConfig,
                                                      false,
                                                    )}
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
                            className="space-y-1 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-950/50"
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

                                  const baseRowClasses =
                                    "group flex items-center rounded-xl px-3 py-2 transition-colors duration-200";
                                  let backgroundClass = "";
                                  if (isCompleted) {
                                    backgroundClass =
                                      "bg-amber-50/70 dark:bg-amber-950/20";
                                  } else if (isNewEntry) {
                                    backgroundClass =
                                      "bg-emerald-50/70 dark:bg-emerald-950/20";
                                  } else if (index % 2 === 0) {
                                    backgroundClass =
                                      "bg-white/70 dark:bg-slate-900/40";
                                  } else {
                                    backgroundClass =
                                      "bg-white/60 dark:bg-slate-900/30";
                                  }

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
                                        className={`${baseRowClasses} ${backgroundClass} hover:bg-blue-50/70 dark:hover:bg-slate-900/60`}
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
                                            {anilist.title.romaji ||
                                              kenmei.title}
                                          </div>
                                          <div className="mt-0.5 flex items-center gap-1">
                                            {isNewEntry && (
                                              <Badge className="bg-emerald-500/80 px-2 py-0 text-[10px] text-white shadow-sm">
                                                New
                                              </Badge>
                                            )}
                                            {isCompleted && (
                                              <Badge
                                                variant="outline"
                                                className="border-amber-400/70 bg-amber-50/60 px-2 py-0 text-[10px] text-amber-600 shadow-sm dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-300"
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
                                              {renderStatusBadge(
                                                statusWillChange,
                                                userEntry,
                                                kenmei,
                                                syncConfig,
                                              )}
                                              {renderProgressBadge(
                                                progressWillChange,
                                                userEntry,
                                                kenmei,
                                                syncConfig,
                                              )}
                                              {renderScoreBadge(
                                                scoreWillChange,
                                                userEntry,
                                                kenmei,
                                              )}
                                              {renderPrivacyBadge(
                                                userEntry,
                                                syncConfig,
                                              )}

                                              {changeCount === 0 && (
                                                <span className="px-1 text-[10px] text-slate-500 dark:text-slate-400">
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
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 border-t border-slate-200/60 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${entriesWithChanges.length > 0 ? "bg-emerald-500" : "bg-amber-500"}`}
                    ></span>
                    {entriesWithChanges.length > 0
                      ? `${entriesWithChanges.length} entries ready to sync`
                      : "No actionable changes detected yet"}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="w-full border-slate-300/70 text-slate-700 hover:border-slate-400 hover:bg-slate-100 sm:w-auto dark:border-slate-700/70 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleStartSync}
                      disabled={
                        entriesWithChanges.length === 0 || libraryLoading
                      }
                      className="group relative w-full overflow-hidden rounded-md bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-2 font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
                      <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="relative flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Launch Sync
                      </span>
                    </Button>
                  </div>
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
    <div className="relative min-h-0 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[8%] h-64 w-64 rounded-full bg-blue-200/50 blur-3xl dark:bg-blue-500/20" />
        <div className="absolute top-1/3 right-[-12%] h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/15" />
        <div className="absolute bottom-[-20%] left-1/2 h-[26rem] w-[40rem] -translate-x-1/2 bg-gradient-to-t from-slate-100 via-transparent to-transparent opacity-80 dark:from-slate-900/40" />
      </div>
      <motion.div
        className="relative z-10 container py-10"
        initial="hidden"
        animate="visible"
        variants={pageVariants}
      >
        <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
      </motion.div>
    </div>
  );
}

export default SyncPage;
