/**
 * @packageDocumentation
 * @module window_listeners
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
 * Registers IPC event listeners for window actions (minimize, maximize, close).
 *
 * @param mainWindow - The main Electron browser window instance.
 * @source
 */
export function addWindowEventListeners(mainWindow: BrowserWindow) {
  secureHandle(
    WIN_MINIMIZE_CHANNEL,
    () => {
      mainWindow.minimize();
    },
    mainWindow,
  );

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

  secureHandle(
    WIN_CLOSE_CHANNEL,
    () => {
      mainWindow.close();
    },
    mainWindow,
  );
}
