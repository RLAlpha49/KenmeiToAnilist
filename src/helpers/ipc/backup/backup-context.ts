/**
 * @packageDocumentation
 * @module backup-context
 * @description Exposes the Electron backup context bridge to the renderer process.
 */

import type { BackupScheduleConfig } from "@/utils/storage";
import type { BackupHistoryEntry } from "@/utils/backup";
import { contextBridge, ipcRenderer } from "electron";
import { BACKUP_CHANNELS } from "./backup-channels";

/**
 * Backup API exposed to the renderer process.
 * Provides schedule configuration, backup triggering, file management, and restore operations.
 * @source
 */
export interface ElectronBackupApi {
  getScheduleConfig: () => Promise<BackupScheduleConfig>;
  setScheduleConfig: (
    config: BackupScheduleConfig,
  ) => Promise<{ success: boolean; error?: string }>;
  getBackupLocation: () => Promise<{
    success: boolean;
    data?: string;
    error?: string;
  }>;
  setBackupLocation: (
    location: string,
  ) => Promise<{ success: boolean; error?: string; code?: string }>;
  openBackupLocation: () => Promise<{ success: boolean; error?: string }>;
  listLocalBackups: () => Promise<{
    success: boolean;
    data?: Array<{ name: string; timestamp: number; size: number }>;
    error?: string;
  }>;
  readLocalBackupFile: (
    filename: string,
  ) => Promise<{ success: boolean; data?: string; error?: string }>;
  deleteBackup: (
    filename: string,
  ) => Promise<{ success: boolean; error?: string }>;
  triggerBackup: () => Promise<{
    success: boolean;
    backupId?: string;
    error?: string;
  }>;
  createNow: () => Promise<{
    success: boolean;
    backupId?: string;
    error?: string;
  }>;
  getBackupStatus: () => Promise<{
    isRunning: boolean;
    lastBackup: number | null;
    nextBackup: number | null;
  }>;
  getBackupHistory: () => Promise<BackupHistoryEntry[]>;
  clearHistory: () => Promise<{ success: boolean; error?: string }>;
  restoreFromLocal: (
    filename: string,
    options?: { merge?: boolean },
  ) => Promise<{ success: boolean; errors?: string[] }>;
  onBackupComplete: (
    callback: (data: { backupId: string; timestamp: number }) => void,
  ) => () => void;
  onBackupError: (callback: (error: string) => void) => () => void;
  onHistoryUpdated: (callback: () => void) => () => void;
  onStatusChanged: (
    callback: (status: {
      isRunning: boolean;
      lastBackup: number | null;
      nextBackup: number | null;
    }) => void,
  ) => () => void;
}

/**
 * Exposes the backup context bridge to the renderer process.
 * @source
 */
