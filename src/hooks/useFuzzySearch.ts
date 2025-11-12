/**
 * @packageDocumentation
 * @module hooks/useFuzzySearch
 * @description Hook for debounced fuzzy search with worker pool support.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { MangaMatchResult } from "@/api/anilist/types";
import { fuzzySearchManga } from "@/utils/fuzzySearch";

/**
 * Options for configuring the fuzzy search hook.
 * @source
 */
export interface UseFuzzySearchOptions {
  /**
   * Debounce delay in milliseconds (default: 150ms)
   */
  debounceMs?: number;

  /**
   * Whether fuzzy search is enabled (default: true)
   */
  enabled?: boolean;
}

/**
 * Custom hook for performing debounced fuzzy search with worker pool support.
 *
 * This hook wraps `fuzzySearchManga` to handle async operations and debouncing,
 * making it easy to integrate fuzzy search into React components without blocking the UI.
 *
 * **Important**: This hook returns a state object with loading and results properties.
 * The results are updated after the debounce delay and search completes.
 *
 * @param searchTerm - The search query string.
 * @param matches - Array of manga match results to search.
 * @param options - Configuration options.
 * @returns Object with `results` (search results) and `isSearching` (loading state).
 * @source
 */
export function useFuzzySearchResults(
  searchTerm: string,
  matches: MangaMatchResult[],
  options: UseFuzzySearchOptions = {},
): {
  results: MangaMatchResult[];
  isSearching: boolean;
} {
  const { debounceMs = 150, enabled = true } = options;

  const [results, setResults] = useState<MangaMatchResult[]>(matches);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  const performSearch = useCallback(
    async (query: string, items: MangaMatchResult[]) => {
      // Create new abort controller for this search
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsSearching(true);

      try {
        const searchResults = await fuzzySearchManga(query, items);

        // Only update if this search wasn't aborted
        if (!abortController.signal.aborted) {
          setResults(searchResults);
        }
      } catch (error: unknown) {
        console.error("[useFuzzySearchResults] Search failed:", error);
        // On error, show all matches
        if (!abortController.signal.aborted) {
          setResults(items);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    // Clear any pending search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If search is disabled or no search term, show all matches
    if (!enabled || !searchTerm.trim()) {
      setResults(matches);
      setIsSearching(false);
      return;
    }

    // Set up debounced search
    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchTerm, matches);
    }, debounceMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Abort any in-flight search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchTerm, matches, enabled, debounceMs, performSearch]);

  return { results, isSearching };
}
