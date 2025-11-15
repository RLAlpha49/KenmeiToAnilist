/**
 * @packageDocumentation
 * @module types/matchingFilters
 * @description Shared types and defaults for advanced matching filters.
 */

/**
 * Advanced filter options for manga match results.
 *
 * Used in MatchingPage for filtering by confidence, format, genres, and publication status.
 *
 * @property confidence - Confidence score range (0-100).
 * @property formats - Array of manga formats (MANGA, NOVEL, ONE_SHOT).
 * @property genres - Array of genres to filter by.
 * @property publicationStatuses - Array of publication statuses (FINISHED, RELEASING, etc.).
 * @property yearRange - Optional year range filter (null means no limit).
 * @property tags - Optional array of tag names to filter by.
 * @source
 */
export interface AdvancedMatchFilters {
  confidence: { min: number; max: number };
  formats: string[];
  genres: string[];
  publicationStatuses: string[];
  yearRange?: { min: number | null; max: number | null };
  tags?: string[];
}

/**
 * Default advanced filter values (no filtering applied).
 * @source
 */
export const DEFAULT_ADVANCED_FILTERS: AdvancedMatchFilters = {
  confidence: { min: 0, max: 100 },
  formats: [],
  genres: [],
  publicationStatuses: [],
  yearRange: { min: null, max: null },
  tags: [],
};

/**
 * User-created filter preset.
 *
 * @property id - Unique identifier (UUID or timestamp-based).
 * @property name - User-provided name.
 * @property description - Optional description.
 * @property filters - The filter configuration.
 * @property createdAt - ISO timestamp of creation.
 * @property updatedAt - ISO timestamp of last update.
 * @source
 */
export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: AdvancedMatchFilters;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query syntax token for parsed search queries.
 *
 * @property type - Token type ('field' for field:value patterns, 'text' for plain text).
 * @property field - Field name for field tokens (genre, format, year, tag).
 * @property value - The value to match.
 * @property operator - Logical operator (default AND).
 * @source
 */
export interface QuerySyntaxToken {
  type: "field" | "text";
  field?: string;
  value: string;
  operator?: "AND" | "OR";
}
