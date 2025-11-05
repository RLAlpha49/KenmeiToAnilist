/**
 * @packageDocumentation
 * @module debug_context
 * @description Exports type definitions for debug context (memory stats and IPC debugging). The actual exposure is handled by ipc-debugger.ts which includes both IPC debugging and memory stats under the unified `electronDebug` object.
 */

import type { MemoryMetrics, IpcLogEntry } from "@/types/debug";

/**
 * Debug performance monitoring interface exposed to the renderer process.
 * Provides memory statistics and IPC event logging for performance tracking.
 * Exposed as part of the `electronDebug` object by ipc-debugger.ts.
 * @source
 */
export interface ElectronIpcDebugBridge {
  /**
   * IPC event logging interface for debugging renderer-main communication.
   * @source
   */
  ipc: {
    /** Maximum number of IPC events retained in memory. @source */
    maxEntries: number;
    /**
     * Retrieves all currently logged IPC events.
     * @returns Array of IPC log entries.
     * @source
     */
    getEvents: () => IpcLogEntry[];
    /**
     * Subscribes to IPC event updates with callback notifications.
     * @param callback - Called with new event list on each change.
     * @returns Function to unsubscribe from updates.
     * @source
     */
    subscribe: (callback: (entries: IpcLogEntry[]) => void) => () => void;
    /**
     * Clears all logged IPC events.
     * @source
     */
    clear: () => void;
    /**
     * Enables or disables IPC event logging.
     * @param value - True to enable, false to disable.
     * @source
     */
    setEnabled: (value: boolean) => void;
    /**
     * Checks if IPC event logging is currently enabled.
     * @returns True if logging is active, false otherwise.
     * @source
     */
    isEnabled: () => boolean;
  };
  /**
   * Retrieves current memory usage metrics from the main process.
   * @returns Promise resolving to memory statistics.
   * @source
   */
  getMemoryStats: () => Promise<MemoryMetrics>;
}
