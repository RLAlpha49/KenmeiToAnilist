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

/**
 * Component for displaying truncated text with inline expansion capability.
 * Used for toast notifications with long descriptions.
 * @internal
 */
const TruncatedToastContent: React.FC<{
  text: string;
  maxLength: number;
  truncatedText: string;
}> = ({ text, maxLength, truncatedText }) => {
  const [expanded, setExpanded] = React.useState(false);

  return React.createElement(
    "div",
    { className: "flex flex-col gap-1" },
    React.createElement(
      "div",
      { className: expanded ? "" : "line-clamp-3" },
      expanded ? text : truncatedText,
    ),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setExpanded(!expanded);
        },
        className:
          "text-xs opacity-70 hover:opacity-100 underline transition-opacity",
      },
      expanded ? "Show less" : "Show more",
    ),
  );
};

/**
 * Truncates text for toast descriptions and provides inline expansion capability.
 * @param text - The text to potentially truncate.
 * @param maxLength - Maximum character length before truncation (default: 200).
 * @returns Object containing truncation status, both versions of text, and React component for rendering.
 *
 * @source
 */
export const truncateToastMessage = (
  text: string,
  maxLength: number = 200,
): {
  isTruncated: boolean;
  truncatedText: string;
  fullText: string;
  component: React.ReactNode;
} => {
  // Early return for whitespace-only strings
  if (text.trim().length === 0) {
    return {
      isTruncated: false,
      truncatedText: text,
      fullText: text,
      component: text,
    };
  }

  // Normalize consecutive whitespace (including newlines) to single spaces
  const normalizedText = text.replace(/\s+/g, " ");

  if (normalizedText.length <= maxLength) {
    return {
      isTruncated: false,
      truncatedText: normalizedText,
      fullText: normalizedText,
      component: normalizedText,
    };
  }

  // Find last space before maxLength for word boundary truncation
  let truncateIndex = maxLength;
  const lastSpaceIndex = normalizedText.lastIndexOf(" ", maxLength);

  if (lastSpaceIndex > 0 && lastSpaceIndex > maxLength - 50) {
    // Use word boundary if space is close to maxLength
    truncateIndex = lastSpaceIndex;
  }

  const truncatedText = normalizedText.slice(0, truncateIndex).trim() + "...";

  return {
    isTruncated: true,
    truncatedText,
    fullText: normalizedText,
    component: React.createElement(TruncatedToastContent, {
      text: normalizedText,
      maxLength,
      truncatedText,
    }),
  };
};

export { sliceText };
