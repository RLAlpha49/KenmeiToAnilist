/**
 * @packageDocumentation
 * @module debug_listeners
 * @description Registers IPC event listeners for debug-related actions (memory stats, performance monitoring) in the Electron main process.
 */

import { BrowserWindow } from "electron";
import { secureHandle } from "../listeners-register";
import type { MemoryMetrics } from "@/types/debug";

/**
 * Registers IPC event listeners for debug-related actions in the main process.
 * Currently handles memory statistics polling for performance monitoring.
 *
 * @param mainWindow - The main application window for security validation
 * @source
 */
export function setupDebugIPC(mainWindow: BrowserWindow): void {
  console.log("[DebugIPC] Setting up debug IPC handlers...");

  /**
   * Handler for retrieving memory statistics from the main process.
   * Combines process memory info and V8 heap statistics.
   *
   * @returns MemoryMetrics object with private, shared, heap memory in KB
   */
  secureHandle(
    "debug:get-memory-stats",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_event: Electron.IpcMainInvokeEvent): Promise<MemoryMetrics> => {
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
    },
    mainWindow,
  );

  console.log("[DebugIPC] ✅ Debug IPC handlers registered");
}
