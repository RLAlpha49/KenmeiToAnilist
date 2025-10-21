/**
 * @packageDocumentation
 * @module store_context
 * @description Exposes the Electron store context bridge (getItem, setItem, removeItem, clear) to the renderer process.
 */

import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes the Electron store context bridge to the renderer process.
 *
 * @source
 */
export function exposeStoreContext() {
  try {
    if (!contextBridge || !ipcRenderer) {
      throw new Error(
        "Failed to load electron modules: contextBridge or ipcRenderer is undefined",
      );
    }

    contextBridge.exposeInMainWorld("electronStore", {
      getItem: (key: string) => ipcRenderer.invoke("store:getItem", key),
      setItem: (key: string, value: string) =>
        ipcRenderer.invoke("store:setItem", key, value),
      removeItem: (key: string) => ipcRenderer.invoke("store:removeItem", key),
      clear: () => ipcRenderer.invoke("store:clear"),
    });

    console.log("[StoreContext] ✅ Store context exposed in main world");
  } catch (error) {
    console.error("[StoreContext] ❌ Error exposing store context:", error);
  }
}
