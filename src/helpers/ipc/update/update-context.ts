/**
 * Context bridge exposure for auto-update functionality.
 * Exposes electron-updater APIs to the renderer process via the context bridge.
 * This ensures secure communication while maintaining process isolation.
 *
 * @module update-context
 */

import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
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

/**
 * Exposes update context to the renderer process.
 * Creates a global `electronUpdater` object with methods for update operations
 * and event subscriptions.
 *
 * @throws {Error} If context bridge exposure fails
 */
export function exposeUpdateContext(): void {
  try {
    contextBridge.exposeInMainWorld("electronUpdater", {
      /**
       * Checks for available updates from the update server.
       * @param options Optional configuration for the check
       * @param options.allowPrerelease Whether to include prerelease versions (default: false)
       * @returns Promise with update information
       */
      checkForUpdates: async (
        options?: CheckForUpdatesPayload,
      ): Promise<{
        updateAvailable: boolean;
        version?: string;
        releaseNotes?: string;
        releaseDate?: string;
      }> => {
        return await ipcRenderer.invoke(UPDATE_CHECK_CHANNEL, options ?? {});
      },

      /**
       * Initiates download of an available update.
       * Progress can be monitored via onDownloadProgress callback.
       * @returns Promise that resolves when download starts
       */
      downloadUpdate: async (): Promise<void> => {
        return await ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL);
      },

      /**
       * Quits the application and installs the downloaded update.
       * @returns Promise that resolves before app quits
       */
      installUpdate: async (): Promise<void> => {
        return await ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL);
      },

      /**
       * Subscribes to update available events.
       * @param callback Function to call when an update is available
       * @returns Function to unsubscribe from the event
       */
      onUpdateAvailable: (
        callback: (info: {
          version: string;
          releaseNotes: string;
          releaseDate: string;
        }) => void,
      ): (() => void) => {
        const listener = (_event: IpcRendererEvent, info: unknown) =>
          callback(
            info as {
              version: string;
              releaseNotes: string;
              releaseDate: string;
            },
          );
        ipcRenderer.on(UPDATE_AVAILABLE_EVENT, listener);
        return () =>
          ipcRenderer.removeListener(UPDATE_AVAILABLE_EVENT, listener);
      },

      /**
       * Subscribes to download progress events.
       * @param callback Function to call with download progress updates
       * @returns Function to unsubscribe from the event
       */
      onDownloadProgress: (
        callback: (progress: {
          percent: number;
          bytesPerSecond: number;
          transferred: number;
          total: number;
        }) => void,
      ): (() => void) => {
        const listener = (_event: IpcRendererEvent, progress: unknown) =>
          callback(
            progress as {
              percent: number;
              bytesPerSecond: number;
              transferred: number;
              total: number;
            },
          );
        ipcRenderer.on(UPDATE_DOWNLOAD_PROGRESS_EVENT, listener);
        return () =>
          ipcRenderer.removeListener(UPDATE_DOWNLOAD_PROGRESS_EVENT, listener);
      },

      /**
       * Subscribes to update downloaded events.
       * @param callback Function to call when download is complete
       * @returns Function to unsubscribe from the event
       */
      onUpdateDownloaded: (
        callback: (info: { version: string }) => void,
      ): (() => void) => {
        const listener = (_event: IpcRendererEvent, info: unknown) =>
          callback(info as { version: string });
        ipcRenderer.on(UPDATE_DOWNLOADED_EVENT, listener);
        return () =>
          ipcRenderer.removeListener(UPDATE_DOWNLOADED_EVENT, listener);
      },

      /**
       * Subscribes to update error events.
       * @param callback Function to call when an update error occurs
       * @returns Function to unsubscribe from the event
       */
      onUpdateError: (
        callback: (error: {
          message: string;
          stack?: string;
          name?: string;
        }) => void,
      ): (() => void) => {
        const listener = (_event: IpcRendererEvent, error: unknown) =>
          callback(error as { message: string; stack?: string; name?: string });
        ipcRenderer.on(UPDATE_ERROR_EVENT, listener);
        return () => ipcRenderer.removeListener(UPDATE_ERROR_EVENT, listener);
      },
    });

    console.log("[Update Context] Successfully exposed update context");
  } catch (error) {
    console.error("[Update Context] Failed to expose update context:", error);
    throw error;
  }
}
