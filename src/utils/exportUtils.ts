/**
 * @packageDocumentation
 * @module exportUtils
 * @description Utility functions for exporting data to JSON files and sync reports.
 */

import { SyncReport } from "../api/anilist/sync-service";

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
 * Exports a data object as a JSON file and triggers browser download.
 *
 * Handles all the boilerplate of creating a blob, object URL, and anchor element for triggering
 * a file download. Automatically appends a timestamp to the filename.
 *
 * @param data - The data object to export (will be stringified to pretty-printed JSON).
 * @param baseFilename - The base filename without extension or timestamp.
 * @returns The full filename that was used for download (including timestamp and extension).
 * @throws Will throw if JSON stringification fails (e.g., circular references).
 * @internal
 * @source
 */
export function exportToJson(
  data: Record<string, unknown>,
  baseFilename: string,
): string {
  // Serialize to pretty-printed JSON
  const json = JSON.stringify(data, null, 2);

  // Create blob and download link
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  // Generate timestamped filename
  const timestamp = generateExportTimestamp();
  const filename = `${baseFilename}-${timestamp}.json`;

  // Trigger download
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Clean up object URL
  URL.revokeObjectURL(url);

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
 * Saves a sync report to localStorage for later reference.
 *
 * Persists the report to browser storage and maintains a history of up to 10 most recent reports.
 *
 * @param report - The sync report to save.
 * @source
 */
export function saveSyncReportToHistory(report: SyncReport): void {
  try {
    // Get existing history from localStorage
    const storageKey = "anilist_sync_history";
    const existingHistoryJson = localStorage.getItem(storageKey);
    const existingHistory: SyncReport[] = existingHistoryJson
      ? JSON.parse(existingHistoryJson)
      : [];

    // Add new report to history (limit to most recent 10)
    const updatedHistory = [report, ...existingHistory].slice(0, 10);

    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(updatedHistory));

    console.debug("[Export] Sync report saved to history");
  } catch (error) {
    console.error("[Export] Failed to save sync report to history:", error);
  }
}
