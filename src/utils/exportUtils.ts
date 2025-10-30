/**
 * @packageDocumentation
 * @module exportUtils
 * @description Utility functions for exporting data to JSON, CSV files, including match results and sync reports.
 */

import Papa from "papaparse";
import { SyncReport } from "../api/anilist/sync-service";
import { MangaMatchResult, AniListManga } from "../api/anilist/types";
import { storage, STORAGE_KEYS } from "./storage";
import type { MatchForExport } from "../types/matching";
import { getAppVersion } from "./app-version";

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
 * Builds export metadata object with timestamp, version, and filter info.
 * @param format - Export format being used
 * @param totalEntries - Number of entries being exported
 * @param filters - Optional filter options applied
 * @param sections - Optional sections included (for statistics)
 * @returns Complete metadata object
 * @internal
 */
export function buildExportMetadata(
  format: ExportFormat,
  totalEntries: number,
  filters?: ExportFilterOptions,
  sections?: string[],
): ExportMetadata {
  const metadata: ExportMetadata = {
    exportedAt: new Date().toISOString(),
    appVersion: getAppVersion(),
    format,
    totalEntries,
  };

  if (filters) {
    metadata.filters = {
      statusFilter: filters.statusFilter,
      confidenceThreshold: filters.confidenceThreshold,
      includeUnmatched: filters.includeUnmatched,
      unmatchedOnly: filters.unmatchedOnly,
    };
  }

  if (sections) {
    metadata.sections = sections;
  }

  return metadata;
}

/**
 * Sanitizes a base filename for safe export to the filesystem.
 * Removes path separators, control characters, and other problematic characters.
 * Preserves alphanumerics, hyphens, and underscores.
 *
 * @param baseFilename - The base filename to sanitize (without extension)
 * @returns Sanitized filename safe for filesystem use
 * @internal
 */
