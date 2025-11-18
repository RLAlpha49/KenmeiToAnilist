/**
 * @packageDocumentation
 * @module components/matching/labels
 * @description Shared label formatting utilities for filter display.
 */

/**
 * Formats manga format string to human-readable label.
 * @param format - Format string (MANGA, ONE_SHOT, NOVEL, etc.).
 * @returns Human-readable label for the format.
 * @source
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
 * Formats publication status string to human-readable label.
 * @param status - Status string (FINISHED, RELEASING, NOT_YET_RELEASED, etc.).
 * @returns Human-readable label for the status.
 * @source
 */
export function formatPublicationStatusLabel(status: string): string {
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

/**
 * Formats year range to human-readable label.
 * @param yearRange - Year range object with min and max values.
 * @returns Formatted year range string.
 * @source
 */
export function formatYearRangeLabel(yearRange: {
  min: number | null;
  max: number | null;
}): string {
  if (yearRange.min !== null && yearRange.max !== null) {
    return `${yearRange.min}-${yearRange.max}`;
  }
  if (yearRange.min !== null) {
    return `${yearRange.min}+`;
  }
  if (yearRange.max !== null) {
    return `<${yearRange.max}`;
  }
  return "Any year";
}
