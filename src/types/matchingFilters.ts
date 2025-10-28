/**
 * @packageDocumentation
 * @module types/matchingFilters
 * @description Shared types and defaults for advanced matching filters.
 */

/**
 * Advanced filter options for manga match results.
 * Used in MatchingPage for filtering by confidence, format, genres, and publication status.
 */
export interface AdvancedMatchFilters {
  confidence: { min: number; max: number };
  formats: string[]; // MANGA, NOVEL, ONE_SHOT
  genres: string[]; // Action, Fantasy, Romance, etc.
  publicationStatuses: string[]; // FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS
}

/**
 * Default advanced filter values (no filtering applied).
 */
export const DEFAULT_ADVANCED_FILTERS: AdvancedMatchFilters = {
  confidence: { min: 0, max: 100 },
  formats: [],
  genres: [],
  publicationStatuses: [],
};
