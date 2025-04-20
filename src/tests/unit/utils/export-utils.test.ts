import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  exportSyncErrorLog,
  exportSyncReport,
  saveSyncReportToHistory,
  getSyncHistory,
  downloadJson,
  exportDataToFile,
} from "@/utils/export-utils";
import { SyncReport } from "@/api/anilist/sync-service";
import {
  setupBrowserMocks,
  resetBrowserMocks,
} from "../../mocks/browser-globals";

// Mock document methods
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

describe("export-utils", () => {
  beforeEach(() => {
    setupBrowserMocks();
    vi.clearAllMocks();

    // Setup document.body mocks
    document.body.appendChild = mockAppendChild;
    document.body.removeChild = mockRemoveChild;
  });

  afterEach(() => {
    resetBrowserMocks();
    vi.restoreAllMocks();
  });

  describe("exportSyncErrorLog", () => {
    it("creates a JSON file with error data and triggers download", () => {
      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 8,
        failedUpdates: 2,
        skippedEntries: 0,
        errors: [
          { mediaId: 1, error: "Test error 1" },
          { mediaId: 2, error: "Test error 2" },
        ],
      };

      exportSyncErrorLog(report);

      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    it("should log warning when no errors exist", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 10,
        failedUpdates: 0,
        skippedEntries: 0,
        errors: [],
      };

      exportSyncErrorLog(report);

      expect(consoleWarnSpy).toHaveBeenCalledWith("No errors to export");
      expect(mockAppendChild).not.toHaveBeenCalled();
    });

    it("handles errors during export", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      document.body.appendChild.mockImplementation(() => {
        throw new Error("Test error");
      });

      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 8,
        failedUpdates: 2,
        skippedEntries: 0,
        errors: [{ mediaId: 1, error: "Test error 1" }],
      };

      exportSyncErrorLog(report);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to export error log:",
        expect.any(Error),
      );
    });
  });

  describe("exportSyncReport", () => {
    it("creates a JSON file with sync report data and triggers download", () => {
      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 8,
        failedUpdates: 2,
        skippedEntries: 0,
        errors: [
          { mediaId: 1, error: "Test error 1" },
          { mediaId: 2, error: "Test error 2" },
        ],
      };

      exportSyncReport(report);

      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    it("should log warning when no report exists", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      exportSyncReport(null as any);

      expect(consoleWarnSpy).toHaveBeenCalledWith("No report to export");
      expect(mockAppendChild).not.toHaveBeenCalled();
    });

    it("handles errors during export", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      document.body.appendChild.mockImplementation(() => {
        throw new Error("Test error");
      });

      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 10,
        failedUpdates: 0,
        skippedEntries: 0,
        errors: [],
      };

      exportSyncReport(report);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to export sync report:",
        expect.any(Error),
      );
    });
  });

  describe("saveSyncReportToHistory and getSyncHistory", () => {
    it("saves a sync report to localStorage", () => {
      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 10,
        failedUpdates: 0,
        skippedEntries: 0,
        errors: [],
      };

      saveSyncReportToHistory(report);

      const history = getSyncHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(report);
    });

    it("maintains a maximum of 10 reports in history", () => {
      // Add 12 reports
      for (let i = 0; i < 12; i++) {
        const report: SyncReport = {
          timestamp: (new Date().getTime() + i) as any,
          totalEntries: 10,
          successfulUpdates: 10,
          failedUpdates: 0,
          skippedEntries: 0,
          errors: [],
        };
        saveSyncReportToHistory(report);
      }

      const history = getSyncHistory();
      expect(history).toHaveLength(10);

      // Verify they are sorted newest first
      for (let i = 0; i < 9; i++) {
        expect(history[i].timestamp).toBeGreaterThan(history[i + 1].timestamp);
      }
    });

    it("handles empty localStorage when getting sync history", () => {
      const history = getSyncHistory();
      expect(history).toEqual([]);
    });

    it("retrieves sync history from localStorage", () => {
      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 8,
        failedUpdates: 2,
        skippedEntries: 0,
        errors: [{ mediaId: 1, error: "Error" }],
      };

      saveSyncReportToHistory(report);
      const history = getSyncHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(report);
    });

    it("handles errors when saving to localStorage", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Make localStorage.setItem throw an error
      Storage.prototype.setItem = vi.fn().mockImplementation(() => {
        throw new Error("Storage error");
      });

      const report: SyncReport = {
        timestamp: new Date().getTime() as any,
        totalEntries: 10,
        successfulUpdates: 10,
        failedUpdates: 0,
        skippedEntries: 0,
        errors: [],
      };

      saveSyncReportToHistory(report);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to save sync report to history:",
        expect.any(Error),
      );
    });

    it("handles malformed JSON in localStorage", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Set invalid JSON data in localStorage
      localStorage.setItem("anilist_sync_history", "invalid json");

      const history = getSyncHistory();

      expect(history).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to get sync history:",
        expect.any(Error),
      );
    });
  });

  describe("downloadJson", () => {
    it("creates and downloads a JSON file with the provided data", () => {
      const data = { test: "data", value: 123 };
      downloadJson(data, "test.json");

      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    it("uses default filename if none provided", () => {
      const data = { test: "data", value: 123 };
      downloadJson(data);

      expect(mockAppendChild).toHaveBeenCalled();
      const linkArg = mockAppendChild.mock.calls[0][0];
      expect(linkArg.download).toBe("export.json");
    });
  });

  describe("exportDataToFile", () => {
    it("exports data to a JSON file with provided filename", () => {
      const data = { test: "data", value: 123 };
      exportDataToFile(data, "test.json");

      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    it("uses default filename if none provided", () => {
      const data = { test: "data", value: 123 };
      exportDataToFile(data);

      expect(mockAppendChild).toHaveBeenCalled();
      const linkArg = mockAppendChild.mock.calls[0][0];
      expect(linkArg.download).toBe("export.json");
    });

    it("handles empty data gracefully", () => {
      exportDataToFile(null as any);

      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });
  });
});
