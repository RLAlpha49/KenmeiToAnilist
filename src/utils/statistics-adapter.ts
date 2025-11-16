/**
 * @packageDocumentation
 * @module statisticsAdapter
 * @description Adapter functions for normalizing and parsing statistics data from storage.
 * Provides safe deserialization with type coercion for match results and sync stats.
 */

import type { KenmeiManga } from "@/utils/storage";
import type { MangaMatch, MatchStatus } from "@/api/anilist/types";
import type { SyncStats } from "@/types/sync";
import type { ReadingHistory, ReadingHistoryEntry } from "./storage";
import { getLocalDateString } from "./storage";

// Local helpers to pick values supporting both camelCase and snake_case keys
function pickStringFromRecord(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string") return v;
  }
  return undefined;
}

function pickNumberFromRecord(
  obj: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

/**
 * Standardized date key format for statistics (yyyy-MM-dd).
 * All date keys in statistics use the local date string format to ensure consistency.
 * @param timestamp - Unix timestamp in milliseconds.
 * @returns Date key in yyyy-MM-dd format.
 * @source
 */
export function getDateKey(timestamp: number): string {
  // Delegates to getLocalDateString which guarantees yyyy-MM-dd format
  return getLocalDateString(timestamp);
}

/**
 * Time range options for filtering and analyzing statistics.
 * @source
 */
export type TimeRange = "7d" | "30d" | "90d" | "all";

/**
 * Minimal match representation for statistics visualization containing only required chart fields.
 * Optionally includes confidence score if known at normalization time.
 * @source
 */
export type SelectedMatchLite = {
  readonly format?: string;
  readonly genres: string[];
  readonly tags: string[];
  readonly confidence?: number;
};

/**
 * Match result optimized for statistics dashboard; uses minimal local types to prevent reliance on unguaranteed fields.
 * @source
 */
export type NormalizedMatchForStats = {
  readonly kenmeiManga: KenmeiManga;
  readonly anilistMatches?: MangaMatch[];
  readonly selectedMatch?: SelectedMatchLite;
  readonly status: MatchStatus;
  readonly matchDate?: Date;
};

/**
 * Validates and extracts kenmeiManga from raw object; returns null if required fields missing.
 * @param raw - Raw object to validate.
 * @returns Validated KenmeiManga or null if invalid.
 * @source
 */
export function extractKenmeiManga(raw: unknown): KenmeiManga | null {
  if (typeof raw !== "object" || raw === null) return null;

  const obj = raw as Record<string, unknown>;

  if (
    (typeof obj.id !== "string" && typeof obj.id !== "number") ||
    typeof obj.title !== "string"
  ) {
    return null;
  }

  return {
    id: obj.id,
    title: obj.title,
    status: pickStringFromRecord(obj, "status") ?? "",
    score: pickNumberFromRecord(obj, "score") ?? 0,
    chaptersRead:
      pickNumberFromRecord(obj, "chaptersRead", "chapters_read") ?? 0,
    volumesRead: pickNumberFromRecord(obj, "volumesRead", "volumes_read") ?? 0,
    notes: pickStringFromRecord(obj, "notes") ?? "",
    createdAt: pickStringFromRecord(obj, "createdAt", "created_at") ?? "",
    updatedAt: pickStringFromRecord(obj, "updatedAt", "updated_at") ?? "",
    lastReadAt: pickStringFromRecord(obj, "lastReadAt", "last_read_at"),
  };
}

/**
 * Parses matchDate (Date, string, or number) to Date object; returns undefined if invalid.
 * @param raw - Raw timestamp value.
 * @returns Parsed Date or undefined if invalid.
 * @source
 */
export function parseMatchDate(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  const parsed = raw instanceof Date ? raw : new Date(raw as string | number);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Builds minimal selectedMatch with format, genres, tags, and optional confidence fields from raw object.
 * Extracts confidence score if present in the raw match data.
 * @param raw - Raw object to build from.
 * @returns SelectedMatchLite or undefined if no valid fields present.
 * @source
 */
export function buildSelectedMatch(
  raw: unknown,
): SelectedMatchLite | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;

  const obj = raw as Record<string, unknown>;
  const format =
    typeof obj.format === "string" && obj.format.trim() !== ""
      ? obj.format
      : undefined;
  const genres = Array.isArray(obj.genres)
    ? obj.genres.filter((g) => typeof g === "string")
    : [];

  // Extract tags from tag objects
  const tags = Array.isArray(obj.tags)
    ? obj.tags
        .map((t) =>
          typeof t === "object" && t !== null && "name" in t
            ? (t as { name: string }).name
            : "",
        )
        .filter((name) => name.trim() !== "")
    : [];

  // Extract confidence score if present
  const confidence =
    typeof obj.confidence === "number" &&
    obj.confidence >= 0 &&
    obj.confidence <= 100
      ? obj.confidence
      : undefined;

  if (!format && genres.length === 0 && tags.length === 0) return undefined;

  return {
    format,
    genres,
    tags,
    ...(confidence !== undefined && { confidence }),
  };
}

/**
 * Coerces status string to valid MatchStatus, defaulting to "pending".
 * @param raw - Raw status value.
 * @returns Valid MatchStatus or "pending".
 * @source
 */
export function parseStatus(raw: unknown): MatchStatus {
  const statusRaw = typeof raw === "string" ? raw.toLowerCase() : "pending";
  const validStatuses: MatchStatus[] = [
    "pending",
    "matched",
    "manual",
    "skipped",
  ];
  return validStatuses.includes(statusRaw as MatchStatus)
    ? (statusRaw as MatchStatus)
    : "pending";
}

/**
 * Normalizes match results from storage into optimized statistics format; safely validates and skips invalid entries.
 * @param results - Raw match results array from storage.
 * @returns Array of normalized match results safe for statistics visualization.
 * @source
 */
export function normalizeMatchResults(
  results: unknown,
): NormalizedMatchForStats[] {
  if (!Array.isArray(results)) {
    return [];
  }

  const normalized: NormalizedMatchForStats[] = [];

  for (const entry of results) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const result = entry as Record<string, unknown>;

    // Extract kenmeiManga - skip if invalid
    const kenmeiMangaRaw = result.kenmeiManga;
    const kenmeiManga = extractKenmeiManga(kenmeiMangaRaw);
    if (!kenmeiManga) {
      continue;
    }

    // Parse other fields
    const matchDate = parseMatchDate(result.matchDate);
    const selectedMatch = buildSelectedMatch(result.selectedMatch);
    const status = parseStatus(result.status);

    // Build normalized result with minimal type
    normalized.push({
      kenmeiManga,
      anilistMatches: Array.isArray(result.anilistMatches)
        ? (result.anilistMatches as MangaMatch[] | undefined)
        : undefined,
      selectedMatch,
      status,
      matchDate,
    });
  }

  return normalized;
}

