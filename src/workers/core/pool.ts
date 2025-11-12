/**
 * @packageDocumentation
 * @module pool
 * @description Manages the singleton matching worker pool to avoid circular dependencies and centralize initialization.
 * @source
 */

import { MatchingWorkerPool } from "../matching/matching-worker-pool";

// Singleton worker pool instance
let workerPoolInstance: MatchingWorkerPool | null = null;

/**
 * Get the singleton worker pool instance.
 * Initialization is handled explicitly via initializeWorkerPoolsAsync() in the renderer.
 * Accessing this without prior initialization will return an uninitialized pool instance.
 *
 * @returns The worker pool instance
 */
export function getWorkerPool(): MatchingWorkerPool {
  workerPoolInstance ??= new MatchingWorkerPool();
  return workerPoolInstance;
}

/**
 * Export the singleton instance for convenience.
 */
export const workerPool = getWorkerPool();
