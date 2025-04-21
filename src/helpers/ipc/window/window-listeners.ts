/**
 * @packageDocumentation
 * @module window_listeners
 * @description Registers IPC event listeners for window actions (minimize, maximize, close) in the Electron main process.
 */

import { BrowserWindow, ipcMain } from "electron";
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
  ipcMain.handle(WIN_MINIMIZE_CHANNEL, () => {
    mainWindow.minimize();
  });
  ipcMain.handle(WIN_MAXIMIZE_CHANNEL, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle(WIN_CLOSE_CHANNEL, () => {
    mainWindow.close();
  });
}