/**
 * Parses sync stats from JSON string; normalizes lastSyncTime to ISO string format.
 * @param raw - Stored sync stats JSON string or null.
 * @returns Parsed SyncStats or null if invalid.
 * @source
 */
export function parseSyncStats(raw: string | null): SyncStats | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<
      SyncStats & { lastSyncTime?: string | Date }
    >;
    let lastSyncTime: string | null = null;
    if (parsed.lastSyncTime) {
      if (typeof parsed.lastSyncTime === "string") {
        lastSyncTime = parsed.lastSyncTime;
      } else {
        const syncDate = new Date(parsed.lastSyncTime);
        lastSyncTime = Number.isNaN(syncDate.getTime())
          ? null
          : syncDate.toISOString();
      }
    }
    return {
      lastSyncTime,
      entriesSynced: Number(parsed.entriesSynced ?? 0),
      failedSyncs: Number(parsed.failedSyncs ?? 0),
      totalSyncs: Number(parsed.totalSyncs ?? 0),
    } satisfies SyncStats;
  } catch (error) {
    console.error("[Statistics] ❌ Failed to parse sync stats", error);
    return null;
  }
}

/**
 * Filters reading history entries by time range.
 * @param history - Complete reading history.
 * @param timeRange - Time range to filter by.
 * @returns Filtered entries within the time range.
 * @source
 */
