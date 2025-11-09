/**
 * @packageDocumentation
 * @module exportUtils
 * @description Utility functions for exporting data to JSON, CSV files, including match results and sync reports.
 */

import { SyncReport } from "../api/anilist/sync-service";
import { MangaMatchResult, AniListManga } from "../api/anilist/types";
import { storage, STORAGE_KEYS, type MatchResult } from "./storage";
import type { MatchForExport } from "../types/matching";
import { getAppVersion } from "./app-version";
import { createError, ErrorType } from "./errorHandling";
import { getJSONSerializationWorkerPool } from "../workers";

/**
 * Dynamically imports papaparse library for CSV operations.
 * Lazy loads the library only when CSV export is needed.
 * @returns Promise resolving to Papa module
 * @internal
 */
async function loadPapaparse(): Promise<typeof import("papaparse")> {
  return await import("papaparse");
}

/**
 * UTF-8 BOM (Byte Order Mark) for Excel compatibility.
 * Ensures proper encoding detection on Windows when opening CSV files in Excel.
 * @internal
 */
const UTF8_BOM = "\ufeff";

/**
 * Generates a timestamp string suitable for use in filenames.
 * Replaces colons and periods with hyphens for filesystem compatibility.
 * @returns ISO timestamp string formatted for filenames (e.g., `2025-10-17T14-30-45-123Z`).
 * @internal
 * @source
 */
export function generateExportTimestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

/**
 * Builds export metadata object with timestamp, version, format, filters, and entry count.
 * @param format - Export format being used.
 * @param totalEntries - Number of entries being exported.
 * @param filters - Optional filter options applied.
 * @param sections - Optional sections included (for statistics).
 * @returns Complete metadata object.
 * @internal
 * @source
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
 * @param baseFilename - The base filename to sanitize (without extension).
 * @returns Sanitized filename safe for filesystem use.
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
 * Supported export format options: JSON, CSV, or Markdown.
 * @source
 */
export type ExportFormat = "json" | "csv" | "markdown";

/**
 * Options for filtering data during export operations.
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
  /** Selected field IDs for CSV/Markdown export projection; if not provided, all fields included */
  fields?: ExportableFieldId[];
  /** JSON export scope: "full" includes complete match result objects, "selected" includes only fields mapped from FlattenedMatchResult */
  jsonScope?: "full" | "selected";
}

/**
 * Metadata included in all exports: timestamp, version, format, filter info, and entry count.
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
 * Single-level representation of match result for CSV export; combines Kenmei, match, and AniList data.
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
 * Metadata describing exportable fields in flat match results.
 * Used by UI to select which columns to include in CSV/Markdown exports.
 * @source
 */
export const EXPORTABLE_FIELDS = [
  // Kenmei data
  { id: "kenmeiId", label: "Kenmei ID", group: "Kenmei" },
  { id: "kenmeiTitle", label: "Kenmei Title", group: "Kenmei" },
  { id: "kenmeiStatus", label: "Kenmei Status", group: "Kenmei" },
  { id: "kenmeiScore", label: "Kenmei Score", group: "Kenmei" },
  { id: "chaptersRead", label: "Chapters Read", group: "Kenmei" },
  { id: "volumesRead", label: "Volumes Read", group: "Kenmei" },
  { id: "author", label: "Author", group: "Kenmei" },
  { id: "notes", label: "Notes", group: "Kenmei" },
  { id: "createdAt", label: "Created At", group: "Kenmei" },
  { id: "updatedAt", label: "Updated At", group: "Kenmei" },
  { id: "lastReadAt", label: "Last Read At", group: "Kenmei" },

  // Match data
  { id: "matchStatus", label: "Match Status", group: "Match" },
  { id: "matchDate", label: "Match Date", group: "Match" },
  { id: "confidence", label: "Confidence", group: "Match" },

  // AniList data
  { id: "anilistId", label: "AniList ID", group: "AniList" },
  {
    id: "anilistTitleRomaji",
    label: "AniList Title (Romaji)",
    group: "AniList",
  },
  {
    id: "anilistTitleEnglish",
    label: "AniList Title (English)",
    group: "AniList",
  },
  {
    id: "anilistTitleNative",
    label: "AniList Title (Native)",
    group: "AniList",
  },
  { id: "format", label: "Format", group: "AniList" },
  { id: "totalChapters", label: "Total Chapters", group: "AniList" },
  { id: "totalVolumes", label: "Total Volumes", group: "AniList" },
  { id: "genres", label: "Genres", group: "AniList" },
] as const satisfies Array<{
  id: keyof FlattenedMatchResult;
  label: string;
  group: string;
}>;

