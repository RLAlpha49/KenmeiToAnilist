/**
 * Worker pool manager for parallel manga matching operations.
 *
 * Manages a pool of Web Workers that execute CPU-intensive matching operations
 * in parallel, keeping the main thread responsive. Handles work distribution,
 * progress aggregation, error recovery, and graceful fallback to main thread execution.
 *
 * @module workers/worker-pool
 */

import type {
  WorkerPoolConfig,
  WorkerTask,
  WorkerMessage,
  ProgressMessage,
  ResultMessage,
  ErrorMessage,
  MatchBatchExecution,
} from "./types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { AniListManga, MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import { findBestMatches } from "@/api/matching/match-engine";
import MatchingWorker from "./matching-worker?worker";

/**
 * Worker pool manager that distributes matching work across multiple workers.
 */
export class MatchingWorkerPool {
  private workers: Worker[] = [];
  private workerBusy: boolean[] = [];
  private readonly tasks: Map<string, WorkerTask> = new Map();
  private readonly chunkTaskIds: Map<string, string[]> = new Map();
  private readonly config: WorkerPoolConfig;
  private initialized = false;
  private useFallback = false;

  constructor(config?: Partial<WorkerPoolConfig>) {
    const defaultWorkerCount =
      typeof navigator === "undefined"
        ? 2
        : Math.min(navigator.hardwareConcurrency || 2, 4);

    this.config = {
      maxWorkers: config?.maxWorkers ?? defaultWorkerCount,
      enableWorkers: config?.enableWorkers ?? true,
      fallbackToMainThread: config?.fallbackToMainThread ?? true,
    };
  }

  /**
   * Initialize the worker pool.
   * Creates workers and sets up message handlers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check if workers are disabled
    if (!this.config.enableWorkers) {
      console.warn(
        "[WorkerPool] ⚠️ Workers disabled, using main thread fallback",
      );
      this.useFallback = true;
      this.initialized = true;
      return;
    }

    try {
      // Spawn workers
      console.info("[WorkerPool] 📦 Initializing worker pool...");
      for (let i = 0; i < this.config.maxWorkers; i++) {
        try {
          // Use imported worker constructor (Vite ?worker pattern)
          const worker = new MatchingWorker();

          // Set up message handler
          worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            this.handleWorkerMessage(i, event.data);
          };

          // Set up error handler
          worker.onerror = (error: ErrorEvent) => {
            console.error(`[WorkerPool] ❌ Worker ${i} error:`, error);
            this.handleWorkerError(i, error);
          };

          this.workers.push(worker);
          this.workerBusy.push(false);
          console.debug(`[WorkerPool] 🔧 Worker ${i} created`);
        } catch (error) {
          console.error(`[WorkerPool] ❌ Failed to create worker ${i}:`, error);
          throw error;
        }
      }

      this.initialized = true;
      console.info(
        `[WorkerPool] ✅ Initialized with ${this.workers.length} workers (max: ${this.config.maxWorkers})`,
      );
    } catch (error) {
      console.error("[WorkerPool] ❌ Failed to initialize worker pool:", error);

      // Clean up any created workers
      this.terminate();

      // Fall back to main thread if enabled
      if (this.config.fallbackToMainThread) {
        console.warn(
          "[WorkerPool] ⚠️ Falling back to main thread execution (workers disabled)",
        );
        this.useFallback = true;
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if the worker pool is available for use.
   */
  isAvailable(): boolean {
    return this.initialized && !this.useFallback && this.workers.length > 0;
  }

