/**
 * @packageDocumentation
 * @module export-utils
 * @description Utilities for exporting sync reports, error logs, and arbitrary data to files or localStorage.
 */

import { SyncReport } from "../api/anilist/sync-service";

/**
 * Helper to export a JSON object as a file with a generated filename.
 *
 * @param data - The data to export as JSON.
 * @param filenamePrefix - The prefix for the filename.
 * @param timestamp - The timestamp to use for the filename.
 */
function exportJsonFile(
  data: unknown,
  filenamePrefix: string,
  timestamp: Date | string,
): void {
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split("T")[0];
    link.download = `${filenamePrefix}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(`Failed to export ${filenamePrefix} file:`, error);
  }
}

/**
 * Exports sync error logs to a JSON file.
 *
 * @param report - The sync report containing errors to export.
 * @remarks
 * If there are no errors, a warning is logged and no file is exported.
 * @example
 * ```ts
 * exportSyncErrorLog(report);
 * ```
 * @source
 */
export function exportSyncErrorLog(report: SyncReport): void {
  if (!report?.errors?.length) {
    console.warn("No errors to export");
    return;
  }
  const errorLog = {
    timestamp: report.timestamp,
    totalEntries: report.totalEntries,
    successfulUpdates: report.successfulUpdates,
    failedUpdates: report.failedUpdates,
    errors: report.errors,
  };
  exportJsonFile(errorLog, "anilist-sync-errors", report.timestamp);
  console.log("Error log exported successfully");
}

/**
 * Exports a full sync report to a JSON file.
 *
 * @param report - The sync report to export.
 * @remarks
 * If the report is missing, a warning is logged and no file is exported.
 * @example
 * ```ts
 * exportSyncReport(report);
 * ```
 * @source
 */
export function exportSyncReport(report: SyncReport): void {
  if (!report) {
    console.warn("No report to export");
    return;
  }
  exportJsonFile(report, "anilist-sync-report", report.timestamp);
  console.log("Sync report exported successfully");
}

/**
 * Saves a sync report to localStorage for later reference.
 *
 * @param report - The sync report to save.
 * @remarks
 * Keeps up to 10 most recent reports in history.
 * @example
 * ```ts
 * saveSyncReportToHistory(report);
 * ```
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

    console.log("Sync report saved to history");
  } catch (error) {
    console.error("Failed to save sync report to history:", error);
  }
}