export function filterHistoryByTimeRange(
  history: ReadingHistory,
  timeRange: TimeRange,
): ReadingHistoryEntry[] {
  if (timeRange === "all") {
    return history.entries;
  }

  const now = Date.now();
  const ranges = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };

  const cutoff = now - ranges[timeRange];
  return history.entries.filter((entry) => entry.timestamp >= cutoff);
}

/**
 * Establishes baseline chapters per manga from latest snapshot before range cutoff to prevent inflated first-day deltas.
 * Explicitly sorts entries by timestamp descending (newest first) to ensure correct baseline extraction.
 * @param history - Complete reading history.
 * @param cutoffTimestamp - Cutoff time in milliseconds.
 * @returns Map of mangaId to baseline chapters.
 * @internal
 * @source
 */
function getPreRangeBaseline(
  history: ReadingHistory,
  cutoffTimestamp: number,
): Map<string | number, number> {
  const baseline = new Map<string | number, number>();

  // Sort entries by timestamp descending (newest first) to find most recent baseline
  const sorted = [...history.entries].sort((a, b) => b.timestamp - a.timestamp);

  // Find most recent snapshot for each manga with timestamp < cutoff
  for (const entry of sorted) {
    if (entry.timestamp < cutoffTimestamp) {
      // Only update if this is newer than current baseline
      const current = baseline.get(entry.mangaId);
      if (current === undefined) {
        baseline.set(entry.mangaId, entry.chaptersRead);
      }
    }
  }

  return baseline;
}

/**
 * Computes daily reading trends with per-manga baseline from pre-range history to avoid inflated first-day deltas.
 * @param history - Reading history data.
 * @param timeRange - Time range to analyze.
 * @returns Array of daily reading data points (date, chapters, count).
 * @source
 */
