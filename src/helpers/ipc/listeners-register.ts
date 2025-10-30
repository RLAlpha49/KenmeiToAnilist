/**
 * @packageDocumentation
 * @module listeners_register
 * @description Registers all IPC event listeners for the Electron main process, including window, theme, auth, store, and AniList API listeners.
 */

import { BrowserWindow } from "electron";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { addAuthEventListeners } from "./auth/auth-listeners";
import { setupStoreIPC } from "./store/store-setup";
import { setupAniListAPI } from "./api/api-listeners";
import { addUpdateEventListeners } from "./update/update-listeners";
import { setupBackupIPC } from "./backup/backup-listeners";
import { setupDebugIPC } from "./debug/debug-listeners";

/**
 * Registers all IPC event listeners for the Electron main process.
 *
 * @param mainWindow - The main Electron browser window instance.
 * @source
 */
export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  addAuthEventListeners(mainWindow);
  setupStoreIPC();
  setupBackupIPC(mainWindow);
  setupDebugIPC();
  setupAniListAPI();
  addUpdateEventListeners(mainWindow);
}
