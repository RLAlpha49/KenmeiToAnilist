/**
 * @packageDocumentation
 * @module MangaMatchingPanel
 * @description React component for reviewing, filtering, sorting, and managing manga match results, including manual search, acceptance, rejection, and alternative selection.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { KenmeiManga } from "../../api/kenmei/types";
import { MangaMatchResult, AniListManga } from "../../api/anilist/types";
import {
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Type,
  ListFilter,
  Sparkles,
  BookOpen,
  ArrowUpDown,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/utils/tailwind";

// Import storage utilities
import { getMatchConfig, saveMatchConfig } from "../../utils/storage";

// Import shadcn UI components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { SkeletonCard } from "../../components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";
import MatchCard from "./MangaMatchingPanel/MatchCard";
import { MatchStatisticsCard } from "./MangaMatchingPanel/MatchStatisticsCard";
import { MatchBulkActions } from "./MangaMatchingPanel/MatchBulkActions";
import {
  MatchFilterControls,
  type StatusFiltersState,
} from "./MangaMatchingPanel/MatchFilterControls";
import { AlternativeSearchSettingsCard } from "./MangaMatchingPanel/AlternativeSearchSettingsCard";

/**
 * Props for the MangaMatchingPanel component.
 *
 * @property matches - The list of manga match results to review and manage.
 * @property onManualSearch - Optional callback to trigger a manual search for a Kenmei manga.
 * @property onAcceptMatch - Optional callback to accept a match result.
 * @property onRejectMatch - Optional callback to reject a match result.
 * @property onSelectAlternative - Optional callback to select an alternative match.
 * @property onResetToPending - Optional callback to reset a match to pending status.
 * @property isLoadingInitial - Optional flag to show skeleton loaders during initial load.
 * @property selectedMatchIds - Optional set of selected match IDs for batch operations.
 * @property onToggleSelection - Optional callback to toggle selection of a match.
 * @property onSelectAll - Optional callback to select all visible matches with list of IDs.
 * @property onClearSelection - Optional callback to clear all selections.
 * @internal
 * @source
 */
export interface MangaMatchingPanelProps {
  matches: MangaMatchResult[];
  onManualSearch?: (kenmeiManga: KenmeiManga) => void;
  onAcceptMatch?: (match: MangaMatchResult) => void;
  onRejectMatch?: (match: MangaMatchResult) => void;
  onSelectAlternative?: (
    match: MangaMatchResult,
    alternativeIndex: number,
    autoAccept?: boolean,
    directAccept?: boolean,
  ) => void;
  onResetToPending?: (match: MangaMatchResult) => void;
  searchQuery?: string;
  onSetMatchedToPending?: () => void;
  disableSetMatchedToPending?: boolean;
  isLoadingInitial?: boolean;
  selectedMatchIds?: Set<number>;
  onToggleSelection?: (matchId: number) => void;
  onSelectAll?: (ids: number[]) => void;
  onClearSelection?: () => void;
}

/**
 * MangaMatchingPanel React component for reviewing, filtering, sorting, and managing manga match results, including manual search, acceptance, rejection, and alternative selection.
 *
 * @param props - The props for the MangaMatchingPanel component.
 * @returns The rendered manga matching panel React element.
 * @source
 */
