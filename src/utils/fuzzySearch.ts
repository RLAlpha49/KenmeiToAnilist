/**
 * @packageDocumentation
 * @module utils/fuzzySearch
 * @description Fuzzy search functionality for manga matching with query syntax parsing.
 */

import Fuse from "fuse.js";
import type { MangaMatchResult } from "@/api/anilist/types";
import type {
  QuerySyntaxToken,
  AdvancedMatchFilters,
} from "@/types/matchingFilters";
import { DEFAULT_ADVANCED_FILTERS } from "@/types/matchingFilters";

/**
 * Creates a configured Fuse.js instance for manga search.
 *
 * Searches across multiple title fields with weighted priorities:
 * - Kenmei title (50%)
 * - Romaji title (30%)
 * - English title (30%)
 * - Synonyms (10%)
 *
 * @param matches - Array of manga match results to search.
 * @returns Configured Fuse instance.
 * @source
 */
export function createMangaFuseInstance(
  matches: MangaMatchResult[],
): Fuse<MangaMatchResult> {
  return new Fuse(matches, {
    keys: [
      { name: "kenmeiManga.title", weight: 0.5 },
      { name: "selectedMatch.title.romaji", weight: 0.3 },
      { name: "selectedMatch.title.english", weight: 0.3 },
      { name: "selectedMatch.synonyms", weight: 0.1 },
    ],
    threshold: 0.35, // Balance between fuzzy and strict
    distance: 100, // Allow some character distance
    includeScore: true,
    useExtendedSearch: true,
  });
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
export function applyQueryToFilters(
  tokens: QuerySyntaxToken[],
  existingFilters: AdvancedMatchFilters = DEFAULT_ADVANCED_FILTERS,
): AdvancedMatchFilters {
  const filters = { ...existingFilters };

  for (const token of tokens) {
    if (token.type !== "field" || !token.field) continue;

    switch (token.field) {
      case "genre":
        if (!filters.genres.includes(token.value)) {
          filters.genres = [...filters.genres, token.value];
        }
        break;

      case "format":
        if (!filters.formats.includes(token.value.toUpperCase())) {
          filters.formats = [...filters.formats, token.value.toUpperCase()];
        }
        break;

      case "year": {
        const rangeParts = token.value.split("-");
        if (rangeParts.length === 2) {
          const min = Number.parseInt(rangeParts[0], 10);
          const max = Number.parseInt(rangeParts[1], 10);
          if (!Number.isNaN(min) && !Number.isNaN(max)) {
            filters.yearRange = { min, max };
          }
        } else {
          const year = Number.parseInt(token.value, 10);
          if (!Number.isNaN(year)) {
            filters.yearRange = { min: year, max: year };
          }
        }
        break;
      }

      case "tag":
        if (!filters.tags?.includes(token.value)) {
          filters.tags = [...(filters.tags || []), token.value];
        }
        break;
    }
  }

  return filters;
}

/**
 * Performs fuzzy search on manga matches.
 *
 * Returns top 100 results ordered by relevance score.
 *
 * @param query - Search query string.
 * @param matches - Array of manga match results.
 * @returns Array of matched results with scores.
 * @source
 */
export function fuzzySearchManga(
  query: string,
  matches: MangaMatchResult[],
): MangaMatchResult[] {
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

  const fuse = createMangaFuseInstance(matches);
  const results = fuse.search(searchQuery);

  // Return top 100 results
  return results.slice(0, 100).map((result) => result.item);
}
