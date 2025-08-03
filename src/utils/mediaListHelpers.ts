/**
 * @packageDocumentation
 * @module mediaListHelpers
 * @description Utility functions for handling AniList media list data and status formatting.
 */

import { MediaListStatus } from "../api/anilist/types";

/**
 * Format a media list status for display
 */
export function formatMediaListStatus(status: MediaListStatus): string {
  switch (status) {
    case "CURRENT":
      return "Reading";
    case "PLANNING":
      return "Plan to Read";
    case "COMPLETED":
      return "Completed";
    case "DROPPED":
      return "Dropped";
    case "PAUSED":
      return "Paused";
    case "REPEATING":
      return "Re-reading";
    default:
      return status;
  }
}

/**
 * Get a color class for a media list status
 */
export function getStatusColor(status: MediaListStatus): string {
  switch (status) {
    case "CURRENT":
      return "text-blue-600 dark:text-blue-400";
    case "PLANNING":
      return "text-gray-600 dark:text-gray-400";
    case "COMPLETED":
      return "text-green-600 dark:text-green-400";
    case "DROPPED":
      return "text-red-600 dark:text-red-400";
    case "PAUSED":
      return "text-yellow-600 dark:text-yellow-400";
    case "REPEATING":
      return "text-purple-600 dark:text-purple-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

/**
 * Get a background color class for a media list status badge
 */
export function getStatusBadgeColor(status: MediaListStatus): string {
  switch (status) {
    case "CURRENT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
    case "PLANNING":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    case "COMPLETED":
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    case "DROPPED":
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
    case "PAUSED":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    case "REPEATING":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
  }
}

/**
 * Format a score for display (0-10 scale)
 */
export function formatScore(score: number): string {
  if (score === 0) {
    return "Not Rated";
  }
  return `${score}/10`;
}

/**
 * Check if a manga entry is on the user's list
 */
export function isOnUserList(mediaListEntry?: { id: number } | null): boolean {
  return Boolean(mediaListEntry?.id);
}
