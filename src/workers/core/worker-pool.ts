/**
 * Worker Pool Manager
 *
 * Manages a single pool of generic workers that can handle both CSV parsing
 * and manga matching operations. This ensures efficient resource utilization
 * by sharing a fixed number of workers across all CPU-intensive tasks.
 *
 * @module workers/worker-pool
 */

import type { WorkerMessage } from "./types";
import Worker from "./worker?worker";

/**
 * Configuration for the worker pool
 */
export interface WorkerPoolConfig {
  /**
   * Number of workers to create
   * Default: Math.min(navigator.hardwareConcurrency || 2, 4)
   */
  maxWorkers: number;

  /**
   * Enable workers or use main thread fallback
   * Default: true
   */
  enableWorkers: boolean;

  /**
   * Fall back to main thread if workers fail
   * Default: true
   */
  fallbackToMainThread: boolean;
}

/**
 * Generic task for any worker operation
 */
interface WorkerTask {
  taskId: string;
  type: "matching" | "csv" | "normalization";
  resolve: (result: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
  workerIndex?: number;
  onProgress?: (message: WorkerMessage) => void;
  cancelTimeoutHandle?: NodeJS.Timeout;
}

/**
 * Worker pool that manages all workers for the entire application
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
   * Initialize the worker pool
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
   * Check if workers are available
   */
  isAvailable(): boolean {
    return this.initialized && !this.useFallback && this.workers.length > 0;
  }

  /**
   * Get the number of currently available (not busy) workers
   */
  getAvailableWorkerCount(): number {
    if (!this.initialized || this.useFallback || this.workers.length === 0) {
      return 0;
    }
    return this.workerBusy.filter((busy) => !busy).length;
  }

  /**
   * Select an available worker
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
   * Get a worker by index and mark it busy
   */
  getWorker(index: number): Worker | null {
    if (index < 0 || index >= this.workers.length || this.workerBusy[index]) {
      return null;
    }
    this.workerBusy[index] = true;
    return this.workers[index];
  }

  /**
   * Register a task for tracking
   */
  registerTask(taskId: string, task: WorkerTask): void {
    this.tasks.set(taskId, task);
  }

  /**
   * Mark a task as completed
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
   * Get a task by ID
   */
  getTask(taskId: string): WorkerTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Handle messages from workers
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
      case "JSON_DESERIALIZE_RESULT": {
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
        if (errorDetails.causeMessage) {
          (error as Error & { cause: Error }).cause = new Error(
            errorDetails.causeMessage as string,
          );
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
   * Handle messages from cancelled tasks
   * Treats terminal messages as completion and skips non-terminal
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
   * Extract raw message payload without shape-specific adaptation.
   * Each feature-specific pool wrapper is responsible for adapting the payload
   * to its expected shape, maintaining clean separation of concerns.
   */
  private extractMessageResult(
    message: WorkerMessage,
  ): Record<string, unknown> {
    return (message as unknown as Record<string, Record<string, unknown>>)
      .payload;
  } /**
   * Handle worker errors
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
   * Cancel a task
   * Sets a cancelled flag and posts a CANCEL message but does not complete yet.
   * Task will be completed when terminal message is received or timeout fires.
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
   * Get pool statistics
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
   * Terminate all workers
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
 * Global singleton instance
 */
let workerPoolInstance: WorkerPool | null = null;

/**
 * Get or create the generic worker pool singleton
 * @internal Use this for low-level worker pool access. Most code should use pool.ts exports.
 */
export function getGenericWorkerPool(
  config?: Partial<WorkerPoolConfig>,
): WorkerPool {
  workerPoolInstance ??= new WorkerPool(config);
  return workerPoolInstance;
}

/**
 * Get the singleton instance
 * @internal Low-level access to the generic pool
 */
export const workerPool = getGenericWorkerPool();
