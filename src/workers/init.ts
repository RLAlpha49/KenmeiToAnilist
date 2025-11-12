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
    // Initialize the main generic worker pool (core infrastructure)
    const { getGenericWorkerPool } = await import("./core/worker-pool");
    const genericPool = getGenericWorkerPool();
    await genericPool.initialize();

    // Initialize data processing worker pools
    const { getCSVWorkerPool } = await import(
      "./data-processing/csv-worker-pool"
    );
    await getCSVWorkerPool().initialize();

    const { getFilterWorkerPool } = await import(
      "./data-processing/filter-worker-pool"
    );
    await getFilterWorkerPool().initialize();

    const { getJSONSerializationWorkerPool } = await import(
      "./data-processing/json-serialization-worker-pool"
    );
    await getJSONSerializationWorkerPool().initialize();

    // Initialize statistics worker pools
    const { getStatisticsWorkerPool } = await import(
      "./statistics/statistics-worker-pool"
    );
    await getStatisticsWorkerPool().initialize();

    const { getReadingHistoryWorkerPool } = await import(
      "./statistics/reading-history-worker-pool"
    );
    await getReadingHistoryWorkerPool().initialize();

    const { getTitleNormalizationPool } = await import(
      "./statistics/title-normalization-worker-pool"
    );
    await getTitleNormalizationPool().initialize();

    const { getDuplicateDetectionWorkerPool } = await import(
      "./statistics/duplicate-worker-pool"
    );
    await getDuplicateDetectionWorkerPool().initialize();

    // Initialize UI worker pools
    const { getDataTableWorkerPool } = await import(
      "./ui/data-table-worker-pool"
    );
    await getDataTableWorkerPool().initialize();

    console.info("[WorkerInit] ✅ All worker pools initialized successfully");
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
