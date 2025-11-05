/**
 * @packageDocumentation
 * @module preload
 * @description Preload script executed before renderer process content loads.
 * Sets up IPC context bridges, exposes main process APIs to the renderer, and initializes debugging utilities.
 * @source
 */
import exposeContexts from "./helpers/ipc/context-exposer";
import { setupIpcDebugging } from "./helpers/ipc/debug/ipc-debugger";

console.log("[Preload] Script started");

/**
 * Set up IPC event tracing and debugging utilities.
 * Allows inspection of IPC messages for development and troubleshooting.
 * @source
 */
try {
  console.log("[Preload] Setting up IPC debugging...");
  setupIpcDebugging();
  console.log("[Preload] ✅ IPC debugging setup complete");
} catch (error) {
  console.error("[Preload] ❌ Failed to setup IPC debugging:", error);
}

/**
 * Expose secure context bridges to the renderer process.
 * Makes main process APIs available via window.electronAPI, window.electronAuth, etc.
 * This is the security boundary between main and renderer processes.
 * @source
 */
try {
  console.log("[Preload] Exposing contexts...");
  exposeContexts();
  console.log("[Preload] ✅ All contexts exposed successfully");
} catch (error) {
  console.error("[Preload] ❌ Failed to expose contexts:", error);
}

console.log("[Preload] Script completed");