  /**
   * Execute a batch matching operation using workers.
   *
   * Partitions work across available workers for parallel processing.
   * Aggregates progress and results from all workers.
   * Tracks chunk task IDs for multi-chunk cancellation support.
   *
   * @param kenmeiMangaList - List of Kenmei manga to match
   * @param anilistMangaMap - Map of manga IDs to their AniList candidates
   * @param config - Matching engine configuration (partial config supported)
   * @param progressCallback - Callback for progress updates
   * @param taskId - Optional task ID for the operation (generated if not provided)
   * @returns Object with taskId, chunkTaskIds, and promise resolving to match results
   */
  async executeMatchBatch(
    kenmeiMangaList: KenmeiManga[],
    anilistMangaMap: Map<string, AniListManga[]>,
    config: Partial<MatchEngineConfig>,
    progressCallback?: (
      current: number,
      total: number,
      currentTitle?: string,
    ) => void,
    taskId?: string,
  ): Promise<MatchBatchExecution> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate task ID if not provided
    const effectiveTaskId =
      taskId ||
      `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    console.info(
      `[WorkerPool] 📋 Batch match task created (ID: ${effectiveTaskId}, items: ${kenmeiMangaList.length})`,
    );

    // Fall back to main thread if workers not available
    if (this.useFallback || this.workers.length === 0) {
      console.warn(
        `[WorkerPool] ⚠️ No workers available, using main thread for task ${effectiveTaskId}`,
      );
      const promise = this.executeOnMainThread(
        kenmeiMangaList,
        anilistMangaMap,
        config,
        progressCallback,
      );
      return {
        taskId: effectiveTaskId,
        chunkTaskIds: [],
        promise,
      };
    }

    // Create task promise
    return new Promise<MatchBatchExecution>((resolve, reject) => {
      const chunkTaskIds: string[] = [];

      // Determine number of chunks (one per available worker)
      const numWorkers = this.workers.length;
      const chunkSize = Math.ceil(kenmeiMangaList.length / numWorkers);

      // Create chunks of work
      const chunks: Array<{
        manga: KenmeiManga[];
        candidates: Map<string, AniListManga[]>;
        index: number;
        startIndex: number;
      }> = [];

      for (let i = 0; i < kenmeiMangaList.length; i += chunkSize) {
        const chunkIndex = Math.floor(i / chunkSize);
        const mangaChunk = kenmeiMangaList.slice(
          i,
          Math.min(i + chunkSize, kenmeiMangaList.length),
        );

        // Build candidates map for this chunk using index-based keys
        const candidatesChunk = new Map<string, AniListManga[]>();
        for (let j = 0; j < mangaChunk.length; j++) {
          const globalIndex = i + j;
          // Use global index as key to match the order in executeMatchingWithWorkers
          const candidates = anilistMangaMap.get(String(globalIndex)) || [];
          candidatesChunk.set(String(j), candidates);
        }

        chunks.push({
          manga: mangaChunk,
          candidates: candidatesChunk,
          index: chunkIndex,
          startIndex: i,
        });
      }

      // If only one chunk or not enough work, just use single worker
      if (chunks.length === 1) {
        const chunk = chunks[0];
        const workerIndex = this.selectWorker();

        if (workerIndex === -1) {
          console.warn("No workers available, falling back to main thread");
          this.executeOnMainThread(
            kenmeiMangaList,
            anilistMangaMap,
            config,
            progressCallback,
          )
            .then((results) => {
              resolve({
                taskId: effectiveTaskId,
                chunkTaskIds: [],
                promise: Promise.resolve(results),
              });
            })
            .catch(reject);
          return;
        }

        const task: WorkerTask = {
          taskId: effectiveTaskId,
          kenmeiManga: chunk.manga,
          anilistCandidates: chunk.candidates,
          config,
          resolve: () => {
            // Not used in direct execution, but required by interface
          },
          reject,
          cancelled: false,
          progressCallback,
          workerIndex,
          totalItems: kenmeiMangaList.length,
          processedItems: 0,
        };
        this.tasks.set(effectiveTaskId, task);
        chunkTaskIds.push(effectiveTaskId);
        this.workerBusy[workerIndex] = true;

        // Create the promise that will resolve when the worker responds
        const resultPromise = new Promise<MangaMatchResult[]>(
          (resolveResult, rejectResult) => {
            task.resolve = resolveResult;
            task.reject = rejectResult;
          },
        );

        try {
          const candidatesArray = Array.from(chunk.candidates.entries());
          this.workers[workerIndex].postMessage({
            type: "MATCH_BATCH",
            payload: {
              kenmeiManga: chunk.manga,
              anilistCandidates: candidatesArray,
              config,
              taskId: effectiveTaskId,
            },
          });

          resolve({
            taskId: effectiveTaskId,
            chunkTaskIds,
            promise: resultPromise,
          });
        } catch (error) {
          console.error("Failed to post message to worker:", error);
          this.workerBusy[workerIndex] = false;
          this.tasks.delete(effectiveTaskId);
          reject(error);
        }
        return;
      }

      // Dispatch multiple chunks to different workers
      const chunkProgress = new Map<
        number,
        { current: number; total: number }
      >();
      const chunkResults = new Map<number, MangaMatchResult[]>();
      let completedChunks = 0;
      let resultResolve: ((results: MangaMatchResult[]) => void) | null = null;
      let resultReject: ((error: Error) => void) | null = null;

      const resultPromise = new Promise<MangaMatchResult[]>((res, rej) => {
        resultResolve = res;
        resultReject = rej;
      });

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        const workerIndex = this.selectWorker();

        if (workerIndex === -1) {
          console.warn(
            "Not enough workers available for all chunks, falling back to main thread",
          );
          this.executeOnMainThread(
            kenmeiMangaList,
            anilistMangaMap,
            config,
            progressCallback,
          )
            .then((results) => {
              if (resultResolve) resultResolve(results);
            })
            .catch((error: unknown) => {
              if (resultReject)
                resultReject(
                  error instanceof Error ? error : new Error(String(error)),
                );
            });
          resolve({
            taskId: effectiveTaskId,
            chunkTaskIds,
            promise: resultPromise,
          });
          return;
        }

        const chunkTaskId = `${effectiveTaskId}-chunk-${chunkIdx}`;
        chunkTaskIds.push(chunkTaskId);
        chunkProgress.set(chunkIdx, { current: 0, total: chunk.manga.length });

        const chunkTask: WorkerTask = {
          taskId: chunkTaskId,
          kenmeiManga: chunk.manga,
          anilistCandidates: chunk.candidates,
          config,
          resolve: (results) => {
            chunkResults.set(chunkIdx, results);
            completedChunks++;

            if (completedChunks === chunks.length) {
              // All chunks complete, merge results in order
              const finalResults: MangaMatchResult[] = [];
              for (let i = 0; i < chunks.length; i++) {
                const results = chunkResults.get(i);
                if (results) {
                  finalResults.push(...results);
                }
              }
              console.info(
                `[WorkerPool] ✅ Batch task ${effectiveTaskId} completed (${finalResults.length} results)`,
              );
              if (resultResolve) resultResolve(finalResults);
            }
          },
          reject: (error: Error) => {
            console.error(
              `[WorkerPool] ❌ Batch task ${effectiveTaskId} failed:`,
              error.message,
            );
            if (resultReject) resultReject(error);
          },
          cancelled: false,
          progressCallback: (current, total, title) => {
            // Update chunk progress
            chunkProgress.set(chunkIdx, { current, total });

            // Compute aggregated progress
            let totalCurrent = 0;
            let totalTotal = 0;
            for (const progress of chunkProgress.values()) {
              totalCurrent += progress.current;
              totalTotal += progress.total;
            }

            if (progressCallback) {
              progressCallback(totalCurrent, totalTotal, title);
            }
          },
          workerIndex,
          totalItems: kenmeiMangaList.length,
          processedItems: 0,
          chunkProgress,
        };

        this.tasks.set(chunkTaskId, chunkTask);
        this.workerBusy[workerIndex] = false; // Will be set by worker dispatch

        try {
          this.workerBusy[workerIndex] = true;
          console.debug(
            `[WorkerPool] 🚀 Dispatched chunk ${chunkIdx} (${chunk.manga.length} items) to worker ${workerIndex} (task: ${chunkTaskId})`,
          );
          const candidatesArray = Array.from(chunk.candidates.entries());
          this.workers[workerIndex].postMessage({
            type: "MATCH_BATCH",
            payload: {
              kenmeiManga: chunk.manga,
              anilistCandidates: candidatesArray,
              config,
              taskId: chunkTaskId,
            },
          });
        } catch (error) {
          console.error(
            `[WorkerPool] ❌ Failed to dispatch to worker ${workerIndex}:`,
            error,
          );
          this.workerBusy[workerIndex] = false;
          this.tasks.delete(chunkTaskId);
          if (resultReject !== null) {
            const err =
              error instanceof Error ? error : new Error(String(error));
            (resultReject as (err: Error) => void)(err);
          }
          return;
        }
      }

      // Store main task for cancellation tracking
      const mainTask: WorkerTask = {
        taskId: effectiveTaskId,
        kenmeiManga: kenmeiMangaList,
        anilistCandidates: anilistMangaMap,
        config,
        resolve: () => {
          // Not used
        },
        reject: () => {
          // Not used
        },
        cancelled: false,
        progressCallback,
        totalItems: kenmeiMangaList.length,
        processedItems: 0,
        chunkProgress,
      };
      this.tasks.set(effectiveTaskId, mainTask);

      // Store chunk task IDs mapping for cancellation
      this.chunkTaskIds.set(effectiveTaskId, chunkTaskIds);

      resolve({
        taskId: effectiveTaskId,
        chunkTaskIds,
        promise: resultPromise,
      });
    });
  }

  /**
   * Cancel a running task.
   *
   * For multi-chunk tasks, cancels all associated chunk tasks by sending CANCEL
   * to the workers responsible for each chunk.
   * Marks workers as available after cancellation.
   *
   * @param taskId - ID of the task to cancel
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    task.cancelled = true;

    // Get associated chunk task IDs
    const chunkIds = this.chunkTaskIds.get(taskId) || [];

    // If there are chunk task IDs, cancel each one
    if (chunkIds.length > 0) {
      for (const chunkTaskId of chunkIds) {
        const chunkTask = this.tasks.get(chunkTaskId);
        if (chunkTask?.workerIndex !== undefined) {
          // Send cancel to the worker responsible for this chunk
          this.workers[chunkTask.workerIndex]?.postMessage({
            type: "CANCEL",
            payload: { taskId: chunkTaskId },
          });
          // Mark worker as available
          this.workerBusy[chunkTask.workerIndex] = false;
        }
        // Clean up chunk task
        this.tasks.delete(chunkTaskId);
      }
      // Clean up mapping
      this.chunkTaskIds.delete(taskId);
    } else if (
      task.workerIndex !== undefined &&
      this.workers[task.workerIndex]
    ) {
      // Single-chunk task: send cancel to its worker
      this.workers[task.workerIndex].postMessage({
        type: "CANCEL",
        payload: { taskId },
      });
      // Optimistically mark worker as available
      this.workerBusy[task.workerIndex] = false;
    }

    // Clean up main task
    this.tasks.delete(taskId);
  }

  /**
   * Terminate all workers and clean up resources.
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.workerBusy = [];
    this.tasks.clear();
    this.chunkTaskIds.clear();
    this.initialized = false;
  }

  /**
   * Select the least busy worker.
   * Returns -1 if no workers are available.
   */
  private selectWorker(): number {
    // Find first available worker
    for (let i = 0; i < this.workerBusy.length; i++) {
      if (!this.workerBusy[i]) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Handle messages from workers.
   */
  private handleWorkerMessage(
    workerIndex: number,
    message: WorkerMessage,
  ): void {
    switch (message.type) {
      case "PROGRESS":
        this.handleProgressMessage(message);
        break;

      case "RESULT":
        this.handleResultMessage(workerIndex, message);
        break;

      case "ERROR":
        this.handleErrorMessage(workerIndex, message);
        break;

      default:
        console.warn("Unknown message type from worker:", message);
    }
  }

  /**
   * Handle progress messages from workers.
   * Invokes the task's progress callback if available.
   * Wraps callback in try/catch to ensure proper cleanup on errors.
   */
  private handleProgressMessage(message: ProgressMessage): void {
    const task = this.tasks.get(message.payload.taskId);
    if (!task?.progressCallback) {
      return;
    }

    // Call the progress callback with current progress
    try {
      task.progressCallback(
        message.payload.current ?? 0,
        message.payload.total ?? 0,
        message.payload.currentTitle,
      );

      // Log progress at intervals to reduce spam
      if (
        (message.payload.current ?? 0) % 50 === 0 ||
        message.payload.current === 1
      ) {
        console.debug(
          `[WorkerPool] 🔄 Task ${message.payload.taskId} progress: ${message.payload.current}/${message.payload.total} (${message.payload.currentTitle})`,
        );
      }
    } catch (error) {
      // On error, cancel the task and mark worker as available
      console.error(
        `[WorkerPool] ❌ Progress callback error in task ${message.payload.taskId}:`,
        error,
      );
      this.cancelTask(message.payload.taskId);
      if (task.workerIndex !== undefined) {
        this.workerBusy[task.workerIndex] = false;
      }
      // Reject the task with the caught error
      task.reject(error instanceof Error ? error : new Error(String(error)));
      this.tasks.delete(message.payload.taskId);
    }
  }

  /**
   * Handle result messages from workers.
   */
  private handleResultMessage(
    workerIndex: number,
    message: ResultMessage,
  ): void {
    const task = this.tasks.get(message.payload.taskId);
    if (!task) {
      return;
    }

    // Mark worker as available
    this.workerBusy[workerIndex] = false;

    console.debug(
      `[WorkerPool] 📨 Received results from worker ${workerIndex} for task ${message.payload.taskId} (${message.payload.results.length} results)`,
    );

    // Resolve the task
    task.resolve(message.payload.results);
    this.tasks.delete(message.payload.taskId);
  }

  /**
   * Handle error messages from workers.
   */
  private handleErrorMessage(workerIndex: number, message: ErrorMessage): void {
    const task = this.tasks.get(message.payload.taskId);
    if (!task) {
      return;
    }

    // Mark worker as available
    this.workerBusy[workerIndex] = false;

    console.error(
      `[WorkerPool] ❌ Worker ${workerIndex} returned error for task ${message.payload.taskId}: ${message.payload.error.message}`,
    );

    // Reject the task
    const error = new Error(message.payload.error.message);
    if (message.payload.error.stack) {
      error.stack = message.payload.error.stack;
    }
    task.reject(error);
    this.tasks.delete(message.payload.taskId);
  }

  /**
   * Handle worker errors.
   */
  private handleWorkerError(workerIndex: number, error: ErrorEvent): void {
    console.error(`Worker ${workerIndex} encountered an error:`, error);

    // Mark worker as available
    this.workerBusy[workerIndex] = false;

    // Try to spawn a replacement worker
    try {
      // Use imported worker constructor (Vite ?worker pattern)
      const newWorker = new MatchingWorker();

      newWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(workerIndex, event.data);
      };

      newWorker.onerror = (error: ErrorEvent) => {
        console.error(`Replacement worker ${workerIndex} error:`, error);
        this.handleWorkerError(workerIndex, error);
      };

      this.workers[workerIndex] = newWorker;
      console.log(`Spawned replacement worker ${workerIndex}`);
    } catch (spawnError) {
      console.error(
        `Failed to spawn replacement worker ${workerIndex}:`,
        spawnError,
      );

      // Remove the failed worker
      this.workers.splice(workerIndex, 1);
      this.workerBusy.splice(workerIndex, 1);

      // If no workers left, enable fallback
      if (this.workers.length === 0 && this.config.fallbackToMainThread) {
        console.warn("No workers remaining, enabling fallback mode");
        this.useFallback = true;
      }
    }
  }

  /**
   * Execute matching on the main thread as fallback.
   * Iterates over manga list and finds best matches per manga.
   * Supports progress callbacks with proper async yielding.
   */
  private async executeOnMainThread(
    kenmeiMangaList: KenmeiManga[],
    anilistMangaMap: Map<string, AniListManga[]>,
    config: Partial<MatchEngineConfig>,
    progressCallback?: (
      current: number,
      total: number,
      currentTitle?: string,
    ) => void,
  ): Promise<MangaMatchResult[]> {
    const results: MangaMatchResult[] = [];
    const total = kenmeiMangaList.length;

    for (let i = 0; i < total; i++) {
      const manga = kenmeiMangaList[i];
      // Use index-based key to match worker and utils convention
      const candidates = anilistMangaMap.get(String(i)) || [];

      // Find best matches for this manga (cast partial config to full config for engine)
      const matchResult = findBestMatches(
        manga,
        candidates,
        config as MatchEngineConfig,
      );
      results.push(matchResult);

      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, total, manga.title);
      }

      // Yield to event loop periodically to keep UI responsive
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return results;
  }
}
