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

// Define a type for API errors
export interface ApiError {
  name?: string;
  message?: string;
  status?: number;
  statusText?: string;
  stack?: string;
  errors?: Array<{ message: string }>;
  [key: string]: unknown;
}

// Interface for the progress state
export interface MatchingProgress {
  current: number;
  total: number;
  currentTitle: string | undefined;
}

// Interface for time estimate
export interface TimeEstimate {
  startTime: number;
  averageTimePerManga: number;
  estimatedRemainingSeconds: number;
}

// Interface for status filter options
export interface StatusFilterOptions {
  pending: boolean;
  skipped: boolean;
  matched: boolean;
  manual: boolean;
  unmatched: boolean;
}

// Props for components that receive match handlers
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
