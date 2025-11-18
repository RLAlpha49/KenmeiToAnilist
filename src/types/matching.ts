/**
 * @packageDocumentation
 * @module matching-types
 * @description TypeScript types and interfaces for manga matching, progress, errors, and handler props.
 */

import { KenmeiManga } from "../api/kenmei/types";
import { MangaMatchResult } from "../api/anilist/types";

/**
 * Global window extensions for tracking manga matching process state.
 *
 * Used to maintain matching progress and state across components without prop drilling.
 *
 * @property activeAbortController - Controller to abort the current matching operation.
 * @property matchingProcessState - Current state of the matching process including progress, timing, and status.
 * @source
 */
declare global {
  interface Window {
    activeAbortController?: AbortController;
    matchingProcessState?: {
      isRunning: boolean;
      progress: {
        current: number;
        total: number;
        currentTitle: string;
      };
      statusMessage: string;
      detailMessage: string | null;
      timeEstimate: {
        startTime: number;
        averageTimePerManga: number;
        estimatedRemainingSeconds: number;
      };
      lastUpdated: number;
      isManuallyPaused?: boolean;
      isPauseTransitioning?: boolean;
      wasRateLimitPaused?: boolean;
    };
  }
}

/**
 * API error object.
 *
 * @property name - Error name.
 * @property message - Error message.
 * @property status - HTTP status code.
 * @property statusText - HTTP status text.
 * @property stack - Error stack trace.
 * @property errors - Array of error messages.
 * @source
 */
export interface ApiError {
  name?: string;
  message?: string;
  status?: number;
  statusText?: string;
  stack?: string;
  errors?: Array<{ message: string }>;
  [key: string]: unknown;
}

/**
 * Progress state of the matching process.
 *
 * @property current - Current progress count.
 * @property total - Total number of items to process.
 * @property currentTitle - Title currently being processed.
 * @source
 */
export interface MatchingProgress {
  current: number;
  total: number;
  currentTitle: string | undefined;
}

/**
 * Time estimate for the matching process.
 *
 * @property startTime - Timestamp when the process started.
 * @property averageTimePerManga - Average time per manga in seconds.
 * @property estimatedRemainingSeconds - Estimated seconds remaining.
 * @source
 */
export interface TimeEstimate {
  startTime: number;
  averageTimePerManga: number;
  estimatedRemainingSeconds: number;
}

/**
 * Status filter options for the matching UI.
 *
 * @property pending - Show pending items.
 * @property skipped - Show skipped items.
 * @property matched - Show matched items.
 * @property manual - Show manually matched items.
 * @property unmatched - Show unmatched items.
 * @source
 */
export interface StatusFilterOptions {
  pending: boolean;
  skipped: boolean;
  matched: boolean;
  manual: boolean;
  unmatched: boolean;
}

/**
 * Match handler functions for matching UI components.
 *
 * @property onManualSearch - Handler for manual search action.
 * @property onAcceptMatch - Handler for accepting a match.
 * @property onRejectMatch - Handler for rejecting a match.
 * @property onSelectAlternative - Handler for selecting an alternative match.
 * @property onResetToPending - Handler for resetting a match to pending.
 * @source
 */
export interface MatchHandlersProps {
  onManualSearch: (manga: KenmeiManga) => void;
  onAcceptMatch: (match: MangaMatchResult) => void;
  onRejectMatch: (match: MangaMatchResult) => void;
  onSelectAlternative: (
    match: MangaMatchResult,
    alternativeIndex: number,
  ) => void;
  onResetToPending: (match: MangaMatchResult) => void;
}

/**
 * Minimal match result type for export operations.
 *
 * Defines the minimal shape needed by `flattenMatchResult()` for CSV/JSON exports.
 * Compatible with both `MangaMatchResult` and statistics-normalized results.
 * Used in `exportUtils.ts` and `ExportStatisticsButton.tsx` for type safety.
 *
 * @property kenmeiManga - Kenmei manga metadata.
 * @property anilistMatches - Optional array of AniList match candidates with confidence scores.
 * @property selectedMatch - Optional manually selected match (may contain format/genres without full AniList data).
 * @property status - Current match status (matched, manual, pending, skipped).
 * @property matchDate - Optional ISO 8601 date string of when the match was made.
 * @source
 */
export type MatchForExport = {
  readonly kenmeiManga: {
    id: string | number;
    title: string;
    status?: string;
    score?: number;
    chaptersRead?: number;
    volumesRead?: number;
    author?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
    lastReadAt?: string;
  };
  readonly anilistMatches?: Array<{
    confidence?: number;
    manga?: {
      id: number;
      title?: {
        romaji?: string;
        english?: string | null;
        native?: string | null;
      };
      format?: string;
      chapters?: number;
      volumes?: number;
      genres?: string[];
    };
  }>;
  readonly selectedMatch?: {
    readonly format?: string;
    readonly genres?: string[];
  };
  readonly status: string;
  readonly matchDate?: Date | string;
};
