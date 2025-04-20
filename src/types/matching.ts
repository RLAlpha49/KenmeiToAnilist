/**
 * @packageDocumentation
 * @module matching-types
 * @description TypeScript types and interfaces for manga matching, progress, errors, and handler props.
 */

import { KenmeiManga } from "../api/kenmei/types";
import { MangaMatchResult } from "../api/anilist/types";

// Global window interface extension for the matching process state
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
    };
  }
}

/**
 * Represents an API error object.
 *
 * @property name - The error name.
 * @property message - The error message.
 * @property status - The HTTP status code.
 * @property statusText - The HTTP status text.
 * @property stack - The error stack trace.
 * @property errors - An array of error messages.
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
 * Represents the progress state of the matching process.
 *
 * @property current - The current progress count.
 * @property total - The total number of items to process.
 * @property currentTitle - The title currently being processed.
 * @source
 */
export interface MatchingProgress {
  current: number;
  total: number;
  currentTitle: string | undefined;
}

/**
 * Represents a time estimate for the matching process.
 *
 * @property startTime - The timestamp when the process started.
 * @property averageTimePerManga - The average time per manga in seconds.
 * @property estimatedRemainingSeconds - The estimated seconds remaining.
 * @source
 */
export interface TimeEstimate {
  startTime: number;
  averageTimePerManga: number;
  estimatedRemainingSeconds: number;
}

/**
 * Represents status filter options for the matching UI.
 *
 * @property pending - Whether to show pending items.
 * @property skipped - Whether to show skipped items.
 * @property matched - Whether to show matched items.
 * @property manual - Whether to show manually matched items.
 * @property unmatched - Whether to show unmatched items.
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
 * Props for components that receive match handler functions.
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
