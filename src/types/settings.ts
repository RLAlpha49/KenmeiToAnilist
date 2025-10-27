/**
 * Type definitions for settings search functionality.
 *
 * Provides interfaces and types for implementing fuzzy search across
 * settings pages using Fuse.js library with highlighting and navigation.
 *
 * @module settings
 */

import type { FuseResultMatch } from "fuse.js";

/**
 * Represents a searchable settings section.
 *
 * Each section corresponds to a logical group of related settings
 * that can be searched and navigated to independently.
 *
 * @interface SettingsSection
 * @example
 * const section: SettingsSection = {
 *   id: "matching-one-shots",
 *   title: "Ignore one shots in automatic matching",
 *   description: "Skip one-shot manga during automatic matching...",
 *   tab: "matching",
 *   keywords: ["skip", "filter", "one-shot", "exclude"],
 *   element: document.getElementById("matching-one-shots")
 * };
 */
export interface SettingsSection {
  /** Unique identifier for the section (kebab-case, e.g., "matching-one-shots") */
  id: string;

  /** Section title/heading text displayed in the UI */
  title: string;

  /** Section description text providing more details about the setting */
  description: string;

  /**
   * Which tab this section belongs to.
   * Determines where the section is displayed in the settings page.
   */
  tab: "matching" | "sync" | "data";

  /**
   * Additional searchable keywords for the section.
   * Includes synonyms, related terms, and keywords that enhance searchability.
   * Examples: ["nsfw", "18+", "filter"] for adult content section
   */
  keywords: string[];

  /**
   * Optional reference to the DOM element for scroll-to-match functionality.
   * Set when component mounts and used for smooth scrolling.
   */
  element?: HTMLElement | null;
}

/**
 * Represents a search result from Fuse.js fuzzy search.
 *
 * Contains the matched section, relevance score, and match indices
 * for highlighting matched text segments.
 *
 * @interface SettingsSearchResult
 * @example
 * const result: SettingsSearchResult = {
 *   section: settingsSection,
 *   score: 0.15,
 *   matches: [
 *     {
 *       key: "description",
 *       indices: [[18, 22]]
 *     }
 *   ]
 * };
 */
export interface SettingsSearchResult {
  /** The matched settings section */
  section: SettingsSection;

  /**
   * Fuse.js relevance score (0 to 1).
   * Lower scores indicate better matches.
   * 0 = exact match, 1 = poor match
   */
  score: number;

  /**
   * Array of match details from Fuse.js.
   * Each match contains the field name and character indices of the match.
   */
  matches?: FuseResultMatch[];
}

/**
 * Configuration object for Fuse.js fuzzy search.
 *
 * Defines search behavior including which fields to search,
 * matching sensitivity, and what metadata to include in results.
 *
 * @interface SettingsSearchConfig
 * @remarks
 * This interface describes the Fuse.js configuration used for settings search.
 * Threshold and key weights can be adjusted to tune search behavior.
 *
 * @example
 * const config: SettingsSearchConfig = {
 *   keys: [
 *     { name: 'title', weight: 0.3 },
 *     { name: 'description', weight: 0.5 },
 *     { name: 'keywords', weight: 0.2 }
 *   ],
 *   threshold: 0.4,
 *   includeScore: true,
 *   includeMatches: true,
 *   minMatchCharLength: 2,
 *   ignoreLocation: true
 * };
 */
export interface SettingsSearchConfig {
  /**
   * Fields to search with their relative importance weights.
   * Higher weights increase importance in scoring.
   *
   * Recommended weights:
   * - title: 0.3 (less important than description)
   * - description: 0.5 (most important, contains detailed information)
   * - keywords: 0.2 (lower weight, used as fallback)
   */
  keys: Array<{
    /** Field name to search (e.g., "title", "description", "keywords") */
    name: string;
    /** Weight multiplier for scoring (0.0 to 1.0, higher = more important) */
    weight: number;
  }>;

  /**
   * Fuzzy match threshold (0.0 to 1.0).
   *
   * - 0.0: Exact matches only
   * - 0.4: Balanced (default) - allows some typos
   * - 1.0: Matches anything
   *
   * Recommended: 0.4 for good balance between precision and typo tolerance
   */
  threshold: number;

  /**
   * Include relevance scores in results.
   * Enables sorting results by relevance (lower score = better match).
   */
  includeScore: boolean;

  /**
   * Include match indices in results.
   * Enables highlighting of matched text segments in the UI.
   */
  includeMatches: boolean;

  /**
   * Minimum number of characters in query to start matching.
   * Prevents very short queries from matching too many results.
   *
   * Recommended: 2 (require at least 2 characters for meaningful search)
   */
  minMatchCharLength: number;

  /**
   * Ignore position of match in string when scoring.
   * When true, matches anywhere in the field are equally scored.
   * When false, earlier matches score better.
   *
   * Recommended: true (search across entire field without position bias)
   */
  ignoreLocation: boolean;
}
