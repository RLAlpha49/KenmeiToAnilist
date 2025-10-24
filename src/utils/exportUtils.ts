/**
 * @packageDocumentation
 * @module exportUtils
 * @description Utility functions for exporting data to JSON, CSV, and Excel files, including match results and sync reports.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { SyncReport } from "../api/anilist/sync-service";
import { MangaMatchResult, AniListManga } from "../api/anilist/types";
import { storage, STORAGE_KEYS } from "./storage";

/**
 * Generates a timestamp string suitable for use in filenames.
 *
 * Replaces colons and periods with hyphens to ensure compatibility with file systems.
 * Ensures safe and readable filenames across platforms.
 *
 * @returns ISO timestamp string formatted for filenames (e.g., `2025-10-17T14-30-45-123Z`).
 * @internal
 * @source
 */
export function generateExportTimestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

/**
 * Export format options.
 * @source
 */
export type ExportFormat = "json" | "csv" | "excel";

/**
 * Options for filtering data during export.
 * @source
 */
export interface ExportFilterOptions {
  /** Filter by match status */
  statusFilter?: ("matched" | "manual" | "pending" | "skipped")[];
  /** Minimum confidence threshold (0-100) */
  confidenceThreshold?: number;
  /** Include entries without matches */
  includeUnmatched?: boolean;
  /** Only export unmatched entries (no selectedMatch and no anilistMatches) */
  unmatchedOnly?: boolean;
}

/**
 * Flattened representation of match result for CSV/Excel export.
 * @source
 */
export interface FlattenedMatchResult {
  // Kenmei data
  kenmeiId: number;
  kenmeiTitle: string;
  kenmeiStatus: string;
  kenmeiScore: number | null;
  chaptersRead: number;
  volumesRead: number;
  author: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastReadAt: string;

  // Match data
  matchStatus: string;
  matchDate: string;
  confidence: number;

  // AniList data
  anilistId: number | null;
  anilistTitleRomaji: string;
  anilistTitleEnglish: string;
  anilistTitleNative: string;
  format: string;
  totalChapters: number | null;
  totalVolumes: number | null;
  genres: string;
}

/**
 * Exports data as a JSON file and triggers browser download.
 *
 * Handles all the boilerplate of creating a blob, object URL, and anchor element for triggering
 * a file download. Automatically appends a timestamp to the filename.
 * Supports both objects and arrays for flexible data export.
 *
 * @param data - The data to export (object or array that will be stringified to pretty-printed JSON).
 * @param baseFilename - The base filename without extension or timestamp.
 * @returns The full filename that was used for download (including timestamp and extension).
 * @throws Will throw if JSON stringification fails (e.g., circular references).
 * @internal
 * @source
 */