function sanitizeFilename(baseFilename: string): string {
  // Remove path separators and problematic characters
  // eslint-disable-next-line no-useless-escape
  const sanitized = baseFilename.replaceAll(/[\\/:\*\?"<>\|]/g, "");
  // Remove control characters (code points 0-31)
  const sanitizedChars = sanitized
    .split("")
    .filter((c) => {
      const codePoint = c.codePointAt(0);
      return codePoint !== undefined && codePoint >= 32;
    })
    .join("");
  // Trim whitespace and enforce minimum length
  const trimmed = sanitizedChars.trim();
  return trimmed || "export";
}

/**
 * Export format options.
 * @source
 */
export type ExportFormat = "json" | "csv" | "markdown";

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
 * Metadata included in all exports.
 * @source
 */
export interface ExportMetadata {
  exportedAt: string; // ISO 8601 timestamp
  appVersion: string; // App version (e.g., "3.0.0")
  format: ExportFormat;
  filters?: {
    statusFilter?: ("matched" | "manual" | "pending" | "skipped")[]; // Applied status filters
    confidenceThreshold?: number; // Minimum confidence
    includeUnmatched?: boolean;
    unmatchedOnly?: boolean;
  };
  sections?: string[]; // For statistics exports
  totalEntries: number; // Count of exported items
}

/**
 * Flattened representation of match result for CSV export.
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
 * Sanitizes the base filename to remove unsafe characters before composition.
 *
 * @param data - The data to export (object or array that will be stringified to pretty-printed JSON).
 * @param baseFilename - The base filename without extension or timestamp. Will be sanitized to remove unsafe characters.
 * @returns The full filename that was used for download (including timestamp and extension).
 * @throws Will throw if JSON stringification fails (e.g., circular references).
 * @throws Will throw if document.body is unavailable (non-DOM/Electron renderer context).
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
    // Sanitize and generate timestamped filename
    const sanitized = sanitizeFilename(baseFilename);
    const timestamp = generateExportTimestamp();
    const filename = `${sanitized}-${timestamp}.json`;

    // Trigger download
    link.href = url;
    link.download = filename;

    // Guard against non-DOM contexts where document.body is unavailable
    if (!document.body) {
      throw new Error(
        "Cannot export: document.body is unavailable. " +
          "This export utility requires the Electron renderer process with access to DOM APIs. " +
          "Ensure this function is called from a React component in the renderer process.",
      );
    }

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
 * Shared minimal match result for flattening operations.
 * @internal
 */
type FlattenableMatchResult = MatchForExport;

/**
 * Normalizes matchDate to an ISO 8601 string representation for consistent export output.
 * Converts Date objects to ISO strings, or returns string values directly.
 * Returns an empty string if the value is undefined.
 *
 * This function ensures that all exported dates are in canonical ISO 8601 format,
 * regardless of the input source. All callers should pass Date objects (not strings)
 * to ensure consistent normalization.
 *
 * @param matchDate - The match date to normalize (Date, string, or undefined)
 * @returns ISO 8601 string (e.g., "2025-10-26T15:30:45.123Z"), or empty string if undefined
 * @internal
 */
function normalizeMatchDate(matchDate: Date | string | undefined): string {
  if (matchDate instanceof Date) {
    return matchDate.toISOString();
  }
  if (typeof matchDate === "string") {
    return matchDate;
  }
  return "";
}

/**
 * Validates that a title is either a string or an object with at least one string-valued key.
 * Ensures title object keys (romaji, english, native) contain string values when present.
 * @param title - The title to validate
 * @returns True if title is a string or an object with at least one string-valued key
 * @internal
 */
function isValidTitle(title: unknown): boolean {
  if (typeof title === "string") {
    return true;
  }
  if (typeof title === "object" && title !== null) {
    const titleObj = title as Record<string, unknown>;
    // Check if at least one required key is present with a string value
    return (
      typeof titleObj.romaji === "string" ||
      typeof titleObj.english === "string" ||
      typeof titleObj.native === "string"
    );
  }
  return false;
}

/**
 * Extracts AniListManga data from match data with strict validation.
 * Ensures the object has required fields with proper types before treating as AniListManga.
 * Returns undefined if the data doesn't contain a valid AniListManga object.
 * @param matchForData - The object to validate as AniListManga
 * @returns Valid AniListManga object or undefined if validation fails
 * @internal
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

  // Strict validation for AniListManga-like objects
  if (!("id" in obj) || obj.id === undefined) {
    return undefined;
  }

  // Validate id is a number
  if (typeof obj.id !== "number") {
    return undefined;
  }

  // Validate title if present
  if ("title" in obj && !isValidTitle(obj.title)) {
    return undefined;
  }

  // Validate format is a string if present
  if ("format" in obj && typeof obj.format !== "string") {
    return undefined;
  }

  return obj as unknown as AniListManga;
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

  // Fallback to selectedMatch format/genres when anilistData is unavailable
  // Use these fields only when AniList data is not present (no id/title from AniList)
  const selectedMatchFormat =
    anilistData === undefined ? match.selectedMatch?.format : undefined;
  const selectedMatchGenres =
    anilistData === undefined ? match.selectedMatch?.genres : undefined;

  // Normalize genres array to semicolon-separated string
  let genresString = "";
  if (Array.isArray(anilistData?.genres)) {
    genresString = anilistData.genres.join("; ");
  } else if (Array.isArray(selectedMatchGenres)) {
    genresString = selectedMatchGenres.join("; ");
  }

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
    matchDate: normalizeMatchDate(match.matchDate),
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
    // Prefer AniList data format, fall back to selectedMatch format when no AniList data
    format: anilistData?.format ?? selectedMatchFormat ?? "",
    totalChapters: anilistData?.chapters ?? null,
    totalVolumes: anilistData?.volumes ?? null,
    // Prefer AniList data genres, fall back to selectedMatch genres when no AniList data
    genres: genresString,
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
        ? Math.max(...match.anilistMatches.map((m) => m.confidence ?? 0))
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
 * Enforces filter precedence: unmatchedOnly takes priority and forces includeUnmatched=true internally.
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

  // Enforce filter semantics: unmatchedOnly forces includeUnmatched=true
  // This prevents UI mismatches where unmatchedOnly=true but includeUnmatched=false
  const unmatchedOnly = filters.unmatchedOnly ?? false;
  const includeUnmatched = unmatchedOnly
    ? true
    : (filters.includeUnmatched ?? true);

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
 * Escapes pipe characters and newlines in Markdown table cells.
 * @param value - Value to escape
 * @returns Escaped string safe for Markdown tables
 * @internal
 */
function escapeMarkdownCell(value: string | number | null): string {
  if (value === null || value === undefined) return "-";
  const str = String(value);
  return str
    .replaceAll("|", String.raw`\|`) // Escape pipes
    .replaceAll("\n", " ") // Replace newlines with spaces
    .replaceAll("\r", "") // Remove carriage returns
    .trim();
}

/**
 * Truncates long strings for Markdown table readability.
 * @param value - Value to truncate
 * @param maxLength - Maximum length (default 50)
 * @returns Truncated string with ellipsis if needed
 * @internal
 */
function truncateForMarkdown(value: string, maxLength = 50): string {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength - 3) + "...";
}

/**
 * Formats metadata as Markdown header section.
 * @param metadata - Export metadata object
 * @returns Formatted Markdown string
 * @internal
 */
function formatMetadataHeader(metadata: ExportMetadata): string {
  let header = "# Export Metadata\n\n";
  header += `- **Exported**: ${metadata.exportedAt}\n`;
  header += `- **App Version**: v${metadata.appVersion}\n`;
  header += `- **Format**: ${metadata.format}\n`;

  if (metadata.filters) {
    const filters = [];
    if (metadata.filters.statusFilter?.length) {
      filters.push(`Status: ${metadata.filters.statusFilter.join(", ")}`);
    }
    if (metadata.filters.confidenceThreshold) {
      filters.push(`Confidence ≥${metadata.filters.confidenceThreshold}%`);
    }
    if (metadata.filters.unmatchedOnly) {
      filters.push("Unmatched only");
    } else if (metadata.filters.includeUnmatched !== undefined) {
      filters.push(
        metadata.filters.includeUnmatched
          ? "Including unmatched"
          : "Excluding unmatched",
      );
    }
    if (filters.length > 0) {
      header += `- **Filters Applied**: ${filters.join(", ")}\n`;
    }
  }

  if (metadata.sections?.length) {
    header += `- **Sections**: ${metadata.sections.join(", ")}\n`;
  }

  header += `- **Total Entries**: ${metadata.totalEntries}\n\n`;
  header += "---\n\n";

  return header;
}

/**
 * Exports data to CSV format and triggers browser download.
 *
 * Includes UTF-8 BOM (Byte Order Mark) prefix to improve Excel compatibility on Windows.
 * The BOM ensures proper encoding detection when opening CSV files in Excel, particularly
 * on Windows systems where Excel may misinterpret non-ASCII characters without it.
 *
 * Sanitizes the base filename to remove unsafe characters before composition.
 *
 * @param data - Array of objects to export.
 * @param baseFilename - Base filename without extension or timestamp. Will be sanitized to remove unsafe characters.
 * @returns The full filename used for download (including timestamp and extension).
 * @throws Will throw if CSV generation fails.
 * @throws Will throw if document.body is unavailable (non-DOM/Electron renderer context).
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
    // Sanitize and generate timestamped filename
    const sanitized = sanitizeFilename(baseFilename);
    const timestamp = generateExportTimestamp();
    const filename = `${sanitized}-${timestamp}.csv`;

    // Trigger download
    link.href = url;
    link.download = filename;

    // Guard against non-DOM contexts where document.body is unavailable
    if (!document.body) {
      throw new Error(
        "Cannot export: document.body is unavailable. " +
          "This export utility requires the Electron renderer process with access to DOM APIs. " +
          "Ensure this function is called from a React component in the renderer process.",
      );
    }

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
 * Formats array of objects as Markdown table.
 * @param data - Array of objects with consistent keys
 * @returns Formatted Markdown table string
 * @internal
 */
function formatMarkdownTable(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  // Get column headers from first object
  const headers = Object.keys(data[0]);

  // Build header row
  let table =
    "| " + headers.map((h) => escapeMarkdownCell(h)).join(" | ") + " |\n";

  // Build separator row (left-align all columns)
  table += "| " + headers.map(() => "---").join(" | ") + " |\n";

  // Build data rows
  for (const row of data) {
    const cells = headers.map((header) => {
      const value = row[header];
      const escaped = escapeMarkdownCell(value as string | number | null);
      // Truncate long values for readability
      return truncateForMarkdown(escaped, 50);
    });
    table += "| " + cells.join(" | ") + " |\n";
  }

  return table + "\n";
}

/**
 * Formats object with sections as Markdown with multiple tables.
 * @param data - Object with section keys and data values
 * @returns Formatted Markdown string with sections
 * @internal
 */
function formatMarkdownSections(data: Record<string, unknown>): string {
  let markdown = "";

  for (const [section, value] of Object.entries(data)) {
    // Skip metadata fields
    if (section === "generatedAt") continue;

    markdown += `## ${section}\n\n`;

    if (Array.isArray(value)) {
      markdown += formatMarkdownTable(value as Record<string, unknown>[]);
    } else if (typeof value === "object" && value !== null) {
      // Format as key-value pairs
      for (const [key, val] of Object.entries(value)) {
        markdown += `- **${key}**: ${escapeMarkdownCell(val as string | number)}\n`;
      }
      markdown += "\n";
    } else {
      markdown += `${escapeMarkdownCell(value as string | number)}\n\n`;
    }
  }

  return markdown;
}

/**
 * Exports data to Markdown format and triggers browser download.
 *
 * Creates formatted Markdown tables with metadata header.
 * Handles both flat data (for tables) and nested objects (for sections).
 *
 * @param data - Array of objects to export as table, or object with sections
 * @param baseFilename - Base filename without extension or timestamp
 * @param metadata - Export metadata to include in header
 * @returns The full filename used for download
 * @throws Will throw if Markdown generation fails
 * @throws Will throw if document.body is unavailable
 * @source
 */
export function exportToMarkdown(
  data: Record<string, unknown>[] | Record<string, unknown>,
  baseFilename: string,
  metadata: ExportMetadata,
): string {
  let markdown = formatMetadataHeader(metadata);

  // Handle array data (table format)
  if (Array.isArray(data)) {
    if (data.length === 0) {
      markdown += "*No data to export*\n";
    } else {
      markdown += formatMarkdownTable(data);
    }
  }
  // Handle object data (sections format)
  else {
    markdown += formatMarkdownSections(data);
  }

  // Create blob and download
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  let appended = false;

  try {
    const sanitized = sanitizeFilename(baseFilename);
    const timestamp = generateExportTimestamp();
    const filename = `${sanitized}-${timestamp}.md`;

    link.href = url;
    link.download = filename;

    if (!document.body) {
      throw new Error(
        "Cannot export: document.body is unavailable. " +
          "This export utility requires the Electron renderer process with access to DOM APIs.",
      );
    }

    document.body.appendChild(link);
    appended = true;
    link.click();

    return filename;
  } finally {
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
 * @param format - Export format (json, csv, markdown).
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

  const metadata = buildExportMetadata(format, filteredMatches.length, filters);

  let filename: string;

  switch (format) {
    case "json": {
      const payload = {
        metadata,
        matches: filteredMatches,
      };
      filename = exportToJson(
        payload as unknown as Record<string, unknown>,
        "match-results",
      );
      break;
    }
    case "csv": {
      const flattened = filteredMatches.map(flattenMatchResult);
      // Add metadata as comment rows at top of CSV
      const withMetadata = [
        { comment: `Exported: ${metadata.exportedAt}` },
        { comment: `App Version: v${metadata.appVersion}` },
        { comment: `Total Entries: ${metadata.totalEntries}` },
        { comment: "" }, // Empty row separator
        ...flattened,
      ];
      filename = exportToCSV(
        withMetadata as unknown as Record<string, unknown>[],
        "match-results",
      );
      break;
    }
    case "markdown": {
      const flattened = filteredMatches.map(flattenMatchResult);
      filename = exportToMarkdown(
        flattened as unknown as Record<string, unknown>[],
        "match-results",
        metadata,
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
 * Validates JSON parsing to prevent corruption of stored history. Filters history to include only valid
 * SyncReport objects and caps error arrays to prevent unbounded growth.
 *
 * @param report - The sync report to save. timestamp should be ISO 8601 string.
 * @source
 */
export function saveSyncReportToHistory(report: SyncReport): void {
  try {
    // Get existing history from storage
    const existingHistoryJson = storage.getItem(STORAGE_KEYS.SYNC_HISTORY);

    // Parse existing history with fallback to empty array on invalid JSON
    let existingHistory: SyncReport[] = [];
    if (existingHistoryJson) {
      try {
        const parsed = JSON.parse(existingHistoryJson);
        // Ensure parsed value is an array
        if (Array.isArray(parsed)) {
          // Filter to include only valid SyncReport objects with required fields
          existingHistory = parsed.filter(
            (item): item is SyncReport =>
              typeof item === "object" &&
              item !== null &&
              "timestamp" in item &&
              "totalEntries" in item &&
              "successfulUpdates" in item &&
              "failedUpdates" in item,
          );
        }
      } catch {
        // If JSON parsing fails, log and reset to empty array
        console.warn(
          "[Export] Failed to parse existing sync history, starting fresh",
        );
        existingHistory = [];
      }
    }

    // Create validated report with capped errors array (max 200 entries to bound size)
    const validatedReport: SyncReport = {
      timestamp: report.timestamp,
      totalEntries: report.totalEntries,
      successfulUpdates: report.successfulUpdates,
      failedUpdates: report.failedUpdates,
      skippedEntries: report.skippedEntries,
      errors: report.errors.slice(0, 200),
    };

    // Add new report to history (limit to most recent 10)
    const updatedHistory = [validatedReport, ...existingHistory].slice(0, 10);

    // Save back to storage
    storage.setItem(STORAGE_KEYS.SYNC_HISTORY, JSON.stringify(updatedHistory));

    console.debug("[Export] Sync report saved to history");
  } catch (error) {
    console.error("[Export] Failed to save sync report to history:", error);
  }
}

/**
 * Backward compatibility re-export of MatchForExport from types/matching.ts.
 * Use MatchForExport from types/matching.ts for new code.
 * @deprecated Use MatchForExport from @/types/matching instead
 * @source
 */
export type { MatchForExport } from "../types/matching";
