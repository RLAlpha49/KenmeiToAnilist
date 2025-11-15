/**
 * @packageDocumentation
 * @module clipboard-context
 * @description Exposes the Electron clipboard context bridge to the renderer process for secure clipboard operations.
 */

import { contextBridge, ipcRenderer } from "electron";
import { CLIPBOARD_WRITE_CHANNEL } from "./clipboard-channels";

/**
 * Exposes clipboard operations to the renderer process via context bridge.
 * Allows the renderer to write text to the system clipboard securely.
 * @throws {Error} If electron modules are unavailable.
 * @source
 */
export function exposeClipboardContext() {
  try {
    if (!contextBridge || !ipcRenderer) {
      throw new Error(
        "Failed to load electron modules: contextBridge or ipcRenderer is undefined",
      );
    }

    contextBridge.exposeInMainWorld("electronClipboard", {
      writeText: (text: string) =>
        ipcRenderer.invoke(CLIPBOARD_WRITE_CHANNEL, text),
    });

    console.log(
      "[ClipboardContext] ✅ Clipboard context exposed in main world",
    );
  } catch (error) {
    console.error(
      "[ClipboardContext] ❌ Error exposing clipboard context:",
      error,
    );
  }
}
