/**
 * @packageDocumentation
 * @module MatchingPage
 * @description Matching page component for the Kenmei to AniList sync tool. Handles manga matching, review, rematch, and sync preparation.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { KenmeiManga } from "../api/kenmei/types";
import { useAuthState } from "../hooks/useAuth";
import {
  getKenmeiData,
  addIgnoredDuplicate,
  getSavedMatchResults,
  storage,
  STORAGE_KEYS,
} from "../utils/storage";
import { StatusFilterOptions } from "../types/matching";
import { MangaMatchResult } from "../api/anilist/types";
import { useMatchingProcess } from "../hooks/useMatchingProcess";
import { usePendingManga } from "../hooks/usePendingManga";
import { useMatchHandlers } from "../hooks/useMatchHandlers";
import { clearCacheForTitles } from "../api/matching/search-service";
import { useRateLimit } from "../contexts/RateLimitContext";
import { UndoRedoManager } from "../utils/undoRedo";
import { useDebugActions } from "../contexts/DebugContext";
import { toast } from "sonner";

// Components
import { RematchOptions } from "../components/matching/RematchOptions";
import { CacheClearingNotification } from "../components/matching/CacheClearingNotification";
import { SearchModal } from "../components/matching/SearchModal";
import { BatchSelectionToolbar } from "../components/matching/BatchSelectionToolbar";
import InitializationCard from "../components/matching/InitializationCard";
import AuthRequiredCard from "../components/matching/AuthRequiredCard";
import { AnimatePresence, motion } from "framer-motion";
import MatchingErrorToast from "../components/matching/MatchingErrorToast";
import MatchingPageHeader from "../components/matching/MatchingPageHeader";
import MatchingPanel from "../components/matching/MatchingPanel";
import MatchingResume from "../components/matching/MatchingResume";
import {
  DuplicateWarning,
  DuplicateEntry,
} from "../components/matching/DuplicateWarning";
import { detectDuplicateAniListIds } from "../components/matching/detectDuplicateAniListIds";
import { LoadingView } from "../components/matching/LoadingView";
import { SkeletonCard } from "../components/ui/skeleton";
import EmptyState from "../components/ui/empty-state";
import { FileSearch } from "lucide-react";

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

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
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
  const { authState } = useAuthState();
  const { rateLimitState } = useRateLimit();
  const { recordEvent } = useDebugActions();

  // State for batch selection
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(
    new Set(),
  );

  // State for manga data
  const [manga, setManga] = useState<KenmeiManga[]>([]);
  const [matchResults, setMatchResults] = useState<MangaMatchResult[]>([]);

  // Undo/Redo state
  const [undoRedoManager] = useState(() => new UndoRedoManager(50));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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

  // State for duplicate detection
  const [duplicateEntries, setDuplicateEntries] = useState<DuplicateEntry[]>(
    [],
  );
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // State for search query (to be passed to MangaMatchingPanel)
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Track initial page load to show skeletons
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const matchStatusSummary = useMemo(() => {
    const total = matchResults.length;
    const matched = matchResults.filter((m) => m.status === "matched").length;
    const manual = matchResults.filter((m) => m.status === "manual").length;
    const pending = matchResults.filter((m) => m.status === "pending").length;
    const skipped = matchResults.filter((m) => m.status === "skipped").length;
    const reviewed = matched + manual + skipped;
    const completionPercent =
      total === 0 ? 0 : Math.round((reviewed / total) * 100);

    return {
      total,
      matched,
      manual,
      pending,
      skipped,
      reviewed,
      completionPercent,
    };
  }, [matchResults]);

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
    // Persist to storage
    try {
      storage.setItem(STORAGE_KEYS.MATCH_RESULTS, JSON.stringify(updated));
    } catch (storageError) {
      console.error(
        "[MatchingPage] Failed to persist match results to storage:",
        storageError,
      );
    }
    // Clear undo history for this bulk reset operation
    undoRedoManager.clear();
  };

  /**
   * Undo the last action
   */
  const handleUndo = () => {
    const metadata = undoRedoManager.undo();
    if (metadata) {
      toast(`Undone: ${metadata.description}`, {
        description: `${metadata.affectedTitles.join(", ")}`,
      });
      recordEvent({
        type: "match.undo",
        message: `Undone: ${metadata.description}`,
        level: "info",
        metadata: { description: metadata.description, count: 1 },
      });
      // Update button states
      setCanUndo(undoRedoManager.canUndo());
      setCanRedo(undoRedoManager.canRedo());
    }
  };

  /**
   * Redo the last undone action
   */
  const handleRedo = () => {
    const metadata = undoRedoManager.redo();
    if (metadata) {
      toast(`Redone: ${metadata.description}`, {
        description: `${metadata.affectedTitles.join(", ")}`,
      });
      recordEvent({
        type: "match.redo",
        message: `Redone: ${metadata.description}`,
        level: "info",
        metadata: { description: metadata.description, count: 1 },
      });
      // Update button states
      setCanUndo(undoRedoManager.canUndo());
      setCanRedo(undoRedoManager.canRedo());
    }
  };
  const matchingProcess = useMatchingProcess({
    accessToken: authState.accessToken || null,
    rateLimitState,
  });
  const pendingMangaState = usePendingManga();

  // Use match handlers
  const matchHandlers = useMatchHandlers(
    matchResults,
    setMatchResults,
    setSearchTarget,
    setIsSearchOpen,
    matchingProcess.setBypassCache,
    undoRedoManager,
  );

  // Batch selection handlers
  const handleToggleSelection = useCallback((matchId: number) => {
    setSelectedMatchIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((ids: number[]) => {
    setSelectedMatchIds(new Set(ids));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedMatchIds(new Set());
  }, []);

  const handleBatchAccept = useCallback(() => {
    const selectedMatches = matchResults.filter((match) =>
      selectedMatchIds.has(match.kenmeiManga.id),
    );
    if (selectedMatches.length > 0) {
      matchHandlers.handleAcceptMatch({
        isBatchOperation: true,
        matches: selectedMatches,
      });
      handleClearSelection();
    }
  }, [matchResults, selectedMatchIds, matchHandlers, handleClearSelection]);

  const handleBatchReject = useCallback(() => {
    const selectedMatches = matchResults.filter((match) =>
      selectedMatchIds.has(match.kenmeiManga.id),
    );
    if (selectedMatches.length > 0) {
      matchHandlers.handleRejectMatch({
        isBatchOperation: true,
        matches: selectedMatches,
      });
      handleClearSelection();
    }
  }, [matchResults, selectedMatchIds, matchHandlers, handleClearSelection]);

  const handleBatchReset = useCallback(() => {
    const selectedMatches = matchResults.filter((match) =>
      selectedMatchIds.has(match.kenmeiManga.id),
    );
    if (selectedMatches.length > 0) {
      matchHandlers.handleResetToPending({
        isBatchOperation: true,
        matches: selectedMatches,
      });
      handleClearSelection();
    }
  }, [matchResults, selectedMatchIds, matchHandlers, handleClearSelection]);

  // Add a ref to track if we've already done initialization
  const hasInitialized = useRef(false);
  const lastGlobalSyncSnapshot = useRef<{
    current: number;
    total: number;
    currentTitle: string | null;
    statusMessage: string | null;
    detailMessage: string | null;
  } | null>(null);
  const matchingProcessRef = useRef(matchingProcess);

  useEffect(() => {
    matchingProcessRef.current = matchingProcess;
  }, [matchingProcess]);

  // Calculate whether resume is needed and the count of unprocessed manga
  const resumeState = useMemo(() => {
    // Create sets for efficient lookup
    const processedIds = new Set(
      matchResults.map((r) => r.kenmeiManga.id).filter(Boolean),
    );
    const processedTitles = new Set(
      matchResults.map((r) => r.kenmeiManga.title.toLowerCase()),
    );

    // Check pending manga from storage
    const unprocessedFromPending = pendingMangaState.pendingManga.filter(
      (manga) => {
        const idMatch = manga.id && processedIds.has(manga.id);
        const titleMatch = processedTitles.has(manga.title.toLowerCase());
        return !idMatch && !titleMatch;
      },
    );

    // Check count difference
    const unprocessedFromAll = manga.filter((m) => {
      const idMatch = m.id && processedIds.has(m.id);
      const titleMatch = processedTitles.has(m.title.toLowerCase());
      return !idMatch && !titleMatch;
    });

    const unprocessedCount = Math.max(
      unprocessedFromPending.length,
      unprocessedFromAll.length,
    );

    const needsProcessing = unprocessedCount > 0;

    return {
      needsProcessing,
      unprocessedCount,
      unprocessedManga: unprocessedFromAll,
    };
  }, [matchResults, pendingMangaState.pendingManga, manga]);

  // Update undo/redo button states
  useEffect(() => {
    setCanUndo(undoRedoManager.canUndo());
    setCanRedo(undoRedoManager.canRedo());
  }, [matchResults, undoRedoManager]);

  // Add keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if target is input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Skip if matching is loading
      if (matchingProcess.isLoading) {
        return;
      }

      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd+Z for undo
      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (undoRedoManager.canUndo()) {
          handleUndo();
        }
      }

      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y for redo
      if (
        modifier &&
        ((e.key === "z" && e.shiftKey) || (!isMac && e.key === "y"))
      ) {
        e.preventDefault();
        if (undoRedoManager.canRedo()) {
          handleRedo();
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [undoRedoManager, matchingProcess.isLoading, handleUndo, handleRedo]);

  // Keyboard shortcuts for batch selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Escape to clear selection
      if (e.key === "Escape" && selectedMatchIds.size > 0) {
        e.preventDefault();
        handleClearSelection();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [selectedMatchIds, handleClearSelection]);

  // Clear pending manga if all are processed (prevents infinite loops)
  useEffect(() => {
    if (
      pendingMangaState.pendingManga.length > 0 &&
      !resumeState.needsProcessing &&
      !matchingProcess.isLoading
    ) {
      console.info(
        "[MatchingPage] All pending manga are processed - clearing pending manga storage",
      );
      pendingMangaState.savePendingManga([]);
    }
  }, [
    resumeState.needsProcessing,
    pendingMangaState,
    matchingProcess.isLoading,
  ]);

  // Add debug effect for matching results
  useEffect(() => {
    if (matchResults.length > 0) {
      console.debug(
        "[MatchingPage] matchResults updated - Current status counts:",
      );
      const statusCounts = {
        matched: matchResults.filter((m) => m.status === "matched").length,
        pending: matchResults.filter((m) => m.status === "pending").length,
        manual: matchResults.filter((m) => m.status === "manual").length,
        skipped: matchResults.filter((m) => m.status === "skipped").length,
      };
      console.debug("[MatchingPage] Status counts:", statusCounts);
    }
  }, [matchResults]);

  // Effect to detect duplicate AniList IDs
  useEffect(() => {
    if (matchResults.length > 0) {
      const duplicates = detectDuplicateAniListIds(matchResults);
      setDuplicateEntries(duplicates);

      // Show warning if duplicates are found and warning wasn't already dismissed
      if (duplicates.length > 0) {
        setShowDuplicateWarning(true);
      } else {
        setShowDuplicateWarning(false);
      }
    } else {
      setDuplicateEntries([]);
      setShowDuplicateWarning(false);
    }
  }, [matchResults]);

  /**
   * Checks user authentication status with AniList.
   * Sets appropriate error messages if not authenticated.
   * @returns Boolean indicating whether authentication is valid.
   * @source
   */
  const checkAuthenticationStatus = (): boolean => {
    if (!authState.isAuthenticated || !authState.accessToken) {
      console.info("[MatchingPage] User not authenticated, showing auth error");
      matchingProcess.setError(
        "Authentication Required. You need to connect your AniList account to match manga.",
      );
      matchingProcess.setDetailMessage(
        "Please go to Settings to authenticate with AniList.",
      );
      return false;
    }
    return true;
  };

  /**
   * Restores the matching process state from global scope if it was interrupted.
   * Recovers progress, status messages, and pause state from previous session.
   * @returns Boolean indicating whether process state was successfully restored.
   * @source
   */
  const restoreRunningProcessState = (): boolean => {
    if (globalThis.matchingProcessState?.isRunning) {
      console.info(
        "[MatchingPage] Detected running matching process, restoring state",
      );

      // Restore the matching process state
      matchingProcess.setIsLoading(true);
      matchingProcess.setProgress({
        current: globalThis.matchingProcessState.progress.current,
        total: globalThis.matchingProcessState.progress.total,
        currentTitle: globalThis.matchingProcessState.progress.currentTitle,
      });
      matchingProcess.setStatusMessage(
        globalThis.matchingProcessState.statusMessage,
      );
      matchingProcess.setDetailMessage(
        globalThis.matchingProcessState.detailMessage,
      );

      if (globalThis.matchingProcessState.timeEstimate) {
        matchingProcess.setTimeEstimate(
          globalThis.matchingProcessState.timeEstimate,
        );
      }

      const persistedPauseTransitioning = Boolean(
        globalThis.matchingProcessState.isPauseTransitioning,
      );
      const persistedManualPause = Boolean(
        globalThis.matchingProcessState.isManuallyPaused,
      );

      if (
        matchingProcess.isPauseTransitioning !== persistedPauseTransitioning
      ) {
        matchingProcess.setIsPauseTransitioning(persistedPauseTransitioning);
      }

      if (matchingProcess.isManuallyPaused !== persistedManualPause) {
        matchingProcess.setIsManuallyPaused(persistedManualPause);
      }

      if (persistedManualPause) {
        matchingProcess.setManualMatchingPause(true);
        matchingProcess.pauseTimeTracking();
      } else if (!matchingProcess.isRateLimitPaused) {
        matchingProcess.setManualMatchingPause(false);
        matchingProcess.resumeTimeTracking();
      }

      // Mark as initialized to prevent auto-starting
      matchingProcess.matchingInitialized.current = true;
      matchingProcess.setIsInitializing(false);
      return true;
    }
    return false;
  };

  /**
   * Loads and processes previously saved match results from storage.
   * Updates component state with saved results and calculates review completion status.
   * @returns Object indicating whether results were found and the results themselves if available.
   * @source
   */
  const processSavedMatchResults = (): {
    hasResults: boolean;
    savedResults?: MangaMatchResult[];
  } => {
    console.info("[MatchingPage] Loading saved match results immediately...");
    const savedResults = getSavedMatchResults();

    if (
      savedResults &&
      Array.isArray(savedResults) &&
      savedResults.length > 0
    ) {
      console.info(
        `[MatchingPage] Found ${savedResults.length} existing match results - loading immediately`,
      );
      setMatchResults(savedResults as MangaMatchResult[]);

      // Check how many matches have already been reviewed
      const reviewedCount = savedResults.filter(
        (m) =>
          m.status === "matched" ||
          m.status === "manual" ||
          m.status === "skipped",
      ).length;

      console.info(
        `[MatchingPage] ${reviewedCount} manga have already been reviewed (${Math.round((reviewedCount / savedResults.length) * 100)}% complete)`,
      );

      return {
        hasResults: true,
        savedResults: savedResults as MangaMatchResult[],
      };
    }

    console.info("[MatchingPage] No saved match results found");
    return { hasResults: false };
  };

  /**
   * Calculates missing manga between saved match results and imported manga data.
   * Saves unprocessed manga to storage or handles discrepancies.
   * @param savedResults - Previously saved match results.
   * @param importedManga - Currently imported manga entries.
   * @source
   */
  const calculateMissingManga = (
    savedResults: MangaMatchResult[],
    importedManga: KenmeiManga[],
  ): void => {
    if (importedManga.length === 0) return;

    console.info(
      "[MatchingPage] Have both saved results and imported manga - calculating unmatched manga",
    );

    const calculatedPendingManga = pendingMangaState.calculatePendingManga(
      savedResults,
      importedManga,
    );

    if (calculatedPendingManga.length > 0) {
      console.info(
        `[MatchingPage] Calculated ${calculatedPendingManga.length} manga that still need to be processed`,
      );
      pendingMangaState.savePendingManga(calculatedPendingManga);
      console.debug(
        `[MatchingPage] Saved ${calculatedPendingManga.length} pending manga to storage for resume`,
      );
    } else {
      handleDiscrepancyDetection(savedResults, importedManga);
    }
  };

  /**
   * Detects and handles discrepancies between total imported manga and processed match results.
   * Attempts to find and save actual missing manga for processing.
   * @param savedResults - Previously saved match results.
   * @param importedManga - Currently imported manga entries.
   * @source
   */
  const handleDiscrepancyDetection = (
    savedResults: MangaMatchResult[],
    importedManga: KenmeiManga[],
  ): void => {
    console.debug("[MatchingPage] No pending manga found in calculation");

    // If there's a clear discrepancy between total manga and processed manga,
    // force a calculation of pending manga by finding the actual missing manga
    if (importedManga.length > savedResults.length) {
      console.warn(
        `[MatchingPage] ⚠️ Discrepancy detected! Total manga: ${importedManga.length}, Processed: ${savedResults.length}`,
      );
      console.info(
        "[MatchingPage] Finding actual missing manga using comprehensive title and ID matching",
      );

      const actualMissingManga = findActualMissingManga(
        savedResults,
        importedManga,
      );

      if (actualMissingManga.length > 0) {
        console.info(
          `[MatchingPage] Found ${actualMissingManga.length} actual missing manga that need processing`,
        );
        console.debug(
          "[MatchingPage] Sample missing manga:",
          actualMissingManga
            .slice(0, 5)
            .map((m) => ({ id: m.id, title: m.title })),
        );
        pendingMangaState.savePendingManga(actualMissingManga);
      } else {
        console.info(
          "[MatchingPage] No actual missing manga found despite count discrepancy - all manga may already be processed",
        );
      }
    }
  };

  /**
   * Finds manga entries that have not been processed using comprehensive title and ID matching.
   * @param savedResults - Previously saved match results for comparison.
   * @param importedManga - All imported manga entries to search through.
   * @returns Array of unprocessed manga entries that still need matching.
   * @source
   */
  const findActualMissingManga = (
    savedResults: MangaMatchResult[],
    importedManga: KenmeiManga[],
  ): KenmeiManga[] => {
    // Create sets of processed manga for quick lookup - convert IDs to strings for consistent comparison
    const processedIds = new Set(
      savedResults.map((r) => r.kenmeiManga.id?.toString()).filter(Boolean),
    );
    const processedTitles = new Set(
      savedResults.map((r) => r.kenmeiManga.title.toLowerCase()),
    );

    console.debug(
      `[MatchingPage] Processed IDs (first 10):`,
      Array.from(processedIds).slice(0, 10),
    );
    console.debug(
      `[MatchingPage] Processed titles (first 5):`,
      Array.from(processedTitles).slice(0, 5),
    );

    // Find manga that aren't in savedResults using proper matching
    const actualMissingManga: KenmeiManga[] = [];

    for (const manga of importedManga) {
      const idMatch = manga.id != null && processedIds.has(manga.id.toString());
      const titleMatch = processedTitles.has(manga.title.toLowerCase());

      // Debug log for first few manga being checked
      if (actualMissingManga.length < 5) {
        console.debug(
          `[MatchingPage] Checking manga "${manga.title}" (ID: ${manga.id}): idMatch=${idMatch}, titleMatch=${titleMatch}, shouldInclude=${!idMatch && !titleMatch}`,
        );
      }

      if (!idMatch && !titleMatch) {
        actualMissingManga.push(manga);
      }
    }

    return actualMissingManga;
  };

  /**
   * Handles module preloading and final initialization steps for matching process.
   * Preloads search service, syncs cache, and starts matching if appropriate.
   * @param importedManga - The imported manga entries to process.
   * @source
   */
  const handleModulePreloadingAndInitialization = (
    importedManga: KenmeiManga[],
  ): void => {
    // Check for pending manga from a previously interrupted operation (only if no saved results)
    const pendingMangaData = pendingMangaState.loadPendingManga();

    if (pendingMangaData && pendingMangaData.length > 0) {
      // Clear any error message since we're showing the resume notification instead
      matchingProcess.setError(null);
      // End initialization when we've found pending manga
      matchingProcess.setIsInitializing(false);
    }

    // Preload the cache service to ensure it's initialized
    import("../api/matching/search-service").then((module) => {
      console.debug("[MatchingPage] Preloaded manga search service");
      // Force cache sync
      if (module.cacheDebugger) {
        module.cacheDebugger.forceSyncCaches();
      }

      // If we haven't already loaded saved results and have imported manga, start matching
      if (
        importedManga.length &&
        !matchingProcess.matchingInitialized.current
      ) {
        console.info(
          "[MatchingPage] Starting initial matching process with imported manga",
        );
        matchingProcess.matchingInitialized.current = true;

        // Start matching process automatically
        matchingProcess.startMatching(importedManga, false, setMatchResults);
      } else if (!importedManga.length) {
        console.info(
          "[MatchingPage] No imported manga found, redirecting to import page",
        );
        matchingProcess.setError(
          "No manga data found. Please import your data first.",
        );
      }

      // Make sure we mark initialization as complete
      matchingProcess.setIsInitializing(false);
      console.info("[MatchingPage] *** INITIALIZATION COMPLETE ***");
    });
  };

  // Initial data loading
  useEffect(() => {
    // Strong initialization guard to prevent multiple runs
    if (hasInitialized.current) {
      return;
    }

    // Mark as initialized immediately to prevent any possibility of re-runs
    hasInitialized.current = true;

    // Check authentication status
    if (!checkAuthenticationStatus()) {
      return;
    }

    console.info("[MatchingPage] *** INITIALIZATION START ***");
    console.debug("[MatchingPage] Initial states:", {
      isLoading: matchingProcess.isLoading,
      hasError: !!matchingProcess.error,
      matchResultsLength: matchResults.length,
      pendingMangaLength: pendingMangaState.pendingManga.length,
      isMatchingInitialized: matchingProcess.matchingInitialized.current,
    });

    // Check if there's an ongoing matching process and restore state if needed
    if (restoreRunningProcessState()) {
      return;
    }

    // Skip if this effect has already been run
    if (matchingProcess.matchingInitialized.current) {
      console.info(
        "[MatchingPage] Matching already initialized, skipping duplicate initialization",
      );
      matchingProcess.setIsInitializing(false);
      return;
    }

    console.info("[MatchingPage] Initializing MatchingPage component...");

    // Get imported data from storage to have it available for calculations
    const importedData = getKenmeiData();
    const importedManga = importedData?.manga || [];

    if (importedManga.length > 0) {
      console.info(
        `[MatchingPage] Found ${importedManga.length} imported manga from storage`,
      );
      // Store the imported manga data for later use
      setManga(importedManga as KenmeiManga[]);
    } else {
      console.info("[MatchingPage] No imported manga found in storage");
    }

    // Load saved match results and process them
    const { hasResults, savedResults } = processSavedMatchResults();

    if (hasResults && savedResults) {
      // Calculate what might still need processing if we have imported manga
      calculateMissingManga(savedResults, importedManga as KenmeiManga[]);

      // Mark as initialized since we have results
      matchingProcess.matchingInitialized.current = true;
      matchingProcess.setIsInitializing(false);
      setIsInitialLoad(false);

      console.info(
        "[MatchingPage] *** INITIALIZATION COMPLETE - Using saved results ***",
      );
      return; // Skip further initialization
    }

    // Handle module preloading and final initialization steps
    handleModulePreloadingAndInitialization(importedManga as KenmeiManga[]);
    setIsInitialLoad(false);

    // Cleanup function to ensure initialization state is reset
    return () => {
      matchingProcess.setIsInitializing(false);
    };
  }, [navigate, matchingProcess, pendingMangaState]);

  // Add an effect to sync with the global process state while the page is mounted
  useEffect(() => {
    // Skip if we're not in the middle of a process
    if (!globalThis.matchingProcessState?.isRunning) return;

    let hasSyncedCompletion = false;
    let syncInterval: ReturnType<typeof setInterval> | null = null;

    const applyPauseState = (
      state: NonNullable<typeof globalThis.matchingProcessState>,
      controls: typeof matchingProcessRef.current,
    ) => {
      const persistedManualPause = Boolean(state.isManuallyPaused);
      if (controls.isManuallyPaused !== persistedManualPause) {
        controls.setIsManuallyPaused(persistedManualPause);
      }

      if (persistedManualPause) {
        controls.setManualMatchingPause(true);
        controls.pauseTimeTracking();
      } else if (!controls.isRateLimitPaused) {
        controls.setManualMatchingPause(false);
        controls.resumeTimeTracking();
      }

      const persistedPauseTransitioning = Boolean(state.isPauseTransitioning);
      if (controls.isPauseTransitioning !== persistedPauseTransitioning) {
        controls.setIsPauseTransitioning(persistedPauseTransitioning);
      }
    };

    const syncStateUpdates = (
      snapshot: {
        current: number;
        total: number;
        currentTitle: string | null;
        statusMessage: string | null;
        detailMessage: string | null;
      },
      state: NonNullable<typeof globalThis.matchingProcessState>,
      controls: typeof matchingProcessRef.current,
    ) => {
      controls.setProgress((prev) => {
        if (
          prev.current === snapshot.current &&
          prev.total === snapshot.total &&
          prev.currentTitle === (snapshot.currentTitle || "")
        ) {
          return prev;
        }
        return {
          current: snapshot.current,
          total: snapshot.total,
          currentTitle: snapshot.currentTitle || "",
        };
      });
      controls.setStatusMessage((prev) => {
        const next = snapshot.statusMessage || "";
        return prev === next ? prev : next;
      });
      controls.setDetailMessage((prev) => {
        const next = snapshot.detailMessage ?? null;
        return prev === next ? prev : next;
      });

      const timeEstimate = state.timeEstimate;
      if (
        timeEstimate &&
        Number.isFinite(timeEstimate.startTime) &&
        timeEstimate.startTime > 0
      ) {
        controls.setTimeEstimate((prev) => {
          if (
            prev.startTime === timeEstimate.startTime &&
            prev.averageTimePerManga === timeEstimate.averageTimePerManga &&
            prev.estimatedRemainingSeconds ===
              timeEstimate.estimatedRemainingSeconds
          ) {
            return prev;
          }
          return {
            startTime: timeEstimate.startTime,
            averageTimePerManga: timeEstimate.averageTimePerManga,
            estimatedRemainingSeconds: timeEstimate.estimatedRemainingSeconds,
          };
        });
      }

      applyPauseState(state, controls);
    };

    const syncRunningState = (
      state: NonNullable<typeof globalThis.matchingProcessState>,
      controls: typeof matchingProcessRef.current,
    ) => {
      const snapshot = {
        current: state.progress.current,
        total: state.progress.total,
        currentTitle: state.progress.currentTitle ?? null,
        statusMessage: state.statusMessage ?? null,
        detailMessage: state.detailMessage ?? null,
      };

      const hasChanged =
        !lastGlobalSyncSnapshot.current ||
        lastGlobalSyncSnapshot.current.current !== snapshot.current ||
        lastGlobalSyncSnapshot.current.total !== snapshot.total ||
        lastGlobalSyncSnapshot.current.currentTitle !== snapshot.currentTitle ||
        lastGlobalSyncSnapshot.current.statusMessage !==
          snapshot.statusMessage ||
        lastGlobalSyncSnapshot.current.detailMessage !== snapshot.detailMessage;

      if (hasChanged) {
        console.debug("[MatchingPage] Syncing UI with global process state:", {
          current: snapshot.current,
          total: snapshot.total,
          statusMessage: snapshot.statusMessage,
        });
        lastGlobalSyncSnapshot.current = snapshot;
      }

      controls.setIsLoading((prev) => prev || true);
      syncStateUpdates(snapshot, state, controls);
    };

    const syncCompletedState = (
      state: NonNullable<typeof globalThis.matchingProcessState>,
      controls: typeof matchingProcessRef.current,
    ): boolean => {
      if (!state.progress) {
        return false;
      }

      const finalSnapshot = {
        current: state.progress.current,
        total: state.progress.total,
        currentTitle: state.progress.currentTitle ?? null,
        statusMessage: state.statusMessage ?? null,
        detailMessage: state.detailMessage ?? null,
      };
      lastGlobalSyncSnapshot.current = finalSnapshot;

      syncStateUpdates(finalSnapshot, state, controls);

      console.info(
        "[MatchingPage] Global process complete, syncing final state",
      );
      controls.setIsLoading((prev) => (prev ? false : prev));

      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }

      return true;
    };

    // Create a function to sync the UI with the global state
    const syncUIWithGlobalState = () => {
      const processState = globalThis.matchingProcessState;
      if (!processState) {
        return;
      }

      const controls = matchingProcessRef.current;

      if (processState.isRunning) {
        syncRunningState(processState, controls);
      } else if (!hasSyncedCompletion) {
        hasSyncedCompletion = syncCompletedState(processState, controls);
      }
    };

    // Create a visibility change listener to ensure UI updates when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.debug(
          "[MatchingPage] Page became visible, syncing state immediately",
        );
        syncUIWithGlobalState();
        if (
          globalThis.matchingProcessState?.isRunning &&
          !matchingProcessRef.current.isManuallyPaused &&
          !matchingProcessRef.current.isRateLimitPaused
        ) {
          matchingProcessRef.current.resumeTimeTracking();
        }
      }
    };

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Create an interval to check for updates to the global state (less frequently since we also have visibility events)
    syncInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncUIWithGlobalState();
      }
    }, 2000); // Check every 2 seconds when visible

    // Clean up the interval and event listener when the component unmounts
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []); // Only run once when component mounts

  useEffect(() => {
    // Only reload when the matching process transitions from loading to not loading
    if (!matchingProcess.isLoading && !matchingProcess.isInitializing) {
      // Use a small delay to ensure all state updates have been flushed
      const timeoutId = setTimeout(() => {
        const savedResults = getSavedMatchResults();
        if (savedResults && savedResults.length > 0) {
          // Only update if we have saved results and current results might be stale
          if (
            matchResults.length === 0 ||
            matchResults.length !== savedResults.length
          ) {
            console.info(
              `[MatchingPage] Reloading match results from storage: ${savedResults.length} results found (current: ${matchResults.length})`,
            );
            setMatchResults(savedResults as MangaMatchResult[]);
          }
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [matchingProcess.isLoading, matchingProcess.isInitializing]);

  // Add an effect to listen for re-search empty matches events
  useEffect(() => {
    async function handleReSearchEmptyMatchesAsync(
      mangaToResearch: KenmeiManga[],
    ) {
      try {
        // Small delay to ensure UI updates
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get the cache service to clear specific entries
        await import("../api/matching/search-service");

        // Clear cache entries for each manga being re-searched
        const mangaTitles = mangaToResearch.map((manga) => manga.title);
        console.info(
          `[MatchingPage] 🔄 Clearing cache for ${mangaTitles.length} manga titles`,
        );
        matchingProcess.setStatusMessage(
          `Clearing cache for ${mangaTitles.length} manga titles...`,
        );

        // Use the clearCacheForTitles function to clear entries efficiently
        const clearResult = clearCacheForTitles(mangaTitles);

        // Log results
        console.info(
          `[MatchingPage] 🧹 Cleared ${clearResult.clearedCount} cache entries for re-search`,
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
          console.info(
            `[MatchingPage] Reset status to pending for ${reSearchTitles.size} manga before re-searching`,
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
        console.error(
          "[MatchingPage] Failed to clear manga cache entries:",
          error,
        );
        matchingProcess.setIsCacheClearing(false);

        // Continue with re-search even if cache clearing fails
        matchingProcess.startMatching(mangaToResearch, true, setMatchResults);
      }
    }

    // Handler for the reSearchEmptyMatches custom event
    const handleReSearchEmptyMatches = (
      event: CustomEvent<{ mangaToResearch: KenmeiManga[] }>,
    ) => {
      const { mangaToResearch } = event.detail;

      console.info(
        `[MatchingPage] Received request to re-search ${mangaToResearch.length} manga without matches`,
      );

      // Reset any previous warnings or cancel state
      setRematchWarning(null);
      matchingProcess.cancelMatchingRef.current = false;
      matchingProcess.setDetailMessage(null);

      if (mangaToResearch.length === 0) {
        console.info("[MatchingPage] No manga to re-search, ignoring request");
        return;
      }

      // Show cache clearing notification with count
      matchingProcess.setIsCacheClearing(true);
      matchingProcess.setCacheClearingCount(mangaToResearch.length);
      matchingProcess.setStatusMessage(
        "Preparing to clear cache for manga without matches...",
      );

      handleReSearchEmptyMatchesAsync(mangaToResearch);
    };

    // Add event listener for the custom event
    globalThis.addEventListener(
      "reSearchEmptyMatches",
      handleReSearchEmptyMatches as EventListener,
    );

    // Clean up the event listener when the component unmounts
    return () => {
      globalThis.removeEventListener(
        "reSearchEmptyMatches",
        handleReSearchEmptyMatches as EventListener,
      );
    };
  }, [matchingProcess, setMatchResults]);

  /**
   * Retries the matching process for all unmatched manga.
   * Clears pending manga and starts a fresh matching attempt.
   * @source
   */
  const handleRetry = () => {
    // Clear selection state on rematch
    handleClearSelection();

    // Clear any pending manga data
    pendingMangaState.savePendingManga([]);

    if (manga.length > 0) {
      matchingProcess.startMatching(manga, false, setMatchResults);
    }
  };

  /**
   * Returns the path to navigate to for synchronization.
   * @returns The sync page route path.
   * @source
   */
  const getSyncPath = () => {
    // When we have a sync route, return that instead
    return "/sync";
  };

  /**
   * Validates and proceeds to the synchronization page.
   * Ensures at least one match has been approved before allowing sync.
   * @source
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
   * Handles re-matching of manga selected by status filter.
   * Filters results by selected status and initiates new matching process.
   * @source
   */
  const handleRematchByStatus = async () => {
    // Clear selection state on rematch
    handleClearSelection();

    // Reset any previous warnings
    setRematchWarning(null);

    // Reset any previous cancel state
    matchingProcess.cancelMatchingRef.current = false;
    matchingProcess.setDetailMessage(null);

    console.debug("[MatchingPage] === REMATCH DEBUG INFO ===");
    console.debug(`[MatchingPage] Total manga in state: ${manga.length}`);
    console.debug(`[MatchingPage] Total match results: ${matchResults.length}`);
    console.debug(
      `[MatchingPage] Displayed unmatched count: ${manga.length - matchResults.length}`,
    );

    // Get manga that have been processed but match selected statuses
    const filteredManga = matchResults.filter(
      (manga) =>
        selectedStatuses[manga.status as keyof typeof selectedStatuses] ===
        true,
    );
    console.debug(
      `[MatchingPage] Filtered manga from results: ${filteredManga.length}`,
    );

    // Find unmatched manga that aren't in matchResults yet
    let unmatchedManga: KenmeiManga[] = [];
    if (selectedStatuses.unmatched) {
      console.debug(
        "[MatchingPage] Finding unmatched manga from pending manga list using title-based matching",
      );

      // Use pendingManga instead of the entire manga collection for fresh search
      unmatchedManga = pendingMangaState.pendingManga;
      console.debug(
        `[MatchingPage] Using pending manga list: ${unmatchedManga.length} manga to process`,
      );
    }

    // Combine the filtered manga with unmatched manga
    const pendingMangaToProcess = [
      ...filteredManga.map((item) => item.kenmeiManga),
      ...unmatchedManga,
    ];

    console.info(
      `[MatchingPage] Total manga to process: ${pendingMangaToProcess.length}`,
    );
    console.info(
      "[MatchingPage] IMPORTANT: Will clear cache entries for selected manga to ensure fresh searches",
    );
    console.debug("[MatchingPage] === END DEBUG INFO ===");

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

    console.info(
      `[MatchingPage] Rematching ${filteredManga.length} status-filtered manga and ${unmatchedManga.length} unmatched manga`,
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
      const { cacheDebugger } = await import("../api/matching/search-service");

      // Get initial cache status for comparison
      const initialCacheStatus = cacheDebugger.getCacheStatus();
      console.debug(
        `[MatchingPage] 📊 Initial cache status: ${initialCacheStatus.inMemoryCache} entries in memory, ${initialCacheStatus.localStorage.mangaCache} in localStorage`,
      );

      // Clear cache entries for each manga being rematched - use our new dedicated function
      const mangaTitles = pendingMangaToProcess.map((manga) => manga.title);
      console.info(
        `[MatchingPage] 🔄 Clearing cache for ${mangaTitles.length} manga titles at once`,
      );
      matchingProcess.setStatusMessage(
        `Clearing cache for ${mangaTitles.length} manga titles...`,
      );

      // Use our new function to clear cache entries efficiently
      const clearResult = clearCacheForTitles(mangaTitles);

      // Log the results
      console.info(
        `[MatchingPage] 🧹 Cleared ${clearResult.clearedCount} cache entries for selected manga`,
      );
      if (clearResult.clearedCount > 0 && mangaTitles.length > 0) {
        console.debug(
          "[MatchingPage] Cleared titles:",
          mangaTitles.slice(0, 5).join(", ") +
            (mangaTitles.length > 5
              ? ` and ${mangaTitles.length - 5} more...`
              : ""),
        );
      }

      // Log final cache status
      console.debug(
        `[MatchingPage] 📊 Final cache status: ${clearResult.remainingCacheSize} entries in memory (removed ${clearResult.clearedCount})`,
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

      console.info(
        `[MatchingPage] Preserved ${existingResults.length} existing match results that aren't being rematched`,
      );

      // Clear undo/redo history before rematch
      undoRedoManager.clear();

      // Start fresh search
      matchingProcess.startMatching(
        pendingMangaToProcess,
        true,
        setMatchResults,
      );
    } catch (error) {
      console.error(
        "[MatchingPage] Failed to clear manga cache entries:",
        error,
      );
      matchingProcess.setIsCacheClearing(false);
      // Continue with rematch even if cache clearing fails
      matchingProcess.startMatching(
        pendingMangaToProcess,
        true,
        setMatchResults,
      );
    }
  };

  // Check for authentication error first - show before skeleton loading
  if (matchingProcess.error?.includes("Authentication Required")) {
    return (
      <div className="relative flex h-full w-full flex-1">
        <motion.div
          className="container mx-auto flex h-full max-w-full flex-col px-4 py-6 md:px-6"
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          <MatchingPageHeader
            headerVariants={headerVariants}
            matchResultsLength={0}
            showRematchOptions={false}
            setShowRematchOptions={() => {}}
            handleSetAllMatchedToPending={() => {}}
            matchingProcessIsLoading={false}
            rateLimitIsRateLimited={false}
            statusSummary={matchStatusSummary}
            pendingBacklog={0}
            handleUndo={() => {}}
            handleRedo={() => {}}
            canUndo={false}
            canRedo={false}
          />
          <motion.div
            className="relative flex flex-1 items-center justify-center"
            variants={contentVariants}
          >
            <AuthRequiredCard
              onGoToSettings={() => navigate({ to: "/settings" })}
            />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Loading state
  if (isInitialLoad && matchResults.length === 0) {
    return (
      <div className="relative flex h-full w-full flex-1">
        <motion.div
          className="container mx-auto flex h-full max-w-full flex-col px-4 py-6 md:px-6"
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          <MatchingPageHeader
            headerVariants={headerVariants}
            matchResultsLength={0}
            showRematchOptions={false}
            setShowRematchOptions={() => {}}
            handleSetAllMatchedToPending={() => {}}
            matchingProcessIsLoading={false}
            rateLimitIsRateLimited={false}
            statusSummary={matchStatusSummary}
            pendingBacklog={0}
            handleUndo={() => {}}
            handleRedo={() => {}}
            canUndo={false}
            canRedo={false}
          />
          <motion.div
            className="relative grid flex-1 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
            variants={contentVariants}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <motion.div
                key={`skeleton-card-${index + 1}`}
                variants={itemVariants}
              >
                <SkeletonCard />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (matchingProcess.isLoading) {
    return (
      <LoadingView
        pageVariants={pageVariants}
        contentVariants={contentVariants}
        matchingProcess={matchingProcess}
        rateLimitState={rateLimitState}
        navigate={navigate}
        matchResultsLength={matchResults.length}
        onRetry={handleRetry}
        onDismissError={() => matchingProcess.setError?.(null)}
      />
    );
  }

  return (
    <div className="relative flex h-full w-full flex-1">
      <motion.div
        className="container mx-auto flex h-full max-w-full flex-col px-4 py-6 md:px-6"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        <MatchingPageHeader
          headerVariants={headerVariants}
          matchResultsLength={matchResults.length}
          showRematchOptions={showRematchOptions}
          setShowRematchOptions={setShowRematchOptions}
          handleSetAllMatchedToPending={handleSetAllMatchedToPending}
          matchingProcessIsLoading={matchingProcess.isLoading}
          rateLimitIsRateLimited={rateLimitState.isRateLimited}
          statusSummary={matchStatusSummary}
          pendingBacklog={pendingMangaState.pendingManga.length}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

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

        {/* Duplicate AniList ID Warning */}
        <AnimatePresence>
          {showDuplicateWarning && duplicateEntries.length > 0 && (
            <DuplicateWarning
              duplicates={duplicateEntries}
              onDismiss={() => setShowDuplicateWarning(false)}
              onSearchAnilist={(title) => setSearchQuery(title)}
              onIgnoreDuplicate={(anilistId, anilistTitle) => {
                addIgnoredDuplicate(anilistId, anilistTitle);
                // Refresh duplicates to remove the ignored one
                const updatedDuplicates =
                  detectDuplicateAniListIds(matchResults);
                setDuplicateEntries(updatedDuplicates);
                // Hide warning if no duplicates remain
                if (updatedDuplicates.length === 0) {
                  setShowDuplicateWarning(false);
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* Initialization state - only show if not already loading and we have pending manga */}
        {matchingProcess.isInitializing &&
          !matchingProcess.isLoading &&
          pendingMangaState.pendingManga.length > 0 && <InitializationCard />}

        {/* Resume message when we have pending manga but aren't already in the loading state */}
        {resumeState.needsProcessing &&
          !matchingProcess.isLoading &&
          !matchingProcess.isInitializing && (
            <MatchingResume
              pendingMangaCount={resumeState.unprocessedCount}
              onResumeMatching={() => {
                console.info(
                  "[MatchingPage] Resume matching clicked - ensuring unprocessed manga are processed",
                );

                if (resumeState.unprocessedManga.length > 0) {
                  pendingMangaState.savePendingManga(
                    resumeState.unprocessedManga,
                  );
                  setTimeout(() => {
                    matchingProcess.handleResumeMatching(
                      matchResults,
                      setMatchResults,
                    );
                  }, 100);
                } else {
                  pendingMangaState.savePendingManga([]);
                  matchingProcess.setError(
                    "All manga have already been processed. No additional matching is needed.",
                  );
                }
              }}
              onCancelResume={matchingProcess.handleCancelResume}
            />
          )}

        {/* Main content */}
        <motion.div className="relative flex-1" variants={contentVariants}>
          {matchResults.length > 0 ? (
            <>
              {/* Batch Selection Toolbar */}
              {selectedMatchIds.size > 0 && (
                <BatchSelectionToolbar
                  selectedCount={selectedMatchIds.size}
                  onAccept={handleBatchAccept}
                  onReject={handleBatchReject}
                  onReset={handleBatchReset}
                  onClearSelection={handleClearSelection}
                />
              )}

              <MatchingPanel
                matches={matchResults}
                onManualSearch={matchHandlers.handleManualSearch}
                onAcceptMatch={matchHandlers.handleAcceptMatch}
                onRejectMatch={matchHandlers.handleRejectMatch}
                onSelectAlternative={matchHandlers.handleSelectAlternative}
                onResetToPending={matchHandlers.handleResetToPending}
                searchQuery={searchQuery}
                onSetMatchedToPending={handleSetAllMatchedToPending}
                disableSetMatchedToPending={
                  matchingProcess.isLoading || rateLimitState.isRateLimited
                }
                onProceedToSync={handleProceedToSync}
                onBackToImport={() => {
                  pendingMangaState.savePendingManga([]);
                  navigate({ to: "/import" });
                }}
                selectedMatchIds={selectedMatchIds}
                onToggleSelection={handleToggleSelection}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
              />
            </>
          ) : (
            <AnimatePresence>
              <EmptyState
                icon={<FileSearch className="h-10 w-10" />}
                title="No manga to match"
                description="No manga data available. Import your Kenmei library to get started."
                actionLabel="Go to Import"
                onAction={() => {
                  pendingMangaState.savePendingManga([]);
                  navigate({ to: "/import" });
                }}
                variant="info"
              />
            </AnimatePresence>
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
              <MatchingErrorToast
                error={matchingProcess.error}
                onDismiss={() => matchingProcess.setError(null)}
              />
            )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
