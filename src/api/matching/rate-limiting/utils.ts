/**
 * Utility functions for rate limiting.
 *
 * @packageDocumentation
 * @source
 */

/**
 * Sleep for a specified duration.
 * @param ms - Number of milliseconds to sleep.
 * @returns Promise that resolves after the specified delay.
 * @source
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
