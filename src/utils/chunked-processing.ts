/**
 * Utility module for chunked async processing with cancellation support.
 * Allows large batch operations to be processed incrementally, yielding to the main thread
 * to prevent UI freezing and enable progress tracking and cancellation.
 */

/**
 * Options for chunked processing
 */
export interface ChunkedProcessorOptions {
  /** Number of items to process per chunk (default: 20) */
  chunkSize?: number;
  /** Milliseconds to wait between chunks (default: 0) */
  delayBetweenChunks?: number;
  /** Optional callback receiving progress updates (current, total) */
  onProgress?: (current: number, total: number) => void;
  /** Optional AbortSignal for cancellation support */
  signal?: AbortSignal;
}

/**
 * Error thrown when a chunked operation is cancelled
 */
export class AbortError extends Error {
  constructor(message: string = "Operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

/**
 * Processes an array of items in chunks, yielding to the main thread between chunks.
 * Enables progress tracking and cancellation for long-running batch operations.
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each chunk of items
 * @param options - Configuration options for chunking and cancellation
 * @returns Promise resolving to array of results from the processor function
 * @throws AbortError if the operation is cancelled via signal.abort()
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (chunk: T[]) => Promise<R[]>,
  options: ChunkedProcessorOptions = {},
): Promise<R[]> {
  const {
    chunkSize = 20,
    delayBetweenChunks = 0,
    onProgress,
    signal,
  } = options;

  // Check if already aborted before starting
  if (signal?.aborted) {
    throw new AbortError();
  }

  const results: R[] = [];
  const totalItems = items.length;

  // Process items in chunks
  for (let i = 0; i < totalItems; i += chunkSize) {
    // Check abort signal before each chunk
    if (signal?.aborted) {
      throw new AbortError();
    }

    // Extract chunk
    const chunk = items.slice(i, Math.min(i + chunkSize, totalItems));

    // Process chunk
    const chunkResults = await processor(chunk);
    results.push(...chunkResults);

    // Update progress
    const processed = Math.min(i + chunkSize, totalItems);
    onProgress?.(processed, totalItems);

    // Yield to main thread between chunks if not the last chunk
    if (i + chunkSize < totalItems) {
      await new Promise((resolve) => {
        setTimeout(resolve, delayBetweenChunks);
      });
    }
  }

  return results;
}
