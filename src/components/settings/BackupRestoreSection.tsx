/**
 * @packageDocumentation
 * @module BackupRestoreSection
 * @description Backup and restore section for the Data tab - unified backup management with location configuration and file browser.
 */

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Upload,
  Folder,
  Trash2,
  Loader2,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { highlightText, truncateToastMessage } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";
import type { BackupScheduleConfig } from "@/utils/storage";

// Helper functions
function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value || min));
}

function parseBackupCount(input: string): number {
  const value = input ? Number.parseInt(input, 10) : 1;
  return clampValue(value, 1, 50);
}

function parseBackupSize(input: string): number {
  const value = input ? Number.parseInt(input, 10) : 100;
  return clampValue(value, 10, 1000);
}

function formatBackupCountText(count: number): string {
  return `${count} backup file${count === 1 ? "" : "s"}`;
}

function formatMoreBackupsLabel(count: number): string {
  return `Show ${count} More Backup${count === 1 ? "" : "s"}`;
}

/**
 * Represents a backup file with metadata.
 * @source
 */
interface BackupFile {
  /** Backup filename. */
  name: string;
  /** Timestamp when backup was created. */
  timestamp: number;
  /** Backup file size in bytes. */
  size: number;
}

/**
 * Props for BackupList component.
 */
interface BackupListProps {
  backups: BackupFile[];
  showAll: boolean;
  isRestoringFromList: string | null;
  isDeletingBackup: string | null;
  onRestore: (backup: BackupFile) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
  onToggleShowAll: () => void;
}