/**
 * Export field metadata for UI.
 * @source
 */
export type ExportableFieldId = (typeof EXPORTABLE_FIELDS)[number]["id"];

/**
 * Exports data as JSON file with automatic timestamp and sanitized filename; triggers browser download.
 * @param data - The data to export (object or array for JSON stringification).
 * @param baseFilename - Base filename (without extension); will be sanitized for filesystem safety.
 * @returns Promise resolving to full filename used for download (including timestamp and extension).
 * @throws If JSON stringification fails or document.body unavailable.
 * @internal
 * @source
 */
export async function exportToJson(
  data: Record<string, unknown> | unknown[],
  baseFilename: string,
): Promise<string> {
  // Serialize using worker pool for performance
  const pool = getJSONSerializationWorkerPool();
  const { json, sizeBytes } = await pool.serialize(data, { space: 2 });

  console.info(
    `[Export] 📦 Serialized JSON: ${sizeBytes} bytes using worker pool`,
  );

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

/**
 * Flattens a match result into a single-level structure suitable for CSV export.
 * Selects best match data and normalizes dates/genres for tabular output.
 * @param match - The match result to flatten.
 * @returns Flattened result with all fields in a single-level object.
 * @source
 */
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
 * Checks if a match passes all filter criteria; used by UI preview and export to keep results in sync.
 * @param match - The match to check.
 * @param statusFilters - Selected status filters (matched, manual, pending, skipped).
 * @param confidenceThreshold - Minimum confidence threshold (null or 0-100).
 * @param includeUnmatched - Include entries without matches.
 * @param unmatchedOnly - Export only unmatched entries (takes precedence).
 * @returns True if the match passes all applied filters.
 * @internal
 * @source
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
 * Filters match results based on provided criteria using shared filter logic with UI preview.
 * @param matches - Array of match results to filter.
 * @param filters - Filter options (status, confidence, includeUnmatched, unmatchedOnly).
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
 * Exports data to CSV format with UTF-8 BOM for Excel compatibility; triggers browser download.
 * @param data - Array of objects to export.
 * @param baseFilename - Base filename (without extension); will be sanitized for filesystem safety.
 * @returns Full filename used for download (including timestamp and extension).
 * @throws If CSV generation fails or document.body unavailable.
 * @source
 */
export async function exportToCSV(
  data: Record<string, unknown>[],
  baseFilename: string,
): Promise<string> {
  // Lazy load papaparse only when CSV export is needed
  const Papa = await loadPapaparse();

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
 * Exports data to Markdown format with metadata header; handles tables and sections; triggers browser download.
 * @param data - Array (for table) or object with sections to export.
 * @param baseFilename - Base filename (without extension or timestamp).
 * @param metadata - Export metadata to include in header.
 * @returns Full filename used for download.
 * @throws If Markdown generation fails or document.body unavailable.
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
 * Exports match results in specified format with optional filtering; triggers browser download.
 * @param matches - Array of match results to export.
 * @param format - Export format (json, csv, markdown).
 * @param filters - Optional filters to apply before export.
 * @returns Promise resolving to filename of exported file.
 * @throws If export fails or document.body unavailable.
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
      let payload: unknown;

      // Apply field projection if fields are provided
      if (filters?.fields && filters.fields.length > 0) {
        const fields = filters.fields;
        const projectedMatches = filteredMatches.map((match) => {
          const flattened = flattenMatchResult(match);
          const projected: Record<string, unknown> = {};
          for (const fieldId of fields) {
            projected[fieldId] = flattened[fieldId];
          }
          return projected;
        });
        payload = {
          metadata,
          matches: projectedMatches,
        };
      } else {
        // Full payload
        payload = {
          metadata,
          matches: filteredMatches,
        };
      }

      filename = await exportToJson(
        payload as Record<string, unknown>,
        "match-results",
      );
      break;
    }
    case "csv": {
      const flattened = filteredMatches.map(flattenMatchResult);

      // Project to selected fields if provided
      let projectedData: Record<string, unknown>[];
      if (filters?.fields && filters.fields.length > 0) {
        const fields = filters.fields;
        projectedData = flattened.map((row) => {
          const projected: Record<string, unknown> = {};
          for (const fieldId of fields) {
            projected[fieldId] = row[fieldId];
          }
          return projected;
        });
      } else {
        projectedData = flattened as unknown as Record<string, unknown>[];
      }

      // Add metadata as comment rows at top of CSV
      const withMetadata = [
        { comment: `Exported: ${metadata.exportedAt}` },
        { comment: `App Version: v${metadata.appVersion}` },
        { comment: `Total Entries: ${metadata.totalEntries}` },
        { comment: "" }, // Empty row separator
        ...projectedData,
      ];
      filename = await exportToCSV(
        withMetadata as unknown as Record<string, unknown>[],
        "match-results",
      );
      break;
    }
    case "markdown": {
      const flattened = filteredMatches.map(flattenMatchResult);

      // Project to selected fields if provided
      let projectedData: Record<string, unknown>[];
      if (filters?.fields && filters.fields.length > 0) {
        const fields = filters.fields;
        projectedData = flattened.map((row) => {
          const projected: Record<string, unknown> = {};
          for (const fieldId of fields) {
            projected[fieldId] = row[fieldId];
          }
          return projected;
        });
      } else {
        projectedData = flattened as unknown as Record<string, unknown>[];
      }

      filename = exportToMarkdown(
        projectedData as unknown as Record<string, unknown>[],
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
 * Exports sync error logs to JSON file; extracts errors from sync report if present.
 * @param report - The sync report containing errors to export.
 * @returns Promise that resolves when export is complete.
 * @source
 */
export async function exportSyncErrorLog(report: SyncReport): Promise<void> {
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
    await exportToJson(
      errorLog as unknown as Record<string, unknown>,
      "anilist-sync-errors",
    );
    console.info("[Export] ✅ Successfully exported error log");
  } catch (error) {
    console.error("[Export] ❌ Failed to export error log:", error);
  }
}

/**
 * Exports complete sync report to JSON file; downloads all entries and outcomes.
 * @param report - The sync report to export.
 * @returns Promise that resolves when export is complete.
 * @source
 */
export async function exportSyncReport(report: SyncReport): Promise<void> {
  if (!report) {
    console.warn("[Export] ⚠️ No report to export");
    return;
  }

  console.info(
    `[Export] 📤 Exporting sync report: ${report.totalEntries} total entries`,
  );

  try {
    await exportToJson(
      report as unknown as Record<string, unknown>,
      "anilist-sync-report",
    );
    console.info("[Export] ✅ Successfully exported sync report");
  } catch (error) {
    console.error("[Export] ❌ Failed to export sync report:", error);
  }
}

/**
 * Saves sync report to storage for later reference; maintains history of 10 most recent reports.
 * @param report - The sync report to save (timestamp should be ISO 8601 string).
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
 * Merge strategy for importing match results
 * - "replace": Overwrite all existing matches with imported data
 * - "merge": Combine with existing matches, preserving non-pending statuses
 * - "skip-duplicates": Only import new manga not in current results
 * @source
 */
export type ImportMergeStrategy = "replace" | "merge" | "skip-duplicates";

/**
 * Options for importing match results
 * @source
 */
export interface ImportOptions {
  /** Merge strategy to use during import */
  strategy: ImportMergeStrategy;
  /** If true, only validate without actually importing */
  validateOnly?: boolean;
}

/**
 * Expected structure for imported JSON files
 * @source
 */
export interface ImportedMatchData {
  /** Export metadata from the original export */
  metadata: ExportMetadata;
  /** Array of match results */
  matches: MatchResult[];
}

/**
 * Result of import validation
 * @source
 */
export interface ImportValidationResult {
  /** Whether the data is valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
  /** Number of valid matches */
  matchCount: number;
  /** Number of duplicate matches within import */
  duplicateCount: number;
}

/**
 * Predefined export templates/presets for common export scenarios
 * @source
 */
export const EXPORT_TEMPLATES = {
  ALL: {
    name: "All Matches",
    description: "Export all match results without filters",
    filters: {} as ExportFilterOptions,
  },
  MATCHED_ONLY: {
    name: "Matched Only",
    description: "Export only successfully matched entries",
    filters: { statusFilter: ["matched", "manual"] } as ExportFilterOptions,
  },
  PENDING_ONLY: {
    name: "Pending Only",
    description: "Export only pending matches",
    filters: { statusFilter: ["pending"] } as ExportFilterOptions,
  },
  UNMATCHED_ONLY: {
    name: "Unmatched Only",
    description: "Export only entries without matches",
    filters: { unmatchedOnly: true } as ExportFilterOptions,
  },
  HIGH_CONFIDENCE: {
    name: "High Confidence (>75%)",
    description: "Export only high confidence matches",
    filters: { confidenceThreshold: 75 } as ExportFilterOptions,
  },
};

/**
 * Helper: Validates metadata object within imported data
 * @internal
 */
function validateMetadata(
  importedData: Record<string, unknown>,
  errors: string[],
): void {
  if (!importedData.metadata) {
    errors.push("Missing required field: metadata");
    return;
  }

  if (typeof importedData.metadata !== "object") {
    errors.push("metadata must be an object");
    return;
  }

  const metadata = importedData.metadata as Record<string, unknown>;

  if (!metadata.exportedAt) {
    errors.push("Metadata missing: exportedAt");
  }
  if (!metadata.appVersion) {
    errors.push("Metadata missing: appVersion");
  }
  if (!metadata.format) {
    errors.push("Metadata missing: format");
  } else if (metadata.format !== "json") {
    errors.push(
      `Unsupported import format: ${metadata.format}. Only JSON format is currently supported.`,
    );
  }
  if (metadata.totalEntries === undefined) {
    errors.push("Metadata missing: totalEntries");
  }
}

/**
 * Helper: Validates a single match entry
 * @internal
 */
function validateMatchEntry(
  match: unknown,
  index: number,
  seenIds: Set<number | string>,
  seenTitles: Set<string>,
  errors: string[],
  warnings: string[],
): boolean {
  if (!match || typeof match !== "object") {
    errors.push(`Match ${index}: Invalid match object`);
    return false;
  }

  const matchObj = match as Record<string, unknown>;

  if (!matchObj.kenmeiManga) {
    errors.push(`Match ${index}: Missing kenmeiManga`);
    return false;
  }

  if (typeof matchObj.kenmeiManga !== "object") {
    errors.push(`Match ${index}: kenmeiManga must be an object`);
    return false;
  }

  const kenmei = matchObj.kenmeiManga as Record<string, unknown>;

  if (!kenmei.id) {
    errors.push(`Match ${index}: Missing kenmeiManga.id`);
    return false;
  }

  if (!kenmei.title) {
    errors.push(`Match ${index}: Missing kenmeiManga.title`);
    return false;
  }

  if (!matchObj.status) {
    errors.push(`Match ${index}: Missing status`);
    return false;
  }

  // Check for duplicates within import
  const id = kenmei.id as string | number;
  const title = (kenmei.title as string).toLowerCase();

  if (seenIds.has(id) || seenTitles.has(title)) {
    warnings.push(
      `Match ${index}: Duplicate entry found (ID: ${id}, Title: ${title})`,
    );
  } else {
    seenIds.add(id);
    seenTitles.add(title);
    return true;
  }

  return false;
}

/**
 * Validates the structure and content of imported match data.
 * Checks for required fields, valid structure, and duplicate detection.
 * @param data - The parsed data to validate
 * @returns Validation result with errors, warnings, and statistics
 * @throws Nothing - returns validation result object
 * @source
 */
export function validateImportedMatchData(
  data: unknown,
): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let matchCount = 0;
  let duplicateCount = 0;

  // Check if data is an object
  if (!data || typeof data !== "object") {
    errors.push("Import data must be a JSON object");
    return { valid: false, errors, warnings, matchCount, duplicateCount };
  }

  const importedData = data as Record<string, unknown>;

  // Validate metadata
  validateMetadata(importedData, errors);

  // Check for matches array
  if (!Array.isArray(importedData.matches)) {
    errors.push("Missing required field: matches (must be an array)");
    return { valid: false, errors, warnings, matchCount, duplicateCount };
  }

  // Validate each match
  const seenIds = new Set<number | string>();
  const seenTitles = new Set<string>();

  for (let i = 0; i < importedData.matches.length; i++) {
    const isValid = validateMatchEntry(
      importedData.matches[i],
      i,
      seenIds,
      seenTitles,
      errors,
      warnings,
    );
    if (isValid) {
      matchCount++;
    } else {
      duplicateCount++;
    }
  }

  // If we have critical errors, mark as invalid
  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    matchCount,
    duplicateCount,
  };
}

