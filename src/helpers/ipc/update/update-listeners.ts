/**
 * IPC event listeners for auto-update functionality.
 * Handles communication between the renderer process and electron-updater.
 * Manages update checking, downloading, and installation operations.
 *
 * @module update-listeners
 */

import { BrowserWindow } from "electron";
import { secureHandle } from "../listeners-register";
import { autoUpdater } from "electron-updater";
import type { UpdateInfo, ProgressInfo } from "electron-updater";
import Store from "electron-store";
import {
  UPDATE_CHECK_CHANNEL,
  UPDATE_DOWNLOAD_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_AVAILABLE_EVENT,
  UPDATE_DOWNLOAD_PROGRESS_EVENT,
  UPDATE_DOWNLOADED_EVENT,
  UPDATE_ERROR_EVENT,
  type CheckForUpdatesPayload,
} from "./update-channels";
import { withGroupAsync } from "../../../utils/logging";

/** Persistent store instance for update preferences and state. @source */
const store = new Store() as unknown as {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

/** Type alias for release notes: string, array of objects with note field, or undefined. @source */
type ReleaseNotes = string | { note?: string }[] | undefined;

/**
 * Normalizes release notes to a string format.
 * Converts array format to multi-line string, returns string as-is, or returns empty string.
 * @param releaseNotes - Raw release notes in various formats.
 * @returns Normalized release notes as string.
 * @source
 */
function normalizeReleaseNotes(releaseNotes: ReleaseNotes): string {
  if (typeof releaseNotes === "string") {
    return releaseNotes;
  }
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((note) => {
        let normalizedNote: string;
        if (typeof note === "string") {
          normalizedNote = note;
        } else if (note && typeof note.note === "string") {
          normalizedNote = note.note;
        } else {
          normalizedNote = "";
        }
        return normalizedNote;
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

/**
 * Registers IPC handlers and event forwarding for auto-update operations.
 * Manages update checking, downloading, installation, and progress events.
 * @param mainWindow - Main application window for security validation and event forwarding.
 * @source
 */
export function addUpdateEventListeners(mainWindow: BrowserWindow): void {
  // Disable automatic download and install to give renderer control
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // Handle update channel selection: persist preference and configure prerelease flag
  secureHandle(
    "updates:set-channel",
    (_event: Electron.IpcMainInvokeEvent, channel: "stable" | "beta") => {
      try {
        store.set("update_channel", channel);
        autoUpdater.allowPrerelease = channel === "beta";
        console.info(
          `[Update Listeners] ✅ Update channel set to ${channel} (allowPrerelease=${autoUpdater.allowPrerelease})`,
        );
        return { success: true };
      } catch (err) {
        console.error(
          "[Update Listeners] ❌ Failed to set update channel:",
          err,
        );
        return { success: false, error: String(err) };
      }
    },
    mainWindow,
  );

  // Handle update check requests and return update information
  secureHandle(
    UPDATE_CHECK_CHANNEL,
    async (
      _event: Electron.IpcMainInvokeEvent,
      payload?: CheckForUpdatesPayload,
    ): Promise<{
      updateAvailable: boolean;
      version?: string;
      releaseNotes?: string;
      releaseDate?: string;
    }> => {
      return await withGroupAsync(
        "[Update Listeners] Checking for updates",
        async () => {
          try {
            // Apply prerelease preference from payload
            autoUpdater.allowPrerelease = Boolean(payload?.allowPrerelease);
            console.log(
              `[Update Listeners] allowPrerelease: ${autoUpdater.allowPrerelease}`,
            );

            const result = await autoUpdater.checkForUpdates();

            if (result?.updateInfo) {
              const updateInfo = result.updateInfo;
              const currentVersion = autoUpdater.currentVersion.version;
              const latestVersion = updateInfo.version;
              const updateAvailable = currentVersion !== latestVersion;

              console.log(
                `[Update Listeners] Current version: ${currentVersion}, Latest version: ${latestVersion}`,
              );

              return {
                updateAvailable,
                version: updateInfo.version,
                releaseNotes: normalizeReleaseNotes(
                  updateInfo.releaseNotes as ReleaseNotes,
                ),
                releaseDate: updateInfo.releaseDate,
              };
            }

            return { updateAvailable: false };
          } catch (error) {
            console.error(
              "[Update Listeners] Error checking for updates:",
              error,
            );
            throw error;
          }
        },
      );
    },
    mainWindow,
  );

  // Handle update download requests
  secureHandle(
    UPDATE_DOWNLOAD_CHANNEL,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_event: Electron.IpcMainInvokeEvent): Promise<void> => {
      return await withGroupAsync(
        "[Update Listeners] Starting update download",
        async () => {
          try {
            await autoUpdater.downloadUpdate();
            console.log("[Update Listeners] Update download started");
          } catch (error) {
            console.error(
              "[Update Listeners] Error downloading update:",
              error,
            );
            throw error;
          }
        },
      );
    },
    mainWindow,
  );

  // Handle update installation requests
  secureHandle(
    UPDATE_INSTALL_CHANNEL,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_event: Electron.IpcMainInvokeEvent): Promise<void> => {
      return await withGroupAsync(
        "[Update Listeners] Installing update",
        async () => {
          try {
            console.log("[Update Listeners] Quitting and installing update");
            autoUpdater.quitAndInstall(false, true);
          } catch (error) {
            console.error("[Update Listeners] Error installing update:", error);
            throw error;
          }
        },
      );
    },
    mainWindow,
  );

  // Forward update-available event to renderer
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("[Update Listeners] Update available:", info.version);
    mainWindow.webContents.send(UPDATE_AVAILABLE_EVENT, {
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes as ReleaseNotes),
      releaseDate: info.releaseDate,
    });
  });

  // Forward download-progress event to renderer with real-time updates
  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    console.log(
      `[Update Listeners] Download progress: ${Math.round(progress.percent)}%`,
    );
    mainWindow.webContents.send(UPDATE_DOWNLOAD_PROGRESS_EVENT, {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // Forward update-downloaded event to renderer
  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    console.log("[Update Listeners] Update downloaded:", info.version);
    mainWindow.webContents.send(UPDATE_DOWNLOADED_EVENT, {
      version: info.version,
    });
  });

  // Forward error event to renderer with error details
  autoUpdater.on("error", (error: Error) => {
    console.error("[Update Listeners] Update error:", error);
    mainWindow.webContents.send(UPDATE_ERROR_EVENT, {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
  });

  console.log("[Update Listeners] Update event listeners registered");
}
