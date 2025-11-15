/**
 * @packageDocumentation
 * @module clipboard-listeners
 * @description IPC listeners for clipboard operations in the Electron main process.
 */

import { clipboard, BrowserWindow, IpcMainInvokeEvent } from "electron";
import { secureHandle } from "../listeners-register";
import { CLIPBOARD_WRITE_CHANNEL } from "./clipboard-channels";

/**
 * Sets up clipboard IPC listeners for the main process.
 * Provides secure clipboard write operations from the renderer process.
 * @param mainWindow - The main Electron browser window instance.
 * @source
 */
export function setupClipboardIPC(mainWindow: BrowserWindow) {
  secureHandle<[string]>(
    CLIPBOARD_WRITE_CHANNEL,
    (_event: IpcMainInvokeEvent, text: string) => {
      try {
        if (typeof text !== "string") {
          throw new TypeError("Text must be a string");
        }
        clipboard.writeText(text);
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          "[Clipboard IPC] ❌ Failed to write to clipboard:",
          errorMessage,
        );
        throw error;
      }
    },
    mainWindow,
  );
}
