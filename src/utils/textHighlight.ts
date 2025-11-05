/**
 * @packageDocumentation
 * @module textHighlight
 * @description Utility functions for highlighting and styling matching text segments in search and filter features.
 */

import React from "react";

/**
 * Extracts substring between start and end indices.
 * @param text - The source text.
 * @param start - Start index (inclusive).
 * @param end - End index (exclusive).
 * @returns Substring from start to end.
 * @internal
 * @source
 */
const sliceText = (text: string, start: number, end: number): string => {
  return text.slice(start, end);
};

/**
 * Highlights all case-insensitive occurrences of query in text with yellow mark styling.
 * @param text - The text to highlight.
 * @param query - The search query to find and highlight.
 * @returns React nodes array containing text and mark elements; original text if query empty.
 * @source
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
