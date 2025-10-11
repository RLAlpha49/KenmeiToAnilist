/**
 * @packageDocumentation
 * @module preload
 * @description Preload script for the Electron app. Exposes IPC and context bridges to the renderer process.
 */
import exposeContexts from "./helpers/ipc/context-exposer";
import { setupIpcDebugging } from "./helpers/ipc/debug/ipc-debugger";

setupIpcDebugging();
exposeContexts();