export function computeReadingTrends(
  history: ReadingHistory,
  timeRange: TimeRange,
): Array<{ date: string; chapters: number; count: number }> {
  const filtered = filterHistoryByTimeRange(history, timeRange);
  if (!filtered.length) return [];

  // Establish baseline from pre-range history
  const now = Date.now();
  const ranges = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const cutoff = timeRange === "all" ? 0 : now - ranges[timeRange];
  const preRangeBaseline =
    timeRange === "all" ? new Map() : getPreRangeBaseline(history, cutoff);

  // Group by date and calculate chapters read per day
  const dailyMap = new Map<string, { chapters: number; count: number }>();

  // Sort by timestamp to calculate deltas
  const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

  // Track previous chapters per manga, seeded with pre-range baseline
  const previousChapters = new Map<string | number, number>(preRangeBaseline);

  for (const entry of sorted) {
    const date = getDateKey(entry.timestamp);
    const prev = previousChapters.get(entry.mangaId) ?? 0;
    const delta = Math.max(0, entry.chaptersRead - prev);

    const existing = dailyMap.get(date) ?? { chapters: 0, count: 0 };
    dailyMap.set(date, {
      chapters: existing.chapters + delta,
      count: existing.count + (delta > 0 ? 1 : 0),
    });

    previousChapters.set(entry.mangaId, entry.chaptersRead);
  }

  // Convert to array and sort by date
  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Computes reading velocity metrics (average chapters per day/week/month) with per-manga baseline.
 * @param history - Reading history data.
 * @param timeRange - Time range to analyze.
 * @returns Velocity metrics object (perDay, perWeek, perMonth, totalChapters, activeDays).
 * @source
 */
export function computeReadingVelocity(
  history: ReadingHistory,
  timeRange: TimeRange,
): {
  perDay: number;
  perWeek: number;
  perMonth: number;
  totalChapters: number;
  activeDays: number;
} {
  const filtered = filterHistoryByTimeRange(history, timeRange);
  if (!filtered.length) {
    return {
      perDay: 0,
      perWeek: 0,
      perMonth: 0,
      totalChapters: 0,
      activeDays: 0,
    };
  }

  // Establish baseline from pre-range history
  const now = Date.now();
  const ranges = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const cutoff = timeRange === "all" ? 0 : now - ranges[timeRange];
  const preRangeBaseline =
    timeRange === "all" ? new Map() : getPreRangeBaseline(history, cutoff);

  // Calculate total chapters read (sum of deltas)
  const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
  const previousChapters = new Map<string | number, number>(preRangeBaseline);
  let totalChapters = 0;
  const activeDates = new Set<string>();

  for (const entry of sorted) {
    const prev = previousChapters.get(entry.mangaId) ?? 0;
    const delta = Math.max(0, entry.chaptersRead - prev);
    if (delta > 0) {
      totalChapters += delta;
      const date = getDateKey(entry.timestamp);
      activeDates.add(date);
    }
    previousChapters.set(entry.mangaId, entry.chaptersRead);
  }

  const activeDays = activeDates.size;

  const perDay = activeDays > 0 ? totalChapters / activeDays : 0;
  const perWeek = perDay * 7;
  const perMonth = perDay * 30;

  return {
    perDay: Math.round(perDay * 10) / 10,
    perWeek: Math.round(perWeek * 10) / 10,
    perMonth: Math.round(perMonth * 10) / 10,
    totalChapters,
    activeDays,
  };
}

/**
 * Computes reading habit patterns (day of week, time of day) with per-manga baseline from pre-range history.
 * @param history - Reading history data.
 * @param timeRange - Time range to analyze.
 * @returns Habit pattern data (byDayOfWeek, byTimeOfDay, peakDay, peakHour).
 * @source
 */
export function computeReadingHabits(
  history: ReadingHistory,
  timeRange: TimeRange,
): {
  byDayOfWeek: Array<{ day: string; chapters: number }>;
  byTimeOfDay: Array<{ hour: string; chapters: number }>;
  peakDay: string | null;
  peakHour: string | null;
} {
  const filtered = filterHistoryByTimeRange(history, timeRange);
  if (!filtered.length) {
    return {
      byDayOfWeek: [],
      byTimeOfDay: [],
      peakDay: null,
      peakHour: null,
    };
  }

  // Establish baseline from pre-range history
  const now = Date.now();
  const ranges = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const cutoff = timeRange === "all" ? 0 : now - ranges[timeRange];
  const preRangeBaseline =
    timeRange === "all" ? new Map() : getPreRangeBaseline(history, cutoff);

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayMap = new Map<number, number>();
  const hourMap = new Map<number, number>();

  // Calculate deltas and group by day/hour
  const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
  const previousChapters = new Map<string | number, number>(preRangeBaseline);

  for (const entry of sorted) {
    const prev = previousChapters.get(entry.mangaId) ?? 0;
    const delta = Math.max(0, entry.chaptersRead - prev);

    if (delta > 0) {
      const date = new Date(entry.timestamp);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();

      dayMap.set(dayOfWeek, (dayMap.get(dayOfWeek) ?? 0) + delta);
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + delta);
    }

    previousChapters.set(entry.mangaId, entry.chaptersRead);
  }

  // Convert to arrays
  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
    day: dayNames[i],
    chapters: dayMap.get(i) ?? 0,
  }));

  const byTimeOfDay = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    chapters: hourMap.get(i) ?? 0,
  }));

  // Find peaks
  const maxDay = Math.max(...byDayOfWeek.map((d) => d.chapters));
  const maxHour = Math.max(...byTimeOfDay.map((h) => h.chapters));

  const peakDay = byDayOfWeek.find((d) => d.chapters === maxDay)?.day ?? null;
  const peakHour =
    byTimeOfDay.find((h) => h.chapters === maxHour)?.hour ?? null;

  return {
    byDayOfWeek,
    byTimeOfDay,
    peakDay,
    peakHour,
  };
}

