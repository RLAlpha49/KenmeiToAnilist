/**
 * Shared normalization utilities for title and string processing.
 *
 * These functions are used across both main thread (for matching/display)
 * and worker context (for matching computations), so they must not have
 * DOM or renderer-specific dependencies.
 *
 * @module utils/normalization
 */

/**
 * Normalize a string for matching operations.
 * - Converts to lowercase
 * - Removes hyphens and special characters (keeps only word chars and spaces)
 * - Collapses multiple spaces to single space
 * - Trims whitespace
 *
 * @param str - The string to normalize
 * @returns Normalized string suitable for title matching
 * @source
 */
export function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .replaceAll("-", "")
    .replaceAll(/[^\w\s]/g, "")
    .replaceAll(/\s+/g, " ")
    .replaceAll("_", " ")
    .trim();
}

/**
 * Process a title by removing parenthetical content and normalizing characters.
 * - Removes content in parentheses
 * - Normalizes special quote characters (smart quotes, curly quotes)
 * - Replaces hyphens with spaces
 * - Normalizes underscores and multiple spaces
 * - Trims whitespace
 *
 * @param title - The title to process
 * @returns Processed title
 * @source
 */
export function processTitle(title: string): string {
  const withoutParentheses = title.replaceAll(/\s*\([^()]*\)\s*/g, " ");

  return withoutParentheses
    .replaceAll("-", " ")
    .replaceAll("\u2018", "'") // Left single quotation mark
    .replaceAll("\u2019", "'") // Right single quotation mark
    .replaceAll("\u201C", '"') // Left double quotation mark
    .replaceAll("\u201D", '"') // Right double quotation mark
    .replaceAll("_", " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
}

/**
 * Map of normalization algorithm names to implementations.
 * Used for dynamic algorithm selection in worker context.
 *
 * @source
 */
export const normalizationAlgorithmsMap: Record<
  string,
  (title: string) => string
> = {
  normalizeForMatching,
  processTitle,
};
