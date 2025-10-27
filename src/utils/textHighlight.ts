import React from "react";

/**
 * Text highlighting utility for search and filter features.
 *
 * Provides functions to highlight matching text segments with visual styling.
 * Extracted from existing patterns in LogViewer and StorageDebugger components.
 *
 * @module textHighlight
 * @example
 * // Basic usage
 * const highlighted = highlightText("Ignore adult content", "adult");
 * // Returns: ["Ignore ", <mark>adult</mark>, " content"]
 *
 * @example
 * // Multiple matches
 * const highlighted = highlightText("backup and restore backup", "backup");
 * // Returns: [<mark>backup</mark>, " and restore ", <mark>backup</mark>]
 */

/**
 * Helper function to extract substring between indices.
 *
 * @param text - The source text
 * @param start - Start index (inclusive)
 * @param end - End index (exclusive)
 * @returns Substring from start to end
 * @internal
 */
const sliceText = (text: string, start: number, end: number): string => {
  return text.slice(start, end);
};

/**
 * Highlights all occurrences of a query string in text.
 *
 * Performs case-insensitive matching and wraps matching segments in
 * a `<mark>` element with yellow background styling. Returns an array
 * of React nodes containing text and highlighted segments.
 *
 * @param text - The text to highlight
 * @param query - The search query to find and highlight
 * @returns React nodes array containing text and <mark> elements, or original text if query is empty
 *
 * @example
 * highlightText("Find adult content", "adult")
 * // Returns JSX: "Find <mark>adult</mark> content"
 *
 * @example
 * highlightText("Backup and restore backup", "backup")
 * // Returns JSX: "<mark>Backup</mark> and restore <mark>backup</mark>"
 *
 * @remarks
 * - Matching is case-insensitive
 * - All occurrences are highlighted
 * - Styling uses Tailwind classes for light and dark mode support
 * - Each mark element has a unique key for React rendering
 */
export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  // Find all occurrences of query in text
  let index = lowerText.indexOf(lowerQuery);

  while (index !== -1) {
    // Add text before the match
    if (index > lastIndex) {
      parts.push(sliceText(text, lastIndex, index));
    }

    // Add highlighted match
    parts.push(
      React.createElement(
        "mark",
        {
          key: `match-${matchIndex}`,
          className:
            "rounded bg-yellow-200/80 px-1 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-100",
        },
        sliceText(text, index, index + query.length),
      ),
    );

    // Move to next position
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
    matchIndex++;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(sliceText(text, lastIndex, text.length));
  }

  return React.createElement(React.Fragment, null, ...parts);
};

export { sliceText };
