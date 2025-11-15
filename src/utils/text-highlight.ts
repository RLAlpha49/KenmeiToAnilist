/**
 * @packageDocumentation
 * @module textHighlight
 * @description Utility functions for highlighting and styling matching text segments in search and filter features.
 */

import React from "react";

/**
 * Size-capped cache for memoizing highlight results.
 * Stores up to 100 recently computed highlights to avoid redundant processing.
 * Uses FIFO eviction when the cache reaches capacity.
 * @internal
 */
const highlightCache = new Map<string, React.ReactNode>();
const CACHE_SIZE_LIMIT = 100;

/**
 * Fast 32-bit FNV-1a hash function for text content.
 * Provides low-collision hashing for cache key generation.
 * @param text - The text to hash.
 * @returns 32-bit hash value as hex string.
 * @internal
 */
const hashText = (text: string): string => {
  let hash = 2166136261; // FNV offset basis for 32-bit
  let i = 0;
  while (i < text.length) {
    const codePoint = text.codePointAt(i) ?? 0;
    hash ^= codePoint;
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash = hash >>> 0; // Keep as 32-bit unsigned
    // Skip extra step for surrogate pairs (code points > 0xFFFF are encoded as surrogate pairs in UTF-16)
    i += codePoint > 0xffff ? 2 : 1;
  }
  return hash.toString(16);
};

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
 * Results are memoized by a cache key incorporating text hash and query to avoid redundant
 * processing on repeated calls with the same inputs and prevent collisions from same-length
 * but different text strings.
 * @param text - The text to highlight.
 * @param query - The search query to find and highlight.
 * @returns React nodes array containing text and mark elements; original text if query empty.
 * @source
 */
export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) {
    return text;
  }

  // Create cache key incorporating text hash, length, and query for low-collision lookup
  const cacheKey = `${hashText(text)}|${text.length}|${query.toLowerCase()}`;
  if (highlightCache.has(cacheKey)) {
    const cachedResult = highlightCache.get(cacheKey)!;
    // Move to end of Map by deleting and re-setting to make eviction closer to LRU
    highlightCache.delete(cacheKey);
    highlightCache.set(cacheKey, cachedResult);
    return cachedResult;
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

  const result = React.createElement(React.Fragment, null, ...parts);

  // Store in cache, evicting oldest entry if cache is full
  if (highlightCache.size >= CACHE_SIZE_LIMIT) {
    const firstKey = highlightCache.keys().next().value;
    if (firstKey) {
      highlightCache.delete(firstKey);
    }
  }
  highlightCache.set(cacheKey, result);

  return result;
};

/**
 * Component for displaying truncated text with inline expansion capability.
 * Used for toast notifications with long descriptions.
 * @internal
 */
const TruncatedToastContent: React.FC<{
  text: string;
  truncatedText: string;
}> = ({ text, truncatedText }) => {
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
 * Preserves single newlines while collapsing multiple spaces/tabs to single spaces.
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

  // Normalize consecutive spaces/tabs to single spaces, but preserve newlines
  const normalizedText = text
    .replaceAll(/[ \t]+/g, " ") // Collapse spaces and tabs
    .replaceAll(/\n\n+/g, "\n"); // Collapse multiple newlines to single newline

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
      truncatedText,
    }),
  };
};

export { sliceText };
