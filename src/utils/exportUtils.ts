/**
 * @packageDocumentation
 * @module exportUtils
 * @description Utility functions for exporting data to JSON, CSV, and Excel files, including match results and sync reports.
 */

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { SyncReport } from "../api/anilist/sync-service";
import { MangaMatchResult, AniListManga } from "../api/anilist/types";
import { storage, STORAGE_KEYS } from "./storage";

/**
 * UTF-8 BOM (Byte Order Mark) for Excel compatibility.
 * Ensures proper encoding detection on Windows when opening CSV files in Excel.
 * @internal
 */
const UTF8_BOM = "\ufeff";

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
  let appended = false;

  try {
    // Generate timestamped filename
    const timestamp = generateExportTimestamp();
    const filename = `${baseFilename}-${timestamp}.json`;

    // Trigger download
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    appended = true;
    link.click();

    return filename;
  } finally {
    // Ensure cleanup always runs
    if (appended) {
      link.remove();
    }
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
 * Returns undefined if the data doesn't contain a valid AniListManga object.
 */
function extractAniListData(matchForData: unknown): AniListManga | undefined {
  if (!matchForData) return undefined;

  const obj = matchForData as Record<string, unknown>;

  // Check if it's a MangaMatch with manga property
  if (obj.manga && typeof obj.manga === "object") {
    return obj.manga as AniListManga;
  }

  // Check if it's the minimal selectedMatch (has format/genres but no id)
  // This shape should NOT be treated as AniListManga data
  if ("format" in obj && "genres" in obj && !("id" in obj)) {
    return undefined;
  }

  // Check if it's already an AniListManga (has id)
  // Only treat as AniListManga if it has an id field
  if ("id" in obj && obj.id !== undefined) {
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

  // Extract AniListManga data safely - handles shapes without id/title fields
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

    // AniList data - explicitly set to empty strings when no AniList data available
    // This ensures selectedMatch shapes without id/title don't incorrectly populate these fields
    anilistId: anilistData?.id ?? null,
    anilistTitleRomaji:
      typeof anilistData?.title === "object"
        ? (anilistData.title.romaji ?? "")
        : (anilistData?.title ?? ""),
    anilistTitleEnglish:
      typeof anilistData?.title === "object"
        ? (anilistData.title.english ?? "")
        : (anilistData?.title ?? ""),
    anilistTitleNative:
      typeof anilistData?.title === "object"
        ? (anilistData.title.native ?? "")
        : (anilistData?.title ?? ""),
    // Do not use format/genres from selectedMatch; only from anilistData
    format: anilistData?.format ?? "",
    totalChapters: anilistData?.chapters ?? null,
    totalVolumes: anilistData?.volumes ?? null,
    genres: Array.isArray(anilistData?.genres)
      ? anilistData.genres.join("; ")
      : "",
  };
}

/**
 * Checks if a match passes all filter criteria.
 *
 * This is a shared helper used by both the UI preview (ExportMatchesButton) and the actual export function.
 * Using this shared helper ensures preview count and export results are always in sync.
 *
 * @param match - The match to check.
 * @param statusFilters - Selected status filters (matched, manual, pending, skipped).
 * @param confidenceThreshold - Minimum confidence threshold (null or number).
 * @param includeUnmatched - Whether to include entries without matches.
 * @param unmatchedOnly - Whether to export only unmatched entries.
 * @returns True if the match passes all applied filters.
 * @internal
 */
export function matchPassesFilter(
  match: MangaMatchResult,
  statusFilters: Set<string> | string[],
  confidenceThreshold: number | null,
  includeUnmatched: boolean,
  unmatchedOnly: boolean,
): boolean {
  const statusFilterSet =
    statusFilters instanceof Set ? statusFilters : new Set(statusFilters);

  // Check status filter
  if (!statusFilterSet.has(match.status)) {
    return false;
  }

  // Check confidence threshold
  if (confidenceThreshold !== null && confidenceThreshold > 0) {
    const highestConfidence =
      match.anilistMatches && match.anilistMatches.length > 0
        ? Math.max(...match.anilistMatches.map((m) => m.confidence))
        : 0;
    if (highestConfidence < confidenceThreshold) {
      return false;
    }
  }

  // Check unmatchedOnly filter (takes precedence over includeUnmatched)
  if (unmatchedOnly) {
    const isUnmatched =
      !match.selectedMatch &&
      (!match.anilistMatches || match.anilistMatches.length === 0);
    return isUnmatched;
  }

  // Check includeUnmatched filter
  if (!includeUnmatched) {
    const isMatched = !!(
      match.selectedMatch ||
      (match.anilistMatches && match.anilistMatches.length > 0)
    );
    return isMatched;
  }

  return true;
}

/**
 * Filters match results based on provided criteria.
 *
 * Uses the shared matchPassesFilter helper to ensure consistency with UI preview counts.
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
  // Convert filter options to matchPassesFilter parameters
  const statusFilters = new Set(
    filters.statusFilter || ["matched", "manual", "pending", "skipped"],
  );
  const confidenceThreshold = filters.confidenceThreshold ?? null;
  const includeUnmatched = filters.includeUnmatched ?? true;
  const unmatchedOnly = filters.unmatchedOnly ?? false;

  return matches.filter((match) =>
    matchPassesFilter(
      match,
      statusFilters,
      confidenceThreshold,
      includeUnmatched,
      unmatchedOnly,
    ),
  );
}

/**
 * Exports data to CSV format and triggers browser download.
 *
 * Includes UTF-8 BOM prefix to improve Excel compatibility on Windows.
 * The BOM ensures proper encoding detection when opening CSV files in Excel.
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
  const blob = new Blob([UTF8_BOM, csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  let appended = false;

  try {
    // Generate timestamped filename
    const timestamp = generateExportTimestamp();
    const filename = `${baseFilename}-${timestamp}.csv`;

    // Trigger download
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    appended = true;
    link.click();

    return filename;
  } finally {
    // Ensure cleanup always runs
    if (appended) {
      link.remove();
    }
    URL.revokeObjectURL(url);
  }
}

/**
 * Exports data to Excel (.xlsx) format and triggers browser download.
 *
 * @param data - Array of objects to export.
 * @param baseFilename - Base filename without extension or timestamp.
 * @param sheetName - Name for the worksheet (default: "Sheet1").
 * @returns Promise resolving to the filename used for download.
 * @throws Will throw if Excel generation fails.
 * @source
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  baseFilename: string,
  sheetName: string = "Sheet1",
): Promise<string> {
  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Set up columns from first data object
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
    }));
  }

  // Add data rows
  for (const row of data) {
    worksheet.addRow(row);
  }

  // Generate binary
  const excelBuffer = await workbook.xlsx.writeBuffer();

  // Create blob and download link
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  let appended = false;

  try {
    // Generate timestamped filename
    const timestamp = generateExportTimestamp();
    const filename = `${baseFilename}-${timestamp}.xlsx`;

    // Trigger download
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    appended = true;
    link.click();

    return filename;
  } finally {
    // Ensure cleanup always runs
    if (appended) {
      link.remove();
    }
    URL.revokeObjectURL(url);
  }
}

/**
 * Exports match results in the specified format with optional filtering.
 *
 * @param matches - Array of match results to export.
 * @param format - Export format (json, csv, or excel).
 * @param filters - Optional filters to apply before export.
 * @returns Promise resolving to the filename of the exported file.
 * @throws Will throw if export fails.
 * @example
 * ```typescript
 * // Export matched items only as CSV
 * const filename = await exportMatchResults(matches, 'csv', {
 *   statusFilter: ['matched'],
 *   confidenceThreshold: 75
 * });
 * ```
 * @source
 */
export async function exportMatchResults(
  matches: MangaMatchResult[],
  format: ExportFormat,
  filters?: ExportFilterOptions,
): Promise<string> {
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
      filename = await exportToExcel(
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
