/**
 * Hook for managing statistics aggregation with worker pool support
 * Replaces multiple useMemo calls with single worker pool dispatch
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getStatisticsWorkerPool,
  type StatisticsAggregationResult,
} from "@/workers";
import type {
  NormalizedMatchForStats,
  TimeRange,
} from "@/utils/statistics-adapter";
import type { ReadingHistory } from "@/utils/storage";
import type { StatisticsFilters, ComparisonMode } from "@/types/statistics";

/**
 * Hook for aggregating statistics data with worker pool support
 * Memoizes results by cache key to avoid redundant computations
 */
export function useStatisticsAggregation(
  matchResults: NormalizedMatchForStats[],
  readingHistory: ReadingHistory,
  filters: StatisticsFilters,
  comparisonMode: ComparisonMode,
  selectedTimeRange: TimeRange,
  onProgressChange?: (stage: string, progress: number, message: string) => void,
): {
  aggregationResult: StatisticsAggregationResult | null;
  isAggregating: boolean;
  error: Error | null;
  cacheKey: string;
} {
  const [aggregationResult, setAggregationResult] =
    useState<StatisticsAggregationResult | null>(null);
  const [isAggregating, setIsAggregating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, StatisticsAggregationResult>>(new Map());
  const poolRef = useRef<ReturnType<typeof getStatisticsWorkerPool> | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize worker pool once
  useEffect(() => {
    let isMounted = true;

    const initPool = async () => {
      if (!poolRef.current && isMounted) {
        const pool = getStatisticsWorkerPool();
        await pool.initialize();
        if (isMounted) {
          poolRef.current = pool;
        }
      }
    };

    void initPool();

    return () => {
      isMounted = false;
      // Cleanup: terminate pool when component unmounts
      if (poolRef.current) {
        poolRef.current.terminate();
        poolRef.current = null;
      }
    };
  }, []);

  // Generate cache key based on filters, comparison mode, and time range
  const cacheKey = useCallback(() => {
    const filterStr = JSON.stringify(filters);
    const comparisonStr = JSON.stringify(comparisonMode);
    const timeStr = selectedTimeRange;

    const keyStr = `stats:${filterStr}:${comparisonStr}:${timeStr}`;
    // Simple hash function for browser compatibility
    let hash = 0;
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.codePointAt(i);
      if (char === undefined) continue;
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${keyStr}:${Math.abs(hash)}`;
  }, [filters, comparisonMode, selectedTimeRange]);

  const currentCacheKey = cacheKey();

  // Main aggregation effect
  useEffect(() => {
    // Check cache first
    const cached = cacheRef.current.get(currentCacheKey);
    if (cached) {
      console.debug(
        "[useStatisticsAggregation] Using cached aggregation result",
      );
      setAggregationResult(cached);
      setIsAggregating(false);
      return;
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const runAggregation = async () => {
      setIsAggregating(true);
      setError(null);

      try {
        // Wait for pool initialization with timeout
        let attempts = 0;
        const maxAttempts = 100; // ~5 seconds with 50ms intervals
        while (!poolRef.current && attempts < maxAttempts && !signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          attempts++;
        }

        if (signal.aborted) {
          return;
        }

        if (!poolRef.current) {
          throw new Error(
            "Worker pool initialization timeout - unable to initialize worker pool",
          );
        }

        const result = await poolRef.current.aggregateStatistics(
          matchResults,
          readingHistory,
          filters,
          comparisonMode,
          selectedTimeRange,
          onProgressChange,
        );

        if (signal.aborted) {
          return;
        }

        // Cache the result
        cacheRef.current.set(currentCacheKey, result);
        setAggregationResult(result);
        setError(null);

        console.info(
          `[useStatisticsAggregation] ✅ Aggregation complete (${result.timing.totalTimeMs.toFixed(2)}ms)`,
        );
      } catch (err) {
        if (signal.aborted) {
          return;
        }

        const aggregationError =
          err instanceof Error ? err : new Error(String(err));
        console.error(
          "[useStatisticsAggregation] ❌ Aggregation failed:",
          aggregationError,
        );
        setError(aggregationError);
      } finally {
        if (!signal.aborted) {
          setIsAggregating(false);
        }
      }
    };

    void runAggregation();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    currentCacheKey,
    matchResults,
    readingHistory,
    filters,
    comparisonMode,
    selectedTimeRange,
    onProgressChange,
  ]);

  return {
    aggregationResult,
    isAggregating,
    error,
    cacheKey: currentCacheKey,
  };
}
