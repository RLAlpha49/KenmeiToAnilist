/**
 * @packageDocumentation
 * @module preload
 * @description Preload script that exposes IPC contexts and debug utilities to the renderer process.
 * @source
 */
import exposeContexts from "./helpers/ipc/context-exposer";
import { setupIpcDebugging } from "./helpers/ipc/debug/ipc-debugger";

console.log("[Preload] Script started");

// Set up IPC event tracing and context bridges
try {
  console.log("[Preload] Setting up IPC debugging...");
  setupIpcDebugging();
  console.log("[Preload] ✅ IPC debugging setup complete");
} catch (error) {
  console.error("[Preload] ❌ Failed to setup IPC debugging:", error);
}

try {
  console.log("[Preload] Exposing contexts...");
  exposeContexts();
  console.log("[Preload] ✅ All contexts exposed successfully");
} catch (error) {
  console.error("[Preload] ❌ Failed to expose contexts:", error);
}

console.log("[Preload] Script completed");
