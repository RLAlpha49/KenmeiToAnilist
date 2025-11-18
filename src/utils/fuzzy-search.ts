/**
 * @packageDocumentation
 * @module utils/fuzzySearch
 * @description Fuzzy search functionality for manga matching with query syntax parsing.
 */

import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { MangaMatchResult } from "@/api/anilist/types";
import type {
  QuerySyntaxToken,
  AdvancedMatchFilters,
} from "@/types/matching-filters";
import { defaultAdvancedFilters } from "@/types/matching-filters";
import { getFuzzySearchWorkerPool } from "@/workers/search/fuzzy-search-worker-pool";

/**
 * Default Fuse.js options for consistent fuzzy search behavior across components.
 * Tuned for balanced fuzzy matching with reasonable performance.
 * @source
 */
export const defaultFuseOptions = {
  threshold: 0.3, // Balance between fuzzy and strict matching
  distance: 100, // Allow some character distance
  includeScore: true,
  minMatchCharLength: 2, // Require minimum 2 characters before matching
  ignoreLocation: true, // Search anywhere in the string, not just start
};

/**
 * Named Fuse.js preset configurations for standardized threshold behavior across components.
 * Use these presets when calling buildFuse() to ensure consistent fuzzy search behavior.
 * @source
 */
export const FUSE_PRESET_STRICT = { threshold: 0.2 } as const; // Highly strict matching
export const FUSE_PRESET_BALANCED = { threshold: 0.3 } as const; // Balanced (default)
export const FUSE_PRESET_LOOSE = { threshold: 0.4 } as const; // Permissive matching

/**
 * Builds a configured Fuse.js instance with default or custom options.
 *
 * Note: For custom field extraction logic, use the top-level `getFn` option via overrides
 * rather than passing getFn in individual keys. Keys should only contain 'name' and optional 'weight'.
 *
 * Important: `useExtendedSearch` defaults to false. To enable Fuse's extended search syntax
 * (e.g., `'word1 -word2 | phrase'`), explicitly pass `useExtendedSearch: true` in overrides.
 *
 * @template T - The data type being searched.
 * @param list - Array of items to search.
 * @param keys - Search key definitions (string name or { name: string; weight?: number }).
 * @param overrides - Optional overrides for default Fuse options (can include top-level getFn and useExtendedSearch).
 * @returns Configured Fuse instance.
 * @source
 */
export function buildFuse<T>(
  list: T[],
  keys: (string | { name: string; weight?: number })[],
  overrides?: Partial<IFuseOptions<T>>,
): Fuse<T> {
  return new Fuse(list, {
    ...defaultFuseOptions,
    keys,
    ...overrides,
  });
}

/**
 * Creates a configured Fuse.js instance for manga search.
 *
 * Searches across multiple title fields with weighted priorities:
 * - Kenmei title (50%)
 * - Romaji title (30%)
 * - English title (30%)
 * - Synonyms (10%)
 *
 * **Important**: This function explicitly enables `useExtendedSearch` for fuzzy query syntax support
 * (e.g., 'foo bar' searches for both terms). Callers should be aware that search results will
 * respect this extended syntax behavior.
 *
 * @param matches - Array of manga match results to search.
 * @returns Configured Fuse instance with extended search enabled.
 * @source
 */
export function createMangaFuseInstance(
  matches: MangaMatchResult[],
): Fuse<MangaMatchResult> {
  return buildFuse(
    matches,
    [
      { name: "kenmeiManga.title", weight: 0.5 },
      { name: "selectedMatch.title.romaji", weight: 0.3 },
      { name: "selectedMatch.title.english", weight: 0.3 },
      { name: "selectedMatch.synonyms", weight: 0.1 },
    ],
    {
      useExtendedSearch: true, // Enable extended search syntax support for query parsing
    },
  );
}

/**
 * Parses search query into tokens for field-specific filtering.
 *
 * Supported syntax:
 * - `genre:action` - Filter by genre
 * - `format:manga` - Filter by format
 * - `year:2020-2023` - Filter by year range
 * - `tag:isekai` - Filter by tag
 * - Plain text - Fuzzy search on titles
 *
 * @param query - Search query string.
 * @returns Array of parsed tokens.
 * @source
 */
export function parseQuerySyntax(query: string): QuerySyntaxToken[] {
  const tokens: QuerySyntaxToken[] = [];
  const parts = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (const part of parts) {
    // Remove quotes if present
    const cleaned = part.replaceAll(/(?:^")|(?:"$)/g, "");

    // Check for field:value pattern
    const fieldPattern = /^(genre|format|year|tag):(.+)$/i;
    const fieldMatch = fieldPattern.exec(cleaned);
    if (fieldMatch) {
      const [, field, value] = fieldMatch;

      // Handle year range (e.g., 2020-2023)
      if (field.toLowerCase() === "year" && value.includes("-")) {
        const [min, max] = value.split("-").map((v) => v.trim());
        tokens.push({
          type: "field",
          field: "year",
          value: `${min}-${max}`,
        });
      } else {
        tokens.push({
          type: "field",
          field: field.toLowerCase(),
          value,
        });
      }
    } else {
      // Plain text for fuzzy search
      tokens.push({
        type: "text",
        value: cleaned,
      });
    }
  }

  return tokens;
}