function BackupList({
  backups,
  showAll,
  isRestoringFromList,
  isDeletingBackup,
  onRestore,
  onDelete,
  onToggleShowAll,
}: Readonly<BackupListProps>) {
  return (
    <div className="space-y-2">
      {backups
        .slice(0, showAll ? undefined : 2)
        .map((backup) => (
          <div
            key={backup.name}
            className="hover:bg-muted/60 flex items-center justify-between rounded-md p-3 transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">
                {new Date(backup.timestamp).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {(backup.size / 1024 / 1024).toFixed(2)} MB
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {backup.name}
                </span>
              </div>
            </div>
            <div className="ml-2 flex gap-2">
              <Button
                onClick={() => onRestore(backup)}
                disabled={isRestoringFromList === backup.name}
                variant="outline"
                size="sm"
                title="Restore from this backup"
              >
                {isRestoringFromList === backup.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={() => onDelete(backup.name)}
                disabled={isDeletingBackup === backup.name}
                variant="ghost"
                size="sm"
                className="ml-2"
                title="Delete this backup"
              >
                {isDeletingBackup === backup.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}

      {backups.length > 2 && (
        <Button
          onClick={onToggleShowAll}
          variant="ghost"
          className="w-full"
          size="sm"
        >
          {showAll ? "Show Less" : formatMoreBackupsLabel(backups.length - 2)}
        </Button>
      )}
    </div>
  );
}

/**
 * Props for BackupListContent component.
 */
interface BackupListContentProps {
  readonly isLoading: boolean;
  readonly backups: BackupFile[];
  readonly showAll: boolean;
  readonly isRestoringFromList: string | null;
  readonly isDeletingBackup: string | null;
  readonly onRestore: (backup: BackupFile) => Promise<void>;
  readonly onDelete: (filename: string) => Promise<void>;
  readonly onToggleShowAll: () => void;
}

function BackupListContent({
  isLoading,
  backups,
  showAll,
  isRestoringFromList,
  isDeletingBackup,
  onRestore,
  onDelete,
  onToggleShowAll,
}: Readonly<BackupListContentProps>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No backups available yet. Create one to get started.
      </p>
    );
  }

  return (
    <BackupList
      backups={backups}
      showAll={showAll}
      isRestoringFromList={isRestoringFromList}
      isDeletingBackup={isDeletingBackup}
      onRestore={onRestore}
      onDelete={onDelete}
      onToggleShowAll={onToggleShowAll}
    />
  );
}

/**
 * Props for BackupRestoreSection component.
 * @source
 */
interface BackupRestoreSectionProps {
  /** Current search query for text highlighting. */
  searchQuery: string;
  /** ID of currently highlighted section. */
  highlightedSectionId: string | null;
  /** Backup schedule configuration. */
  scheduleConfig: BackupScheduleConfig;
  /** Timestamp of next scheduled backup. */
  nextScheduledBackup: number | null;
  /** Timestamp of last scheduled backup. */
  lastScheduledBackup: number | null;
  /** Whether a manual backup trigger is in progress. */
  isTriggeringBackup: boolean;
  /** Whether a backup restore operation is in progress. */
  isRestoringBackup: boolean;
  /** Currently selected backup file for restore. */
  selectedBackupFile: File | null;
  /** Error message if backup file validation fails. */
  backupValidationError: string | null;
  /** Callback when backup schedule config changes. */
  onScheduleConfigChange: (config: BackupScheduleConfig) => void;
  /** Callback to trigger manual backup. */
  onTriggerBackup: () => void;
  /** Callback to restore backup. */
  onRestoreBackup: () => void;
  /** Optional callback to restore from specific file. */
  onRestoreBackupFile?: (file: File) => void;
  /** Callback when backup file is selected. */
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Backup and restore section component.
 * Handles backup scheduling, location management, file browser, and restore operations.
 *
 * @source
 */
export function BackupRestoreSection({
  searchQuery,
  scheduleConfig,
  nextScheduledBackup,
  lastScheduledBackup,
  isTriggeringBackup,
  isRestoringBackup,
  selectedBackupFile,
  backupValidationError,
  onScheduleConfigChange,
  onTriggerBackup,
  onRestoreBackup,
  onFileSelect,
}: Readonly<BackupRestoreSectionProps>) {
  const [localBackups, setLocalBackups] = useState<BackupFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isDeletingBackup, setIsDeletingBackup] = useState<string | null>(null);
  const [isRestoringFromList, setIsRestoringFromList] = useState<string | null>(
    null,
  );
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const [resolvedDefaultBackupLocation, setResolvedDefaultBackupLocation] =
    useState<string>("");
  const [isContextMissing, setIsContextMissing] = useState(false);
  const [showAllBackups, setShowAllBackups] = useState(false);
  const refreshCooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if electronBackup context is missing on mount
  useEffect(() => {
    if (!globalThis.electronBackup) {
      setIsContextMissing(true);
      console.warn(
        "[BackupRestoreSection] electronBackup context is not available - preload may have failed",
      );
    }
  }, []);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (refreshCooldownRef.current) {
        clearTimeout(refreshCooldownRef.current);
      }
    };
  }, []);

  // Fetch the resolved default backup location on mount
  useEffect(() => {
    const fetchDefaultLocation = async () => {
      try {
        const result = await globalThis.electronBackup?.getBackupLocation?.();
        if (result?.success && result.data) {
          setResolvedDefaultBackupLocation(result.data);
        } else if (!result?.success) {
          console.error(
            "[BackupRestoreSection] Error fetching backup location:",
            result?.error,
          );
          toast.error("Failed to load backup location", {
            description: truncateToastMessage(
              result?.error || "Failed to load backup location",
              200,
            ).component,
          });
        }
      } catch (error) {
        console.error(
          "[BackupRestoreSection] Error fetching backup location:",
          error,
        );
        toast.error("Failed to load backup location", {
          description: truncateToastMessage(
            "Failed to load backup location",
            200,
          ).component,
        });
      }
    };
    void fetchDefaultLocation();
  }, []);

  // Load backups from the configured location
  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const result = await globalThis.electronBackup?.listLocalBackups?.();
      if (result?.success && result.data) {
        setLocalBackups(result.data);
      } else if (!result?.success) {
        console.error(
          "[BackupRestoreSection] Error loading backups:",
          result?.error,
        );
      }
    } catch (error) {
      console.error("[BackupRestoreSection] Error loading backups:", error);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Debounced refresh handler with cooldown to prevent spam
  const handleRefreshBackups = async () => {
    if (refreshCooldownRef.current || isLoadingBackups) {
      return;
    }

    await loadBackups();

    // Set cooldown: disable button for 1000ms
    setRefreshCooldown(true);
    refreshCooldownRef.current = setTimeout(() => {
      setRefreshCooldown(false);
      refreshCooldownRef.current = null;
    }, 1000);
  };

  // Load backups on mount and when backup location changes
  useEffect(() => {
    loadBackups();
  }, [scheduleConfig.backupLocation]);

  // Listen for backup history updates
  useEffect(() => {
    const cleanup = globalThis.electronBackup?.onHistoryUpdated?.(() => {
      loadBackups();
    });
    return () => {
      cleanup?.();
    };
  }, []);

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Delete backup "${filename}"?`)) {
      return;
    }

    setIsDeletingBackup(filename);
    try {
      const result = await globalThis.electronBackup?.deleteBackup?.(filename);
      if (result?.success) {
        // Reload backups after deletion
        await loadBackups();
        toast.success("Backup deleted successfully");
      } else {
        const errorMsg = result?.error || "Failed to delete backup";
        console.error(
          "[BackupRestoreSection] Failed to delete backup:",
          result?.error,
        );
        toast.error("Failed to delete backup", {
          description: truncateToastMessage(errorMsg, 200).component,
        });
      }
    } catch (error) {
      console.error("[BackupRestoreSection] Error deleting backup:", error);
      toast.error("Error deleting backup");
    } finally {
      setIsDeletingBackup(null);
    }
  };

  const handleRestoreFromList = async (backup: BackupFile) => {
    if (
      !confirm(
        `Restore from "${new Date(backup.timestamp).toLocaleString()}"?\n\nWarning: This will overwrite your current data. Make sure you have a backup first.`,
      )
    ) {
      return;
    }

    setIsRestoringFromList(backup.name);
    try {
      // Call the main process restore IPC directly instead of reconstructing a File object
      const result = await globalThis.electronBackup?.restoreFromLocal?.(
        backup.name,
        { merge: false },
      );

      if (result?.success) {
        // Trigger the restore workflow with the result
        onRestoreBackup();
        toast.success("Backup restored successfully. App will reload...");
        // Reload backups and clear temp state
        setTimeout(() => {
          loadBackups();
        }, 1000);
      } else {
        const errorMsg =
          result?.errors?.join(", ") || "Failed to restore backup";
        console.error("[BackupRestoreSection] Restore failed:", result?.errors);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error("[BackupRestoreSection] Error restoring from list:", error);
      toast.error("Error restoring backup");
    } finally {
      setIsRestoringFromList(null);
    }
  };

  const handleOpenBackupLocation = async () => {
    try {
      const result = await globalThis.electronBackup?.openBackupLocation?.();
      if (!result?.success) {
        const errorMsg = result?.error || "Failed to open backup location";
        console.error(
          "[BackupRestoreSection] Error opening backup location:",
          result?.error,
        );
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error(
        "[BackupRestoreSection] Error opening backup location:",
        error,
      );
      toast.error("Error opening backup location");
    }
  };

  const handleBackupLocationChange = async (newLocation: string) => {
    try {
      const result =
        await globalThis.electronBackup?.setBackupLocation?.(newLocation);
      if (result?.success) {
        onScheduleConfigChange({
          ...scheduleConfig,
          backupLocation: newLocation,
        });
        // Reload backups from new location
        await loadBackups();
        toast.success("Backup location updated");
      } else {
        const errorMsg = result?.error || "Failed to set backup location";
        let friendlyMsg = errorMsg;

        // Map error codes to friendly messages
        if (result?.code === "ENOENT") {
          friendlyMsg = "Directory does not exist";
        } else if (result?.code === "EACCES") {
          friendlyMsg = "Permission denied";
        } else if (result?.code === "INVALID_PATH") {
          friendlyMsg = "Invalid backup location path";
        }

        console.error(
          "[BackupRestoreSection] Failed to set backup location:",
          result?.error,
        );
        toast.error(friendlyMsg);
      }
    } catch (error) {
      console.error(
        "[BackupRestoreSection] Error setting backup location:",
        error,
      );
      toast.error("Error setting backup location");
    }
  };

  return (
    <div id="data-backup" className="space-y-4" aria-busy={isLoadingBackups}>
      {/* Context Missing Warning */}
      {isContextMissing && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm">
            <p className="font-medium text-red-900 dark:text-red-300">
              Backup features unavailable
            </p>
            <p className="mt-1 text-xs text-red-800 dark:text-red-400">
              The backup context failed to expose. Preload may have failed to
              initialize properly.
            </p>
          </div>
        </div>
      )}

      {/* Backup Schedule Section */}
      <motion.div
        className={cn("bg-muted/40 space-y-4 rounded-xl border p-4")}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4 text-violet-500" />
            {searchQuery
              ? highlightText("Backup Schedule", searchQuery)
              : "Backup Schedule"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText(
                  "Configure automatic backups and backup location",
                  searchQuery,
                )
              : "Configure automatic backups and backup location"}
          </p>
        </div>

        <Separator />

        {/* Enable Schedule Toggle */}
        <label
          className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
          htmlFor="schedule-enabled"
          aria-label="Enable scheduled backups"
        >
          <input
            id="schedule-enabled"
            type="checkbox"
            className="border-primary text-primary h-4 w-4 rounded"
            checked={scheduleConfig.enabled}
            onChange={(e) =>
              onScheduleConfigChange({
                ...scheduleConfig,
                enabled: e.target.checked,
              })
            }
          />
          <div>
            <span className="text-sm font-medium">
              Enable automatic scheduled backups
            </span>
            <p className="text-muted-foreground text-xs">
              Create backups automatically at regular intervals
            </p>
          </div>
        </label>

        {/* Auto-backup before operations */}
        <label
          className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
          htmlFor="auto-backup-sync"
          aria-label="Auto-backup before sync"
        >
          <input
            id="auto-backup-sync"
            type="checkbox"
            className="border-primary text-primary h-4 w-4 rounded"
            checked={scheduleConfig.autoBackupBeforeSync}
            onChange={(e) =>
              onScheduleConfigChange({
                ...scheduleConfig,
                autoBackupBeforeSync: e.target.checked,
              })
            }
          />
          <div>
            <span className="text-sm font-medium">
              Auto-backup before sync operations
            </span>
            <p className="text-muted-foreground text-xs">
              Automatically create a backup before starting sync
            </p>
          </div>
        </label>

        <label
          className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
          htmlFor="auto-backup-match"
          aria-label="Auto-backup before matching"
        >
          <input
            id="auto-backup-match"
            type="checkbox"
            className="border-primary text-primary h-4 w-4 rounded"
            checked={scheduleConfig.autoBackupBeforeMatch}
            onChange={(e) =>
              onScheduleConfigChange({
                ...scheduleConfig,
                autoBackupBeforeMatch: e.target.checked,
              })
            }
          />
          <div>
            <span className="text-sm font-medium">
              Auto-backup before matching operations
            </span>
            <p className="text-muted-foreground text-xs">
              Automatically create a backup before starting match
            </p>
          </div>
        </label>

        {/* Interval Selector */}
        {scheduleConfig.enabled && (
          <div className="space-y-3">
            <div>
              <label htmlFor="backup-interval" className="text-sm font-medium">
                Backup Interval
              </label>
              <select
                id="backup-interval"
                aria-describedby="backup-interval-desc"
                value={scheduleConfig.interval}
                onChange={(e) =>
                  onScheduleConfigChange({
                    ...scheduleConfig,
                    interval: e.target.value as "daily" | "weekly" | "monthly",
                  })
                }
                className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <p
                id="backup-interval-desc"
                className="text-muted-foreground mt-1 text-xs"
              >
                How often to automatically create backups
              </p>
            </div>

            {/* Retention Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="max-backup-count"
                  className="text-sm font-medium"
                >
                  Max Backups to Keep
                </label>
                <input
                  id="max-backup-count"
                  aria-describedby="max-backup-count-desc"
                  aria-invalid={
                    scheduleConfig.maxBackupCount < 1 ||
                    scheduleConfig.maxBackupCount > 50
                  }
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  value={scheduleConfig.maxBackupCount}
                  onChange={(e) => {
                    const clamped = parseBackupCount(e.target.value);
                    onScheduleConfigChange({
                      ...scheduleConfig,
                      maxBackupCount: clamped,
                    });
                  }}
                  className="border-input bg-background text-foreground aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-500 mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
                <p
                  id="max-backup-count-desc"
                  className="text-muted-foreground mt-1 text-xs"
                >
                  Number of backups to retain (1-50)
                </p>
              </div>
              <div>
                <label
                  htmlFor="max-backup-size"
                  className="text-sm font-medium"
                >
                  Max Size (MB)
                </label>
                <input
                  id="max-backup-size"
                  aria-describedby="max-backup-size-desc"
                  aria-invalid={
                    scheduleConfig.maxBackupSizeMB < 10 ||
                    scheduleConfig.maxBackupSizeMB > 1000
                  }
                  type="number"
                  inputMode="numeric"
                  min="10"
                  max="1000"
                  value={scheduleConfig.maxBackupSizeMB}
                  onChange={(e) => {
                    const clamped = parseBackupSize(e.target.value);
                    onScheduleConfigChange({
                      ...scheduleConfig,
                      maxBackupSizeMB: clamped,
                    });
                  }}
                  className="border-input bg-background text-foreground aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-500 mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
                <p
                  id="max-backup-size-desc"
                  className="text-muted-foreground mt-1 text-xs"
                >
                  Maximum backup file size to retain (10-1000 MB)
                </p>
              </div>
            </div>

            {/* Schedule Status Display */}
            {(lastScheduledBackup || nextScheduledBackup) && (
              <output className="block space-y-2" aria-live="polite">
                {lastScheduledBackup && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Last backup:</span>
                    <span className="ml-2 font-medium">
                      {new Date(lastScheduledBackup).toLocaleString()}
                    </span>
                  </div>
                )}
                {nextScheduledBackup && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Next backup:</span>
                    <span className="ml-2 font-medium">
                      {new Date(nextScheduledBackup).toLocaleString()}
                    </span>
                  </div>
                )}
              </output>
            )}

            {/* Manual Trigger Button */}
            <Button
              onClick={onTriggerBackup}
              disabled={isTriggeringBackup}
              aria-busy={isTriggeringBackup}
              aria-disabled={isTriggeringBackup}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {isTriggeringBackup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating backup...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Run Backup Now
                </>
              )}
            </Button>
          </div>
        )}
      </motion.div>

      {/* Backup Location Section */}
      <motion.div
        className="bg-muted/40 space-y-4 rounded-xl border p-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Folder className="h-4 w-4 text-blue-500" />
            {searchQuery
              ? highlightText("Backup Location", searchQuery)
              : "Backup Location"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText("Where to save your backup files", searchQuery)
              : "Where to save your backup files"}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <label htmlFor="backup-location" className="text-sm font-medium">
            Backup Directory
          </label>
          <div className="flex gap-2">
            <input
              id="backup-location"
              type="text"
              aria-describedby="backup-location-desc"
              value={scheduleConfig.backupLocation}
              onChange={(e) => handleBackupLocationChange(e.target.value)}
              placeholder="Enter backup directory path..."
              className="border-input bg-background text-foreground flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <Button
              onClick={handleOpenBackupLocation}
              variant="outline"
              size="sm"
              title="Open backup location in file browser"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <p
            id="backup-location-desc"
            className="text-muted-foreground text-xs"
          >
            {scheduleConfig.backupLocation
              ? scheduleConfig.backupLocation
              : `Default: ${resolvedDefaultBackupLocation || "Loading..."}`}
          </p>
        </div>
      </motion.div>

      {/* Available Backups Section */}
      <motion.div
        className="bg-muted/40 space-y-4 rounded-xl border p-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Download className="h-4 w-4 text-indigo-500" />
              {searchQuery
                ? highlightText("Available Backups", searchQuery)
                : "Available Backups"}
            </h3>
            <p className="text-muted-foreground text-xs">
              {searchQuery
                ? highlightText(
                    `${formatBackupCountText(localBackups.length)} available`,
                    searchQuery,
                  )
                : `${formatBackupCountText(localBackups.length)} available`}
            </p>
          </div>
          <Button
            onClick={handleRefreshBackups}
            disabled={isLoadingBackups || refreshCooldown}
            aria-busy={isLoadingBackups}
            aria-disabled={isLoadingBackups || refreshCooldown}
            variant="ghost"
            size="sm"
            title={
              refreshCooldown
                ? "Please wait before refreshing again"
                : "Refresh backup list"
            }
          >
            {isLoadingBackups ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>

        <Separator />

        <BackupListContent
          isLoading={isLoadingBackups}
          backups={localBackups}
          showAll={showAllBackups}
          isRestoringFromList={isRestoringFromList}
          isDeletingBackup={isDeletingBackup}
          onRestore={handleRestoreFromList}
          onDelete={handleDeleteBackup}
          onToggleShowAll={() => setShowAllBackups(!showAllBackups)}
        />
      </motion.div>

      {/* Restore from Backup Section */}
      <motion.div
        className="bg-muted/40 space-y-4 rounded-xl border p-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4 text-purple-500" />
            {searchQuery
              ? highlightText("Restore from Backup", searchQuery)
              : "Restore from Backup"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText(
                  "Import and restore all data from a backup file",
                  searchQuery,
                )
              : "Import and restore all data from a backup file"}
          </p>
        </div>

        <Separator />

        <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> Match results are merged when restoring
            (newer and unprocessed results are preserved), while other data is
            completely replaced.
          </p>
        </div>

        <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> Restoring from backup will overwrite
              your current data. Create a backup first if needed.
            </p>
          </div>
        </div>

        <div>
          <input
            type="file"
            id="backup-file-input"
            accept=".json"
            onChange={onFileSelect}
            className="hidden"
            aria-describedby="backup-file-desc"
          />
          <label
            htmlFor="backup-file-input"
            className="hover:bg-muted/60 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Upload className="text-muted-foreground mb-2 h-8 w-8" />
            <span className="text-sm font-medium">
              {selectedBackupFile
                ? selectedBackupFile.name
                : "Choose backup file or drag and drop"}
            </span>
            <span className="text-muted-foreground mt-1 text-xs">
              Supports .json backup files
            </span>
          </label>
          <p id="backup-file-desc" className="sr-only">
            Click to browse or press Enter/Space to select a backup file to
            restore.
          </p>
        </div>

        <Button
          onClick={onRestoreBackup}
          disabled={isRestoringBackup || !selectedBackupFile}
          aria-busy={isRestoringBackup}
          aria-disabled={isRestoringBackup || !selectedBackupFile}
          className="w-full"
        >
          {isRestoringBackup ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Restoring...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Restore Backup
            </>
          )}
        </Button>

        {backupValidationError && (
          <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">
                {backupValidationError}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
