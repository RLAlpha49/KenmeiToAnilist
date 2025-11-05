/**
 * Type definitions for settings search functionality.
 *
 * Provides interfaces and types for implementing fuzzy search across settings pages
 * using Fuse.js library with highlighting and navigation.
 *
 * @module settings
 */

import type { FuseResultMatch } from "fuse.js";

/**
 * Searchable settings section.
 *
 * Each section corresponds to a logical group of related settings that can be searched
 * and navigated to independently.
 *
 * @property id - Unique identifier for the section (kebab-case, e.g., "matching-one-shots").
 * @property title - Section title/heading text displayed in the UI.
 * @property description - Section description text providing details about the setting.
 * @property tab - Which tab this section belongs to (matching, sync, or data).
 * @property keywords - Additional searchable keywords (synonyms, related terms for enhanced searchability).
 * @property element - Optional reference to the DOM element for scroll-to-match functionality.
 * @source
 */
export interface SettingsSection {
  id: string;
  title: string;
  description: string;
  tab: "matching" | "sync" | "data";
  keywords: string[];
  element?: HTMLElement | null;
}

/**
 * Search result from Fuse.js fuzzy search.
 *
 * Contains the matched section, relevance score, and match indices for highlighting.
 *
 * @property section - The matched settings section.
 * @property score - Fuse.js relevance score (0 to 1, lower = better match).
 * @property matches - Array of match details with field name and character indices.
 * @source
 */
export interface SettingsSearchResult {
  section: SettingsSection;
  score: number;
  matches?: FuseResultMatch[];
}

/**
 * Configuration object for Fuse.js fuzzy search.
 *
 * Defines search behavior including which fields to search, matching sensitivity,
 * and what metadata to include in results.
 *
 * @property keys - Fields to search with their relative importance weights (0.0 to 1.0).
 * @property threshold - Fuzzy match threshold (0.0 to 1.0, 0.4 recommended for balance).
 * @property includeScore - Include relevance scores in results.
 * @property includeMatches - Include match indices in results for highlighting.
 * @property minMatchCharLength - Minimum characters in query to start matching.
 * @property ignoreLocation - Ignore position of match in string when scoring.
 * @source
 */
export interface SettingsSearchConfig {
  keys: Array<{
    name: string;
    weight: number;
  }>;
  threshold: number;
  includeScore: boolean;
  includeMatches: boolean;
  minMatchCharLength: number;
  ignoreLocation: boolean;
}
