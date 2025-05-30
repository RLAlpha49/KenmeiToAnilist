/**
 * @packageDocumentation
 * @module preload
 * @description Preload script for the Electron app. Exposes IPC and context bridges to the renderer process.
 */
import exposeContexts from "./helpers/ipc/context-exposer";

exposeContexts();
