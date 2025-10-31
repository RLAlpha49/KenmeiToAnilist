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

const store = new Store() as unknown as {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

/**
 * Type alias for release notes, which can be a string, an array of note objects, or undefined.
 */
type ReleaseNotes = string | { note?: string }[] | undefined;

/**
 * Normalizes release notes to a string.
 * If release notes is an array, joins mapped note fields with double newlines.
 * If undefined, returns empty string.
 *
 * @param releaseNotes The raw release notes (string, array, or undefined)
 * @returns Normalized release notes as string
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
 * Set up IPC event listeners for auto-update functionality
 *
 * @param mainWindow - The main application window for security validation
 */
export function addUpdateEventListeners(mainWindow: BrowserWindow): void {
  // Configure autoUpdater to not download automatically
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  /**
   * Handle update channel selection from renderer
   * Persists the selected channel and sets autoUpdater.allowPrerelease accordingly
   */
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

  /**
   * Handle update check requests from renderer
   * Checks for available updates and returns update information
   * Respects allowPrerelease option to include beta releases
   */
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
            // Set allowPrerelease based on payload (default: false for stable only)
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

  /**
   * Handle update download requests from renderer
   * Initiates download of the available update
   */
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

  /**
   * Handle update installation requests from renderer
   * Quits the application and installs the downloaded update
   */
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

  /**
   * Forward update-available event to renderer
   * Triggered when a new update is available
   */
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("[Update Listeners] Update available:", info.version);
    mainWindow.webContents.send(UPDATE_AVAILABLE_EVENT, {
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes as ReleaseNotes),
      releaseDate: info.releaseDate,
    });
  });

  /**
   * Forward download-progress event to renderer
   * Provides real-time download progress updates
   */
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

  /**
   * Forward update-downloaded event to renderer
   * Triggered when the update has been fully downloaded
   */
  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    console.log("[Update Listeners] Update downloaded:", info.version);
    mainWindow.webContents.send(UPDATE_DOWNLOADED_EVENT, {
      version: info.version,
    });
  });

  /**
   * Forward error event to renderer
   * Triggered when an error occurs during the update process
   */
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
