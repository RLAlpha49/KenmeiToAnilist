/**
 * IPC channel constants for update operations.
 * These channels facilitate communication between the main and renderer processes
 * for auto-update functionality using electron-updater.
 *
 * @module update-channels
 */

/**
 * Payload for UPDATE_CHECK_CHANNEL.
 * Allows specifying whether to include prerelease versions.
 */
export interface CheckForUpdatesPayload {
  /** Whether to allow prerelease versions (beta/early access). */
  allowPrerelease?: boolean;
}

/**
 * Channel for checking for available updates.
 * Accepts optional payload to control prerelease inclusion.
 * Payload: CheckForUpdatesPayload
 */
export const UPDATE_CHECK_CHANNEL = "update:check";

/**
 * Channel for downloading available updates.
 * Starts the download process for a pending update.
 */
export const UPDATE_DOWNLOAD_CHANNEL = "update:download";

/**
 * Channel for installing downloaded updates.
 * Quits the application and installs the update.
 */
export const UPDATE_INSTALL_CHANNEL = "update:install";

/**
 * Channel for canceling an in-progress update download.
 * Stops the current download operation.
 */
export const UPDATE_CANCEL_DOWNLOAD_CHANNEL = "update:cancel-download";

/**
 * Event channel for update available notification.
 * Sent from main to renderer when an update is available.
 */
export const UPDATE_AVAILABLE_EVENT = "update:available";

/**
 * Event channel for download progress updates.
 * Sent from main to renderer during update downloads.
 */
export const UPDATE_DOWNLOAD_PROGRESS_EVENT = "update:download-progress";

/**
 * Event channel for update downloaded notification.
 * Sent from main to renderer when an update download completes.
 */
export const UPDATE_DOWNLOADED_EVENT = "update:downloaded";

/**
 * Event channel for update error notification.
 * Sent from main to renderer when an error occurs during update operations.
 */
export const UPDATE_ERROR_EVENT = "update:error";
