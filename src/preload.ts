/**
 * @packageDocumentation
 * @module preload
 * @description Preload script that exposes IPC contexts and debug utilities to the renderer process.
 * @source
 */
import exposeContexts from "./helpers/ipc/context-exposer";
import { setupIpcDebugging } from "./helpers/ipc/debug/ipc-debugger";

// Set up IPC event tracing and context bridges
setupIpcDebugging();
exposeContexts();
