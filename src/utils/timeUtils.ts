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

/**
 * Formats a timestamp into a relative time string (e.g., "2 hours ago", "3 days ago").
 *
 * Converts an ISO 8601 timestamp or null value into a human-readable relative time.
 * Falls back to "Never" if no timestamp is provided.
 *
 * @param timestamp - ISO 8601 timestamp string or null.
 * @returns A human-readable relative time string.
 * @source
 */
export const formatRelativeTime = (timestamp: string | null): string => {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) {
    const minutes = Math.round(diffMs / minute);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (diffMs < day) {
    const hours = Math.round(diffMs / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 7 * day) {
    const days = Math.round(diffMs / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
