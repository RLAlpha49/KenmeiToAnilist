/**
 * Utilities for exporting data to files
 */

import { SyncReport } from "../api/anilist/sync-service";

/**
 * Exports sync error logs to a JSON file
 */
export function exportSyncErrorLog(report: SyncReport): void {
  if (!report || !report.errors.length) {
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
 * Exports a full sync report to a JSON file
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
 * Saves a sync report to localStorage for later reference
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

/**
 * Gets sync history from localStorage
 */
export function getSyncHistory(): SyncReport[] {
  try {
    const storageKey = "anilist_sync_history";
    const historyJson = localStorage.getItem(storageKey);

    if (!historyJson) {
      return [];
    }

    return JSON.parse(historyJson) as SyncReport[];
  } catch (error) {
    console.error("Failed to get sync history:", error);
    return [];
  }
}

/**
 * Creates and downloads a JSON file with the provided data
 */
export function downloadJson<T extends Record<string, unknown>>(
  data: T,
  filename = "export.json",
): void {
  // Convert to JSON string with pretty formatting
  const jsonContent = JSON.stringify(data, null, 2);

  // Create blob and URL
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Create element to trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data to a JSON file with the given filename
 */
export function exportDataToFile<T extends Record<string, unknown>>(
  data: T,
  filename = "export.json",
): void {
  // Convert to JSON string with pretty formatting
  const jsonContent = JSON.stringify(data, null, 2);

  // Create blob and URL
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Create element to trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