/**
 * Applies statistics filters to match results and reading history.
 * @param matchResults - Array of normalized match results.
 * @param readingHistory - Reading history data.
 * @param filters - Statistics filters to apply.
 * @returns Filtered match results and reading history.
 * @source
 */
export function applyStatisticsFilters(
  matchResults: NormalizedMatchForStats[],
  readingHistory: ReadingHistory,
  filters: import("@/types/statistics").StatisticsFilters,
): {
  matchResults: NormalizedMatchForStats[];
  readingHistory: ReadingHistory;
} {
  let filteredMatches = matchResults;

  // Filter by genres
  if (filters.genres.length > 0) {
    filteredMatches = filteredMatches.filter((match) => {
      const genres = match.selectedMatch?.genres ?? [];
      return filters.genres.some((filterGenre) => genres.includes(filterGenre));
    });
  }

  // Filter by formats
  if (filters.formats.length > 0) {
    filteredMatches = filteredMatches.filter((match) => {
      const format = match.selectedMatch?.format;
      return format && filters.formats.includes(format);
    });
  }

  // Filter by tags
  if (filters.tags.length > 0) {
    filteredMatches = filteredMatches.filter((match) => {
      const tags = match.selectedMatch?.tags ?? [];
      return filters.tags.some((filterTag) => tags.includes(filterTag));
    });
  }

  // Filter by statuses
  if (filters.statuses.length > 0) {
    filteredMatches = filteredMatches.filter((match) =>
      filters.statuses.includes(match.status),
    );
  }

  // Filter by date range
  if (filters.dateRange.start || filters.dateRange.end) {
    filteredMatches = filteredMatches.filter((match) => {
      if (!match.matchDate) return false;
      const matchTime = match.matchDate.getTime();
      if (
        filters.dateRange.start &&
        matchTime < filters.dateRange.start.getTime()
      ) {
        return false;
      }
      if (
        filters.dateRange.end &&
        matchTime > filters.dateRange.end.getTime()
      ) {
        return false;
      }
      return true;
    });
  }

  // Filter by confidence range
  // Try to read confidence from selectedMatch first, fall back to max of all anilistMatches
  if (filters.confidenceRange.min > 0 || filters.confidenceRange.max < 100) {
    filteredMatches = filteredMatches.filter((match) => {
      let confidence = 0;
      // Prefer selectedMatch confidence if available
      if (match.selectedMatch?.confidence !== undefined) {
        confidence = match.selectedMatch.confidence;
      } else if (match.anilistMatches && match.anilistMatches.length > 0) {
        // Use maximum confidence across all anilist matches
        const validConfidences = match.anilistMatches
          .map((m) => m.confidence ?? 0)
          .filter((c) => typeof c === "number" && c >= 0);
        confidence =
          validConfidences.length > 0 ? Math.max(...validConfidences) : 0;
      }
      return (
        confidence >= filters.confidenceRange.min &&
        confidence <= filters.confidenceRange.max
      );
    });
  }

  // Cross-reference reading history with filtered matches
  const filteredMangaIds = new Set(
    filteredMatches.map((m) => String(m.kenmeiManga.id)),
  );
  const filteredEntries = readingHistory.entries.filter((entry) =>
    filteredMangaIds.has(String(entry.mangaId)),
  );
  const filteredHistory: ReadingHistory = {
    entries: filteredEntries,
    lastUpdated: readingHistory.lastUpdated,
    version: readingHistory.version,
  };

  return {
    matchResults: filteredMatches,
    readingHistory: filteredHistory,
  };
}

