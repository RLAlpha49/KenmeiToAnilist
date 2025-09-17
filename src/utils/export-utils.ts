/**
 * @packageDocumentation
 * @module export-utils
 * @description Utilities for exporting sync reports, error logs, and arbitrary data to files or localStorage.
 */

import { SyncReport } from "../api/anilist/sync-service";

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

  try {
    // Create a formatted error log with timestamp
    const errorLog = {
      timestamp: report.timestamp,
      totalEntries: report.totalEntries,
      successfulUpdates: report.successfulUpdates,
      failedUpdates: report.failedUpdates,
      errors: report.errors,
    };

    // Convert to JSON string with pretty formatting
    const jsonContent = JSON.stringify(errorLog, null, 2);

    // Create blob and URL
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create element to trigger download
    const link = document.createElement("a");
    link.href = url;

    // Generate filename with date
    const date = new Date(report.timestamp);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD format
    link.download = `anilist-sync-errors-${dateStr}.json`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("Error log exported successfully");
  } catch (error) {
    console.error("Failed to export error log:", error);
  }
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

  try {
    // Convert to JSON string with pretty formatting
    const jsonContent = JSON.stringify(report, null, 2);

    // Create blob and URL
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create element to trigger download
    const link = document.createElement("a");
    link.href = url;

    // Generate filename with date
    const date = new Date(report.timestamp);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD format
    link.download = `anilist-sync-report-${dateStr}.json`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("Sync report exported successfully");
  } catch (error) {
    console.error("Failed to export sync report:", error);
  }
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