/**
 * Parses and validates an import file (JSON only).
 * Reads file as text, parses JSON, and validates structure.
 * @param file - File object to parse
 * @returns Parsed ImportedMatchData
 * @throws Error with descriptive message if parsing or validation fails
 * @source
 */
export async function parseImportFile(file: File): Promise<ImportedMatchData> {
  // Validate file type
  if (!file.name.endsWith(".json")) {
    throw createError(
      ErrorType.IMPORT,
      "Only JSON files are supported for import",
      new Error("Invalid file type"),
      "INVALID_FILE_TYPE",
    );
  }

  // Validate file size (max 10MB)
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw createError(
      ErrorType.IMPORT,
      `File too large. Maximum size is 10MB, but received ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      new Error(`File size: ${file.size} bytes`),
      "FILE_TOO_LARGE",
    );
  }

  // Read file as text
  let fileContent: string;
  try {
    fileContent = await file.text();
  } catch (error) {
    throw createError(
      ErrorType.IMPORT,
      `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
      error,
      "FILE_READ_FAILED",
    );
  }

  // Parse JSON
  let data: unknown;
  try {
    const pool = getJSONSerializationWorkerPool();
    const { data: parsedData } = await pool.deserialize(fileContent);
    data = parsedData;
    console.info(
      `[Import] 📦 Deserialized JSON using worker pool: ${fileContent.length} bytes`,
    );
  } catch (error) {
    throw createError(
      ErrorType.IMPORT,
      `Invalid JSON format: ${error instanceof Error ? error.message : "JSON parsing failed"}`,
      error,
      "INVALID_JSON",
    );
  }

  // Validate structure
  const validation = validateImportedMatchData(data);
  if (!validation.valid) {
    throw createError(
      ErrorType.IMPORT,
      `Invalid import file structure:\n${validation.errors.join("\n")}`,
      new Error(validation.errors.join("; ")),
      "INVALID_STRUCTURE",
    );
  }

  return data as ImportedMatchData;
}

