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
  AniListMediaEntry,
  UserMediaList,
  MediaListStatus,
} from "../api/anilist/types";
import { MangaMatchResult } from "../api/anilist/types";
import { STATUS_MAPPING, KenmeiStatus } from "../api/kenmei/types";
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
  Settings,
  Check,
  Filter,
  SortAsc,
} from "lucide-react";
import { exportSyncErrorLog } from "../utils/export-utils";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

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
  const [viewMode, setViewMode] = useState<"preview" | "sync" | "results">(
    "preview",
  );
  const { rateLimitState, setRateLimit } = useRateLimit();

  // Animation configs - remove unused variants
  const pageVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: 0.1,
      },
    },
  };

  const staggerContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  // Add a specific transition for view modes to prevent warping
  const viewModeTransition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.2,
  };

  // Create variants that only animate opacity, not size or position
  const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

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

  const getEffectiveStatus = (kenmei: {
    status: string;
    updated_at: string;
    last_read_at?: string;
    title: string;
  }): MediaListStatus => {
    // Check if manga should be auto-paused due to inactivity
    const lastActivity = kenmei.last_read_at || kenmei.updated_at;
    if (
      syncConfig.autoPauseInactive &&
      kenmei.status.toLowerCase() !== "completed" &&
      kenmei.status.toLowerCase() !== "dropped" &&
      lastActivity
    ) {
      // Calculate how many days since the last activity
      const lastUpdated = new Date(lastActivity);

      // Validate the parsed date
      if (isNaN(lastUpdated.getTime())) {
        console.warn(
          `[Auto-Pause Warning] Title: "${kenmei.title}" | Invalid date format: ${lastActivity}`,
        );
        return STATUS_MAPPING[kenmei.status as KenmeiStatus];
      }

      const daysSinceUpdate = Math.floor(
        (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Additional validation
      if (daysSinceUpdate < 0) {
        console.warn(
          `[Auto-Pause Warning] Title: "${kenmei.title}" | Negative days calculated (future date): ${daysSinceUpdate}`,
        );
        return STATUS_MAPPING[kenmei.status as KenmeiStatus];
      }

      // Check if using a custom threshold (not in predefined list)
      const isCustomThreshold = ![1, 7, 14, 30, 60, 90, 180, 365].includes(
        syncConfig.autoPauseThreshold,
      );
      const threshold = isCustomThreshold
        ? (syncConfig.customAutoPauseThreshold ?? 30)
        : syncConfig.autoPauseThreshold;

      // Validate threshold value
      const validThreshold =
        typeof threshold === "number" && threshold > 0 ? threshold : 30;
      if (validThreshold !== threshold) {
        console.warn(
          `[Auto-Pause Warning] Title: "${kenmei.title}" | Invalid threshold value: ${threshold}, using fallback: ${validThreshold}`,
        );
      }

      if (daysSinceUpdate >= validThreshold) {
        return "PAUSED";
      }
    }

    // Otherwise use the normal status mapping
    // Use type assertion for safety
    const status = kenmei.status as KenmeiStatus;
    return STATUS_MAPPING[status];
  };

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

  // View mode for displaying manga entries
  const [displayMode, setDisplayMode] = useState<"cards" | "compact">("cards");

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
  const [sortOption, setSortOption] = useState<{
    field: "title" | "status" | "progress" | "score" | "changes";
    direction: "asc" | "desc";
  }>({ field: "title", direction: "asc" });

  const [filters, setFilters] = useState({
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
    return mangaMatches
      .filter(
        (match) => match.status === "matched" || match.status === "manual",
      )
      .filter((match) => match.selectedMatch !== undefined)
      .filter((match) => {
        // Status filter
        if (filters.status !== "all") {
          const kenmeiStatus = match.kenmeiManga.status.toLowerCase();

          if (filters.status === "reading" && kenmeiStatus !== "reading")
            return false;
          if (filters.status === "completed" && kenmeiStatus !== "completed")
            return false;
          if (filters.status === "planned" && kenmeiStatus !== "plan_to_read")
            return false;
          if (filters.status === "paused" && kenmeiStatus !== "on_hold")
            return false;
          if (filters.status === "dropped" && kenmeiStatus !== "dropped")
            return false;
        }

        // Changes filter
        if (filters.changes !== "all") {
          const anilist = match.selectedMatch!;
          const kenmei = match.kenmeiManga;
          const userEntry = userLibrary[anilist.id];

          // Calculate if any changes will be made
          const isCompleted =
            userEntry &&
            userEntry.status === "COMPLETED" &&
            syncConfig.preserveCompletedStatus;

          // If completed and we're preserving completed status, no changes will be made
          if (isCompleted) {
            if (filters.changes === "with-changes") return false;
          } else {
            const statusWillChange = userEntry
              ? syncConfig.prioritizeAniListStatus
                ? false
                : getEffectiveStatus(kenmei) !== userEntry.status
              : true;

            const progressWillChange = userEntry
              ? syncConfig.prioritizeAniListProgress
                ? // Will only change if Kenmei has more chapters read than AniList
                  (kenmei.chapters_read || 0) > (userEntry.progress || 0)
                : (kenmei.chapters_read || 0) !== (userEntry.progress || 0)
              : true;

            const anilistScore = userEntry ? Number(userEntry.score || 0) : 0;
            const kenmeiScore = Number(kenmei.score || 0);

            const scoreWillChange = userEntry
              ? userEntry.status === "COMPLETED" &&
                syncConfig.preserveCompletedStatus
                ? false
                : syncConfig.prioritizeAniListScore && anilistScore > 0
                  ? false
                  : kenmeiScore > 0 &&
                    (anilistScore === 0 ||
                      Math.abs(kenmeiScore - anilistScore) >= 0.5)
              : kenmeiScore > 0;

            const hasChanges =
              statusWillChange ||
              progressWillChange ||
              scoreWillChange ||
              (syncConfig.setPrivate && userEntry && !userEntry.private);

            if (filters.changes === "with-changes" && !hasChanges) return false;
            if (filters.changes === "no-changes" && hasChanges) return false;
          }
        }

        // Library filter
        if (filters.library !== "all") {
          const anilist = match.selectedMatch!;
          const isNewEntry = !userLibrary[anilist.id];

          if (filters.library === "new" && !isNewEntry) return false;
          if (filters.library === "existing" && isNewEntry) return false;
        }

        return true;
      });
  }, [mangaMatches, filters, userLibrary, syncConfig]);

  // Apply sorting to filtered manga matches
  const sortedMangaMatches = useMemo(() => {
    return [...filteredMangaMatches].sort((a, b) => {
      const anilistA = a.selectedMatch!;
      const anilistB = b.selectedMatch!;
      const kenmeiA = a.kenmeiManga;
      const kenmeiB = b.kenmeiManga;

      // Calculate changes for sorting by changes
      const getChangeCount = (match: MangaMatchResult) => {
        const anilist = match.selectedMatch!;
        const kenmei = match.kenmeiManga;
        const userEntry = userLibrary[anilist.id];
        const isCompleted =
          userEntry &&
          userEntry.status === "COMPLETED" &&
          syncConfig.preserveCompletedStatus;

        if (isCompleted) return 0;
        if (!userEntry) return 3; // New entry, all fields will change

        const statusWillChange =
          !syncConfig.prioritizeAniListStatus &&
          getEffectiveStatus(kenmei) !== userEntry.status;

        const progressWillChange = syncConfig.prioritizeAniListProgress
          ? (kenmei.chapters_read || 0) > (userEntry.progress || 0)
          : (kenmei.chapters_read || 0) !== (userEntry.progress || 0);

        const anilistScore = Number(userEntry.score);
        const kenmeiScore = Number(kenmei.score || 0);

        const scoreWillChange =
          !syncConfig.prioritizeAniListScore &&
          kenmei.score > 0 &&
          (anilistScore === 0 || Math.abs(kenmeiScore - anilistScore) >= 0.5);

        // Check if privacy will change
        const privacyWillChange = syncConfig.setPrivate && !userEntry.private;

        return (
          (statusWillChange ? 1 : 0) +
          (progressWillChange ? 1 : 0) +
          (scoreWillChange ? 1 : 0) +
          (privacyWillChange ? 1 : 0)
        );
      };

      // Sort based on the selected field
      let comparison = 0;

      switch (sortOption.field) {
        case "title":
          comparison = (anilistA.title.romaji || kenmeiA.title).localeCompare(
            anilistB.title.romaji || kenmeiB.title,
          );
          break;
        case "status":
          comparison = kenmeiA.status.localeCompare(kenmeiB.status);
          break;
        case "progress":
          comparison =
            (kenmeiA.chapters_read || 0) - (kenmeiB.chapters_read || 0);
          break;
        case "score":
          comparison = (kenmeiA.score || 0) - (kenmeiB.score || 0);
          break;
        case "changes":
          comparison = getChangeCount(b) - getChangeCount(a);
          break;
        default:
          comparison = 0;
      }

      // Apply sort direction
      return sortOption.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredMangaMatches, sortOption, userLibrary, syncConfig]);

  // Compute all entries to sync (unfiltered, all with changes)
  const allEntriesToSync = useMemo(() => {
    return mangaMatches
      .filter(
        (match) => match.status === "matched" || match.status === "manual",
      )
      .filter((match) => match.selectedMatch !== undefined)
      .map((match) => {
        // Get Kenmei data
        const kenmei = match.kenmeiManga;
        const anilist = match.selectedMatch!;
        const userEntry = userLibrary[anilist.id];
        if (
          userEntry &&
          userEntry.status === "COMPLETED" &&
          syncConfig.preserveCompletedStatus
        ) {
          return null;
        }
        let calculatedStatus: MediaListStatus;
        if (
          syncConfig.autoPauseInactive &&
          kenmei.status.toLowerCase() !== "completed" &&
          kenmei.status.toLowerCase() !== "dropped"
        ) {
          // Use last_read_at if available, otherwise fall back to updated_at
          const lastActivity = kenmei.last_read_at || kenmei.updated_at;
          if (lastActivity) {
            const lastUpdated = new Date(lastActivity);

            // Validate the parsed date
            if (isNaN(lastUpdated.getTime())) {
              console.warn(
                `[Auto-Pause Warning 2] Title: "${kenmei.title}" | Invalid date format: ${lastActivity}`,
              );
              calculatedStatus = STATUS_MAPPING[kenmei.status];
            } else {
              const daysSinceUpdate = Math.floor(
                (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24),
              );

              // Additional validation
              if (daysSinceUpdate < 0) {
                console.warn(
                  `[Auto-Pause Warning 2] Title: "${kenmei.title}" | Negative days calculated (future date): ${daysSinceUpdate}`,
                );
                calculatedStatus = STATUS_MAPPING[kenmei.status];
              } else {
                // Check if using a custom threshold (not in predefined list)
                const isCustomThreshold = ![
                  1, 7, 14, 30, 60, 90, 180, 365,
                ].includes(syncConfig.autoPauseThreshold);
                const threshold = isCustomThreshold
                  ? (syncConfig.customAutoPauseThreshold ?? 30)
                  : syncConfig.autoPauseThreshold;

                // Validate threshold value
                const validThreshold =
                  typeof threshold === "number" && threshold > 0
                    ? threshold
                    : 30;
                if (validThreshold !== threshold) {
                  console.warn(
                    `[Auto-Pause Warning 2] Title: "${kenmei.title}" | Invalid threshold value: ${threshold}, using fallback: ${validThreshold}`,
                  );
                }

                if (daysSinceUpdate >= validThreshold) {
                  calculatedStatus = "PAUSED";
                } else {
                  calculatedStatus = STATUS_MAPPING[kenmei.status];
                }
              }
            }
          } else {
            calculatedStatus = STATUS_MAPPING[kenmei.status];
          }
        } else {
          calculatedStatus = STATUS_MAPPING[kenmei.status];
        }
        const privateStatus = userEntry
          ? syncConfig.setPrivate
            ? true
            : userEntry.private || false
          : syncConfig.setPrivate;
        const entry: AniListMediaEntry = {
          mediaId: anilist.id,
          status:
            syncConfig.prioritizeAniListStatus && userEntry?.status
              ? (userEntry.status as MediaListStatus)
              : calculatedStatus,
          progress:
            syncConfig.prioritizeAniListProgress &&
            userEntry?.progress &&
            userEntry.progress > 0
              ? userEntry.progress > (kenmei.chapters_read || 0)
                ? userEntry.progress
                : kenmei.chapters_read || 0
              : kenmei.chapters_read || 0,
          private: privateStatus,
          score:
            userEntry &&
            syncConfig.prioritizeAniListScore &&
            userEntry.score > 0
              ? userEntry.score
              : typeof kenmei.score === "number"
                ? kenmei.score
                : 0,
          previousValues: userEntry
            ? {
                status: userEntry.status,
                progress:
                  typeof userEntry.progress === "number"
                    ? userEntry.progress
                    : 0,
                score:
                  typeof userEntry.score === "number" ? userEntry.score : 0,
                private: userEntry.private || false,
              }
            : null,
          title: anilist.title.romaji || kenmei.title,
          coverImage: anilist.coverImage?.large || anilist.coverImage?.medium,
        };
        if (entry.private === undefined) {
          entry.private = syncConfig.setPrivate || false;
        }
        return entry;
      })
      .filter((entry) => entry !== null) as AniListMediaEntry[];
  }, [mangaMatches, userLibrary, syncConfig]);

  // Only sync entries with actual changes
  const hasChanges = (entry: AniListMediaEntry) => {
    // New entry: not in userLibrary
    if (!entry.previousValues) return true;

    // Completed and preserve setting: skip
    if (
      entry.previousValues.status === "COMPLETED" &&
      syncConfig.preserveCompletedStatus
    ) {
      return false;
    }

    // Status change
    const statusWillChange = syncConfig.prioritizeAniListStatus
      ? false
      : entry.status !== entry.previousValues.status;

    // Progress change
    const progressWillChange = syncConfig.prioritizeAniListProgress
      ? entry.progress > entry.previousValues.progress
      : entry.progress !== entry.previousValues.progress;

    // Score change
    const anilistScore = Number(entry.previousValues.score || 0);
    const kenmeiScore = Number(entry.score || 0);
    const scoreWillChange =
      entry.previousValues.status === "COMPLETED" &&
      syncConfig.preserveCompletedStatus
        ? false
        : syncConfig.prioritizeAniListScore && anilistScore > 0
          ? false
          : kenmeiScore > 0 &&
            (anilistScore === 0 || Math.abs(kenmeiScore - anilistScore) >= 0.5);

    // Privacy change
    const privacyWillChange =
      syncConfig.setPrivate && !entry.previousValues.private;

    return (
      statusWillChange ||
      progressWillChange ||
      scoreWillChange ||
      privacyWillChange
    );
  };
  const entriesWithChanges = useMemo(
    () => allEntriesToSync.filter(hasChanges),
    [allEntriesToSync],
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
    setLibraryLoading(true);
    setLibraryError(null);
    setRetryCount(0);
    setRateLimit(false, undefined, undefined);

    const controller = new AbortController();

    getUserMangaList(token, controller.signal)
      .then((library) => {
        setUserLibrary(library);
        setLibraryLoading(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          if (error.isRateLimited || error.status === 429) {
            const retryDelay = error.retryAfter ? error.retryAfter : 60;
            setRateLimit(
              true,
              retryDelay,
              "AniList API rate limit reached. Waiting to retry...",
            );
          } else {
            setLibraryError(
              error.message ||
                "Failed to load your AniList library. Synchronization can still proceed without comparison data.",
            );
          }
          setUserLibrary({});
          setLibraryLoading(false);
        }
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
      <div className="container py-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          <Card
            className={`mx-auto w-full max-w-md overflow-hidden text-center ${authError ? "border-amber-200 bg-amber-50/30 dark:border-amber-800/30 dark:bg-amber-900/10" : ""}`}
          >
            <CardContent className="pt-6 pb-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>

              {authError && (
                <>
                  <h3 className="text-lg font-medium">
                    Authentication Required
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    You need to be authenticated with AniList to synchronize
                    your manga.
                  </p>
                  <Button
                    onClick={() => navigate({ to: "/settings" })}
                    className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Go to Settings
                  </Button>
                </>
              )}

              {matchDataError && !authError && (
                <>
                  <h3 className="text-lg font-medium">Missing Match Data</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    No matched manga found. You need to match your manga with
                    AniList entries first.
                  </p>
                  <Button
                    onClick={() => navigate({ to: "/review" })}
                    className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Go to Matching Page
                  </Button>
                </>
              )}

              {validMatchesError && !authError && !matchDataError && (
                <>
                  <h3 className="text-lg font-medium">No Valid Matches</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    No approved matches found. You need to review and accept
                    manga matches before synchronizing.
                  </p>
                  <Button
                    onClick={() => navigate({ to: "/review" })}
                    className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Review Matches
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // If no manga matches are loaded yet, show loading state
  if (mangaMatches.length === 0) {
    return (
      <div className="container py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="mx-auto w-full max-w-md text-center">
            <CardContent className="pt-6">
              <div
                className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent text-blue-600"
                role="status"
                aria-label="loading"
              >
                <span className="sr-only">Loading...</span>
              </div>
              <h3 className="text-lg font-medium">
                Loading Synchronization Data
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Please wait while we load your matched manga data...
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // If library is loading, show loading state
  if (libraryLoading) {
    return (
      <div className="container py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="mx-auto w-full max-w-md text-center">
            <CardContent className="pt-6">
              <div
                className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent text-blue-600"
                role="status"
                aria-label="loading"
              >
                <span className="sr-only">Loading...</span>
              </div>
              <h3 className="text-lg font-medium">
                {rateLimitState.isRateLimited
                  ? "Synchronization Paused"
                  : "Loading Your AniList Library"}
              </h3>
              {!rateLimitState.isRateLimited && (
                <p className="mt-2 text-sm text-slate-500">
                  {retryCount > 0
                    ? `Server error encountered. Retrying (${retryCount}/${maxRetries})...`
                    : "Please wait while we fetch your AniList library data for comparison..."}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
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
                  {/* Sync Configuration */}
                  <Collapsible className="mb-4">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex w-full items-center justify-between p-3"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Sync Configuration
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Click to expand
                        </span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 rounded-md border bg-slate-50 p-4 dark:bg-slate-900">
                      <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="prioritizeAniListStatus"
                              className="flex-1 text-sm"
                            >
                              Prioritize AniList status
                              <span className="text-muted-foreground block text-xs">
                                When enabled, keeps your existing AniList status
                              </span>
                            </Label>
                            <Switch
                              id="prioritizeAniListStatus"
                              checked={syncConfig.prioritizeAniListStatus}
                              onCheckedChange={() =>
                                handleToggleOption("prioritizeAniListStatus")
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="preserveCompletedStatus"
                              className="flex-1 text-sm"
                            >
                              Preserve Completed Status
                              <span className="text-muted-foreground block text-xs">
                                Always preserve entries marked as COMPLETED in
                                AniList
                              </span>
                            </Label>
                            <Switch
                              id="preserveCompletedStatus"
                              checked={syncConfig.preserveCompletedStatus}
                              onCheckedChange={() =>
                                handleToggleOption("preserveCompletedStatus")
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="prioritizeAniListProgress"
                              className="flex-1 text-sm"
                            >
                              Prioritize AniList progress
                              <span className="text-muted-foreground block text-xs">
                                When enabled, keeps higher chapter counts from
                                AniList (Does not apply when the prioritized
                                source is 0 or none/null)
                              </span>
                            </Label>
                            <Switch
                              id="prioritizeAniListProgress"
                              checked={syncConfig.prioritizeAniListProgress}
                              onCheckedChange={() =>
                                handleToggleOption("prioritizeAniListProgress")
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="prioritizeAniListScore"
                              className="flex-1 text-sm"
                            >
                              Prioritize AniList scores
                              <span className="text-muted-foreground block text-xs">
                                When enabled, keeps your existing AniList scores
                                (Does not apply when the prioritized source is
                                none/null)
                              </span>
                            </Label>
                            <Switch
                              id="prioritizeAniListScore"
                              checked={syncConfig.prioritizeAniListScore}
                              onCheckedChange={() =>
                                handleToggleOption("prioritizeAniListScore")
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="setPrivate"
                              className="flex-1 text-sm"
                            >
                              Set entries as private
                              <span className="text-muted-foreground block text-xs">
                                When enabled, sets entries as private.
                                Doesn&apos;t change existing private settings.
                              </span>
                            </Label>
                            <Switch
                              id="setPrivate"
                              checked={syncConfig.setPrivate}
                              onCheckedChange={() =>
                                handleToggleOption("setPrivate")
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="autoPauseInactive"
                              className="flex-1 text-sm"
                            >
                              Auto-pause inactive manga
                              <span className="text-muted-foreground block text-xs">
                                When enabled, sets manga as PAUSED if not
                                updated recently (Can specify the period)
                              </span>
                            </Label>
                            <Switch
                              id="autoPauseInactive"
                              checked={syncConfig.autoPauseInactive}
                              onCheckedChange={() =>
                                handleToggleOption("autoPauseInactive")
                              }
                            />
                          </div>
                        </div>

                        {syncConfig.autoPauseInactive && (
                          <div className="mt-2 border-l-2 border-slate-200 pl-2 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor="autoPauseThreshold"
                                className="text-sm whitespace-nowrap"
                              >
                                Pause after
                              </Label>
                              {!useCustomThreshold ? (
                                <select
                                  id="autoPauseThreshold"
                                  value={syncConfig.autoPauseThreshold}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "custom") {
                                      setUseCustomThreshold(true);
                                    } else {
                                      setSyncConfig((prev) => {
                                        const newConfig = {
                                          ...prev,
                                          autoPauseThreshold: Number(value),
                                        };
                                        saveSyncConfig(newConfig);
                                        return newConfig;
                                      });
                                    }
                                  }}
                                  className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                                >
                                  <option value="1">1 day</option>
                                  <option value="7">7 days</option>
                                  <option value="14">14 days</option>
                                  <option value="30">30 days</option>
                                  <option value="60">2 months</option>
                                  <option value="90">3 months</option>
                                  <option value="180">6 months</option>
                                  <option value="365">1 year</option>
                                  <option value="custom">Custom...</option>
                                </select>
                              ) : (
                                <div className="flex w-full items-center gap-2">
                                  <input
                                    id="customAutoPauseThreshold"
                                    type="number"
                                    min="1"
                                    placeholder="Enter days"
                                    value={syncConfig.autoPauseThreshold.toString()}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value);
                                      if (!isNaN(value) && value > 0) {
                                        setSyncConfig((prev) => {
                                          const newConfig = {
                                            ...prev,
                                            autoPauseThreshold: value,
                                          };
                                          saveSyncConfig(newConfig);
                                          return newConfig;
                                        });
                                      }
                                    }}
                                    className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                                  />
                                  <Button
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => setUseCustomThreshold(false)}
                                  >
                                    Use Presets
                                  </Button>
                                </div>
                              )}
                            </div>

                            <p className="text-muted-foreground mt-1 text-xs">
                              Manga not updated for this period will be set to
                              PAUSED
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Summary of changes */}
                  <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <h3 className="flex items-center text-sm font-medium">
                      <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                      Changes Summary
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {entriesWithChanges.length} entries will be synchronized
                      to your AniList account.
                    </p>

                    {libraryLoading && (
                      <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading your AniList library for comparison...
                      </div>
                    )}

                    {libraryError && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        {!rateLimitState.isRateLimited && (
                          <span>{libraryError}</span>
                        )}

                        {/* Only show Try Again button when not rate limited */}
                        {!rateLimitState.isRateLimited && (
                          <Button
                            variant="link"
                            className="h-auto px-0 py-0 text-xs"
                            onClick={() => {
                              setLibraryLoading(true);
                              setLibraryError(null);
                              setRetryCount(0);
                              setRateLimit(false, undefined, undefined);

                              const controller = new AbortController();

                              getUserMangaList(token, controller.signal)
                                .then((library) => {
                                  console.log(
                                    `Loaded ${Object.keys(library).length} entries from user's AniList library`,
                                  );
                                  setUserLibrary(library);
                                  setLibraryLoading(false);
                                })
                                .catch((error) => {
                                  if (error.name !== "AbortError") {
                                    console.error(
                                      "Failed to load user library again:",
                                      error,
                                    );

                                    // Check for rate limiting - with our new client updates, this should be more reliable
                                    if (
                                      error.isRateLimited ||
                                      error.status === 429
                                    ) {
                                      console.warn(
                                        "📛 DETECTED RATE LIMIT in SyncPage:",
                                        {
                                          isRateLimited: error.isRateLimited,
                                          status: error.status,
                                          retryAfter: error.retryAfter,
                                        },
                                      );

                                      const retryDelay = error.retryAfter
                                        ? error.retryAfter
                                        : 60;
                                      const retryTimestamp =
                                        Date.now() + retryDelay;

                                      console.log(
                                        `Setting rate limited state with retry after: ${retryTimestamp} (in ${retryDelay / 1000}s)`,
                                      );

                                      setRateLimit(
                                        true,
                                        retryDelay,
                                        "AniList API rate limit reached. Waiting to retry...",
                                      );
                                    } else {
                                      setLibraryError(
                                        error.message ||
                                          "Failed to load your AniList library. Synchronization can still proceed without comparison data.",
                                      );
                                    }

                                    setUserLibrary({});
                                    setLibraryLoading(false);
                                  }
                                });
                            }}
                          >
                            Try Again
                          </Button>
                        )}
                      </div>
                    )}

                    {!libraryLoading &&
                      !libraryError &&
                      userLibrary &&
                      Object.keys(userLibrary).length > 0 && (
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                            <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                            <span>
                              Found{" "}
                              <span className="font-semibold">
                                {Object.keys(userLibrary).length}
                              </span>{" "}
                              unique entries in your AniList library for
                              comparison
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setLibraryLoading(true);
                              setLibraryError(null);
                              setRetryCount(0);
                              setRateLimit(false, undefined, undefined);

                              const controller = new AbortController();

                              getUserMangaList(token, controller.signal)
                                .then((library) => {
                                  console.log(
                                    `Loaded ${Object.keys(library).length} entries from user's AniList library`,
                                  );
                                  setUserLibrary(library);
                                  setLibraryLoading(false);
                                })
                                .catch((error) => {
                                  if (error.name !== "AbortError") {
                                    console.error(
                                      "Failed to load user library again:",
                                      error,
                                    );

                                    // Check for rate limiting - with our new client updates, this should be more reliable
                                    if (
                                      error.isRateLimited ||
                                      error.status === 429
                                    ) {
                                      console.warn(
                                        "📛 DETECTED RATE LIMIT in SyncPage:",
                                        {
                                          isRateLimited: error.isRateLimited,
                                          status: error.status,
                                          retryAfter: error.retryAfter,
                                        },
                                      );

                                      const retryDelay = error.retryAfter
                                        ? error.retryAfter
                                        : 60;
                                      const retryTimestamp =
                                        Date.now() + retryDelay;

                                      console.log(
                                        `Setting rate limited state with retry after: ${retryTimestamp} (in ${retryDelay / 1000}s)`,
                                      );

                                      setRateLimit(
                                        true,
                                        retryDelay,
                                        "AniList API rate limit reached. Waiting to retry...",
                                      );
                                    } else {
                                      setLibraryError(
                                        error.message ||
                                          "Failed to load your AniList library. Synchronization can still proceed without comparison data.",
                                      );
                                    }

                                    setUserLibrary({});
                                    setLibraryLoading(false);
                                  }
                                });
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mr-1"
                            >
                              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                              <path d="M21 3v5h-5" />
                              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                              <path d="M8 16H3v5" />
                            </svg>
                            Refresh
                          </Button>
                        </div>
                      )}

                    {!libraryLoading && !libraryError && (
                      <div className="mt-4 rounded bg-blue-50 p-2 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        <div className="mb-1 font-semibold">
                          Manga Statistics:
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">
                              Kenmei manga:
                            </span>{" "}
                            {mangaMatches.length}
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">
                              AniList library:
                            </span>{" "}
                            {Object.keys(userLibrary).length}
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">
                              New entries:
                            </span>{" "}
                            {
                              mangaMatches.filter(
                                (match) =>
                                  match.selectedMatch &&
                                  !userLibrary[match.selectedMatch.id],
                              ).length
                            }
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">
                              Updates:
                            </span>{" "}
                            {
                              mangaMatches.filter((match) => {
                                // Only count manga that will actually have changes
                                if (!match.selectedMatch) return false;

                                const anilist = match.selectedMatch;
                                const kenmei = match.kenmeiManga;
                                const userEntry = userLibrary[anilist.id];

                                // Skip if not in user library or if completed and we're preserving completed status
                                if (
                                  !userEntry ||
                                  (userEntry.status === "COMPLETED" &&
                                    syncConfig.preserveCompletedStatus)
                                ) {
                                  return false;
                                }

                                // Check if any values will change based on sync configuration
                                const statusWillChange = userEntry
                                  ? syncConfig.prioritizeAniListStatus
                                    ? false
                                    : getEffectiveStatus(kenmei) !==
                                      userEntry.status
                                  : true;

                                const progressWillChange =
                                  syncConfig.prioritizeAniListProgress
                                    ? // Will only change if Kenmei has more chapters read than AniList
                                      (kenmei.chapters_read || 0) >
                                      (userEntry.progress || 0)
                                    : (kenmei.chapters_read || 0) !==
                                      (userEntry.progress || 0);

                                const anilistScore = Number(
                                  userEntry.score || 0,
                                );
                                const kenmeiScore = Number(kenmei.score || 0);
                                const scoreWillChange =
                                  syncConfig.prioritizeAniListScore &&
                                  userEntry.score &&
                                  Number(userEntry.score) > 0
                                    ? false
                                    : kenmei.score > 0 &&
                                      (anilistScore === 0 ||
                                        Math.abs(kenmeiScore - anilistScore) >=
                                          0.5);

                                // Check if privacy will change
                                const privacyWillChange =
                                  syncConfig.setPrivate && !userEntry.private;

                                // Count entry only if at least one value will change
                                return (
                                  statusWillChange ||
                                  progressWillChange ||
                                  scoreWillChange ||
                                  privacyWillChange
                                );
                              }).length
                            }
                          </div>
                        </div>

                        <div className="mt-2 border-t border-blue-200 pt-2 text-amber-600 dark:border-blue-800 dark:text-amber-400">
                          <strong className="text-xs">Note:</strong> Media
                          entries with &ldquo;Hide from status lists&rdquo;
                          option set to true and not associated with any custom
                          lists will not be returned by the query and will be
                          treated as not in your library.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    {/* Display Mode Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">
                        View:
                      </span>
                      <div className="border-input bg-background inline-flex items-center rounded-md border p-1">
                        <Button
                          variant={
                            displayMode === "cards" ? "default" : "ghost"
                          }
                          size="sm"
                          className="h-8 rounded-sm px-2"
                          onClick={() => setDisplayMode("cards")}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <rect width="7" height="7" x="3" y="3" rx="1" />
                            <rect width="7" height="7" x="14" y="3" rx="1" />
                            <rect width="7" height="7" x="14" y="14" rx="1" />
                            <rect width="7" height="7" x="3" y="14" rx="1" />
                          </svg>
                          Cards
                        </Button>
                        <Button
                          variant={
                            displayMode === "compact" ? "default" : "ghost"
                          }
                          size="sm"
                          className="h-8 rounded-sm px-2"
                          onClick={() => setDisplayMode("compact")}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <line x1="3" x2="21" y1="6" y2="6" />
                            <line x1="3" x2="21" y1="12" y2="12" />
                            <line x1="3" x2="21" y1="18" y2="18" />
                          </svg>
                          Compact
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Sort Dropdown - Improved */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8">
                            <SortAsc className="mr-1 h-4 w-4" />
                            Sort
                            {sortOption.field !== "title" ||
                            sortOption.direction !== "asc" ? (
                              <span className="ml-1 text-xs opacity-70">
                                (
                                {sortOption.field.charAt(0).toUpperCase() +
                                  sortOption.field.slice(1)}
                                , {sortOption.direction === "asc" ? "↑" : "↓"})
                              </span>
                            ) : null}
                            <span className="sr-only">Sort</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <div className="p-2">
                            <div className="mb-2 flex items-center justify-between">
                              <DropdownMenuLabel className="p-0">
                                Sort by
                              </DropdownMenuLabel>
                              <div className="flex overflow-hidden rounded-md border">
                                <Button
                                  variant={
                                    sortOption.direction === "asc"
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  className="h-7 rounded-none border-0 px-2"
                                  onClick={() =>
                                    setSortOption((prev) => ({
                                      ...prev,
                                      direction: "asc",
                                    }))
                                  }
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="m3 8 4-4 4 4" />
                                    <path d="M7 4v16" />
                                    <path d="M11 12h4" />
                                    <path d="M11 16h7" />
                                    <path d="M11 20h10" />
                                  </svg>
                                  <span className="sr-only">Ascending</span>
                                </Button>
                                <Button
                                  variant={
                                    sortOption.direction === "desc"
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  className="h-7 rounded-none border-0 px-2"
                                  onClick={() =>
                                    setSortOption((prev) => ({
                                      ...prev,
                                      direction: "desc",
                                    }))
                                  }
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="m3 16 4 4 4-4" />
                                    <path d="M7 20V4" />
                                    <path d="M11 4h4" />
                                    <path d="M11 8h7" />
                                    <path d="M11 12h10" />
                                  </svg>
                                  <span className="sr-only">Descending</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setSortOption((prev) => ({
                                ...prev,
                                field: "title",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Title
                            {sortOption.field === "title" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setSortOption((prev) => ({
                                ...prev,
                                field: "status",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Status
                            {sortOption.field === "status" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setSortOption((prev) => ({
                                ...prev,
                                field: "progress",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Progress
                            {sortOption.field === "progress" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setSortOption((prev) => ({
                                ...prev,
                                field: "score",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Score
                            {sortOption.field === "score" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setSortOption((prev) => ({
                                ...prev,
                                field: "changes",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Changes count
                            {sortOption.field === "changes" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Filter Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8">
                            <Filter className="mr-1 h-4 w-4" />
                            Filter
                            <span className="sr-only">Filter</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>
                            Filter by Status
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({ ...prev, status: "all" }))
                            }
                            className="flex justify-between"
                          >
                            All statuses
                            {filters.status === "all" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                status: "reading",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Reading
                            {filters.status === "reading" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                status: "completed",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Completed
                            {filters.status === "completed" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                status: "planned",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Plan to Read
                            {filters.status === "planned" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                status: "paused",
                              }))
                            }
                            className="flex justify-between"
                          >
                            On Hold
                            {filters.status === "paused" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                status: "dropped",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Dropped
                            {filters.status === "dropped" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>
                            Filter by Changes
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                changes: "all",
                              }))
                            }
                            className="flex justify-between"
                          >
                            All entries
                            {filters.changes === "all" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                changes: "with-changes",
                              }))
                            }
                            className="flex justify-between"
                          >
                            With changes
                            {filters.changes === "with-changes" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                changes: "no-changes",
                              }))
                            }
                            className="flex justify-between"
                          >
                            No changes
                            {filters.changes === "no-changes" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>
                            Filter by Library
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                library: "all",
                              }))
                            }
                            className="flex justify-between"
                          >
                            All entries
                            {filters.library === "all" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                library: "new",
                              }))
                            }
                            className="flex justify-between"
                          >
                            New to library
                            {filters.library === "new" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                library: "existing",
                              }))
                            }
                            className="flex justify-between"
                          >
                            Already in library
                            {filters.library === "existing" && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setSortOption({ field: "title", direction: "asc" });
                          setFilters({
                            status: "all",
                            changes: "with-changes",
                            library: "all",
                          });
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

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

                                // Determine what will change based on sync configuration
                                const statusWillChange = userEntry
                                  ? syncConfig.prioritizeAniListStatus
                                    ? false // If prioritizing AniList status, it won't change
                                    : getEffectiveStatus(kenmei) !==
                                        userEntry.status &&
                                      !(
                                        userEntry.status === "COMPLETED" &&
                                        syncConfig.preserveCompletedStatus
                                      )
                                  : true;

                                const progressWillChange = userEntry
                                  ? syncConfig.prioritizeAniListProgress
                                    ? // Will only change if Kenmei has more chapters read than AniList
                                      (kenmei.chapters_read || 0) >
                                      (userEntry.progress || 0)
                                    : (kenmei.chapters_read || 0) !==
                                      (userEntry.progress || 0)
                                  : true;

                                const scoreWillChange = userEntry
                                  ? // Don't update completed entries if preserve setting is on
                                    userEntry.status === "COMPLETED" &&
                                    syncConfig.preserveCompletedStatus
                                    ? false
                                    : // Apply score prioritization rules
                                      syncConfig.prioritizeAniListScore &&
                                        userEntry.score &&
                                        Number(userEntry.score) > 0
                                      ? false // Only prioritize if AniList score > 0
                                      : // Only consider a change if Kenmei has a score
                                        kenmei.score > 0 &&
                                        // Convert both scores to numbers and compare
                                        // If AniList has no score but Kenmei does, that's a change
                                        (Number(userEntry.score || 0) === 0 ||
                                          // Use threshold comparison after explicit number conversion
                                          Math.abs(
                                            Number(kenmei.score) -
                                              Number(userEntry.score || 0),
                                          ) >= 0.5)
                                  : // For new entries, only show score change if Kenmei has a score
                                    kenmei.score > 0;

                                // Track if manga is new to the user's library or shouldn't be updated due to special cases
                                const isNewEntry = !userEntry;
                                const isCompleted =
                                  userEntry && userEntry.status === "COMPLETED";

                                // Count the number of changes
                                const changeCount = [
                                  statusWillChange,
                                  progressWillChange,
                                  scoreWillChange,
                                  userEntry
                                    ? syncConfig.setPrivate &&
                                      !userEntry.private
                                    : syncConfig.setPrivate,
                                ].filter(Boolean).length;

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
                                                  {changeCount !== 1 ? "s" : ""}
                                                </div>
                                              )}
                                          </div>

                                          {/* Comparison Table */}
                                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                            <div
                                              className={`rounded-md p-2 ${isNewEntry ? "bg-slate-100 dark:bg-slate-800/60" : "bg-slate-100 dark:bg-slate-800/60"}`}
                                            >
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
                                                    <span
                                                      className={`text-xs font-medium ${userEntry ? (syncConfig.setPrivate && !userEntry.private ? "text-muted-foreground line-through" : "") : syncConfig.setPrivate ? "text-muted-foreground line-through" : ""}`}
                                                    >
                                                      {userEntry?.private
                                                        ? "Yes"
                                                        : "No"}
                                                    </span>
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
                                                    {getEffectiveStatus(kenmei)}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-blue-500 dark:text-blue-400">
                                                    Progress:
                                                  </span>
                                                  <span
                                                    className={`text-xs font-medium ${progressWillChange ? "text-blue-700 dark:text-blue-300" : ""}`}
                                                  >
                                                    {syncConfig.prioritizeAniListProgress
                                                      ? userEntry?.progress &&
                                                        userEntry.progress > 0
                                                        ? (kenmei.chapters_read ||
                                                            0) >
                                                          userEntry.progress
                                                          ? kenmei.chapters_read ||
                                                            0
                                                          : userEntry.progress
                                                        : kenmei.chapters_read ||
                                                          0
                                                      : kenmei.chapters_read ||
                                                        0}{" "}
                                                    ch
                                                    {anilist.chapters
                                                      ? ` / ${anilist.chapters}`
                                                      : ""}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-blue-500 dark:text-blue-400">
                                                    Score:
                                                  </span>
                                                  <span
                                                    className={`text-xs font-medium ${scoreWillChange ? "text-blue-700 dark:text-blue-300" : ""}`}
                                                  >
                                                    {scoreWillChange
                                                      ? kenmei.score
                                                        ? `${kenmei.score}/10`
                                                        : "None"
                                                      : userEntry?.score
                                                        ? `${userEntry.score}/10`
                                                        : "None"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-blue-500 dark:text-blue-400">
                                                    Private:
                                                  </span>
                                                  <span
                                                    className={`text-xs font-medium ${userEntry ? (syncConfig.setPrivate && !userEntry.private ? "text-blue-700 dark:text-blue-300" : "") : syncConfig.setPrivate ? "text-blue-700 dark:text-blue-300" : ""}`}
                                                  >
                                                    {userEntry
                                                      ? syncConfig.setPrivate
                                                        ? "Yes"
                                                        : userEntry.private
                                                          ? "Yes"
                                                          : "No"
                                                      : syncConfig.setPrivate
                                                        ? "Yes"
                                                        : "No"}
                                                  </span>
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
                          ) : sortedMangaMatches.length > 0 ? (
                            <div className="py-4 text-center">
                              <span className="text-muted-foreground text-xs">
                                All items loaded
                              </span>
                            </div>
                          ) : null}
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

                                // Determine what will change based on sync configuration
                                const statusWillChange = userEntry
                                  ? syncConfig.prioritizeAniListStatus
                                    ? false // If prioritizing AniList status, it won't change
                                    : getEffectiveStatus(kenmei) !==
                                        userEntry.status &&
                                      !(
                                        userEntry.status === "COMPLETED" &&
                                        syncConfig.preserveCompletedStatus
                                      )
                                  : true;

                                const progressWillChange = userEntry
                                  ? syncConfig.prioritizeAniListProgress
                                    ? // Will only change if Kenmei has more chapters read than AniList
                                      (kenmei.chapters_read || 0) >
                                      (userEntry.progress || 0)
                                    : (kenmei.chapters_read || 0) !==
                                      (userEntry.progress || 0)
                                  : true;

                                const scoreWillChange = userEntry
                                  ? // Don't update completed entries if preserve setting is on
                                    userEntry.status === "COMPLETED" &&
                                    syncConfig.preserveCompletedStatus
                                    ? false
                                    : // Apply score prioritization rules
                                      syncConfig.prioritizeAniListScore &&
                                        userEntry.score &&
                                        Number(userEntry.score) > 0
                                      ? false // Only prioritize if AniList score > 0
                                      : // Only consider a change if Kenmei has a score
                                        kenmei.score > 0 &&
                                        // Convert both scores to numbers and compare
                                        // If AniList has no score but Kenmei does, that's a change
                                        (Number(userEntry.score || 0) === 0 ||
                                          // Use threshold comparison after explicit number conversion
                                          Math.abs(
                                            Number(kenmei.score) -
                                              Number(userEntry.score || 0),
                                          ) >= 0.5)
                                  : // For new entries, only show score change if Kenmei has a score
                                    kenmei.score > 0;

                                // Track if manga is new to the user's library or shouldn't be updated due to special cases
                                const isNewEntry = !userEntry;
                                const isCompleted =
                                  userEntry && userEntry.status === "COMPLETED";

                                // Count the number of changes
                                const changeCount = [
                                  statusWillChange,
                                  progressWillChange,
                                  scoreWillChange,
                                  userEntry
                                    ? syncConfig.setPrivate &&
                                      !userEntry.private
                                    : syncConfig.setPrivate,
                                ].filter(Boolean).length;

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
                                                getEffectiveStatus(kenmei);

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
                                              const toProgress =
                                                syncConfig.prioritizeAniListProgress
                                                  ? userEntry?.progress &&
                                                    userEntry.progress > 0
                                                    ? (kenmei.chapters_read ||
                                                        0) > userEntry.progress
                                                      ? kenmei.chapters_read ||
                                                        0
                                                      : userEntry.progress
                                                    : kenmei.chapters_read || 0
                                                  : kenmei.chapters_read || 0;

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
