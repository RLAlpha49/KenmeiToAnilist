/**
 * @packageDocumentation
 * @module update-channels
 * @description IPC channels and events for auto-update operations via electron-updater.
 */

/**
 * Options for checking updates.
 * @property allowPrerelease - Include prerelease versions in results.
 * @source
 */
export interface CheckForUpdatesPayload {
  allowPrerelease?: boolean;
}

/** IPC channel for checking available updates. @source */
export const UPDATE_CHECK_CHANNEL = "update:check";

/** IPC channel for initiating update download. @source */
export const UPDATE_DOWNLOAD_CHANNEL = "update:download";

/** IPC channel for installing downloaded updates and restarting. @source */
export const UPDATE_INSTALL_CHANNEL = "update:install";

/** IPC channel for canceling in-progress update downloads. @source */
export const UPDATE_CANCEL_DOWNLOAD_CHANNEL = "update:cancel-download";

/** IPC event for update availability notification from main process. @source */
export const UPDATE_AVAILABLE_EVENT = "update:available";

/** IPC event for download progress updates from main process. @source */
export const UPDATE_DOWNLOAD_PROGRESS_EVENT = "update:download-progress";

/** IPC event for update download completion from main process. @source */
export const UPDATE_DOWNLOADED_EVENT = "update:downloaded";

/** IPC event for update operation errors from main process. @source */
export const UPDATE_ERROR_EVENT = "update:error";