/**
 * Generates preview statistics for import, comparing imported data with existing results.
 * Identifies new, duplicate, and conflicting entries.
 * @param file - File to preview
 * @returns Preview statistics including counts and validation info
 * @throws Error if file cannot be parsed or validated
 * @source
 */
export async function getImportPreview(file: File): Promise<{
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  conflictCount: number;
  validationErrors: string[];
  validationWarnings: string[];
}> {
  try {
    const importedData = await parseImportFile(file);
    const validation = validateImportedMatchData(importedData);

    // Get existing match results
    const existingResults = storage.getItem(STORAGE_KEYS.MATCH_RESULTS);
    const existingMatches: MatchResult[] = existingResults
      ? JSON.parse(existingResults)
      : [];

    // Create lookup maps
    const existingById = new Map<string | number, MatchResult>();
    const existingByTitle = new Map<string, MatchResult>();

    for (const match of existingMatches) {
      existingById.set(match.kenmeiManga.id, match);
      existingByTitle.set(match.kenmeiManga.title.toLowerCase(), match);
    }

    // Count statistics
    let newCount = 0;
    let duplicateCount = 0;
    let conflictCount = 0;

    for (const importedMatch of importedData.matches) {
      const id = importedMatch.kenmeiManga.id;
      const title = importedMatch.kenmeiManga.title.toLowerCase();

      const existingById_match = existingById.get(id);
      const existingByTitle_match = existingByTitle.get(title);
      const existing = existingById_match || existingByTitle_match;

      if (existing) {
        // Check if existing match is non-pending (potential conflict)
        if (existing.status === "pending") {
          duplicateCount++;
        } else {
          conflictCount++;
        }
      } else {
        newCount++;
      }
    }

    return {
      totalCount: importedData.matches.length,
      newCount,
      duplicateCount,
      conflictCount,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
    };
  } catch (error) {
    console.error("[Export] Error generating import preview:", error);
    return {
      totalCount: 0,
      newCount: 0,
      duplicateCount: 0,
      conflictCount: 0,
      validationErrors: [
        error instanceof Error ? error.message : "Unknown error",
      ],
      validationWarnings: [],
    };
  }
}

