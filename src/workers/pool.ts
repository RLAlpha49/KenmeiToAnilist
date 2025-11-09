/**
 * Worker pool singleton management module.
 * Extracted into separate module to avoid circular dependencies.
 *
 * @module workers/pool
 */

import { MatchingWorkerPool } from "./matching-worker-pool";

// Singleton worker pool instance
let workerPoolInstance: MatchingWorkerPool | null = null;

/**
 * Get the singleton worker pool instance.
 * Creates and initializes the pool on first access.
 *
 * @returns The worker pool instance
 */
export function getWorkerPool(): MatchingWorkerPool {
  if (!workerPoolInstance) {
    workerPoolInstance = new MatchingWorkerPool();
    // Initialize lazily on first use (fire and forget)
    workerPoolInstance.initialize().catch(console.error);
  }
  return workerPoolInstance;
}

/**
 * Export the singleton instance for convenience.
 */
export const workerPool = getWorkerPool();
