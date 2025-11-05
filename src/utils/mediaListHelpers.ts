/**
 * @packageDocumentation
 * @module mediaListHelpers
 * @description Utility functions for handling AniList media list data and status formatting.
 */

import { MediaListStatus } from "../api/anilist/types";

/**
 * Formats AniList media list status constants into human-readable display labels.
 * @param status - The AniList media list status (CURRENT, PLANNING, COMPLETED, etc.).
 * @returns Human-readable status label.
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
 * Returns Tailwind CSS text color classes for AniList media list status.
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
 * Returns Tailwind CSS badge styling classes for AniList media list status with dark mode support.
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
 * Formats 0-10 score into human-readable string ("Not Rated" or "{score}/10").
 * @param score - The score value (0-10).
 * @returns Formatted score string.
 * @source
 */
export function formatScore(score: number): string {
  if (score === 0) {
    return "Not Rated";
  }
  return `${score}/10`;
}

/**
 * Checks whether manga entry exists on user's AniList list (has valid id).
 * @param mediaListEntry - The media list entry object (may be null/undefined).
 * @returns True if entry has an id; false otherwise.
 * @source
 */
export function isOnUserList(mediaListEntry?: { id?: number } | null): boolean {
  return Boolean(mediaListEntry?.id);
}