/**
 * Helper: Applies "replace" merge strategy
 * Replaces all existing matches with imported data
 * @internal
 */
function applyReplaceStrategy(importedMatches: MatchResult[]): {
  finalMatches: MatchResult[];
  imported: number;
  merged: number;
  skipped: number;
  conflicts: number;
} {
  return {
    finalMatches: importedMatches,
    imported: importedMatches.length,
    merged: 0,
    skipped: 0,
    conflicts: 0,
  };
}

/**
 * Helper: Applies "skip-duplicates" merge strategy
 * Only imports new entries not in current results
 * @internal
 */
function applySkipDuplicatesStrategy(
  importedMatches: MatchResult[],
  existingMatches: MatchResult[],
): {
  finalMatches: MatchResult[];
  imported: number;
  merged: number;
  skipped: number;
  conflicts: number;
} {
  const existingIds = new Set(existingMatches.map((m) => m.kenmeiManga.id));
  const existingTitles = new Set(
    existingMatches.map((m) => m.kenmeiManga.title.toLowerCase()),
  );

  const newMatches = importedMatches.filter((m) => {
    const isNewId = !existingIds.has(m.kenmeiManga.id);
    const isNewTitle = !existingTitles.has(m.kenmeiManga.title.toLowerCase());
    return isNewId && isNewTitle;
  });

  let mergedCount = 0;
  const finalMatches = [...existingMatches];
  for (const newMatch of newMatches) {
    const existing = finalMatches.find(
      (m) =>
        m.kenmeiManga.id === newMatch.kenmeiManga.id ||
        m.kenmeiManga.title.toLowerCase() ===
          newMatch.kenmeiManga.title.toLowerCase(),
    );

    if (!existing) {
      finalMatches.push(newMatch);
      mergedCount++;
    }
  }

  return {
    finalMatches,
    imported: newMatches.length,
    merged: mergedCount,
    skipped: importedMatches.length - newMatches.length,
    conflicts: 0,
  };
}

