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

/**
 * Time range options for filtering statistics.
 */
export type TimeRange = "7d" | "30d" | "90d" | "all";

/**
 * Minimal representation of a selected match for statistics visualization.
 * Contains only the fields needed by the charts.
 * @source
 */
export type SelectedMatchLite = {
  readonly format?: string;
  readonly genres: string[];
};

/**
 * Normalized match result optimized for statistics dashboard.
 * Uses local minimal types instead of broader domain types to prevent
 * relying on unguaranteed fields from storage.
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
 * Validates and extracts kenmeiManga from a raw object.
 * Returns null if required fields are missing.
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
    status: typeof obj.status === "string" ? obj.status : "",
    score: typeof obj.score === "number" ? obj.score : 0,
    chapters_read:
      typeof obj.chapters_read === "number" ? obj.chapters_read : 0,
    volumes_read: typeof obj.volumes_read === "number" ? obj.volumes_read : 0,
    notes: typeof obj.notes === "string" ? obj.notes : "",
    created_at: typeof obj.created_at === "string" ? obj.created_at : "",
    updated_at: typeof obj.updated_at === "string" ? obj.updated_at : "",
    last_read_at:
      typeof obj.last_read_at === "string" ? obj.last_read_at : undefined,
  };
}

/**
 * Parses matchDate string/number to Date object, or returns undefined.
 * @param raw - Raw timestamp (Date, string, number, or other).
 * @returns Parsed Date or undefined if invalid.
 * @source
 */
export function parseMatchDate(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  const parsed = raw instanceof Date ? raw : new Date(raw as string | number);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Builds minimal selectedMatch with format and genres fields only.
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

  if (!format && genres.length === 0) return undefined;

  return {
    format,
    genres,
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
 * Normalizes match results from storage into optimized statistics format.
 * Safely validates each field and skips invalid entries.
 *
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
 * Parses sync stats from stored JSON string.
 * Normalizes lastSyncTime to ISO string format.
 *
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
 * Establishes baseline chapters for each manga from the latest snapshot before the range cutoff.
 * Prevents inflating first in-range day deltas.
 * @param history - Complete reading history.
 * @param cutoffTimestamp - Cutoff time in milliseconds.
 * @returns Map of mangaId to baseline chapters.
 */
function getPreRangeBaseline(
  history: ReadingHistory,
  cutoffTimestamp: number,
): Map<string | number, number> {
  const baseline = new Map<string | number, number>();

  // Find most recent snapshot for each manga with timestamp < cutoff
  for (const entry of history.entries) {
    if (entry.timestamp < cutoffTimestamp) {
      // Only update if this is newer than current baseline (entries are sorted newest first)
      const current = baseline.get(entry.mangaId);
      if (current === undefined) {
        baseline.set(entry.mangaId, entry.chaptersRead);
      }
    }
  }

  return baseline;
}

/**
 * Computes daily reading trends (chapters read per day).
 * Establishes per-manga baseline from pre-range history to avoid inflated first-day deltas.
 * @param history - Reading history data.
 * @param timeRange - Time range to analyze.
 * @returns Array of daily reading data points.
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
    const date = getLocalDateString(entry.timestamp);
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
 * Computes reading velocity metrics (average chapters per time period).
 * Establishes per-manga baseline from pre-range history to avoid inflated first-day deltas.
 * @param history - Reading history data.
 * @param timeRange - Time range to analyze.
 * @returns Velocity metrics object.
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
      const date = getLocalDateString(entry.timestamp);
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
 * Computes reading habit patterns (day of week, time of day).
 * Establishes per-manga baseline from pre-range history to avoid inflated deltas.
 * @param history - Reading history data.
 * @param timeRange - Time range to analyze.
 * @returns Habit pattern data.
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