/**
 * Builds comparison datasets for two time ranges.
 * @param readingHistory - Reading history data.
 * @param primaryRange - First time period to compare.
 * @param secondaryRange - Second time period to compare.
 * @returns Primary and secondary datasets with labels.
 * @source
 */
export function buildComparisonDatasets(
  readingHistory: ReadingHistory,
  primaryRange: TimeRange,
  secondaryRange: TimeRange,
): {
  primary: {
    trends: ReturnType<typeof computeReadingTrends>;
    velocity: ReturnType<typeof computeReadingVelocity>;
    habits: ReturnType<typeof computeReadingHabits>;
  };
  secondary: {
    trends: ReturnType<typeof computeReadingTrends>;
    velocity: ReturnType<typeof computeReadingVelocity>;
    habits: ReturnType<typeof computeReadingHabits>;
  };
  primaryLabel: string;
  secondaryLabel: string;
} {
  const rangeLabels: Record<TimeRange, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    all: "All time",
  };

  return {
    primary: {
      trends: computeReadingTrends(readingHistory, primaryRange),
      velocity: computeReadingVelocity(readingHistory, primaryRange),
      habits: computeReadingHabits(readingHistory, primaryRange),
    },
    secondary: {
      trends: computeReadingTrends(readingHistory, secondaryRange),
      velocity: computeReadingVelocity(readingHistory, secondaryRange),
      habits: computeReadingHabits(readingHistory, secondaryRange),
    },
    primaryLabel: rangeLabels[primaryRange],
    secondaryLabel: rangeLabels[secondaryRange],
  };
}

/**
 * Extracts available filter options from match results.
 * @param matchResults - Array of normalized match results.
 * @returns Available genres, formats, and statuses.
 * @source
 */
