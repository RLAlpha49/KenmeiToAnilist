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
  type: "matching" | "csv";
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
  workerIndex?: number;
  onProgress?: (message: any) => void;
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

    const taskId = (message.payload as any).taskId;
    const task = this.tasks.get(taskId);

    if (!task) {
      return;
    }

    switch (message.type) {
      case "PROGRESS":
        if (task.onProgress) {
          task.onProgress(message);
        }
        break;

      case "RESULT":
      case "CSV_COMPLETE":
      case "ADVANCED_FILTER_RESULT": {
        const payload = (message as any).payload;
        let result: Record<string, unknown>;

        if (message.type === "CSV_COMPLETE") {
          result = { manga: payload.manga, stats: payload.stats };
        } else if (message.type === "ADVANCED_FILTER_RESULT") {
          result = {
            filteredMatches: payload.filteredMatches,
            stats: payload.stats,
            timing: payload.timing,
          };
        } else {
          result = { results: payload.results };
        }

        task.resolve(result);
        this.completeTask(taskId);
        console.info(
          `[WorkerPool] ✅ Worker ${workerIndex} completed task ${taskId}`,
        );
        break;
      }

      case "ERROR": {
        const payload = (message as any).payload;
        task.reject(new Error(`Worker error: ${payload.error.message}`));
        this.completeTask(taskId);
        console.error(
          `[WorkerPool] ❌ Worker ${workerIndex} error: ${payload.error.message}`,
        );
        break;
      }
    }
  }

  /**
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
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.workerIndex !== undefined) {
      this.workers[task.workerIndex].postMessage({
        type: "CANCEL",
        payload: { taskId },
      });
      this.completeTask(taskId);
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
 * Get or create the worker pool singleton
 */
export function getWorkerPool(config?: Partial<WorkerPoolConfig>): WorkerPool {
  workerPoolInstance ??= new WorkerPool(config);
  return workerPoolInstance;
}

/**
 * Get the singleton instance
 */
export const workerPool = getWorkerPool();
