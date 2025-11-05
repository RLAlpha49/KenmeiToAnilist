/**
 * Utility functions for rate limiting operations.
 *
 * @packageDocumentation
 * @source
 */

/**
 * Delay execution for a specified duration.
 * @param ms - Number of milliseconds to delay.
 * @returns Promise that resolves after the delay.
 * @source
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
