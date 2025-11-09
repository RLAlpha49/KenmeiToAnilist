/**
 * Hook for debounced advanced filter application using workers
 *
 * Provides:
 * - Debounced filter execution (avoids excessive processing)
 * - Incremental diff tracking (only processes when filters actually change)
 * - Worker-based filtering with fallback
 * - Performance metrics and debug information
 * - Comprehensive error handling
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { getFilterWorkerPool } from "@/workers/filter-worker-pool";
import type { FilterOperationResult } from "@/workers/filter-worker-pool";
import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";

interface UseAdvancedFilterResult {
  /**
   * Filtered match results
   */
  filteredMatches: MangaMatchResult[];

  /**
   * Statistics about the filter operation
   */
  stats: FilterOperationResult["stats"] | null;

  /**
   * Whether a filter operation is currently in progress
   */
  isFiltering: boolean;

  /**
   * Performance timing from last filter operation
   */
  timing: FilterOperationResult["timing"] | null;

  /**
   * Whether the last filter was executed on a worker
   */
  wasWorkerExecution: boolean;

  /**
   * Error from filter operation (if any)
   */
  error: Error | null;

  /**
   * Debug information about the last operation
   */
  debug?: {
    /**
     * Reasons why matches were filtered out (limited to 100 entries)
     */
    mismatchReasons: Array<{
      matchId: number;
      reason: string;
    }>;
  };
}

/**
 * Debounce time for filter changes (milliseconds)
 */
const FILTER_DEBOUNCE_MS = 300;

/**
 * Hook for applying advanced filters with debouncing and worker support
 *
 * Features:
 * - Automatically debounces filter changes to avoid excessive processing
 * - Uses worker threads when available for better performance
 * - Tracks incremental diffs to skip unnecessary updates
 * - Provides comprehensive error handling with fallback to main thread
 * - Includes performance metrics for debugging
 *
 * @param matches - The match array to filter
 * @param filters - The filter criteria to apply
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 * @returns Filter result with matches, stats, timing, and error info
 */
export function useAdvancedFilter(
  matches: MangaMatchResult[],
  filters: AdvancedMatchFilters,
  debounceMs: number = FILTER_DEBOUNCE_MS,
): UseAdvancedFilterResult {
  const [filteredMatches, setFilteredMatches] =
    useState<MangaMatchResult[]>(matches);
  const [stats, setStats] = useState<FilterOperationResult["stats"] | null>(
    null,
  );
  const [isFiltering, setIsFiltering] = useState(false);
  const [timing, setTiming] = useState<FilterOperationResult["timing"] | null>(
    null,
  );
  const [wasWorkerExecution, setWasWorkerExecution] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [debug, setDebug] = useState<UseAdvancedFilterResult["debug"]>();

  // Track the last applied filters to detect changes
  const lastFiltersRef = useRef<AdvancedMatchFilters | null>(null);
  const lastMatchesLengthRef = useRef<number>(0);

  // Debounce timeout ID
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Worker pool instance
  const filterPoolRef = useRef(getFilterWorkerPool());

  // Track whether this is the first render
  const isFirstRenderRef = useRef(true);

  // Initialize worker pool
  useEffect(() => {
    filterPoolRef.current.initialize().catch((err) => {
      console.warn(
        "[useAdvancedFilter] Failed to initialize filter worker pool:",
        err,
      );
    });
  }, []);

  /**
   * Check if filters have meaningfully changed
   */
  const haveFiltersChanged = useCallback(() => {
    // If no previous filters, treat as changed
    if (!lastFiltersRef.current) return true;

    // If match count changed significantly, filters may need updating
    if (lastMatchesLengthRef.current !== matches.length) {
      return true;
    }

    // Deep comparison of filter objects
    return JSON.stringify(lastFiltersRef.current) !== JSON.stringify(filters);
  }, [matches.length, filters]);

  /**
   * Apply filters with debouncing
   */
  const applyFilters = useCallback(async () => {
    // Check if filters actually changed
    if (!haveFiltersChanged()) {
      return;
    }

    setIsFiltering(true);
    setError(null);
    setDebug(undefined);

    try {
      const result = await filterPoolRef.current.filterMatches(
        matches,
        filters,
      );

      // Update state with results
      setFilteredMatches(result.filteredMatches);
      setStats(result.stats);
      setTiming(result.timing);
      setWasWorkerExecution(result.executedOnWorker);
      if (result.debug) {
        setDebug(result.debug);
      }

      // Record that we've applied these filters
      lastFiltersRef.current = structuredClone(filters);
      lastMatchesLengthRef.current = matches.length;

      // Log performance metrics in development
      if (process.env.NODE_ENV === "development") {
        const workerTag = result.executedOnWorker ? "🔄 worker" : "⚙️ main";
        console.debug(
          `[useAdvancedFilter] ${workerTag}: ${result.stats.filteredCount}/${result.stats.totalMatches} matches (${result.timing.processingTimeMs.toFixed(2)}ms)`,
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("[useAdvancedFilter] Filter operation failed:", error);

      // On error, keep previous filtered matches (don't show empty state)
      // This provides a better UX during transient failures
    } finally {
      setIsFiltering(false);
    }
  }, [matches, filters, haveFiltersChanged]);

  /**
   * Debounced filter application
   */
  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Check if filters changed - if not, don't debounce
    if (!haveFiltersChanged()) {
      return;
    }

    // Skip debounce on first render to show initial results immediately
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      applyFilters().catch((err) => {
        console.error("[useAdvancedFilter] Initial filter failed:", err);
      });
      return;
    }

    // Set new debounce timeout
    debounceTimeoutRef.current = setTimeout(() => {
      applyFilters().catch((err) => {
        console.error("[useAdvancedFilter] Debounced filter failed:", err);
      });
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [matches, filters, debounceMs, haveFiltersChanged, applyFilters]);

  return {
    filteredMatches,
    stats,
    isFiltering,
    timing,
    wasWorkerExecution,
    error,
    debug,
  };
}
