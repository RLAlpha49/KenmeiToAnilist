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
  ipc: {
    maxEntries: number;
    getEvents: () => IpcLogEntry[];
    subscribe: (callback: (entries: IpcLogEntry[]) => void) => () => void;
    clear: () => void;
    setEnabled: (value: boolean) => void;
    isEnabled: () => boolean;
  };
  getMemoryStats: () => Promise<MemoryMetrics>;
}
