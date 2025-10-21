/**
 * @packageDocumentation
 * @module window_context
 * @description Exposes the Electron window control context bridge (minimize, maximize, close) to the renderer process.
 */

import { contextBridge, ipcRenderer } from "electron";
import {
  WIN_MINIMIZE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_CLOSE_CHANNEL,
} from "./window-channels";

/**
 * Exposes the Electron window control context bridge to the renderer process.
 *
 * @source
 */
export function exposeWindowContext() {
  try {
    if (!contextBridge || !ipcRenderer) {
      throw new Error(
        "Failed to load electron modules: contextBridge or ipcRenderer is undefined",
      );
    }

    contextBridge.exposeInMainWorld("electronWindow", {
      minimize: () => ipcRenderer.invoke(WIN_MINIMIZE_CHANNEL),
      maximize: () => ipcRenderer.invoke(WIN_MAXIMIZE_CHANNEL),
      close: () => ipcRenderer.invoke(WIN_CLOSE_CHANNEL),
    });

    console.log("[WindowContext] ✅ Window context exposed in main world");
  } catch (error) {
    console.error("[WindowContext] ❌ Error exposing window context:", error);
  }
}
