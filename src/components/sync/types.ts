/**
 * @packageDocumentation
 * @module SyncPage/types
 * @description Type definitions for SyncPage component
 */

/**
 * View mode type for the sync page.
 * @source
 */
export type ViewMode = "preview" | "sync" | "results";

/**
 * Display mode for manga entries.
 * @source
 */
export type DisplayMode = "cards" | "compact";

/**
 * Sort field options for manga entries.
 * @source
 */
export type SortField = "title" | "status" | "progress" | "score" | "changes";

/**
 * Sort direction options.
 * @source
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort option configuration.
 * @property field - The field to sort by.
 * @property direction - Sort direction.
 * @source
 */
export interface SortOption {
  field: SortField;
  direction: SortDirection;
}

/**
 * Filter options for manga entries.
 * @property status - Filter by manga status (all statuses or specific ones).
 * @property changes - Filter by change state (all, with changes, or no changes).
 * @property library - Filter by library membership (all, new, or existing entries).
 * @source
 */
export interface FilterOptions {
  status: "all" | "reading" | "completed" | "planned" | "paused" | "dropped";
  changes: "all" | "with-changes" | "no-changes";
  library: "all" | "new" | "existing";
}
