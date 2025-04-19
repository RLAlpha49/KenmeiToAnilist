import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSynchronization } from "../../../hooks/useSynchronization";

// Mock the syncMangaBatch function
vi.mock("../../../api/anilist/sync-service", () => ({
  syncMangaBatch: vi
    .fn()
    .mockImplementation(async (entries, token, progressCallback) => {
      // Call the progress callback with mock progress
      if (progressCallback) {
        progressCallback({
          total: entries.length,
          completed: entries.length,
          successful: entries.length,
          failed: 0,
          skipped: 0,
          currentEntry: null,
          currentStep: null,
          totalSteps: null,
          rateLimited: false,
          retryAfter: null,
        });
      }

      // Return a mock report
      return {
        totalEntries: entries.length,
        successfulUpdates: entries.length,
        failedUpdates: 0,
        skippedEntries: 0,
        errors: [],
        timestamp: new Date(),
      };
    }),
}));

// Mock the export utility functions
vi.mock("../../../utils/export-utils", () => ({
  exportSyncErrorLog: vi.fn(),
  exportSyncReport: vi.fn(),
  saveSyncReportToHistory: vi.fn(),
}));

// Import the mocked functions for assertions
import { syncMangaBatch } from "../../../api/anilist/sync-service";
import {
  exportSyncErrorLog,
  exportSyncReport,
} from "../../../utils/export-utils";

describe("useSynchronization", () => {
  // Original AbortController implementation
  const originalAbortController = global.AbortController;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original AbortController after each test
    global.AbortController = originalAbortController;
  });

  it("initializes with correct initial state", () => {
    const { result } = renderHook(() => useSynchronization());

    // Check initial state
    const [state] = result.current;
    expect(state.isActive).toBe(false);
    expect(state.progress).toBeNull();
    expect(state.report).toBeNull();
    expect(state.error).toBeNull();
    expect(state.abortController).toBeNull();
  });

  it("starts synchronization with valid inputs", async () => {
    const { result } = renderHook(() => useSynchronization());

    // Create mock entries and token
    const mockEntries = [
      { id: 1, progress: 10, status: "CURRENT" },
      { id: 2, progress: 5, status: "COMPLETED" },
    ] as any;
    const mockToken = "test-token";

    // Start synchronization and force state update immediately
    await act(async () => {
      const [, actions] = result.current;

      // Create a promise that can be resolved immediately to control test flow
      const syncPromise = actions.startSync(mockEntries, mockToken);

      // Advance any timers if needed
      await syncPromise;
    });

    // Verify that syncMangaBatch was called
    expect(syncMangaBatch).toHaveBeenCalledWith(
      mockEntries,
      mockToken,
      expect.any(Function),
      expect.any(Object), // AbortSignal
    );

    // Since the mock implementation of syncMangaBatch completes immediately,
    // the state will be updated with the final report and isActive will be false
    const [state] = result.current;

    // Check report
    expect(state.report).not.toBeNull();
    if (state.report) {
      expect(state.report.totalEntries).toBe(mockEntries.length);
      expect(state.report.successfulUpdates).toBe(mockEntries.length);
    }

    // Check progress
    expect(state.progress).not.toBeNull();
    if (state.progress) {
      expect(state.progress.total).toBe(mockEntries.length);
      expect(state.progress.completed).toBe(mockEntries.length);
      expect(state.progress.successful).toBe(mockEntries.length);
    }
  });

  it("handles empty entries array", async () => {
    const { result } = renderHook(() => useSynchronization());

    // Try to start synchronization with empty entries
    await act(async () => {
      const [, actions] = result.current;
      await actions.startSync([], "test-token");
    });

    // Check that sync was not started and error was set
    const [state] = result.current;
    expect(state.isActive).toBe(false);
    expect(state.error).toBe("No entries to synchronize");
    expect(syncMangaBatch).not.toHaveBeenCalled();
  });

  it("handles missing token", async () => {
    const { result } = renderHook(() => useSynchronization());

    // Try to start synchronization with empty token
    await act(async () => {
      const [, actions] = result.current;
      await actions.startSync([{ id: 1 }] as any, "");
    });

    // Check that sync was not started and error was set
    const [state] = result.current;
    expect(state.isActive).toBe(false);
    expect(state.error).toBe("No authentication token available");
    expect(syncMangaBatch).not.toHaveBeenCalled();
  });

  it("cancels ongoing synchronization", async () => {
    // Mock abortController implementation
    const mockAbort = vi.fn();

    // Replace the global AbortController with our mock
    global.AbortController = vi.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: mockAbort,
    })) as any;

    // Mock syncMangaBatch to resolve when abort is called
    let abortHandler: (() => void) | null = null;
    (syncMangaBatch as any).mockImplementationOnce(
      (entries: any, token: any, progressCallback: any, signal: any) => {
        return new Promise((resolve) => {
          abortHandler = () =>
            resolve({
              totalEntries: entries.length,
              successfulUpdates: 0,
              failedUpdates: 0,
              skippedEntries: 0,
              errors: [],
              timestamp: new Date(),
            });
          if (signal) {
            Object.defineProperty(signal, "aborted", {
              get: () => false,
            });
          }
        });
      },
    );

    const { result } = renderHook(() => useSynchronization());

    // Start synchronization
    await act(async () => {
      const [, actions] = result.current;
      actions.startSync([{ id: 1 }] as any, "test-token");
    });

    // At this point, sync should be active
    expect(result.current[0].isActive).toBe(true);
    expect(result.current[0].abortController).not.toBeNull();

    // Cancel synchronization (simulate abort)
    await act(async () => {
      const [, actions] = result.current;
      actions.cancelSync();
      if (abortHandler) abortHandler();
    });

    // Check that abort was called
    expect(mockAbort).toHaveBeenCalled();

    // Check that state was reset properly
    const [state] = result.current;
    expect(state.isActive).toBe(false);
    expect(state.abortController).toBeNull();
    expect(state.error).toBe("Synchronization cancelled by user");
  });

  it("exports error log", async () => {
    const { result } = renderHook(() => useSynchronization());

    // Set up mock report with errors
    await act(async () => {
      const [, actions] = result.current;
      await actions.startSync([{ id: 1 }] as any, "test-token");
    });

    // Export errors
    await act(async () => {
      const [, actions] = result.current;
      actions.exportErrors();
    });

    // Check that export function was called with the report
    const [state] = result.current;
    expect(exportSyncErrorLog).toHaveBeenCalledWith(state.report);
  });

  it("exports full report", async () => {
    const { result } = renderHook(() => useSynchronization());

    // Set up mock report
    await act(async () => {
      const [, actions] = result.current;
      await actions.startSync([{ id: 1 }] as any, "test-token");
    });

    // Export report
    await act(async () => {
      const [, actions] = result.current;
      actions.exportReport();
    });

    // Check that export function was called with the report
    const [state] = result.current;
    expect(exportSyncReport).toHaveBeenCalledWith(state.report);
  });

  it("resets state", async () => {
    const { result } = renderHook(() => useSynchronization());

    // Set up some state
    await act(async () => {
      const [, actions] = result.current;
      await actions.startSync([{ id: 1 }] as any, "test-token");
    });

    // Reset state
    await act(async () => {
      const [, actions] = result.current;
      actions.reset();
    });

    // Check that state was reset to initial values
    const [state] = result.current;
    expect(state.isActive).toBe(false);
    expect(state.progress).toBeNull();
    expect(state.report).toBeNull();
    expect(state.error).toBeNull();
    expect(state.abortController).toBeNull();
  });
});
