/**
 * @packageDocumentation
 * @module window-listeners
 * @description Registers IPC event listeners for window actions (minimize, maximize, close) in the Electron main process.
 */

import { BrowserWindow } from "electron";
import { secureHandle } from "../listeners-register";
import {
  WIN_CLOSE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_MINIMIZE_CHANNEL,
} from "./window-channels";

/**
 * Registers IPC handlers for window control operations.
 * @param mainWindow - Main application window for control operations.
 * @source
 */
export function addWindowEventListeners(mainWindow: BrowserWindow) {
  // Minimize window
  secureHandle(
    WIN_MINIMIZE_CHANNEL,
    () => {
      mainWindow.minimize();
    },
    mainWindow,
  );

  // Toggle maximize state
  secureHandle(
    WIN_MAXIMIZE_CHANNEL,
    () => {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    },
    mainWindow,
  );

  // Close window
  secureHandle(
    WIN_CLOSE_CHANNEL,
    () => {
      mainWindow.close();
    },
    mainWindow,
  );
}