export function MangaMatchingPanel({
  matches,
  onManualSearch,
  onAcceptMatch,
  onRejectMatch,
  onSelectAlternative,
  onResetToPending,
  searchQuery,
  onSetMatchedToPending,
  isLoadingInitial = false,
  selectedMatchIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
}: Readonly<MangaMatchingPanelProps>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilters, setStatusFilters] = useState<StatusFiltersState>({
    matched: true,
    pending: true,
    manual: true,
    skipped: true,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastExternalSearchQuery = useRef<string | undefined>(undefined);

  type SortField = "title" | "status" | "confidence" | "chapters_read";
  const [sortOption, setSortOption] = useState<{
    field: SortField;
    direction: "asc" | "desc";
  }>({ field: "title", direction: "asc" });

  const itemsPerPage = 10;
  const [isSkippingEmptyMatches, setIsSkippingEmptyMatches] = useState(false);
  const [isAcceptingAllMatches, setIsAcceptingAllMatches] = useState(false);
  const [isReSearchingNoMatches, setIsReSearchingNoMatches] = useState(false);
  const [isResettingSkippedToPending, setIsResettingSkippedToPending] =
    useState(false);
  const [isResettingMatchedToPending] = useState(false);

  // Add state for adult content settings and blur management
  const [blurAdultContent, setBlurAdultContent] = useState(true);
  const [unblurredImages, setUnblurredImages] = useState<Set<string>>(
    new Set(),
  );

  // Add state for Comick search setting (disabled - Comick temporarily unavailable)
  // eslint-disable-next-line
  const [enableComickSearch, setEnableComickSearch] = useState(false);
  // Add state for MangaDex search setting
  const [enableMangaDexSearch, setEnableMangaDexSearch] = useState(true);

  // Load blur settings from match config
  useEffect(() => {
    const loadBlurSettings = async () => {
      const matchConfig = getMatchConfig();
      setBlurAdultContent(matchConfig.blurAdultContent);
      // Comick is temporarily disabled, keep it false
      setEnableComickSearch(false);
      setEnableMangaDexSearch(matchConfig.enableMangaDexSearch);
    };
    loadBlurSettings();
  }, []);

  // Helper functions for adult content handling
  const isAdultContent = (manga: AniListManga | undefined | null) => {
    return manga?.isAdult === true;
  };

  const shouldBlurImage = (mangaId: string) => {
    return blurAdultContent && !unblurredImages.has(mangaId);
  };

  const toggleImageBlur = (mangaId: string) => {
    setUnblurredImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mangaId)) {
        newSet.delete(mangaId);
      } else {
        newSet.add(mangaId);
      }
      return newSet;
    });
  };

  // Handler for toggling Comick search setting
  const handleComickSearchToggle = async (enabled: boolean) => {
    setEnableComickSearch(enabled);
    try {
      const currentConfig = getMatchConfig();
      const updatedConfig = {
        ...currentConfig,
        enableComickSearch: enabled,
      };
      saveMatchConfig(updatedConfig);
    } catch (error) {
      console.error(
        "[MatchingPanel] Failed to save Comick search setting:",
        error,
      );
      // Revert the state if saving failed
      setEnableComickSearch(!enabled);
    }
  };

  // Handler for toggling MangaDex search setting
  const handleMangaDexSearchToggle = async (enabled: boolean) => {
    setEnableMangaDexSearch(enabled);
    try {
      const currentConfig = getMatchConfig();
      const updatedConfig = {
        ...currentConfig,
        enableMangaDexSearch: enabled,
      };
      saveMatchConfig(updatedConfig);
    } catch (error) {
      console.error(
        "[MatchingPanel] Failed to save MangaDex search setting:",
        error,
      );
      // Revert the state if saving failed
      setEnableMangaDexSearch(!enabled);
    }
  };

  // Selection helper
  const isMatchSelected = useCallback(
    (matchId: number): boolean => {
      return selectedMatchIds?.has(matchId) ?? false;
    },
    [selectedMatchIds],
  );

  // Handler for opening external links in the default browser
  const handleOpenExternal = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (globalThis.electronAPI?.shell?.openExternal) {
      globalThis.electronAPI.shell.openExternal(url);
    } else {
      // Fallback to regular link behavior if not in Electron
      globalThis.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Process matches to filter out Light Novels from alternatives
  const processedMatches = matches.map((match) => {
    // Ensure manga has an ID - if missing, generate one based on title
    if (match.kenmeiManga.id === undefined) {
      // Create a simple hash from the title
      const generatedId = match.kenmeiManga.title
        .split("")
        .reduce(
          (hash, char) => (hash << 5) - hash + (char.codePointAt(0) ?? 0),
          0,
        );
      match = {
        ...match,
        kenmeiManga: {
          ...match.kenmeiManga,
          id: Math.abs(generatedId),
        },
      };
    }

    // Filter out Light Novels from anilistMatches
    const filteredAltMatches = match.anilistMatches
      ? match.anilistMatches.filter(
          (m) =>
            m.manga &&
            m.manga.format !== "NOVEL" &&
            m.manga.format !== "LIGHT_NOVEL",
        )
      : [];

    // If the selected match is a Light Novel, clear it
    const newSelectedMatch =
      match.selectedMatch &&
      (match.selectedMatch.format === "NOVEL" ||
        match.selectedMatch.format === "LIGHT_NOVEL")
        ? undefined
        : match.selectedMatch;

    // Return a new object with filtered matches
    return {
      ...match,
      anilistMatches: filteredAltMatches,
      selectedMatch: newSelectedMatch,
    };
  });

  // Filter and search matches
  const filteredMatches = processedMatches.filter((match) => {
    // Sanity check - skip entries with no ID
    if (match.kenmeiManga.id === undefined) return false;

    // Apply status filters
    const statusMatch =
      (match.status === "matched" && statusFilters.matched) ||
      (match.status === "pending" && statusFilters.pending) ||
      (match.status === "manual" && statusFilters.manual) ||
      (match.status === "skipped" && statusFilters.skipped);

    // Then apply search term if any
    const searchMatch =
      !searchTerm ||
      match.kenmeiManga.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      match.selectedMatch?.title?.english
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      match.selectedMatch?.title?.romaji
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    return statusMatch && searchMatch;
  });

  // Sort the filtered matches
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    // Declare variables outside switch to avoid linter errors
    let titleA: string, titleB: string;
    let statusA: number, statusB: number;
    let confidenceA: number, confidenceB: number;
    let chaptersA: number, chaptersB: number;

    // Define status priority for sorting (matched > manual > conflict > pending > skipped)
    const statusPriority: Record<string, number> = {
      matched: 1,
      manual: 2,
      conflict: 3,
      pending: 4,
      skipped: 5,
    };

    switch (sortOption.field) {
      case "title":
        titleA = a.kenmeiManga.title.toLowerCase();
        titleB = b.kenmeiManga.title.toLowerCase();
        return sortOption.direction === "asc"
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA);

      case "status":
        statusA = statusPriority[a.status] || 999;
        statusB = statusPriority[b.status] || 999;
        return sortOption.direction === "asc"
          ? statusA - statusB
          : statusB - statusA;

      case "confidence":
        // Get confidence scores
        // Entries with actual matches but 0 confidence should rank higher than entries with no matches at all
        confidenceA =
          a.anilistMatches?.length && a.anilistMatches.length > 0
            ? (a.anilistMatches[0].confidence ?? 0)
            : -1; // No matches at all should be lowest

        confidenceB =
          b.anilistMatches?.length && b.anilistMatches.length > 0
            ? (b.anilistMatches[0].confidence ?? 0)
            : -1; // No matches at all should be lowest

        return sortOption.direction === "asc"
          ? confidenceA - confidenceB
          : confidenceB - confidenceA;

      case "chapters_read":
        chaptersA = a.kenmeiManga.chapters_read || 0;
        chaptersB = b.kenmeiManga.chapters_read || 0;
        return sortOption.direction === "asc"
          ? chaptersA - chaptersB
          : chaptersB - chaptersA;

      default:
        return 0;
    }
  });

  // Pagination logic
  const totalPages = Math.max(
    1,
    Math.ceil(sortedMatches.length / itemsPerPage),
  );
  const currentMatches = sortedMatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Auto-adjust current page if filters change
  useEffect(() => {
    // If current page is out of bounds, adjust it
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [statusFilters, searchTerm, totalPages, currentPage]);

  // Focus search input when pressing Ctrl+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle Ctrl+A to select all visible items on current page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in input fields or text areas
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd+A to select all visible items on current page
      if (
        modifier &&
        e.key === "a" &&
        currentMatches.length > 0 &&
        onSelectAll
      ) {
        e.preventDefault();
        const visibleIds = currentMatches.map((match) => match.kenmeiManga.id);
        onSelectAll(visibleIds);
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [currentMatches, onSelectAll]);

  // Count statistics
  const matchStats = {
    total: matches.length,
    matched: matches.filter((m) => m.status === "matched").length,
    pending: matches.filter((m) => m.status === "pending").length,
    manual: matches.filter((m) => m.status === "manual").length,
    skipped: matches.filter((m) => m.status === "skipped").length,
  };

  // Handle pagination
  const goToPage = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  // Add keyboard navigation for pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Handle arrow keys and Home/End keys
      if (e.key === "ArrowLeft" && currentPage > 1) {
        goToPage(currentPage - 1);
      } else if (e.key === "ArrowRight" && currentPage < totalPages) {
        goToPage(currentPage + 1);
      } else if (e.key === "Home" && currentPage > 1) {
        goToPage(1);
      } else if (e.key === "End" && currentPage < totalPages) {
        goToPage(totalPages);
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentPage, totalPages]);

  // Sync external searchQuery with local searchTerm
  useEffect(() => {
    if (
      searchQuery !== undefined &&
      searchQuery.trim() !== "" &&
      searchQuery !== lastExternalSearchQuery.current
    ) {
      setSearchTerm(searchQuery);
      lastExternalSearchQuery.current = searchQuery;
    }
  }, [searchQuery]);

  // Handle sort change
  const handleSortChange = (field: SortField) => {
    setSortOption((prev) => {
      // If clicking the same field, toggle direction
      if (prev.field === field) {
        return {
          ...prev,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      // If clicking a new field, default to ascending for title, descending for others
      return {
        field,
        direction: field === "title" ? "asc" : "desc",
      };
    });
  };

  // Function to render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortOption.field !== field) return null;

    return (
      <span className="ml-1 text-xs">
        {sortOption.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  // Confidence badge extracted to separate component

  // Helper function to format status text nicely - moved outside for reuse
  const formatStatusText = (status: string | undefined): string => {
    if (!status) return "Unknown";

    // Handle cases with underscores or spaces
    return status
      .split(/[_\s]+/) // Split by underscores or spaces
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Handle keyboard navigation for item selection
  const handleKeyDown = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  // Function to skip all pending matches with no results
  const handleSkipEmptyMatches = () => {
    // Set processing state to disable the button
    setIsSkippingEmptyMatches(true);

    // Find all pending manga with no matches
    const pendingWithNoMatches = matches.filter(
      (match) =>
        match.status === "pending" &&
        (!match.anilistMatches || match.anilistMatches.length === 0),
    );

    console.debug(
      `[MatchingPanel] Skipping ${pendingWithNoMatches.length} pending manga with no matches`,
    );

    // Skip all matches at once if possible
    if (pendingWithNoMatches.length > 0 && onRejectMatch) {
      // Create a single batched update by using a custom handler
      const batchedReject = matches.map((match) => {
        // Only modify the matches that need to be skipped
        if (
          match.status === "pending" &&
          (!match.anilistMatches || match.anilistMatches.length === 0)
        ) {
          // Return a modified version with skipped status
          return {
            ...match,
            status: "skipped" as const,
            selectedMatch: undefined,
            matchDate: new Date().toISOString(),
          };
        }
        // Return the original for all other matches
        return match;
      });

      // Pass the full array with modifications to the parent
      // Special flag to indicate this is a batch operation
      const batchOperation = {
        isBatchOperation: true,
        matches: batchedReject,
      };

      // @ts-expect-error - We're adding a special property for the batch handler to recognize
      onRejectMatch(batchOperation);

      // Short delay to ensure state updates have time to process
      setTimeout(() => {
        setIsSkippingEmptyMatches(false);
      }, 500);
    } else {
      // Reset processing state if no matching items found
      setIsSkippingEmptyMatches(false);
    }
  };

  // Get count of pending matches with no results
  const emptyMatchesCount = matches.filter(
    (match) =>
      match.status === "pending" &&
      (!match.anilistMatches || match.anilistMatches.length === 0),
  ).length;

  // Function to accept all pending matches with main matches
  const handleAcceptAllPendingMatches = () => {
    // Set processing state to disable the button
    setIsAcceptingAllMatches(true);

    // Find all pending manga with valid main matches
    const pendingWithMatches = matches.filter(
      (match) =>
        match.status === "pending" &&
        match.anilistMatches &&
        match.anilistMatches.length > 0,
    );

    console.debug(
      `[MatchingPanel] Accepting ${pendingWithMatches.length} pending manga with matches`,
    );

    // Accept all matches at once if possible
    if (pendingWithMatches.length > 0 && onAcceptMatch) {
      // Create a single batched update
      const batchedAccept = matches.map((match) => {
        // Only modify the matches that need to be accepted
        if (
          match.status === "pending" &&
          match.anilistMatches &&
          match.anilistMatches.length > 0
        ) {
          // Return a modified version with matched status
          return {
            ...match,
            status: "matched" as const,
            selectedMatch: match.anilistMatches[0].manga,
            matchDate: new Date().toISOString(),
          };
        }
        // Return the original for all other matches
        return match;
      });

      // Pass the full array with modifications to the parent
      // Special flag to indicate this is a batch operation
      const batchOperation = {
        isBatchOperation: true,
        matches: batchedAccept,
      };

      // @ts-expect-error - We're adding a special property for the batch handler to recognize
      onAcceptMatch(batchOperation);

      // Short delay to ensure state updates have time to process
      setTimeout(() => {
        setIsAcceptingAllMatches(false);
      }, 500);
    } else {
      // Reset processing state if no matching items found
      setIsAcceptingAllMatches(false);
    }
  };

  // Get count of pending matches with valid matches
  const pendingMatchesCount = matches.filter(
    (match) =>
      match.status === "pending" &&
      match.anilistMatches &&
      match.anilistMatches.length > 0,
  ).length;

  // Function to handle re-searching all manga without matches regardless of status
  const handleReSearchNoMatches = () => {
    // Set processing state to disable the button
    setIsReSearchingNoMatches(true);

    // Find all manga without any matches regardless of status
    const mangaWithoutMatches = matches.filter(
      (match) => !match.anilistMatches || match.anilistMatches.length === 0,
    );

    console.debug(
      `[MatchingPanel] Re-searching ${mangaWithoutMatches.length} manga without any matches`,
    );

    if (mangaWithoutMatches.length > 0) {
      // Extract the Kenmei manga objects from the matches
      const kenmeiMangaToResearch = mangaWithoutMatches.map(
        (match) => match.kenmeiManga,
      );

      // Create a custom event to trigger the re-search process at the page level
      // This allows us to use the same efficient batch processing as the "Fresh Search" button
      const customEvent = new CustomEvent("reSearchEmptyMatches", {
        detail: {
          mangaToResearch: kenmeiMangaToResearch,
        },
      });

      // Dispatch the event to be handled by the MatchingPage component
      globalThis.dispatchEvent(customEvent);

      // Reset processing state after a short delay
      setTimeout(() => {
        setIsReSearchingNoMatches(false);
      }, 1000);
    } else {
      // Reset processing state if no matching items found
      setIsReSearchingNoMatches(false);
    }
  };

  // Get count of manga without any matches
  const noMatchesCount = matches.filter(
    (match) => !match.anilistMatches || match.anilistMatches.length === 0,
  ).length;

  // Function to handle resetting all skipped manga to pending
  const handleResetSkippedToPending = () => {
    // Set processing state to disable the button
    setIsResettingSkippedToPending(true);

    // Find all skipped manga
    const skippedManga = matches.filter((match) => match.status === "skipped");

    console.debug(
      `[MatchingPanel] Resetting ${skippedManga.length} skipped manga to pending status`,
    );

    // Reset all these manga to pending status
    if (skippedManga.length > 0 && onResetToPending) {
      // Create a batched update by modifying the matches
      const batchedReset = matches.map((match) => {
        // Only modify the matches that are skipped
        if (match.status === "skipped") {
          // Return a modified version with pending status
          return {
            ...match,
            status: "pending" as const,
            selectedMatch: undefined,
            matchDate: new Date().toISOString(),
          };
        }
        // Return the original for all other matches
        return match;
      });

      // Pass the full array with modifications to the parent
      // Special flag to indicate this is a batch operation
      const batchOperation = {
        isBatchOperation: true,
        matches: batchedReset,
      };

      // @ts-expect-error - We're adding a special property for the batch handler to recognize
      onResetToPending(batchOperation);

      // Short delay to ensure state updates have time to process
      setTimeout(() => {
        setIsResettingSkippedToPending(false);
      }, 500);
    } else {
      // Reset processing state if no matching items found
      setIsResettingSkippedToPending(false);
    }
  };

  // Get count of skipped manga
  const skippedMangaCount = matches.filter(
    (match) => match.status === "skipped",
  ).length;

  // Count matched manga for bulk reset label
  const matchedCount = matches.filter((m) => m.status === "matched").length;

  return (
    <div
      className="flex flex-col space-y-4"
      ref={containerRef}
      tabIndex={-1} // Make div focusable but not in tab order
    >
      <MatchStatisticsCard
        matchStats={matchStats}
        noMatchesCount={noMatchesCount}
        searchTerm={searchTerm}
        onSearchTermChange={(value) => setSearchTerm(value)}
        searchInputRef={searchInputRef}
      />

      <MatchBulkActions
        emptyMatchesCount={emptyMatchesCount}
        onSkipEmptyMatches={handleSkipEmptyMatches}
        isSkippingEmptyMatches={isSkippingEmptyMatches}
        noMatchesCount={noMatchesCount}
        onReSearchNoMatches={handleReSearchNoMatches}
        isReSearchingNoMatches={isReSearchingNoMatches}
        skippedMangaCount={skippedMangaCount}
        onResetSkippedToPending={handleResetSkippedToPending}
        isResettingSkippedToPending={isResettingSkippedToPending}
        pendingMatchesCount={pendingMatchesCount}
        onAcceptAllPendingMatches={handleAcceptAllPendingMatches}
        isAcceptingAllMatches={isAcceptingAllMatches}
        onSetMatchedToPending={onSetMatchedToPending}
        isResettingMatchedToPending={isResettingMatchedToPending}
        matchedCount={matchedCount}
      />

      <MatchFilterControls
        statusFilters={statusFilters}
        setStatusFilters={setStatusFilters}
        matchStats={matchStats}
      />

      {/* Batch Selection Controls */}
      {onSelectAll && (
        <Card className="relative mb-4 overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
          <CardHeader className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                  Batch Selection
                </CardTitle>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {selectedMatchIds && selectedMatchIds.size > 0
                    ? `${selectedMatchIds.size} match${selectedMatchIds.size === 1 ? "" : "es"} selected`
                    : "Select multiple matches for batch operations"}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedMatchIds && selectedMatchIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="rounded-xl bg-slate-500/10 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-500/20 dark:text-slate-300 dark:hover:bg-slate-500/30"
                    title="Clear Selection (Esc)"
                  >
                    Clear Selection
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectAll) {
                        // Only select items currently visible on this page
                        const visibleIds = currentMatches.map(
                          (match) => match.kenmeiManga.id,
                        );
                        onSelectAll(visibleIds);
                      }
                    }}
                    className="rounded-xl bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                    title="Select All Visible Matches on This Page (Ctrl+A)"
                  >
                    Select All Visible
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <AlternativeSearchSettingsCard
        enableMangaDexSearch={enableMangaDexSearch}
        onComickSearchToggle={handleComickSearchToggle}
        onMangaDexSearchToggle={handleMangaDexSearchToggle}
      />

      {/* Sort options */}
      <Card className="relative mb-4 overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
        <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-blue-400/15 blur-3xl" />
        <CardHeader className="relative z-10 flex flex-col gap-2 border-b border-white/40 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
              <ArrowUpDown className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                Sort Priorities
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tap a mode to focus your review queue. Tap again to flip
                direction.
              </p>
            </div>
          </div>
          <Badge className="rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            {sortOption.field.toUpperCase()} ·{" "}
            {sortOption.direction === "asc" ? "Ascending" : "Descending"}
          </Badge>
        </CardHeader>
        <CardContent className="relative z-10 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                field: "title" as const,
                label: "Title",
                helper: "Alphabetical preview",
                icon: Type,
                accent: "from-slate-400/20 via-slate-500/10 to-transparent",
              },
              {
                field: "status" as const,
                label: "Status",
                helper: "Group by review workflow",
                icon: ListFilter,
                accent: "from-emerald-400/20 via-emerald-500/10 to-transparent",
              },
              {
                field: "confidence" as const,
                label: "Confidence",
                helper: "Highest certainty first",
                icon: Sparkles,
                accent: "from-violet-400/20 via-violet-500/10 to-transparent",
              },
              {
                field: "chapters_read" as const,
                label: "Chapters Read",
                helper: "Prioritize deep progress",
                icon: BookOpen,
                accent: "from-amber-400/20 via-amber-500/10 to-transparent",
              },
            ].map(({ field, label, helper, icon: Icon, accent }) => {
              const isActive = sortOption.field === field;
              let directionLabel: string;
              if (isActive) {
                directionLabel =
                  sortOption.direction === "asc" ? "Ascending" : "Descending";
              } else {
                directionLabel = "Tap to sort";
              }

              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => handleSortChange(field)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-white/40 bg-white/65 p-4 text-left shadow-md transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-slate-800/60 dark:bg-slate-900/65 dark:hover:border-slate-700",
                    isActive &&
                      "ring-offset-background ring-2 ring-indigo-400 ring-offset-2",
                  )}
                >
                  <div
                    className={cn(
                      "bg-linear-to-br absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-70",
                      accent,
                    )}
                  />
                  <div className="relative flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70",
                            isActive && "border-indigo-400/50 text-indigo-500",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {label}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 rounded-full border border-white/40 bg-white/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                      >
                        {directionLabel}
                        {renderSortIndicator(field)}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {helper}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confidence accuracy notice */}
      <div className="relative mb-4 overflow-hidden rounded-3xl border border-amber-400/40 bg-amber-50/80 p-5 shadow-xl shadow-amber-500/10 backdrop-blur dark:border-amber-500/30 dark:bg-amber-900/25">
        <div className="pointer-events-none absolute -top-20 left-10 h-48 w-48 rounded-full bg-amber-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-8 h-40 w-40 rounded-full bg-red-400/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-100/70 text-amber-600 shadow-inner dark:border-amber-500/30 dark:bg-amber-900/40 dark:text-amber-200">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                Confidence percentages are advisory
              </h3>
              <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
                Treat the score as a hint—not a guarantee. Always glance over
                matches with similar titles, alternate editions, or multiple
                adaptations.
              </p>
              <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
                Found a confidence outlier? Let me know so I can improve the
                matching for everyone.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Badge className="rounded-full border border-amber-500/20 bg-amber-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/40 dark:text-amber-100">
              Manual review recommended
            </Badge>
            <a
              href="https://github.com/RLAlpha49/KenmeiToAnilist/issues/new?template=confidence_mismatch.md"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenExternal(
                "https://github.com/RLAlpha49/KenmeiToAnilist/issues/new?template=confidence_mismatch.md",
              )}
              className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-transparent px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10 hover:text-amber-800 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/20"
            >
              <AlertTriangle className="h-4 w-4" />
              Report a mismatch
            </a>
          </div>
        </div>
      </div>

      {/* Match list */}
      <div className="space-y-6" aria-live="polite">
        {isLoadingInitial && matches.length === 0 ? (
          <motion.div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <motion.div
                key={`skeleton-card-${index + 1}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <SkeletonCard />
              </motion.div>
            ))}
          </motion.div>
        ) : currentMatches.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {currentMatches.map((match, index) => {
              // Generate a unique key using index as fallback when ID is undefined
              const uniqueKey = match.kenmeiManga.id
                ? `${match.kenmeiManga.id}-${match.status}`
                : `index-${index}-${match.status}-${match.kenmeiManga.title?.replaceAll(" ", "_") || "unknown"}`;

              // Extract border color class for clarity
              let borderColorClass = "";
              if (match.status === "matched") {
                borderColorClass =
                  "border-emerald-300/70 dark:border-emerald-500/60";
              } else if (match.status === "manual") {
                borderColorClass = "border-sky-300/70 dark:border-sky-500/60";
              } else if (match.status === "skipped") {
                borderColorClass = "border-rose-300/70 dark:border-rose-500/60";
              } else {
                borderColorClass =
                  "border-slate-200/80 dark:border-slate-700/70";
              }

              // Extract status color for the indicator
              let statusBgColorClass = "";
              if (match.status === "matched") {
                statusBgColorClass =
                  "bg-gradient-to-b from-emerald-400 to-emerald-600";
              } else if (match.status === "manual") {
                statusBgColorClass = "bg-gradient-to-b from-sky-400 to-sky-600";
              } else if (match.status === "skipped") {
                statusBgColorClass =
                  "bg-gradient-to-b from-rose-400 to-rose-600";
              } else {
                statusBgColorClass =
                  "bg-gradient-to-b from-slate-300 to-slate-500";
              }

              let glowClass = "";
              if (match.status === "matched") {
                glowClass =
                  "hover:shadow-emerald-500/30 hover:ring-emerald-400/60";
              } else if (match.status === "manual") {
                glowClass = "hover:shadow-sky-500/30 hover:ring-sky-400/60";
              } else if (match.status === "skipped") {
                glowClass = "hover:shadow-rose-500/25 hover:ring-rose-400/60";
              } else {
                glowClass = "hover:shadow-slate-500/20 hover:ring-slate-300/60";
              }

              return (
                <MatchCard
                  key={uniqueKey}
                  match={match}
                  uniqueKey={uniqueKey}
                  borderColorClass={borderColorClass}
                  statusBgColorClass={statusBgColorClass}
                  glowClass={glowClass}
                  formatStatusText={formatStatusText}
                  handleOpenExternal={handleOpenExternal}
                  handleKeyDown={handleKeyDown}
                  isAdultContent={isAdultContent}
                  shouldBlurImage={shouldBlurImage}
                  toggleImageBlur={toggleImageBlur}
                  onManualSearch={onManualSearch}
                  onAcceptMatch={onAcceptMatch}
                  onRejectMatch={onRejectMatch}
                  onSelectAlternative={onSelectAlternative}
                  onResetToPending={onResetToPending}
                  isSelected={isMatchSelected(match.kenmeiManga.id)}
                  onToggleSelection={
                    onToggleSelection
                      ? () => onToggleSelection(match.kenmeiManga.id)
                      : undefined
                  }
                />
              );
            })}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm
                ? `No manga matches found for "${searchTerm}" with the current filters.`
                : "No manga matches found with the current filters."}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="mt-4 flex flex-col items-center justify-between space-y-3 sm:flex-row sm:space-y-0"
          aria-label="Pagination navigation"
        >
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing{" "}
            <span className="font-medium">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {Math.min(currentPage * itemsPerPage, sortedMatches.length)}
            </span>{" "}
            of <span className="font-medium">{sortedMatches.length}</span>{" "}
            results
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              (Use ← → arrow keys to navigate, Home/End for first/last page)
            </span>
          </div>
          <div className="inline-flex items-center space-x-1">
            <button
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              aria-label="First page"
              title="Go to first page"
            >
              <span className="text-xs">«</span>
              <span className="sr-only sm:not-sr-only sm:ml-1">First</span>
            </button>

            <button
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
            </button>

            <span className="mx-2 inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="font-medium">{currentPage}</span>
              <span className="mx-1">/</span>
              <span className="font-medium">{totalPages}</span>
            </span>

            <button
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              aria-label="Last page"
              title="Go to last page"
            >
              <span className="sr-only sm:not-sr-only sm:mr-1">Last</span>
              <span className="text-xs">»</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
