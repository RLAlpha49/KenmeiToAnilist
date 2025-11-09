/**
 * Hook for managing reading history filtering with worker pool support
 * Parallelizes history filtering and aggregation to keep UI responsive
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getReadingHistoryWorkerPool,
  type ReadingHistoryFilterResult,
} from "@/workers";
import type { ReadingHistory } from "@/utils/storage";

/**
 * Hook for filtering reading history with worker pool support
 * Memoizes results by cache key to avoid redundant computations
 */
export function useReadingHistoryFilter(
  readingHistory: ReadingHistory,
  dateRange: {
    start: Date | number;
    end: Date | number;
  },
  aggregationType?: "daily" | "weekly" | "none",
  onProgressChange?: (stage: string, progress: number, message: string) => void,
): {
  filterResult: ReadingHistoryFilterResult | null;
  isFiltering: boolean;
  error: Error | null;
  cacheKey: string;
} {
  const [filterResult, setFilterResult] =
    useState<ReadingHistoryFilterResult | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, ReadingHistoryFilterResult>>(new Map());
  const poolRef = useRef<ReturnType<typeof getReadingHistoryWorkerPool> | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize worker pool once
  useEffect(() => {
    const initPool = async () => {
      if (!poolRef.current) {
        const pool = getReadingHistoryWorkerPool();
        await pool.initialize();
        poolRef.current = pool;
      }
    };

    void initPool();

    return () => {
      // Cleanup: terminate pool when component unmounts
      if (poolRef.current) {
        poolRef.current.terminate();
        poolRef.current = null;
      }
    };
  }, []);

  // Generate cache key based on date range and aggregation type
  const cacheKey = useCallback(() => {
    const startMs =
      dateRange.start instanceof Date
        ? dateRange.start.getTime()
        : dateRange.start;
    const endMs =
      dateRange.end instanceof Date ? dateRange.end.getTime() : dateRange.end;
    const aggStr = aggregationType || "none";

    const keyStr = `history:${startMs}:${endMs}:${aggStr}`;
    // Simple hash function for browser compatibility
    let hash = 0;
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.codePointAt(i);
      if (char === undefined) continue;
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${keyStr}:${Math.abs(hash)}`;
  }, [dateRange, aggregationType]);

  const currentCacheKey = cacheKey();

  // Main filtering effect
  useEffect(() => {
    // Check cache first
    const cached = cacheRef.current.get(currentCacheKey);
    if (cached) {
      console.debug("[useReadingHistoryFilter] Using cached filter result");
      setFilterResult(cached);
      setIsFiltering(false);
      return;
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const runFilter = async () => {
      setIsFiltering(true);
      setError(null);

      try {
        if (!poolRef.current) {
          throw new Error("Worker pool not initialized");
        }

        const result = await poolRef.current.filterReadingHistory(
          readingHistory,
          dateRange,
          aggregationType,
          onProgressChange,
        );

        if (signal.aborted) {
          return;
        }

        // Cache the result
        cacheRef.current.set(currentCacheKey, result);
        setFilterResult(result);
        setError(null);

        console.info(
          `[useReadingHistoryFilter] ✅ Filter complete (${result.timing.totalTimeMs.toFixed(2)}ms)`,
        );
      } catch (err) {
        if (signal.aborted) {
          return;
        }

        const filterError = err instanceof Error ? err : new Error(String(err));
        console.error(
          "[useReadingHistoryFilter] ❌ Filter failed:",
          filterError,
        );
        setError(filterError);
      } finally {
        if (!signal.aborted) {
          setIsFiltering(false);
        }
      }
    };

    void runFilter();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    currentCacheKey,
    readingHistory,
    dateRange,
    aggregationType,
    onProgressChange,
  ]);

  return {
    filterResult,
    isFiltering,
    error,
    cacheKey: currentCacheKey,
  };
}
