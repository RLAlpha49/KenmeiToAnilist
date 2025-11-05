/**
 * @packageDocumentation
 * @module listeners_register
 * @description Registers all IPC event listeners for the Electron main process, including window, theme, auth, store, and AniList API listeners.
 */

import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { addAuthEventListeners } from "./auth/auth-listeners";
import { setupStoreIPC } from "./store/store-setup";
import { setupAniListAPI } from "./api/api-listeners";
import { addUpdateEventListeners } from "./update/update-listeners";
import { setupBackupIPC } from "./backup/backup-listeners";
import { setupDebugIPC } from "./debug/debug-listeners";

/**
 * Validates that an IPC event originates from the main application window.
 * Prevents unauthorized IPC calls from other windows or injected content.
 * @param event - The IPC event to validate.
 * @param mainWindow - The main application window.
 * @returns True if sender is the main window, false otherwise.
 * @internal
 * @source
 */
function isValidSender(
  event: IpcMainInvokeEvent,
  mainWindow: BrowserWindow,
): boolean {
  // Get the sender's webContents ID
  const senderId = event.sender.id;
  const mainWindowId = mainWindow.webContents.id;

  // Check if sender is the main window
  if (senderId === mainWindowId) {
    return true;
  }

  // Log unauthorized access attempts
  console.warn(
    `[IPC Security] ⚠️ Unauthorized IPC call from webContents ID ${senderId} (expected ${mainWindowId})`,
  );
  console.warn(`[IPC Security] ⚠️ Sender URL: ${event.sender.getURL()}`);

  return false;
}

/**
 * Creates and registers a secure IPC handler with sender validation.
 * Wraps the handler to verify the request originates from the main window.
 * @param channel - The IPC channel name.
 * @param handler - The handler function to register.
 * @param mainWindow - The main application window for sender validation.
 * @internal
 * @source
 */
function secureHandle<T extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: T) => unknown,
  mainWindow: BrowserWindow,
): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: T) => {
    // Validate sender
    if (!isValidSender(event, mainWindow)) {
      const error = new Error(`Unauthorized IPC call to channel: ${channel}`);
      console.error(`[IPC Security] ❌ ${error.message}`);
      throw error;
    }

    // Call original handler if validation passes
    return handler(event, ...args);
  });
}

/**
 * Registers all IPC handlers for the main process.
 * Sets up listeners for window, theme, auth, store, backup, debug, and update operations.
 * @param mainWindow - The main Electron browser window instance.
 * @source
 */
export default function registerListeners(mainWindow: BrowserWindow) {
  // Register all IPC handlers (they will use secureHandle internally)
  addWindowEventListeners(mainWindow);
  addThemeEventListeners(mainWindow);
  addAuthEventListeners(mainWindow);
  setupStoreIPC(mainWindow);
  setupBackupIPC(mainWindow);
  setupDebugIPC(mainWindow);
  setupAniListAPI(mainWindow);
  addUpdateEventListeners(mainWindow);

  console.info("[IPC] ✅ All IPC listeners registered with sender validation");
}

/**
 * Secure IPC handler factory with sender validation.
 * Registers handlers with protection against unauthorized IPC calls from unverified sources.
 * @source
 */
export { secureHandle };
