/**
 * @packageDocumentation
 * @module mediaListHelpers
 * @description Utility functions for handling AniList media list data and status formatting.
 */

import { MediaListStatus } from "../api/anilist/types";

/**
 * Formats an AniList media list status into a human-readable label.
 *
 * Translates internal AniList status constants (CURRENT, PLANNING, COMPLETED, etc.)
 * to user-friendly display strings.
 *
 * @param status - The AniList media list status.
 * @returns A human-readable status label.
 * @source
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
 * Returns Tailwind CSS text color classes for an AniList media list status.
 *
 * @param status - The AniList media list status.
 * @returns Tailwind CSS class string for text coloring.
 * @source
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
 * Returns Tailwind CSS classes for styling an AniList media list status badge.
 *
 * Combines background and text colors appropriate for badge display with dark mode support.
 *
 * @param status - The AniList media list status.
 * @returns Tailwind CSS class string for badge styling.
 * @source
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
 * Formats a score into a human-readable string on the 0-10 scale.
 *
 * Returns "Not Rated" for a score of 0, otherwise returns the score with "/10" suffix.
 *
 * @param score - The score value (0-10).
 * @returns A formatted score string.
 * @source
 */
export function formatScore(score: number): string {
  if (score === 0) {
    return "Not Rated";
  }
  return `${score}/10`;
}

/**
 * Determines whether a manga entry exists on the user's AniList list.
 *
 * @param mediaListEntry - The media list entry object.
 * @returns True if the entry exists (has an id), false otherwise.
 * @source
 */
export function isOnUserList(mediaListEntry?: { id?: number } | null): boolean {
  return Boolean(mediaListEntry?.id);
}
