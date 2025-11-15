import Fuse from "fuse.js";
import type { FuzzySearchMessage } from "../../types";
import { getErrorDetails } from "../error-utils";

/**
 * Performs fuzzy search on manga matches using Fuse.js in a worker thread.
 *
 * This operation is optimized for large dataset searches (100+ items) where
 * search performance would block the main thread. The worker handles both
 * index building and search execution.
 *
 * @param message - Fuzzy search request with matches, query, and options.
 * @source
 */
export async function handleFuzzySearch(
  message: FuzzySearchMessage,
): Promise<void> {
  const {
    taskId,
    matches,
    query,
    keys,
    options,
    maxResults = 100,
  } = message.payload;

  const startTime = performance.now();
  let indexingTime = 0;
  let searchTime = 0;

  try {
    if (!query.trim()) {
      // Empty query returns all matches (up to maxResults)
      globalThis.postMessage({
        type: "FUZZY_SEARCH_RESULT",
        payload: {
          taskId,
          results: matches.slice(0, maxResults),
          timing: {
            indexingTimeMs: 0,
            searchTimeMs: 0,
            totalTimeMs: performance.now() - startTime,
          },
        },
      });
      return;
    }

    // Build Fuse index
    const indexStart = performance.now();
    const fuse = new Fuse(matches, {
      threshold: 0.3,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
      ...options,
      keys,
    });
    indexingTime = performance.now() - indexStart;

    // Perform search
    const searchStart = performance.now();
    const searchResults = fuse.search(query);
    searchTime = performance.now() - searchStart;

    // Extract items and limit results
    const results = searchResults
      .slice(0, maxResults)
      .map((result) => result.item);

    const totalTime = performance.now() - startTime;

    console.debug(
      `[Worker] 🔍 Fuzzy search completed for task ${taskId}: ${results.length} results in ${totalTime.toFixed(2)}ms (index: ${indexingTime.toFixed(2)}ms, search: ${searchTime.toFixed(2)}ms)`,
    );

    globalThis.postMessage({
      type: "FUZZY_SEARCH_RESULT",
      payload: {
        taskId,
        results,
        timing: {
          indexingTimeMs: indexingTime,
          searchTimeMs: searchTime,
          totalTimeMs: totalTime,
        },
      },
    });
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    console.error(
      `[Worker] ❌ Fuzzy search failed for task ${taskId}:`,
      errorDetails,
    );

    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: errorDetails,
      },
    });
  }
}
