/**
 * Advanced Filter Worker
 *
 * Handles filtering of manga matches based on advanced criteria.
 * Runs on a separate thread to avoid blocking the UI.
 *
 * Features:
 * - Optimized filtering with pre-computed normalized metadata
 * - Performance timing metrics
 * - Debug mode with mismatch reasons
 * - Efficient cache-friendly implementation
 */

import type {
  AdvancedFilterMessage,
  AdvancedFilterResultMessage,
} from "./types";
import type { MangaMatchResult } from "@/api/anilist/types";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";

/**
 * Normalize a string for case-insensitive comparison
 * Memoize internally for performance
 */
const normalizeStringCache = new Map<string, string>();
function normalizeString(str: string): string {
  if (!normalizeStringCache.has(str)) {
    normalizeStringCache.set(str, str.toLowerCase());
  }
  return normalizeStringCache.get(str)!;
}

/**
 * Pre-compute normalized metadata for efficient filtering
 */
interface NormalizedMetadata {
  genresLower: Set<string>;
  tagsLower: Set<string>;
  confidence: number;
  format: string | undefined;
  status: string | undefined;
  year: number | undefined;
}

/**
 * Extract and normalize match metadata
 */
function extractNormalizedMetadata(
  match: MangaMatchResult,
): NormalizedMetadata {
  // Get the match data (prefer selectedMatch, fallback to first anilistMatch)
  const matchData = match.selectedMatch || match.anilistMatches?.[0]?.manga;

  // Compute confidence
  let confidence = 0;
  if (match.selectedMatch && match.anilistMatches) {
    const selectedEntry = match.anilistMatches.find(
      (m) => m.manga?.id === match.selectedMatch?.id,
    );
    confidence = selectedEntry?.confidence ?? 0;
  } else if (match.anilistMatches?.length) {
    confidence = match.anilistMatches[0].confidence ?? 0;
  }

  // Pre-compute normalized genre set
  const genres = matchData?.genres || [];
  const genresLower = new Set(genres.map((g) => normalizeString(g)));

  // Pre-compute normalized tag set
  const tags = matchData?.tags || [];
  const tagsLower = new Set(tags.map((t) => normalizeString(t.name)));

  return {
    genresLower,
    tagsLower,
    confidence,
    format: matchData?.format,
    status: matchData?.status,
    year: matchData?.startDate?.year,
  };
}

/**
 * Reason why a match was filtered out (for debugging)
 */
interface FilterReason {
  matchId: number;
  reason: string;
}

/**
 * Check if confidence is within range
 */
function passesConfidenceFilter(
  confidence: number,
  confidenceFilter: { min: number; max: number },
  debugReasons?: FilterReason[],
  matchId?: number,
): boolean {
  if (confidence < confidenceFilter.min || confidence > confidenceFilter.max) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: `Confidence ${confidence} outside range [${confidenceFilter.min}, ${confidenceFilter.max}]`,
      });
    }
    return false;
  }
  return true;
}

/**
 * Check if format is in the filter list
 */
function passesFormatFilter(
  format: string | undefined,
  formatFilter: string[],
  debugReasons?: FilterReason[],
  matchId?: number,
): boolean {
  if (formatFilter.length === 0) return true;

  if (!format || !formatFilter.includes(format)) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: `Format '${format}' not in [${formatFilter.join(", ")}]`,
      });
    }
    return false;
  }
  return true;
}

/**
 * Check if any genre matches the filter
 */
function passesGenreFilter(
  genres: Set<string>,
  genreFilter: string[],
  debugReasons?: FilterReason[],
  matchId?: number,
): boolean {
  if (genreFilter.length === 0) return true;

  const genresNormalized = genreFilter.map((g) => normalizeString(g));
  const hasMatchingGenre = genresNormalized.some((filterGenre) =>
    genres.has(filterGenre),
  );

  if (!hasMatchingGenre) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: `No matching genres. Required one of: [${genreFilter.join(", ")}]`,
      });
    }
    return false;
  }
  return true;
}

