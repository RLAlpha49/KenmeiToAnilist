/**
 * Manages a shared pool of generic workers for CPU-intensive tasks with fallback behavior.
 * @source
 */

import type { WorkerMessage, WorkerPoolConfig, WorkerTask } from "./types";
import Worker from "./worker?worker";

/**
 * Coordinates worker lifecycle, task routing, cancellation, and fallbacks.
 * @source
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private workerBusy: boolean[] = [];
  private readonly tasks: Map<string, WorkerTask> = new Map();
  private readonly config: WorkerPoolConfig;
  private initialized = false;
  private useFallback = false;

  constructor(config?: Partial<WorkerPoolConfig>) {
    const defaultWorkerCount =
      typeof navigator === "undefined"
        ? 4
        : Math.min(navigator.hardwareConcurrency || 2, 4);

    this.config = {
      maxWorkers: config?.maxWorkers ?? defaultWorkerCount,
      enableWorkers: config?.enableWorkers ?? true,
      fallbackToMainThread: config?.fallbackToMainThread ?? true,
    };
  }

  /**
   * Lazily creates workers and enables main-thread fallback on failure.
   * @source
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config.enableWorkers) {
      console.warn(
        "[WorkerPool] ⚠️ Workers disabled, using main thread fallback",
      );
      this.useFallback = true;
      this.initialized = true;
      return;
    }

    try {
      console.info("[WorkerPool] 📦 Initializing worker pool...");
      for (let i = 0; i < this.config.maxWorkers; i++) {
        try {
          const worker = new Worker();

          worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            this.handleWorkerMessage(i, event.data);
          };

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
        `[WorkerPool] ✅ Initialized with ${this.workers.length} workers`,
      );
    } catch (error) {
      console.error("[WorkerPool] ❌ Failed to initialize worker pool:", error);
      this.terminate();

      if (this.config.fallbackToMainThread) {
        console.warn("[WorkerPool] ⚠️ Falling back to main thread execution");
        this.useFallback = true;
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Returns true when workers are initialized and not using fallback.
   * @source
   */
  isAvailable(): boolean {
    return this.initialized && !this.useFallback && this.workers.length > 0;
  }

  /**
   * Returns the count of idle workers currently available for new tasks.
   * @source
   */
  getAvailableWorkerCount(): number {
    if (!this.initialized || this.useFallback || this.workers.length === 0) {
      return 0;
    }
    return this.workerBusy.filter((busy) => !busy).length;
  }

  /**
   * Selects the index of a free worker or -1 if none available.
   * @source
   */
  selectWorker(): number {
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.workerBusy[i]) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Returns a worker by index and marks it busy.
   * @source
   */
  getWorker(index: number): Worker | null {
    if (index < 0 || index >= this.workers.length || this.workerBusy[index]) {
      return null;
    }
    this.workerBusy[index] = true;
    return this.workers[index];
  }

  /**
   * Registers a task so responses can be routed correctly.
   * @source
   */
  registerTask(taskId: string, task: WorkerTask): void {
    this.tasks.set(taskId, task);
  }

  /**
   * Clears tracking for a task and frees its worker.
   * @source
   */
  completeTask(taskId: string): WorkerTask | undefined {
    const task = this.tasks.get(taskId);
    if (task?.workerIndex !== undefined) {
      this.workerBusy[task.workerIndex] = false;
    }
    this.tasks.delete(taskId);
    return task;
  }

  /**
   * Retrieves a tracked task by its ID.
   * @source
   */
  getTask(taskId: string): WorkerTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Routes worker messages to the appropriate task handlers.
   * @source
   */
  private handleWorkerMessage(
    workerIndex: number,
    message: WorkerMessage,
  ): void {
    if (!("payload" in message) || !("taskId" in message.payload)) {
      return;
    }

    const taskId = (message.payload as Record<string, unknown>)
      .taskId as string;
    const task = this.tasks.get(taskId);

    if (!task) {
      return;
    }

    // If task is cancelled, handle terminal messages and skip non-terminal
    if (task.cancelled) {
      this.handleCancelledTaskMessage(taskId, task, workerIndex, message);
      return;
    }

    switch (message.type) {
      case "PROGRESS":
      case "TITLE_NORMALIZATION_PROGRESS":
      case "BATCH_SYNC_PROGRESS":
      case "DATA_TABLE_PREPARATION_PROGRESS":
      case "DUPLICATE_DETECTION_PROGRESS":
      case "READING_HISTORY_FILTER_PROGRESS":
      case "STATISTICS_AGGREGATION_PROGRESS":
      case "CSV_ROWS":
        if (task.onProgress) {
          task.onProgress(message);
        }
        break;

      case "RESULT":
      case "CSV_COMPLETE":
      case "CSV_CANCELLED":
      case "ADVANCED_FILTER_RESULT":
      case "TITLE_NORMALIZATION_RESULT":
      case "STATISTICS_AGGREGATION_RESULT":
      case "JSON_SERIALIZE_RESULT":
      case "JSON_DESERIALIZE_RESULT":
      case "BATCH_SYNC_RESULT":
      case "DATA_TABLE_PREPARATION_RESULT":
      case "DUPLICATE_DETECTION_RESULT":
      case "READING_HISTORY_FILTER_RESULT": {
        const result = this.extractMessageResult(message);
        task.resolve(result);
        this.completeTask(taskId);
        console.info(
          `[WorkerPool] ✅ Worker ${workerIndex} completed task ${taskId}`,
        );
        break;
      }

      case "ERROR": {
        const payload = (message as unknown as Record<string, unknown>)
          .payload as Record<string, unknown>;
        const errorDetails = payload.error as Record<string, unknown>;
        const error = new Error(errorDetails.message as string);
        // Attach additional error properties from worker
        if (errorDetails.name) {
          error.name = errorDetails.name as string;
        }
        if (errorDetails.stack) {
          error.stack = errorDetails.stack as string;
        }
        // Guard Error.cause with feature detection; attach to meta if not supported
        if (errorDetails.causeMessage) {
          try {
            // Try to set native cause if supported (Node 16.9+, modern browsers)
            (error as Error & { cause?: Error }).cause = new Error(
              errorDetails.causeMessage as string,
            );
          } catch {
            // Fallback: attach cause message to error object for logging
            (error as Error & { causeMessage?: string }).causeMessage =
              errorDetails.causeMessage as string;
          }
        }
        task.reject(error);
        this.completeTask(taskId);
        console.error(
          `[WorkerPool] ❌ Worker ${workerIndex} error: ${errorDetails.message}`,
        );
        break;
      }
    }
  }

  /**
   * Handles messages for cancelled tasks, discarding payloads while cleaning up.
   * @source
   */
  private handleCancelledTaskMessage(
    taskId: string,
    task: WorkerTask,
    workerIndex: number,
    message: WorkerMessage,
  ): void {
    // Clear any pending cancel timeout
    if (task.cancelTimeoutHandle) {
      clearTimeout(task.cancelTimeoutHandle);
    }

    const isTerminalMessage =
      message.type === "RESULT" ||
      message.type === "CSV_COMPLETE" ||
      message.type === "CSV_CANCELLED" ||
      message.type === "ADVANCED_FILTER_RESULT" ||
      message.type === "TITLE_NORMALIZATION_RESULT" ||
      message.type === "STATISTICS_AGGREGATION_RESULT" ||
      message.type === "JSON_SERIALIZE_RESULT" ||
      message.type === "JSON_DESERIALIZE_RESULT" ||
      message.type === "BATCH_SYNC_RESULT" ||
      message.type === "DATA_TABLE_PREPARATION_RESULT" ||
      message.type === "DUPLICATE_DETECTION_RESULT" ||
      message.type === "READING_HISTORY_FILTER_RESULT" ||
      message.type === "MATCH_CANCELLED" ||
      message.type === "STATS_CANCELLED" ||
      message.type === "TITLE_NORM_CANCELLED" ||
      message.type === "BATCH_SYNC_CANCELLED" ||
      message.type === "DUP_DETECTION_CANCELLED" ||
      message.type === "DATA_TABLE_CANCELLED" ||
      message.type === "READ_HIST_CANCELLED" ||
      message.type === "ERROR";

    if (!isTerminalMessage) {
      // Non-terminal message from cancelled task, skip and wait for terminal
      return;
    }

    // Process terminal message
    if (message.type === "ERROR") {
      console.debug(
        `[WorkerPool] 📋 Cancelled task ${taskId} received error, discarding`,
      );
    } else {
      console.debug(
        `[WorkerPool] 📋 Cancelled task ${taskId} received result, discarding`,
      );
    }

    this.completeTask(taskId);
  }

  /**
   * Extract and format result from worker message
   */
  /**
   * Extracts the raw payload object for consumers to shape as needed.
   * @source
   */
  private extractMessageResult(
    message: WorkerMessage,
  ): Record<string, unknown> {
    return (message as unknown as Record<string, Record<string, unknown>>)
      .payload;
  } /**
   * Rejects affected tasks and attempts to spawn a replacement worker.
   * @source
   */
  private handleWorkerError(workerIndex: number, error: ErrorEvent): void {
    const failedTasks: string[] = [];
    for (const [taskId, task] of this.tasks) {
      if (task.workerIndex === workerIndex) {
        task.reject(
          new Error(`Worker ${workerIndex} crashed: ${error.message}`),
        );
        failedTasks.push(taskId);
      }
    }

    for (const taskId of failedTasks) {
      this.tasks.delete(taskId);
    }

    this.workerBusy[workerIndex] = false;

    try {
      const newWorker = new Worker();
      newWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(workerIndex, event.data);
      };
      newWorker.onerror = (err: ErrorEvent) => {
        this.handleWorkerError(workerIndex, err);
      };
      this.workers[workerIndex] = newWorker;
      console.info(`[WorkerPool] Spawned replacement worker ${workerIndex}`);
    } catch (spawnError) {
      console.error(
        `[WorkerPool] Failed to spawn replacement worker ${workerIndex}:`,
        spawnError,
      );
      this.useFallback = true;
    }
  }

  /**
   * Requests cancellation for a task and forces completion on timeout.
   * @source
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.workerIndex !== undefined) {
      // Mark task as cancelled
      task.cancelled = true;

      // Post CANCEL message to worker
      this.workers[task.workerIndex].postMessage({
        type: "CANCEL",
        payload: { taskId },
      });

      // Set a timeout fallback to ensure task doesn't hang indefinitely
      // If no terminal message within 5 seconds, force completion
      const timeoutHandle = setTimeout(() => {
        const stillExistingTask = this.tasks.get(taskId);
        if (stillExistingTask) {
          stillExistingTask.reject(
            new Error(
              `Task ${taskId} cancelled and timed out waiting for worker response`,
            ),
          );
          this.completeTask(taskId);
          console.warn(
            `[WorkerPool] ⏱️ Cancelled task ${taskId} timed out after 5s, forcing completion`,
          );
        }
      }, 5000);

      // Store timeout handle for potential cleanup
      task.cancelTimeoutHandle = timeoutHandle;
    }
  }

  /**
   * Returns snapshot metrics for workers and active tasks.
   * @source
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    activeTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      activeWorkers: this.workerBusy.filter(Boolean).length,
      activeTasks: this.tasks.size,
    };
  }

  /**
   * Terminates all workers and clears internal state.
   * @source
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.workerBusy = [];
    this.tasks.clear();
    console.info("[WorkerPool] ✅ All workers terminated");
  }
}

/**
 * Global singleton instance for the generic worker pool.
 * @source
 */
let workerPoolInstance: WorkerPool | null = null;

/**
 * Returns the shared generic worker pool instance.
 * @internal Prefer using higher-level helpers where available.
 * @source
 */
export function getGenericWorkerPool(
  config?: Partial<WorkerPoolConfig>,
): WorkerPool {
  workerPoolInstance ??= new WorkerPool(config);
  return workerPoolInstance;
}

/**
 * Eagerly created singleton for low-level generic pool access.
 * @internal
 * @source
 */
export const workerPool = getGenericWorkerPool();
