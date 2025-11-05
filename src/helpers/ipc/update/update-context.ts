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
 * Exposes update APIs to the renderer process via context bridge.
 * Provides methods for checking, downloading, and installing updates plus event listeners.
 * @throws {Error} If context bridge exposure fails.
 * @source
 */
export function exposeUpdateContext(): void {
  try {
    contextBridge.exposeInMainWorld("electronUpdater", {
      /**
       * Checks for available updates from the update server.
       * @param options - Optional configuration including allowPrerelease flag.
       * @returns Update information (version, release notes, date, availability).
       * @source
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
       * Initiates download of available update.
       * Monitor progress with onDownloadProgress callback.
       * @returns Promise resolving when download begins.
       * @source
       */
      downloadUpdate: async (): Promise<void> => {
        return await ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL);
      },

      /**
       * Installs downloaded update and restarts application.
       * @returns Promise resolving before restart.
       * @source
       */
      installUpdate: async (): Promise<void> => {
        return await ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL);
      },

      /**
       * Subscribes to update available event.
       * @param callback - Invoked when update is available with version and release info.
       * @returns Unsubscribe function.
       * @source
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
       * Subscribes to download progress event.
       * @param callback - Invoked with progress percentage, speed, bytes transferred and total.
       * @returns Unsubscribe function.
       * @source
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
       * Subscribes to update downloaded event.
       * @param callback - Invoked with update version when download completes.
       * @returns Unsubscribe function.
       * @source
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
       * Subscribes to update error event.
       * @param callback - Invoked with error details when update operation fails.
       * @returns Unsubscribe function.
       * @source
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