/**
 * Check if status is in the filter list
 */
function passesStatusFilter(
  status: string | undefined,
  statusFilter: string[],
  debugReasons?: FilterReason[],
  matchId?: number,
): boolean {
  if (statusFilter.length === 0) return true;

  if (!status || !statusFilter.includes(status)) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: `Status '${status}' not in [${statusFilter.join(", ")}]`,
      });
    }
    return false;
  }
  return true;
}

/**
 * Check if year is within range
 */
function passesYearFilter(
  year: number | undefined,
  yearFilter: { min: number | null; max: number | null },
  debugReasons?: FilterReason[],
  matchId?: number,
): boolean {
  const hasYearFilter = yearFilter.min !== null || yearFilter.max !== null;

  if (!hasYearFilter) return true;

  if (!year) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: "Year filter active but no year data available",
      });
    }
    return false;
  }

  if (yearFilter.min !== null && year < yearFilter.min) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: `Year ${year} before min ${yearFilter.min}`,
      });
    }
    return false;
  }

  if (yearFilter.max !== null && year > yearFilter.max) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: `Year ${year} after max ${yearFilter.max}`,
      });
    }
    return false;
  }

  return true;
}

/**
 * Check if any tag matches the filter
 */
function passesTagFilter(
  tags: Set<string>,
  tagFilter: string[],
  debugReasons?: FilterReason[],
  matchId?: number,
): boolean {
  if (tagFilter.length === 0) return true;

  const tagsNormalized = tagFilter.map((t) => normalizeString(t));
  const hasMatchingTag = tagsNormalized.some((filterTag) =>
    tags.has(filterTag),
  );

  if (!hasMatchingTag) {
    if (debugReasons && matchId !== undefined) {
      debugReasons.push({
        matchId,
        reason: `No matching tags. Required one of: [${tagFilter.join(", ")}]`,
      });
    }
    return false;
  }

  return true;
}

/**
 * Apply advanced filters to a single match
 * Returns true if match passes all filters, false otherwise
 */
function doesMatchPassFilters(
  metadata: NormalizedMetadata,
  filters: AdvancedMatchFilters,
  debugReasons?: FilterReason[],
  matchId?: number,
): boolean {
  // Check each filter in sequence
  return (
    passesConfidenceFilter(
      metadata.confidence,
      filters.confidence,
      debugReasons,
      matchId,
    ) &&
    passesFormatFilter(
      metadata.format,
      filters.formats,
      debugReasons,
      matchId,
    ) &&
    passesGenreFilter(
      metadata.genresLower,
      filters.genres,
      debugReasons,
      matchId,
    ) &&
    passesStatusFilter(
      metadata.status,
      filters.publicationStatuses,
      debugReasons,
      matchId,
    ) &&
    passesYearFilter(
      metadata.year,
      filters.yearRange || { min: null, max: null },
      debugReasons,
      matchId,
    ) &&
    passesTagFilter(
      metadata.tagsLower,
      filters.tags || [],
      debugReasons,
      matchId,
    )
  );
}

/**
 * Apply advanced filters to matches array
 * Returns filtered matches and statistics
 */
