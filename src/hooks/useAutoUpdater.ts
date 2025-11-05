/**
 * Custom React hook for managing auto-update state and interactions.
 * Handles update checking, downloading, installation, and event subscriptions.
 *
 * @module useAutoUpdater
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { storage, STORAGE_KEYS } from "@/utils/storage";

/**
 * Update information returned from the update server.
 * @property version - Semantic version of the available update.
 * @property releaseNotes - Markdown-formatted release notes for the update.
 * @property releaseDate - ISO date string of when the update was released.
 * @source
 */
interface UpdateInfo {
  version: string;
  releaseNotes: string;
  releaseDate: string;
}

/**
 * Manages auto-update functionality including checking, downloading, and installing updates.
 * Handles update notifications, download progress, and dismissal persistence via storage.
 * @returns State and control methods for update management.
 * @source
 */
export function useAutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get dismissed updates from storage abstraction
  const getDismissedVersions = useCallback((): string[] => {
    try {
      const dismissed = storage.getItem(STORAGE_KEYS.UPDATE_DISMISSED_VERSIONS);
      return dismissed ? JSON.parse(dismissed) : [];
    } catch {
      return [];
    }
  }, []);

  // Add version to dismissed list
  const dismissVersion = useCallback(
    (version: string) => {
      const dismissed = getDismissedVersions();
      if (!dismissed.includes(version)) {
        dismissed.push(version);
        storage.setItem(
          STORAGE_KEYS.UPDATE_DISMISSED_VERSIONS,
          JSON.stringify(dismissed),
        );
      }
    },
    [getDismissedVersions],
  );

  // Check if version was dismissed
  const isVersionDismissed = useCallback(
    (version: string): boolean => {
      return getDismissedVersions().includes(version);
    },
    [getDismissedVersions],
  );

  /**
   * Check for available updates with optional prerelease support.
   * @param allowPrerelease - Whether to include prerelease versions in the check.
   * @source
   */
  const checkForUpdates = useCallback(
    async (allowPrerelease = false) => {
      try {
        if (!globalThis.electronUpdater?.checkForUpdates) {
          const msg = "Auto-updater not available in this environment";
          console.warn(`[useAutoUpdater] ${msg}`);
          setError(msg);
          toast.warning("Update checking not available", {
            description: "Auto-update is not supported in this environment",
          });
          return;
        }

        setError(null);
        const result = await globalThis.electronUpdater.checkForUpdates({
          allowPrerelease,
        });

        if (
          result.updateAvailable &&
          result.version &&
          result.releaseNotes &&
          result.releaseDate
        ) {
          // Don't show notification if this version was dismissed
          if (!isVersionDismissed(result.version)) {
            setUpdateAvailable(true);
            setUpdateInfo({
              version: result.version,
              releaseNotes: result.releaseNotes,
              releaseDate: result.releaseDate,
            });
            toast.info(`Update available: v${result.version}`, {
              description: "A new version is ready to download",
            });
          }
        } else {
          toast.success("You're up to date!", {
            description: "No updates available",
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        toast.error("Failed to check for updates", {
          description: errorMessage,
        });
      }
    },
    [isVersionDismissed],
  );

  /**
   * Downloads the available update from the update server.
   * @throws Updates download state on failure, shows toast notification.
   * @source
   */
  const downloadUpdate = useCallback(async () => {
    try {
      if (!globalThis.electronUpdater?.downloadUpdate) {
        const msg = "Download not available";
        console.warn(`[useAutoUpdater] ${msg}`);
        setError(msg);
        toast.error("Download failed", {
          description: "Update download is not supported in this environment",
        });
        return;
      }

      setError(null);
      setIsDownloading(true);
      await globalThis.electronUpdater.downloadUpdate();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setIsDownloading(false);
      toast.error("Failed to download update", {
        description: errorMessage,
      });
    }
  }, []);

  /**
   * Installs the downloaded update and restarts the application.
   * @source
   */
  const installUpdate = useCallback(async () => {
    try {
      // Defensive guard: check if electronUpdater is available
      if (!globalThis.electronUpdater?.installUpdate) {
        const msg = "Installation not available";
        console.warn(`[useAutoUpdater] ${msg}`);
        setError(msg);
        toast.error("Installation failed", {
          description:
            "Update installation is not supported in this environment",
        });
        return;
      }

      setError(null);
      await globalThis.electronUpdater.installUpdate();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      toast.error("Failed to install update", {
        description: errorMessage,
      });
    }
  }, []);

  /**
   * Dismisses the current update notification and resets all update state.
   * Adds the dismissed version to permanent dismissal list in storage.
   * @source
   */
  const dismissUpdate = useCallback(() => {
    if (updateInfo) {
      dismissVersion(updateInfo.version);
    }
    setUpdateAvailable(false);
    setUpdateInfo(null);
    setDownloadProgress(0);
    setIsDownloading(false);
    setIsDownloaded(false);
    setError(null);
  }, [updateInfo, dismissVersion]);

  // Set up event listeners
  useEffect(() => {
    if (!globalThis.electronUpdater) {
      console.warn(
        "[useAutoUpdater] electronUpdater not available, skipping event subscriptions",
      );
      return;
    }

    const unsubscribeAvailable = globalThis.electronUpdater.onUpdateAvailable?.(
      (info) => {
        if (!isVersionDismissed(info.version)) {
          setUpdateAvailable(true);
          setUpdateInfo(info);
          toast.info(`Update available: v${info.version}`, {
            description: "A new version is ready to download",
          });
        }
      },
    );

    const unsubscribeProgress = globalThis.electronUpdater.onDownloadProgress?.(
      (progress) => {
        setDownloadProgress(progress.percent);
      },
    );

    const unsubscribeDownloaded =
      globalThis.electronUpdater.onUpdateDownloaded?.((info) => {
        setIsDownloading(false);
        setIsDownloaded(true);
        toast.success(`Update downloaded: v${info.version}`, {
          description: "Ready to install",
          action: {
            label: "Install Now",
            onClick: () => {
              installUpdate();
            },
          },
        });
      });

    const unsubscribeError = globalThis.electronUpdater.onUpdateError?.(
      (err) => {
        setError(err.message);
        setIsDownloading(false);
        toast.error("Update error", {
          description: err.message,
        });
      },
    );

    // Clean up subscriptions on unmount
    return () => {
      unsubscribeAvailable?.();
      unsubscribeProgress?.();
      unsubscribeDownloaded?.();
      unsubscribeError?.();
    };
  }, [isVersionDismissed, installUpdate]);

  return {
    updateAvailable,
    updateInfo,
    downloadProgress,
    isDownloading,
    isDownloaded,
    error,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  };
}
