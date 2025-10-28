/**
 * @packageDocumentation
 * @module components/matching/labels
 * @description Shared label formatting utilities for filter display.
 */

/**
 * Format label for manga format display.
 * @param format - The format string (MANGA, ONE_SHOT, NOVEL, etc.).
 * @returns A human-readable label for the format.
 */
export function formatLabel(format: string): string {
  switch (format) {
    case "MANGA":
      return "Manga";
    case "ONE_SHOT":
      return "One-Shot";
    case "NOVEL":
      return "Novel";
    default:
      return format;
  }
}

/**
 * Format label for publication status display.
 * @param status - The status string (FINISHED, RELEASING, etc.).
 * @returns A human-readable label for the status.
 */
export function statusLabel(status: string): string {
  switch (status) {
    case "FINISHED":
      return "Finished";
    case "RELEASING":
      return "Releasing";
    case "NOT_YET_RELEASED":
      return "Not Yet Released";
    case "CANCELLED":
      return "Cancelled";
    case "HIATUS":
      return "Hiatus";
    default:
      return status;
  }
}