function applyAdvancedFilters(
  matches: MangaMatchResult[],
  filters: AdvancedMatchFilters,
  includeDebugInfo: boolean = false,
): {
  filtered: MangaMatchResult[];
  stats: {
    totalMatches: number;
    filteredCount: number;
    confidenceFiltered: number;
    formatFiltered: number;
    genreFiltered: number;
    statusFiltered: number;
    yearFiltered: number;
    tagFiltered: number;
  };
  debugReasons?: FilterReason[];
} {
  const debugReasons: FilterReason[] = [];
  const filtered: MangaMatchResult[] = [];

  // Statistics counters
  const stats = {
    totalMatches: matches.length,
    filteredCount: 0,
    confidenceFiltered: 0,
    formatFiltered: 0,
    genreFiltered: 0,
    statusFiltered: 0,
    yearFiltered: 0,
    tagFiltered: 0,
  };

  // Process each match
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const matchId = match.kenmeiManga.id ?? i;

    // Extract normalized metadata
    const metadata = extractNormalizedMetadata(match);

    // Test if match passes filters
    const tempReasons: FilterReason[] = [];
    if (
      doesMatchPassFilters(
        metadata,
        filters,
        includeDebugInfo ? tempReasons : undefined,
        matchId,
      )
    ) {
      filtered.push(match);
    } else {
      updateFilterStatistics(
        stats,
        tempReasons,
        includeDebugInfo,
        debugReasons,
      );
    }
  }

  stats.filteredCount = filtered.length;

  return {
    filtered,
    stats,
    debugReasons: includeDebugInfo ? debugReasons : undefined,
  };
}

/**
 * Update filter statistics based on debug reasons
 */
function updateFilterStatistics(
  stats: {
    confidenceFiltered: number;
    formatFiltered: number;
    genreFiltered: number;
    statusFiltered: number;
    yearFiltered: number;
    tagFiltered: number;
  },
  tempReasons: FilterReason[],
  includeDebugInfo: boolean,
  debugReasons: FilterReason[],
): void {
  if (includeDebugInfo && tempReasons.length > 0) {
    const reason = tempReasons[0].reason;
    debugReasons.push(...tempReasons);

    // Update specific filter counters based on reason
    if (reason.includes("Confidence")) {
      stats.confidenceFiltered += 1;
    } else if (reason.includes("Format")) {
      stats.formatFiltered += 1;
    } else if (reason.includes("genre")) {
      stats.genreFiltered += 1;
    } else if (reason.includes("Status")) {
      stats.statusFiltered += 1;
    } else if (reason.includes("Year")) {
      stats.yearFiltered += 1;
    } else if (reason.includes("tag")) {
      stats.tagFiltered += 1;
    }
  }
}

/**
 * Message handler for advanced filter operations
 */
function handleAdvancedFilter(message: AdvancedFilterMessage): void {
  const { taskId, matches, filters } = message.payload;
  const startTime = performance.now();

  try {
    // Check if debug mode is enabled (can be passed via filters or environment)
    const debugModeValue = (globalThis as unknown as Record<string, unknown>)
      .__DEBUG_MODE__;
    const includeDebugInfo = debugModeValue === true;

    // Apply filters
    const filterStartTime = performance.now();
    const { filtered, stats, debugReasons } = applyAdvancedFilters(
      matches,
      filters,
      includeDebugInfo,
    );
    const filterEndTime = performance.now();

    const totalTime = performance.now() - startTime;

    // Send result back to main thread
    const result: AdvancedFilterResultMessage = {
      type: "ADVANCED_FILTER_RESULT",
      payload: {
        taskId,
        filteredMatches: filtered,
        stats,
        timing: {
          processingTimeMs: totalTime,
          filterApplicationTimeMs: filterEndTime - filterStartTime,
        },
        ...(includeDebugInfo && debugReasons && debugReasons.length > 0
          ? { debug: { mismatchReasons: debugReasons.slice(0, 100) } } // Limit to first 100 for perf
          : {}),
      },
    };

    globalThis.postMessage(result);
  } catch (error) {
    // Send error back to main thread
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });
  }
}

/**
 * Main worker message handler
 */
globalThis.onmessage = (event: MessageEvent) => {
  const message = event.data;

  try {
    if (message.type === "ADVANCED_FILTER") {
      handleAdvancedFilter(message);
    } else {
      console.warn(
        "[AdvancedFilterWorker] Unknown message type:",
        message.type,
      );
    }
  } catch (error) {
    console.error("[AdvancedFilterWorker] Unhandled error:", error);
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId: message.taskId || "unknown",
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });
  }
};

// Notify that worker is ready
console.info("[AdvancedFilterWorker] Worker initialized");
