/**
 * @packageDocumentation
 * @module statisticsAdapter
 * @description Adapter functions for normalizing and parsing statistics data from storage.
 * Provides safe deserialization with type coercion for match results and sync stats.
 */

import type { KenmeiManga } from "@/utils/storage";
import type { MangaMatch, MatchStatus } from "@/api/anilist/types";
import type { SyncStats } from "@/types/sync";

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
    status: String(obj.status ?? ""),
    score: typeof obj.score === "number" ? obj.score : 0,
    chapters_read:
      typeof obj.chapters_read === "number" ? obj.chapters_read : 0,
    volumes_read: typeof obj.volumes_read === "number" ? obj.volumes_read : 0,
    notes: String(obj.notes ?? ""),
    created_at: String(obj.created_at ?? ""),
    updated_at: String(obj.updated_at ?? ""),
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
    obj.format && String(obj.format).trim() !== ""
      ? String(obj.format)
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
  const statusRaw = String(raw ?? "pending").toLowerCase();
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
