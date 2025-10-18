/**
 * @packageDocumentation
 * @module timeUtils
 * @description Utility functions for formatting time values into human-readable strings.
 */

/**
 * Formats seconds into a human-readable time string.
 *
 * Converts numeric seconds into a convenient display format (e.g., "2 hours 30 minutes").
 * Handles singular/plural forms appropriately.
 *
 * @param seconds - The number of seconds to format.
 * @returns A human-readable time string.
 * @source
 */
export const formatTimeRemaining = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minute${minutes === 1 ? "" : "s"} ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
};
