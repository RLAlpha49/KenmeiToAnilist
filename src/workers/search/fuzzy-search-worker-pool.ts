/**
 * Manages fuzzy search operations using the shared worker pool.
 * Offloads CPU-intensive Fuse.js indexing and search to worker threads.
 * @source
 */

import { BaseWorkerPool } from "../core/base-worker-pool";
import { generateTaskId } from "../core/pool-utils";
import type {
  FuzzySearchMessage,
  FuzzySearchResultMessage,
} from "../core/types";
import type { MangaMatchResult } from "@/api/anilist/types";
import type { IFuseOptions } from "fuse.js";

/**
 * Result of a fuzzy search operation including timing and execution context.
 * @source
 */
export interface FuzzySearchResult {
  /**
   * Array of matched results, ordered by relevance score
   */
  results: MangaMatchResult[];

  /**
   * Performance timing breakdown
   */
  timing: {
    indexingTimeMs: number;
    searchTimeMs: number;
    totalTimeMs: number;
  };

  /**
   * Whether this was executed on a worker or main thread
   */
  executedOnWorker: boolean;
}

/**
 * Generates a unique task identifier for fuzzy search tasks.
 * @returns A unique task ID string.
 * @source
 */
function generateUniqueFuzzySearchTaskId(): string {
  return generateTaskId("fuzzy_search");
}

/**
 * Coordinates fuzzy search tasks across workers with main-thread fallback.
 * Optimized for large dataset searches (100+ items) where Fuse.js would block the UI.
 * @source
 */
export class FuzzySearchWorkerPool extends BaseWorkerPool {
  constructor() {
    super();
  }

  protected getPoolName(): string {
    return "FuzzySearchWorkerPool";
  }

  /**
   * Performs fuzzy search on manga matches using workers when available.
   * Falls back to main thread when worker execution is not possible.
   *
   * @param matches - Candidate matches to search.
   * @param query - Search query string.
   * @param keys - Search key definitions.
   * @param options - Optional Fuse.js configuration overrides.
   * @param maxResults - Maximum number of results to return (default: 100).
   * @returns Fuzzy search result with timing metadata.
   * @source
   */
  async search(
    matches: MangaMatchResult[],
    query: string,
    keys: (string | { name: string; weight?: number })[] = ["title"],
    options?: Partial<IFuseOptions<MangaMatchResult>>,
    maxResults: number = 100,
  ): Promise<FuzzySearchResult> {
    const taskId = generateUniqueFuzzySearchTaskId();
    await this.ensureInitialized();

    return this.executeWithFallback(
      () =>
        this.executeOnWorker(taskId, matches, query, keys, options, maxResults),
      () => this.executeOnMainThread(matches, query, keys, options, maxResults),
      taskId,
    );
  }

  /**
   * Executes fuzzy search on a worker thread via the generic pool.
   * @param taskId - Unique identifier for the dispatched task.
   * @param matches - Candidate matches to search.
   * @param query - Search query string.
   * @param keys - Search key definitions.
   * @param options - Optional Fuse.js configuration.
   * @param maxResults - Maximum number of results to return.
   * @returns Fuzzy search result when the worker completes.
   * @source
   */
  private async executeOnWorker(
    taskId: string,
    matches: MangaMatchResult[],
    query: string,
    keys: (string | { name: string; weight?: number })[],
    options: Partial<IFuseOptions<MangaMatchResult>> | undefined,
    maxResults: number,
  ): Promise<FuzzySearchResult> {
    try {
      const workerIndex = this.selectWorker();
      if (workerIndex === -1) {
        throw new Error("No workers available from pool");
      }

      const worker = this.getWorker(workerIndex);
      if (!worker) {
        throw new Error("Failed to get worker from pool");
      }

      // Create task tracking
      const task = {
        taskId,
        type: "fuzzy_search" as const,
        resolve: null as unknown as (result: unknown) => void,
        reject: null as unknown as (error: Error) => void,
        cancelled: false,
        workerIndex,
      };

      const taskPromise = new Promise<FuzzySearchResult>((resolve, reject) => {
        task.resolve = (result: unknown) => {
          const typedResult = result as FuzzySearchResultMessage["payload"];
          resolve({
            results: typedResult.results,
            timing: typedResult.timing,
            executedOnWorker: true,
          });
        };
        task.reject = reject;
      });

      this.registerTask(taskId, task);

      // Send message to the worker
      const message: FuzzySearchMessage = {
        type: "FUZZY_SEARCH",
        payload: {
          taskId,
          matches,
          query,
          keys,
          options,
          maxResults,
        },
      };

      worker.postMessage(message);

      console.debug(
        `[FuzzySearchWorkerPool] Dispatched fuzzy search task ${taskId}: query="${query}", ${matches.length} items`,
      );

      // Rely on executeWithFallback in BaseWorkerPool to enforce timeouts using taskTimeoutMs
      // This ensures consistent timeout behavior with other worker pools
      return await taskPromise;
    } catch (error) {
      console.error(
        "[FuzzySearchWorkerPool] Error executing on worker:",
        error,
      );
      throw error;
    }
  }

  /**
   * Executes fuzzy search on the main thread as a fallback.
   * Uses Fuse.js directly on the main thread.
   *
   * @param matches - Candidate matches to search.
   * @param query - Search query string.
   * @param keys - Search key definitions.
   * @param options - Optional Fuse.js configuration.
   * @param maxResults - Maximum number of results to return.
   * @returns Fuzzy search result computed on the main thread.
   * @source
   */
  private async executeOnMainThread(
    matches: MangaMatchResult[],
    query: string,
    keys: (string | { name: string; weight?: number })[],
    options: Partial<IFuseOptions<MangaMatchResult>> | undefined,
    maxResults: number,
  ): Promise<FuzzySearchResult> {
    // Dynamically import Fuse to avoid loading if using worker
    const Fuse = (await import("fuse.js")).default;

    const startTime = performance.now();
    let indexingTime = 0;
    let searchTime = 0;

    if (!query.trim()) {
      // Empty query returns all matches
      return {
        results: matches.slice(0, maxResults),
        timing: {
          indexingTimeMs: 0,
          searchTimeMs: 0,
          totalTimeMs: performance.now() - startTime,
        },
        executedOnWorker: false,
      };
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
      `[FuzzySearchWorkerPool] Main thread search completed: ${results.length} results in ${totalTime.toFixed(2)}ms`,
    );

    return {
      results,
      timing: {
        indexingTimeMs: indexingTime,
        searchTimeMs: searchTime,
        totalTimeMs: totalTime,
      },
      executedOnWorker: false,
    };
  }
}

/**
 * Global singleton instance of the fuzzy search worker pool.
 * @source
 */
let fuzzySearchPoolInstance: FuzzySearchWorkerPool | null = null;

/**
 * Returns the singleton fuzzy search worker pool, creating it if needed.
 * @returns Shared fuzzy search worker pool instance.
 * @source
 */
export function getFuzzySearchWorkerPool(): FuzzySearchWorkerPool {
  fuzzySearchPoolInstance ??= new FuzzySearchWorkerPool();
  return fuzzySearchPoolInstance;
}
