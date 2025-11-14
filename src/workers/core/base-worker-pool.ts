/**
 * Base worker pool class providing common patterns and functionality
 * for all specialized worker pool implementations.
 * Reduces code duplication across filter, duplicate, fuzzy search, CSV, and other pools.
 * @source
 */

import { getGenericWorkerPool } from "./worker-pool";

/**
 * Configuration for task execution timeouts.
 * @source
 */
export interface BaseWorkerPoolConfig {
  /** Task timeout in milliseconds (default: 30000) */
  taskTimeoutMs?: number;
}

/**
 * Base class for all worker pool implementations.
 * Handles common patterns: initialization, worker selection, task tracking,
 * timeout management, and main-thread fallback.
 * @source
 */
export abstract class BaseWorkerPool {
  protected initialized = false;
  protected readonly taskTimeoutMs: number;

  constructor(config?: BaseWorkerPoolConfig) {
    this.taskTimeoutMs = config?.taskTimeoutMs ?? 30000;
  }

  /**
   * Initializes the shared worker pool.
   * Should be called by subclasses via super.initialize() or independently.
   * @source
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const pool = getGenericWorkerPool();
      await pool.initialize();
      this.initialized = true;
      console.info(`[${this.getPoolName()}] Pool initialized`);
    } catch (error) {
      console.warn(`[${this.getPoolName()}] Failed to initialize pool:`, error);
      // Still mark as initialized to use main thread fallback
      this.initialized = true;
    }
  }

  /**
   * Returns the name of this worker pool for logging purposes.
   * Subclasses should override this for better logging.
   * @returns Pool name string
   * @source
   */
  protected getPoolName(): string {
    return this.constructor.name;
  }

  /**
   * Ensures the pool is initialized before executing tasks.
   * @source
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Checks if workers are available for task execution.
   * @returns True if workers are available
   * @source
   */
  protected isWorkerPoolAvailable(): boolean {
    const pool = getGenericWorkerPool();
    return this.initialized && pool.isAvailable();
  }

  /**
   * Gets the count of available workers.
   * @returns Count of idle workers
   * @source
   */
  getAvailableWorkerCount(): number {
    const pool = getGenericWorkerPool();
    return this.initialized ? pool.getAvailableWorkerCount() : 0;
  }

  /**
   * Selects an available worker from the pool.
   * @returns Worker index or -1 if none available
   * @source
   */
  protected selectWorker(): number {
    const pool = getGenericWorkerPool();
    return pool.selectWorker();
  }

  /**
   * Gets a specific worker by index, marking it as busy.
   * @param workerIndex - Index of the worker to retrieve
   * @returns Worker instance or null
   * @source
   */
  protected getWorker(workerIndex: number): Worker | null {
    const pool = getGenericWorkerPool();
    return pool.getWorker(workerIndex);
  }

  /**
   * Registers a task with the pool for message routing.
   * @param taskId - Unique task identifier
   * @param task - Task object with resolve/reject handlers
   * @source
   */
  protected registerTask(taskId: string, task: unknown): void {
    const pool = getGenericWorkerPool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pool.registerTask(taskId, task as any);
  }

  /**
   * Cancels a task and frees its associated worker.
   * @param taskId - Task identifier to cancel
   * @source
   */
  protected cancelTask(taskId: string): void {
    const pool = getGenericWorkerPool();
    pool.cancelTask(taskId);
  }

  /**
   * Executes a function with timeout and fallback to main thread.
   * Common pattern: try worker execution, fallback on timeout or unavailability.
   * @param workerExecution - Function that executes task on worker
   * @param fallbackExecution - Function that executes task on main thread
   * @param taskId - Task identifier for logging and cleanup
   * @returns Result from either worker or fallback execution
   * @source
   */
  protected async executeWithFallback<T>(
    workerExecution: () => Promise<T>,
    fallbackExecution: () => T | Promise<T>,
    taskId: string,
  ): Promise<T> {
    if (!this.isWorkerPoolAvailable()) {
      console.debug(
        `[${this.getPoolName()}] No workers available, using main thread for ${taskId}`,
      );
      return fallbackExecution();
    }

    try {
      // Set timeout for worker execution
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          this.cancelTask(taskId);
          reject(
            new Error(
              `[${this.getPoolName()}] Task ${taskId} timed out after ${this.taskTimeoutMs}ms`,
            ),
          );
        }, this.taskTimeoutMs);
      });

      try {
        // Race between worker execution and timeout
        return await Promise.race([workerExecution(), timeoutPromise]);
      } finally {
        // Ensure timeout is always cleared, whether worker succeeds or rejects
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    } catch (error) {
      console.warn(
        `[${this.getPoolName()}] Worker execution failed for ${taskId}, falling back to main thread:`,
        error,
      );
      return fallbackExecution();
    }
  }

  /**
   * Terminates the underlying shared worker pool.
   * @source
   */
  terminate(): void {
    if (this.initialized) {
      try {
        const pool = getGenericWorkerPool();
        pool.terminate();
        this.initialized = false;
      } catch (error) {
        console.warn(`[${this.getPoolName()}] Error terminating pool:`, error);
      }
    }
  }

  /**
   * Returns initialization and availability stats.
   * @returns Status object
   * @source
   */
  getStats(): {
    initialized: boolean;
    available: boolean;
    availableWorkers: number;
  } {
    return {
      initialized: this.initialized,
      available: this.isWorkerPoolAvailable(),
      availableWorkers: this.getAvailableWorkerCount(),
    };
  }
}
