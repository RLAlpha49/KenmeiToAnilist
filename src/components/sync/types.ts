/**
 * @packageDocumentation
 * @module SyncPage/types
 * @description Type definitions for SyncPage component
 */

/**
 * View mode type for the sync page
 */
export type ViewMode = "preview" | "sync" | "results";

/**
 * Display mode for manga entries
 */
export type DisplayMode = "cards" | "compact";

/**
 * Sort field options for manga entries
 */
export type SortField = "title" | "status" | "progress" | "score" | "changes";

/**
 * Sort direction options
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort option configuration
 */
export interface SortOption {
  field: SortField;
  direction: SortDirection;
}

/**
 * Filter options for manga entries
 */
export interface FilterOptions {
  status: "all" | "reading" | "completed" | "planned" | "paused" | "dropped";
  changes: "all" | "with-changes" | "no-changes";
  library: "all" | "new" | "existing";
}