/**
 * Converts parsed query tokens to filter state.
 *
 * Merges field tokens into AdvancedMatchFilters structure.
 * Text tokens are ignored (used for fuzzy search separately).
 *
 * @param tokens - Array of parsed query tokens.
 * @param existingFilters - Existing filters to merge with.
 * @returns Updated filter object.
 * @source
 */
/**
 * Applies a genre filter token to the filters object.
 */
function applyGenreFilter(
  filters: AdvancedMatchFilters,
  value: string,
): AdvancedMatchFilters {
  if (!filters.genres.includes(value)) {
    return { ...filters, genres: [...filters.genres, value] };
  }
  return filters;
}

/**
 * Applies a format filter token to the filters object.
 */
function applyFormatFilter(
  filters: AdvancedMatchFilters,
  value: string,
): AdvancedMatchFilters {
  const upperValue = value.toUpperCase();
  if (!filters.formats.includes(upperValue)) {
    return { ...filters, formats: [...filters.formats, upperValue] };
  }
  return filters;
}

/**
 * Applies a year filter token to the filters object.
 * Handles both year ranges (e.g., "2020-2023") and single years.
 */
function applyYearFilter(
  filters: AdvancedMatchFilters,
  value: string,
): AdvancedMatchFilters {
  const rangeParts = value.split("-");
  if (rangeParts.length === 2) {
    const min = Number.parseInt(rangeParts[0], 10);
    const max = Number.parseInt(rangeParts[1], 10);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return { ...filters, yearRange: { min, max } };
    }
  } else {
    const year = Number.parseInt(value, 10);
    if (!Number.isNaN(year)) {
      return { ...filters, yearRange: { min: year, max: year } };
    }
  }
  return filters;
}

/**
 * Applies a tag filter token to the filters object.
 */
function applyTagFilter(
  filters: AdvancedMatchFilters,
  value: string,
): AdvancedMatchFilters {
  if (!filters.tags?.includes(value)) {
    return { ...filters, tags: [...(filters.tags || []), value] };
  }
  return filters;
}

export function applyQueryToFilters(
  tokens: QuerySyntaxToken[],
  existingFilters: AdvancedMatchFilters = defaultAdvancedFilters,
): AdvancedMatchFilters {
  let filters = { ...existingFilters };

  for (const token of tokens) {
    if (token.type !== "field" || !token.field) continue;

    switch (token.field) {
      case "genre":
        filters = applyGenreFilter(filters, token.value);
        break;
      case "format":
        filters = applyFormatFilter(filters, token.value);
        break;
      case "year":
        filters = applyYearFilter(filters, token.value);
        break;
      case "tag":
        filters = applyTagFilter(filters, token.value);
        break;
    }
  }

  return filters;
}

/**
 * Performs fuzzy search on manga matches.
 *
 * Returns top 100 results ordered by relevance score.
 * Uses worker pool for large datasets (100+ items) to prevent UI blocking.
 * Falls back to main thread for small datasets.
 *
 * @param query - Search query string.
 * @param matches - Array of manga match results.
 * @returns Array of matched results with scores.
 * @source
 */
export async function fuzzySearchManga(
  query: string,
  matches: MangaMatchResult[],
): Promise<MangaMatchResult[]> {
  if (!query.trim()) {
    return matches;
  }

  // Extract text tokens for fuzzy search
  const tokens = parseQuerySyntax(query);
  const textTokens = tokens.filter((t) => t.type === "text");

  if (textTokens.length === 0) {
    // Only field tokens, no fuzzy search needed
    return matches;
  }

  // Combine text tokens for search
  const searchQuery = textTokens.map((t) => t.value).join(" ");

  // Use worker pool for large datasets (100+ items) to prevent UI blocking
  // Small datasets use main thread for faster execution (less overhead)
  if (matches.length >= 100) {
    try {
      const pool = getFuzzySearchWorkerPool();
      await pool.initialize();

      const result = await pool.search(
        matches,
        searchQuery,
        [
          { name: "kenmeiManga.title", weight: 0.5 },
          { name: "selectedMatch.title.romaji", weight: 0.3 },
          { name: "selectedMatch.title.english", weight: 0.3 },
          { name: "selectedMatch.synonyms", weight: 0.1 },
        ],
        { useExtendedSearch: true },
        100,
      );

      return result.results;
    } catch (error) {
      console.warn(
        "[fuzzySearchManga] Worker pool search failed, falling back to main thread:",
        error,
      );
      // Fall through to main thread implementation below
    }
  }

  // Main thread implementation for small datasets
  const fuse = createMangaFuseInstance(matches);
  const results = fuse.search(searchQuery);

  // Return top 100 results
  return results.slice(0, 100).map((result) => result.item);
}