/**
 * Helper: Counts conflict matches for merge strategy
 * Identifies matches where a non-pending entry would be overwritten
 * @internal
 */
function countConflicts(
  importedMatches: MatchResult[],
  existingMatches: MatchResult[],
): number {
  let conflicts = 0;
  for (const imported_match of importedMatches) {
    const existing = existingMatches.find(
      (m) =>
        m.kenmeiManga.id === imported_match.kenmeiManga.id ||
        m.kenmeiManga.title.toLowerCase() ===
          imported_match.kenmeiManga.title.toLowerCase(),
    );

    if (existing && existing.status !== "pending") {
      conflicts++;
    }
  }
  return conflicts;
}

/**
 * Helper: Fallback merge logic that mirrors mergeMatchResults() from storage.ts
 * Preserves non-pending user progress from existing matches
 * @internal
 */
function fallbackMergeMatchResults(
  importedMatches: MatchResult[],
  existingMatches: MatchResult[],
): MatchResult[] {
  // Create lookup maps for quick matching
  const existingById = new Map<string | number, MatchResult>();
  const existingByTitle = new Map<string, MatchResult>();

  for (const match of existingMatches) {
    if (match.kenmeiManga?.id != null) {
      existingById.set(match.kenmeiManga.id, match);
    }
    if (match.kenmeiManga?.title != null) {
      existingByTitle.set(match.kenmeiManga.title.toLowerCase(), match);
    }
  }

  // Process imported matches, preserving user progress from existing
  const processedResults = importedMatches.map((newMatch) => {
    // Try to find existing match by ID first
    let existingMatch =
      newMatch.kenmeiManga?.id == null
        ? undefined
        : existingById.get(newMatch.kenmeiManga.id);

    // If not found by ID, try title (case insensitive)
    if (!existingMatch && newMatch.kenmeiManga?.title != null) {
      existingMatch = existingByTitle.get(
        newMatch.kenmeiManga.title.toLowerCase(),
      );
    }

    // If we found a match AND it has user progress (not pending), preserve it
    if (existingMatch && existingMatch.status !== "pending") {
      return {
        ...newMatch,
        status: existingMatch.status,
        selectedMatch: existingMatch.selectedMatch,
        matchDate: existingMatch.matchDate,
      };
    }

    // Otherwise use the new match
    return newMatch;
  });

  // Track processed entries to add unprocessed existing entries later
  const processedIds = new Set<string | number>();
  const processedTitles = new Set<string>();

  for (const result of processedResults) {
    if (result.kenmeiManga?.id != null) {
      processedIds.add(result.kenmeiManga.id);
    }
    if (result.kenmeiManga?.title != null) {
      processedTitles.add(result.kenmeiManga.title.toLowerCase());
    }
  }

  // Add existing entries that weren't in the imported batch
  const unprocessedExistingResults = existingMatches.filter((existingMatch) => {
    if (
      existingMatch.kenmeiManga?.id != null &&
      processedIds.has(existingMatch.kenmeiManga.id)
    ) {
      return false;
    }
    if (
      existingMatch.kenmeiManga?.title != null &&
      processedTitles.has(existingMatch.kenmeiManga.title.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return [...processedResults, ...unprocessedExistingResults];
}

/**
 * Helper: Applies "merge" strategy (default)
 * Combines with existing matches, preserving non-pending statuses
 * @internal
 */
async function applyMergeStrategy(
  importedMatches: MatchResult[],
  existingMatches: MatchResult[],
): Promise<{
  finalMatches: MatchResult[];
  imported: number;
  merged: number;
  skipped: number;
  conflicts: number;
}> {
  const conflicts = countConflicts(importedMatches, existingMatches);

  // Try to use storage merge function
  try {
    const { mergeMatchResults } = await import("./storage");
    const finalMatches = mergeMatchResults(importedMatches);
    return {
      finalMatches,
      imported: importedMatches.length,
      merged: finalMatches.length - existingMatches.length,
      skipped: 0,
      conflicts,
    };
  } catch (error) {
    // Fallback: merge logic mirroring mergeMatchResults() from storage.ts
    console.debug("[Export] Merging using fallback strategy:", error);
    const finalMatches = fallbackMergeMatchResults(
      importedMatches,
      existingMatches,
    );

    return {
      finalMatches,
      imported: importedMatches.length,
      merged: finalMatches.length - existingMatches.length,
      skipped: 0,
      conflicts,
    };
  }
}

/**
 * Imports and processes match results with specified merge strategy.
 * Validates data, applies merge logic, and returns statistics.
 * @param file - File to import
 * @param options - Import options including merge strategy
 * @returns Statistics: { imported, merged, skipped, conflicts }
 * @throws Error if validation fails or import cannot be completed
 * @source
 */
export async function importMatchResults(
  file: File,
  options: ImportOptions,
): Promise<{
  imported: number;
  merged: number;
  skipped: number;
  conflicts: number;
}> {
  // Parse and validate file
  const importedData = await parseImportFile(file);
  const validation = validateImportedMatchData(importedData);

  if (!validation.valid) {
    throw createError(
      ErrorType.IMPORT,
      `Import validation failed:\n${validation.errors.join("\n")}`,
      new Error(validation.errors.join("; ")),
      "VALIDATION_FAILED",
    );
  }

  // Get existing results
  const existingResults = storage.getItem(STORAGE_KEYS.MATCH_RESULTS);
  const existingMatches: MatchResult[] = existingResults
    ? JSON.parse(existingResults)
    : [];

  // Apply appropriate merge strategy
  let strategyResult: {
    finalMatches: MatchResult[];
    imported: number;
    merged: number;
    skipped: number;
    conflicts: number;
  };

  if (options.strategy === "replace") {
    strategyResult = applyReplaceStrategy(importedData.matches);
  } else if (options.strategy === "skip-duplicates") {
    strategyResult = applySkipDuplicatesStrategy(
      importedData.matches,
      existingMatches,
    );
  } else {
    strategyResult = await applyMergeStrategy(
      importedData.matches,
      existingMatches,
    );
  }

  // Save results to storage
  storage.setItem(
    STORAGE_KEYS.MATCH_RESULTS,
    JSON.stringify(strategyResult.finalMatches),
  );

  // Update cache version
  const cacheVersion = storage.getItem(STORAGE_KEYS.CACHE_VERSION) || "1";
  const nextVersion = (Number.parseInt(cacheVersion, 10) + 1).toString();
  storage.setItem(STORAGE_KEYS.CACHE_VERSION, nextVersion);

  return {
    imported: strategyResult.imported,
    merged: strategyResult.merged,
    skipped: strategyResult.skipped,
    conflicts: strategyResult.conflicts,
  };
}

/**
 * Backward compatibility re-export of MatchForExport from types/matching.ts.
 * Use MatchForExport from types/matching.ts for new code.
 * @deprecated Use MatchForExport from @/types/matching instead
 * @source
 */
export type { MatchForExport } from "../types/matching";
