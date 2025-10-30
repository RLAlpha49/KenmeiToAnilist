/**
 * @packageDocumentation
 * @module debug_listeners
 * @description Registers IPC event listeners for debug-related actions (memory stats, performance monitoring) in the Electron main process.
 */

import { ipcMain } from "electron";
import type { MemoryMetrics } from "@/types/debug";

/**
 * Registers IPC event listeners for debug-related actions in the main process.
 * Currently handles memory statistics polling for performance monitoring.
 *
 * @source
 */
export function setupDebugIPC(): void {
  console.log("[DebugIPC] Setting up debug IPC handlers...");

  // Remove any existing handler for idempotency
  try {
    ipcMain.removeHandler("debug:get-memory-stats");
    console.debug(
      "[DebugIPC] Removed existing handler for debug:get-memory-stats",
    );
  } catch {
    // Handler may not exist on first registration - this is expected
  }

  /**
   * Handler for retrieving memory statistics from the main process.
   * Combines process memory info and V8 heap statistics.
   *
   * @returns MemoryMetrics object with private, shared, heap memory in KB
   */
  ipcMain.handle("debug:get-memory-stats", async (): Promise<MemoryMetrics> => {
    try {
      // Get process memory info (returns KB values)
      const memoryInfo = await process.getProcessMemoryInfo();
      const heapStats = process.getHeapStatistics();

      const metrics: MemoryMetrics = {
        private: memoryInfo.private,
        shared: memoryInfo.shared,
        heap: heapStats.totalHeapSize,
        timestamp: Date.now(),
      };

      return metrics;
    } catch (error) {
      console.error("[DebugIPC] Error retrieving memory stats:", error);

      // Return fallback metrics on error - performance monitoring should never crash the app
      return {
        private: 0,
        shared: 0,
        heap: 0,
        timestamp: Date.now(),
      };
    }
  });

  console.log("[DebugIPC] ✅ Debug IPC handlers registered");
}