export function exposeBackupContext() {
  try {
    if (!contextBridge || !ipcRenderer) {
      throw new Error(
        "Failed to load electron modules: contextBridge or ipcRenderer is undefined",
      );
    }

    console.debug("[BackupContext] Setting up backup context bridge...");

    contextBridge.exposeInMainWorld("electronBackup", {
      /**
       * Retrieves current backup schedule configuration from the main process.
       * @returns Promise<BackupScheduleConfig> The backup schedule configuration.
       * @source
       */
      getScheduleConfig: () => {
        console.debug(
          "[BackupContext] Renderer requesting backup schedule config",
        );
        return ipcRenderer.invoke(BACKUP_CHANNELS.GET_SCHEDULE_CONFIG);
      },

      /**
       * Updates the backup schedule configuration in the main process.
       * @param config - New backup schedule configuration.
       * @returns Promise indicating success or error.
       * @source
       */
      setScheduleConfig: (
        config: BackupScheduleConfig,
      ): Promise<{ success: boolean; error?: string }> => {
        console.debug(
          "[BackupContext] Renderer updating backup schedule config",
          {
            enabled: config.enabled,
            interval: config.interval,
            backupLocation: config.backupLocation,
          },
        );
        return ipcRenderer.invoke(BACKUP_CHANNELS.SET_SCHEDULE_CONFIG, config);
      },

      /**
       * Retrieves the currently configured backup location.
       * @returns Promise with backup directory path or error.
       * @source
       */
      getBackupLocation: (): Promise<{
        success: boolean;
        data?: string;
        error?: string;
      }> => {
        console.debug("[BackupContext] Renderer requesting backup location");

        return ipcRenderer.invoke(BACKUP_CHANNELS.GET_BACKUP_LOCATION);
      },

      /**
       * Updates the backup location directory in the main process.
       * @param location - Full path to new backup directory.
       * @returns Promise with success status or error with code.
       * @source
       */
      setBackupLocation: (
        location: string,
      ): Promise<{ success: boolean; error?: string; code?: string }> => {
        console.debug("[BackupContext] Renderer updating backup location");

        return ipcRenderer.invoke(
          BACKUP_CHANNELS.SET_BACKUP_LOCATION,
          location,
        );
      },

      /**
       * Opens the backup location in the system file browser.
       * @returns Promise with success status.
       * @source
       */
      openBackupLocation: (): Promise<{ success: boolean; error?: string }> => {
        console.debug(
          "[BackupContext] Renderer requesting to open backup location",
        );

        return ipcRenderer.invoke(BACKUP_CHANNELS.OPEN_BACKUP_LOCATION);
      },

      /**
       * Lists all available backup files in the configured location.
       * @returns Promise with array of backup file metadata.
       * @source
       */
      listLocalBackups: (): Promise<{
        success: boolean;
        data?: Array<{ name: string; timestamp: number; size: number }>;
        error?: string;
      }> => {
        console.debug(
          "[BackupContext] Renderer requesting list of local backups",
        );

        return ipcRenderer.invoke(BACKUP_CHANNELS.LIST_LOCAL_BACKUPS);
      },

      /**
       * Reads a backup file's contents as a string.
       * @param filename - Name of the backup file to read.
       * @returns Promise with file contents or error.
       * @source
       */
      readLocalBackupFile: (
        filename: string,
      ): Promise<{ success: boolean; data?: string; error?: string }> => {
        console.debug(
          "[BackupContext] Renderer requesting to read local backup file",
        );

        return ipcRenderer.invoke(BACKUP_CHANNELS.READ_LOCAL_BACKUP, filename);
      },

      /**
       * Deletes a specific backup file by name.
       * @param filename - Name of the backup file to delete.
       * @returns Promise with success status.
       * @source
       */
      deleteBackup: (
        filename: string,
      ): Promise<{ success: boolean; error?: string }> => {
        console.debug(
          "[BackupContext] Renderer requesting to delete backup",
          filename,
        );
        return ipcRenderer.invoke(BACKUP_CHANNELS.DELETE_BACKUP, filename);
      },

      /**
       * Triggers a manual backup outside the scheduled interval.
       * @returns Promise with backup ID on success.
       * @source
       */
      triggerBackup: () => {
        console.debug("[BackupContext] Renderer manually triggering backup");
        return ipcRenderer.invoke(BACKUP_CHANNELS.TRIGGER_BACKUP);
      },

      /**
       * Creates an immediate backup bypassing the scheduler.
       * Writes silently to the configured backup location without user interaction.
       * This is the recommended approach for automatic backups before matching/sync operations.
       *
       * Semantically identical to triggerBackup(), but with clearer intent for automatic operations.
       *
       * @returns Promise with backup ID on success, or error message on failure.
       * @source
       */
      createNow: () => {
        console.debug(
          "[BackupContext] Renderer requesting immediate backup creation",
        );
        return ipcRenderer.invoke(BACKUP_CHANNELS.CREATE_NOW);
      },

      /**
       * Retrieves the current backup scheduler status.
       * @returns Promise with running state and backup timestamps.
       * @source
       */
      getBackupStatus: () => {
        console.debug("[BackupContext] Renderer requesting backup status");
        return ipcRenderer.invoke(BACKUP_CHANNELS.GET_BACKUP_STATUS);
      },

      /**
       * Retrieves backup history entries from the main process store.
       * @returns Promise<BackupHistoryEntry[]> Array of backup history entries.
       * @source
       */
      getBackupHistory: (): Promise<BackupHistoryEntry[]> => {
        console.debug("[BackupContext] Renderer requesting backup history");
        return ipcRenderer.invoke(BACKUP_CHANNELS.GET_BACKUP_HISTORY);
      },

      /**
       * Clears all backup history from storage.
       * Triggers ON_HISTORY_UPDATED event to notify renderer.
       * @returns Promise with success status.
       * @source
       */
      clearHistory: () => {
        console.debug(
          "[BackupContext] Renderer requesting to clear backup history",
        );
        return ipcRenderer.invoke(BACKUP_CHANNELS.CLEAR_HISTORY);
      },

      /**
       * Restores application data from a backup file.
       * Supports merge mode for match results.
       * @param filename - Name of the backup file to restore from.
       * @param options - Restore options (merge mode for match results).
       * @returns Promise with success status and optional errors.
       * @source
       */
      restoreFromLocal: (
        filename: string,
        options?: { merge?: boolean },
      ): Promise<{ success: boolean; errors?: string[] }> => {
        console.debug(
          "[BackupContext] Renderer requesting restore from local backup",
          filename,
          options,
        );
        return ipcRenderer.invoke(
          BACKUP_CHANNELS.RESTORE_LOCAL_BACKUP,
          filename,
          options,
        );
      },

      /**
       * Registers a listener for backup completion events.
       * @param callback - Function called with backup ID and timestamp on completion.
       * @returns Cleanup function to remove the listener.
       * @source
       */
      onBackupComplete: (
        callback: (data: { backupId: string; timestamp: number }) => void,
      ): (() => void) => {
        // Create a local handler function for this specific callback
        const handler = (
          _event: Electron.IpcRendererEvent,
          data: { backupId: string; timestamp: number },
        ) => {
          console.debug("[BackupContext] Backup completed:", {
            backupId: data?.backupId,
            timestamp: data?.timestamp,
          });
          callback(data);
        };

        // Add the event listener for backup completion
        ipcRenderer.on(BACKUP_CHANNELS.ON_BACKUP_COMPLETE, handler);

        // Return a function to remove only this specific listener
        return () => {
          ipcRenderer.removeListener(
            BACKUP_CHANNELS.ON_BACKUP_COMPLETE,
            handler,
          );
        };
      },

      /**
       * Registers a listener for backup error events.
       * @param callback - Function called with error message on backup error.
       * @returns Cleanup function to remove the listener.
       * @source
       */
      onBackupError: (callback: (error: string) => void): (() => void) => {
        // Create a local handler function for this specific callback
        const handler = (_event: Electron.IpcRendererEvent, error: string) => {
          console.debug("[BackupContext] Backup error:", error);
          callback(error);
        };

        // Add the event listener for backup errors
        ipcRenderer.on(BACKUP_CHANNELS.ON_BACKUP_ERROR, handler);

        // Return a function to remove only this specific listener
        return () => {
          ipcRenderer.removeListener(BACKUP_CHANNELS.ON_BACKUP_ERROR, handler);
        };
      },

      /**
       * Registers a listener for backup history updates.
       * Fired when history is updated in the main process.
       * @param callback - Function called on history update.
       * @returns Cleanup function to remove the listener.
       * @source
       */
      onHistoryUpdated: (callback: () => void) => {
        // Create a local handler function for this specific callback
        const handler = () => {
          console.debug("[BackupContext] Backup history updated");
          callback();
        };

        // Add the event listener for history updates
        ipcRenderer.on(BACKUP_CHANNELS.ON_HISTORY_UPDATED, handler);

        // Return a function to remove only this specific listener
        return () => {
          ipcRenderer.removeListener(
            BACKUP_CHANNELS.ON_HISTORY_UPDATED,
            handler,
          );
        };
      },

      /**
       * Registers a listener for backup status changes.
       * Fired when scheduler status changes (config update, trigger, or scheduled backup).
       * @param callback - Function called with updated status.
       * @returns Cleanup function to remove the listener.
       * @source
       */
      onStatusChanged: (
        callback: (status: {
          isRunning: boolean;
          lastBackup: number | null;
          nextBackup: number | null;
        }) => void,
      ): (() => void) => {
        // Create a local handler function for this specific callback
        const handler = (
          _event: Electron.IpcRendererEvent,
          status: {
            isRunning: boolean;
            lastBackup: number | null;
            nextBackup: number | null;
          },
        ) => {
          console.debug("[BackupContext] Backup status changed");
          callback(status);
        };

        // Add the event listener for status changes
        ipcRenderer.on(BACKUP_CHANNELS.ON_STATUS_CHANGED, handler);

        // Return a function to remove only this specific listener
        return () => {
          ipcRenderer.removeListener(
            BACKUP_CHANNELS.ON_STATUS_CHANGED,
            handler,
          );
        };
      },
    });

    console.log("[BackupContext] ✅ Backup context exposed in main world");
  } catch (error) {
    console.error("[BackupContext] ❌ Error exposing backup context:", error);
  }
}
