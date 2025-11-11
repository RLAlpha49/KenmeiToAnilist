/**
 * @packageDocumentation
 * @module workers/init
 * @description Non-blocking worker pool initialization for the renderer process.
 * Loads worker pools in parallel with UI rendering to improve startup performance.
 * @source
 */

/**
 * Initializes all worker pools in the background without blocking the main thread.
 * This function is designed to be called after storage initialization but before
 * or alongside React app rendering to ensure workers are ready when needed.
 *
 * Runs asynchronously and non-blocking via .then() chaining to avoid blocking UI rendering.
 * @returns Promise that resolves when worker pools are initialized (or rejects on error).
 * @source
 */
export async function initializeWorkerPoolsAsync(): Promise<void> {
  try {
    const { getWorkerPool } = await import("./core/pool");
    const workerPool = getWorkerPool();
    await workerPool.initialize();
    console.info("[WorkerInit] ✅ Worker pools initialized successfully");
  } catch (error) {
    console.warn(
      "[WorkerInit] ⚠️ Worker pool initialization failed (will fall back to main thread):",
      error instanceof Error ? error.message : String(error),
    );
    // Non-critical: if workers fail, the app falls back to main thread execution
    // Re-throw to allow error handling in the caller
    throw error;
  }
}
