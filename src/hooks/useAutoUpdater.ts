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
 * Update information returned from the update server
 */
interface UpdateInfo {
  version: string;
  releaseNotes: string;
  releaseDate: string;
}

/**
 * Hook for managing auto-update functionality.
 * Provides state and methods for checking, downloading, and installing updates.
 *
 * @returns Object containing update state and control methods
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
   * Check for available updates with optional prerelease support
   */
  const checkForUpdates = useCallback(
    async (allowPrerelease = false) => {
      try {
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
   * Download the available update
   */
  const downloadUpdate = useCallback(async () => {
    try {
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
   * Install the downloaded update and restart the app
   */
  const installUpdate = useCallback(async () => {
    try {
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
   * Dismiss the current update notification
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
    const unsubscribeAvailable = globalThis.electronUpdater.onUpdateAvailable(
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

    const unsubscribeProgress = globalThis.electronUpdater.onDownloadProgress(
      (progress) => {
        setDownloadProgress(progress.percent);
      },
    );

    const unsubscribeDownloaded = globalThis.electronUpdater.onUpdateDownloaded(
      (info) => {
        setIsDownloading(false);
        setIsDownloaded(true);
        toast.success(`Update downloaded: v${info.version}`, {
          description: "Ready to install",
          action: {
            label: "Install Now",
            onClick: () => {
              void installUpdate();
            },
          },
        });
      },
    );

    const unsubscribeError = globalThis.electronUpdater.onUpdateError((err) => {
      setError(err.message);
      setIsDownloading(false);
      toast.error("Update error", {
        description: err.message,
      });
    });

    // Clean up subscriptions on unmount
    return () => {
      unsubscribeAvailable();
      unsubscribeProgress();
      unsubscribeDownloaded();
      unsubscribeError();
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