export function extractAvailableFilterOptions(
  matchResults: NormalizedMatchForStats[],
): {
  genres: string[];
  formats: string[];
  statuses: MatchStatus[];
  tags: string[];
} {
  const genresSet = new Set<string>();
  const formatsSet = new Set<string>();
  const statusesSet = new Set<MatchStatus>();
  const tagsSet = new Set<string>();

  for (const match of matchResults) {
    // Extract genres
    const genres = match.selectedMatch?.genres ?? [];
    for (const genre of genres) {
      genresSet.add(genre);
    }

    // Extract format
    const format = match.selectedMatch?.format;
    if (format) {
      formatsSet.add(format);
    }

    // Extract tags
    const tags = match.selectedMatch?.tags ?? [];
    for (const tag of tags) {
      tagsSet.add(tag);
    }

    // Extract status
    statusesSet.add(match.status);
  }

  return {
    genres: Array.from(genresSet).sort((a, b) => a.localeCompare(b)),
    formats: Array.from(formatsSet).sort((a, b) => a.localeCompare(b)),
    statuses: Array.from(statusesSet).sort((a, b) => a.localeCompare(b)),
    tags: Array.from(tagsSet).sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Overload for status-based drill-down: value must be a MatchStatus.
 */
export function computeDrillDownData(
  matchResults: NormalizedMatchForStats[],
  type: "status",
  value: MatchStatus,
  readingHistory: ReadingHistory,
): import("@/types/statistics").DrillDownData;

/**
 * Overload for non-status drill-downs: value is a string.
 */
export function computeDrillDownData(
  matchResults: NormalizedMatchForStats[],
  type: "genre" | "format" | "date",
  value: string,
  readingHistory: ReadingHistory,
): import("@/types/statistics").DrillDownData;

/**
 * Computes drill-down data for a specific filter dimension.
 *
 * @param matchResults - Filtered match results.
 * @param type - Type of drill-down:
 *   - 'genre': Filters by selected match genres
 *   - 'format': Filters by selected match format
 *   - 'status': Filters by match status (pending/matched/manual) - NOTE: Different from kenmeiManga.status (reading status)
 *   - 'date': Filters by match date
 * @param value - Specific value to drill down into.
 * @param readingHistory - Reading history for chapter counts.
 * @returns Drill-down data with detailed breakdown.
 * @source
 */
export function computeDrillDownData(
  matchResults: NormalizedMatchForStats[],
  type: "genre" | "format" | "status" | "date",
  value: string,
  readingHistory: ReadingHistory,
): import("@/types/statistics").DrillDownData {
  let filtered: NormalizedMatchForStats[] = [];

  switch (type) {
    case "genre":
      filtered = matchResults.filter((match) => {
        const genres = match.selectedMatch?.genres ?? [];
        return genres.includes(value);
      });
      break;
    case "format":
      filtered = matchResults.filter(
        (match) => match.selectedMatch?.format === value,
      );
      break;
    case "status":
      filtered = matchResults.filter((match) => match.status === value);
      break;
    case "date":
      // For date drill-down, filter by specific date
      filtered = matchResults.filter((match) => {
        if (!match.matchDate) return false;
        const matchDateStr = getDateKey(match.matchDate.getTime());
        return matchDateStr === value;
      });
      break;
  }

  // Build detailed data
  const data = filtered.map((match) => {
    const mangaId = String(match.kenmeiManga.id);
    const mangaHistory = readingHistory.entries.filter(
      (entry) => String(entry.mangaId) === mangaId,
    );

    // Sort by timestamp and get the latest entry to ensure correct chapter count
    const latestEntry =
      mangaHistory.length > 0
        ? mangaHistory.toSorted((a, b) => a.timestamp - b.timestamp).at(-1)
        : null;
    const chapters = latestEntry?.chaptersRead ?? 0;

    // Compute confidence as selectedMatch.confidence or max across all AniList matches
    const selectedConfidence = match.selectedMatch?.confidence;
    const allConfidences = (
      match.anilistMatches?.map((m) => m.confidence ?? 0) || [0]
    ).filter(Number.isFinite);
    const maxConfidence =
      allConfidences.length > 0 ? Math.max(...allConfidences) : 0;
    const confidence = selectedConfidence ?? maxConfidence;

    return {
      title: match.kenmeiManga.title,
      chapters,
      status: match.status,
      confidence,
      format: match.selectedMatch?.format,
    };
  });

  // Sort by chapters read (descending) and limit to top 100
  data.sort((a, b) => b.chapters - a.chapters);
  const limitedData = data.slice(0, 100);

  return {
    type,
    value,
    data: limitedData,
  };
}

/**
 * Computes daily chapter reading deltas by manga across reading history.
 * Tracks progress change per manga per day, excluding days with no progress.
 *
 * @param history - Reading history with chronologically sorted entries
 * @returns Map of date -> Map of mangaId -> daily delta (chapters read that day)
 * @source
 */
export function computeDailyDeltasByManga(
  history: ReadingHistory,
): Map<string, Map<string | number, number>> {
  const dailyDeltaMap = new Map<string, Map<string | number, number>>();
  const prevChaptersPerManga = new Map<string | number, number>();

  // Sort entries by timestamp to ensure chronological order
  const sortedEntries = [...history.entries].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  for (const entry of sortedEntries) {
    const date = getDateKey(entry.timestamp);
    const mangaId = entry.mangaId;
    const prevChapters = prevChaptersPerManga.get(mangaId) ?? 0;
    const delta = Math.max(0, entry.chaptersRead - prevChapters);

    // Only record if there's progress that day
    if (delta > 0) {
      if (!dailyDeltaMap.has(date)) {
        dailyDeltaMap.set(date, new Map());
      }
      dailyDeltaMap.get(date)!.set(mangaId, delta);
    }

    // Update previous chapters for next iteration
    prevChaptersPerManga.set(mangaId, entry.chaptersRead);
  }

  return dailyDeltaMap;
}
