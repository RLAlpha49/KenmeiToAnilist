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
 * @source
 */
export interface AdvancedMatchFilters {
  confidence: { min: number; max: number };
  formats: string[];
  genres: string[];
  publicationStatuses: string[];
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
};