export function exportToJson(
  data: Record<string, unknown> | unknown[],
  baseFilename: string,
): string {
  // Serialize to pretty-printed JSON
  const json = JSON.stringify(data, null, 2);

  // Create blob and download link
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    // Generate timestamped filename
    const timestamp = generateExportTimestamp();
    const filename = `${baseFilename}-${timestamp}.json`;

    // Trigger download
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    return filename;
  } finally {
    // Ensure cleanup always runs
    link.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * Flattens a nested MangaMatchResult into a single-level object for CSV/Excel export.
 *
 * @param match - The match result to flatten.
 * @returns Flattened representation with all key fields at the top level.
 * @source
 */
/**
 * Minimal match result acceptable for flattening.
 * Compatible with both MangaMatchResult and statistics-normalized results.
 * @source
 */
type FlattenableMatchResult = {
  readonly kenmeiManga: {
    id: string | number;
    title: string;
    status?: string;
    score?: number;
    chapters_read?: number;
    volumes_read?: number;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    last_read_at?: string;
  };
  readonly anilistMatches?: Array<{
    confidence?: number;
    manga?: AniListManga;
  }>;
  readonly selectedMatch?: {
    format?: string;
    genres?: string[];
  };
  readonly status: string;
  readonly matchDate?: Date;
};

/**
 * Extracts AniListManga data from match data.
 * Handles both MangaMatch (with confidence) and minimal selectedMatch objects.
 */
function extractAniListData(matchForData: unknown): AniListManga | undefined {
  if (!matchForData) return undefined;

  const obj = matchForData as Record<string, unknown>;

  // Check if it's a MangaMatch with manga property
  if (obj.manga && typeof obj.manga === "object") {
    return obj.manga as AniListManga;
  }

  // Check if it's the minimal selectedMatch (has format/genres but no id)
  if ("format" in obj && "genres" in obj && !("id" in obj)) {
    return undefined;
  }

  // Check if it's already an AniListManga (has id)
  if ("id" in obj) {
    return obj as unknown as AniListManga;
  }

  return undefined;
}

export function flattenMatchResult(
  match: MangaMatchResult | FlattenableMatchResult,
): FlattenedMatchResult {
  const kenmei = match.kenmeiManga;

  // Find the highest confidence match from anilistMatches
  const highestConfidenceMatch =
    match.anilistMatches && match.anilistMatches.length > 0
      ? match.anilistMatches.reduce((prev, current) => {
          const prevConf = prev.confidence ?? 0;
          const currConf = current.confidence ?? 0;
          return currConf > prevConf ? current : prev;
        }, match.anilistMatches[0])
      : null;

  // Use selectedMatch or fall back to highest confidence match
  const matchForData = match.selectedMatch ?? highestConfidenceMatch;

  // Extract confidence from MangaMatch or default to 0
  const confidence =
    matchForData && "confidence" in matchForData
      ? (matchForData.confidence ?? 0)
      : 0;

  // Extract AniListManga data safely
  const anilistData = extractAniListData(matchForData);

  return {
    // Kenmei data
    kenmeiId: Number(kenmei.id),
    kenmeiTitle: kenmei.title,
    kenmeiStatus: kenmei.status || "",
    kenmeiScore: kenmei.score ?? null,
    chaptersRead: kenmei.chapters_read || 0,
    volumesRead: kenmei.volumes_read || 0,
    author: "author" in kenmei ? (kenmei.author ?? "") : "",
    notes: kenmei.notes || "",
    createdAt: kenmei.created_at || "",
    updatedAt: kenmei.updated_at || "",
    lastReadAt: kenmei.last_read_at || "",

    // Match data
    matchStatus: match.status,
    matchDate:
      match.matchDate instanceof Date
        ? match.matchDate.toISOString()
        : (match.matchDate ?? ""),
    confidence,

    // AniList data
    anilistId: anilistData?.id ?? null,
    anilistTitleRomaji:
      typeof anilistData?.title === "object"
        ? (anilistData.title.romaji ?? kenmei.title)
        : (anilistData?.title ?? kenmei.title),
    anilistTitleEnglish:
      typeof anilistData?.title === "object"
        ? (anilistData.title.english ?? kenmei.title)
        : (anilistData?.title ?? kenmei.title),
    anilistTitleNative:
      typeof anilistData?.title === "object"
        ? (anilistData.title.native ?? kenmei.title)
        : (anilistData?.title ?? kenmei.title),
    format: anilistData?.format ?? "",
    totalChapters: anilistData?.chapters ?? null,
    totalVolumes: anilistData?.volumes ?? null,
    genres: Array.isArray(anilistData?.genres)
      ? anilistData.genres.join("; ")
      : "",
  };
}

/**
 * Filters match results based on provided criteria.
 *
 * @param matches - Array of match results to filter.
 * @param filters - Filter options to apply.
 * @returns Filtered array of match results.
 * @source
 */
export function filterMatchResults(
  matches: MangaMatchResult[],
  filters: ExportFilterOptions,
): MangaMatchResult[] {
  let filtered = [...matches];

  // Apply status filter
  if (filters.statusFilter && filters.statusFilter.length > 0) {
    filtered = filtered.filter((match) =>
      filters.statusFilter!.includes(
        match.status as "matched" | "manual" | "pending" | "skipped",
      ),
    );
  }

  // Apply confidence threshold
  if (
    filters.confidenceThreshold !== undefined &&
    filters.confidenceThreshold > 0
  ) {
    filtered = filtered.filter((match) => {
      const highestConfidenceMatch =
        match.anilistMatches && match.anilistMatches.length > 0
          ? match.anilistMatches.reduce(
              (prev, current) =>
                current.confidence > prev.confidence ? current : prev,
              match.anilistMatches[0],
            )
          : null;
      return (
        highestConfidenceMatch &&
        highestConfidenceMatch.confidence >= filters.confidenceThreshold!
      );
    });
  }

  // Apply unmatchedOnly filter (takes precedence over includeUnmatched)
  if (filters.unmatchedOnly === true) {
    filtered = filtered.filter(
      (match) =>
        !match.selectedMatch &&
        (!match.anilistMatches || match.anilistMatches.length === 0),
    );
  } else if (filters.includeUnmatched === false) {
    // Apply unmatched filter only if unmatchedOnly is not set
    filtered = filtered.filter(
      (match) =>
        match.selectedMatch ||
        (match.anilistMatches && match.anilistMatches.length > 0),
    );
  }

  return filtered;
}

/**
 * Exports data to CSV format and triggers browser download.
 *
 * Includes UTF-8 BOM prefix to improve Excel compatibility on Windows.
 *
 * @param data - Array of objects to export.
 * @param baseFilename - Base filename without extension or timestamp.
 * @returns The full filename used for download.
 * @throws Will throw if CSV generation fails.
 * @source
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  baseFilename: string,
): string {
  // Convert to CSV using papaparse
  const csv = Papa.unparse(data, {
    header: true,
    quotes: true,
  });

  // Create blob with UTF-8 BOM prefix for better Excel compatibility
  const bom = "\ufeff";
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    // Generate timestamped filename
    const timestamp = generateExportTimestamp();
    const filename = `${baseFilename}-${timestamp}.csv`;

    // Trigger download
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    return filename;
  } finally {
    // Ensure cleanup always runs
    link.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * Exports data to Excel (.xlsx) format and triggers browser download.
 *
 * @param data - Array of objects to export.
 * @param baseFilename - Base filename without extension or timestamp.
 * @param sheetName - Name for the worksheet (default: "Sheet1").
 * @returns The full filename used for download.
 * @throws Will throw if Excel generation fails.
 * @source
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  baseFilename: string,
  sheetName: string = "Sheet1",
): string {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate binary
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  // Create blob and download link
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    // Generate timestamped filename
    const timestamp = generateExportTimestamp();
    const filename = `${baseFilename}-${timestamp}.xlsx`;

    // Trigger download
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    return filename;
  } finally {
    // Ensure cleanup always runs
    link.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * Exports match results in the specified format with optional filtering.
 *
 * @param matches - Array of match results to export.
 * @param format - Export format (json, csv, or excel).
 * @param filters - Optional filters to apply before export.
 * @returns The filename of the exported file.
 * @throws Will throw if export fails.
 * @example
 * ```typescript
 * // Export matched items only as CSV
 * const filename = exportMatchResults(matches, 'csv', {
 *   statusFilter: ['matched'],
 *   confidenceThreshold: 75
 * });
 * ```
 * @source
 */
export function exportMatchResults(
  matches: MangaMatchResult[],
  format: ExportFormat,
  filters?: ExportFilterOptions,
): string {
  console.info(
    `[Export] 📤 Exporting ${matches.length} match results as ${format}`,
  );

  // Apply filters if provided
  const filteredMatches = filters
    ? filterMatchResults(matches, filters)
    : matches;

  console.info(`[Export] 🔍 Filtered to ${filteredMatches.length} matches`);

  let filename: string;

  switch (format) {
    case "json":
      filename = exportToJson(filteredMatches, "match-results");
      break;
    case "csv": {
      const flattened = filteredMatches.map(flattenMatchResult);
      filename = exportToCSV(
        flattened as unknown as Record<string, unknown>[],
        "match-results",
      );
      break;
    }
    case "excel": {
      const flattened = filteredMatches.map(flattenMatchResult);
      filename = exportToExcel(
        flattened as unknown as Record<string, unknown>[],
        "match-results",
        "Match Results",
      );
      break;
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
  console.info(`[Export] ✅ Successfully exported to ${filename}`);
  return filename;
}

/**
 * Exports sync error logs to a JSON file.
 *
 * Extracts error details from a sync report and downloads them as a JSON file.
 * Skips export if no errors are present.
 *
 * @param report - The sync report containing errors to export.
 * @source
 */
export function exportSyncErrorLog(report: SyncReport): void {
  if (!report?.errors?.length) {
    console.warn("[Export] ⚠️ No errors to export");
    return;
  }

  console.info(
    `[Export] 📤 Exporting error log: ${report.errors.length} errors`,
  );

  try {
    const errorLog = {
      timestamp: report.timestamp,
      totalEntries: report.totalEntries,
      successfulUpdates: report.successfulUpdates,
      failedUpdates: report.failedUpdates,
      errors: report.errors,
    };
    exportToJson(
      errorLog as unknown as Record<string, unknown>,
      "anilist-sync-errors",
    );
    console.info("[Export] ✅ Successfully exported error log");
  } catch (error) {
    console.error("[Export] ❌ Failed to export error log:", error);
  }
}

/**
 * Exports a full sync report to a JSON file.
 *
 * Downloads the complete sync report including all entries and outcomes as a JSON file.
 * Skips export if the report is empty.
 *
 * @param report - The sync report to export.
 * @source
 */
export function exportSyncReport(report: SyncReport): void {
  if (!report) {
    console.warn("[Export] ⚠️ No report to export");
    return;
  }

  console.info(
    `[Export] 📤 Exporting sync report: ${report.totalEntries} total entries`,
  );

  try {
    exportToJson(
      report as unknown as Record<string, unknown>,
      "anilist-sync-report",
    );
    console.info("[Export] ✅ Successfully exported sync report");
  } catch (error) {
    console.error("[Export] ❌ Failed to export sync report:", error);
  }
}

/**
 * Saves a sync report to storage for later reference.
 *
 * Persists the report using the storage abstraction and maintains a history of up to 10 most recent reports.
 *
 * @param report - The sync report to save.
 * @source
 */
export function saveSyncReportToHistory(report: SyncReport): void {
  try {
    // Get existing history from storage
    const existingHistoryJson = storage.getItem(STORAGE_KEYS.SYNC_HISTORY);
    const existingHistory: SyncReport[] = existingHistoryJson
      ? JSON.parse(existingHistoryJson)
      : [];

    // Add new report to history (limit to most recent 10)
    const updatedHistory = [report, ...existingHistory].slice(0, 10);

    // Save back to storage
    storage.setItem(STORAGE_KEYS.SYNC_HISTORY, JSON.stringify(updatedHistory));

    console.debug("[Export] Sync report saved to history");
  } catch (error) {
    console.error("[Export] Failed to save sync report to history:", error);
  }
}
