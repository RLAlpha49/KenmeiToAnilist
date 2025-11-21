/**
 * @packageDocumentation
 * @module BackupRestoreSection
 * @description Backup and restore section for the Data tab - unified backup management with location configuration and file browser.
 */

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Folder,
  Trash2,
  Loader2,
  AlertTriangle,
  FolderOpen,
  Clock,
  FileJson,
  History,
  Save,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { highlightText, truncateToastMessage } from "@/utils/text-highlight";
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
  isShowingAllBackups: boolean;
  isRestoringFromList: string | null;
  isDeletingBackup: string | null;
  onRestore: (backup: BackupFile) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
  onToggleShowAll: () => void;
}

function BackupList({
  backups,
  isShowingAllBackups,
  isRestoringFromList,
  isDeletingBackup,
  onRestore,
  onDelete,
  onToggleShowAll,
}: Readonly<BackupListProps>) {
  return (
    <div className="space-y-2">
      {backups.slice(0, isShowingAllBackups ? undefined : 4).map((backup) => (
        <div
          key={backup.name}
          className="hover:bg-muted/60 group flex items-center justify-between rounded-lg border border-transparent p-3 transition-all hover:border-slate-200 dark:hover:border-slate-800"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <FileJson className="text-muted-foreground h-4 w-4" />
              <p className="truncate text-sm font-medium">
                {new Date(backup.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 pl-6">
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-normal"
              >
                {(backup.size / 1024 / 1024).toFixed(2)} MB
              </Badge>
              <span className="text-muted-foreground truncate text-xs opacity-60">
                {backup.name}
              </span>
            </div>
          </div>
          <div className="ml-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              onClick={() => onRestore(backup)}
              disabled={isRestoringFromList === backup.name}
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Restore from this backup"
            >
              {isRestoringFromList === backup.name ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              onClick={() => onDelete(backup.name)}
              disabled={isDeletingBackup === backup.name}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
              title="Delete this backup"
            >
              {isDeletingBackup === backup.name ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      ))}

      {backups.length > 3 && (
        <Button
          onClick={onToggleShowAll}
          variant="ghost"
          className="w-full text-xs"
          size="sm"
        >
          {isShowingAllBackups
            ? "Show Less"
            : formatMoreBackupsLabel(backups.length - 4)}
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
  readonly isShowingAllBackups: boolean;
  readonly isRestoringFromList: string | null;
  readonly isDeletingBackup: string | null;
  readonly onRestore: (backup: BackupFile) => Promise<void>;
  readonly onDelete: (filename: string) => Promise<void>;
  readonly onToggleShowAll: () => void;
}

function BackupListContent({
  isLoading,
  backups,
  isShowingAllBackups,
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
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <History className="text-muted-foreground/30 mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">No backups available</p>
        <p className="text-muted-foreground text-xs">
          Create a backup to get started
        </p>
      </div>
    );
  }

  return (
    <BackupList
      backups={backups}
      isShowingAllBackups={isShowingAllBackups}
      isRestoringFromList={isRestoringFromList}
      isDeletingBackup={isDeletingBackup}
      onRestore={onRestore}
      onDelete={onDelete}
      onToggleShowAll={onToggleShowAll}
    />
  );
}

interface BackupScheduleCardProps {
  searchQuery: string;
  scheduleConfig: BackupScheduleConfig;
  onScheduleConfigChange: (config: BackupScheduleConfig) => void;
  lastScheduledBackup: number | null;
  nextScheduledBackup: number | null;
  isTriggeringBackup: boolean;
  onTriggerBackup: () => void;
}

function BackupScheduleCard({
  searchQuery,
  scheduleConfig,
  onScheduleConfigChange,
  lastScheduledBackup,
  nextScheduledBackup,
  isTriggeringBackup,
  onTriggerBackup,
}: Readonly<BackupScheduleCardProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-violet-500" />
              {searchQuery
                ? highlightText("Backup Schedule", searchQuery)
                : "Backup Schedule"}
            </CardTitle>
            <CardDescription>
              {searchQuery
                ? highlightText(
                    "Configure automatic backups and retention",
                    searchQuery,
                  )
                : "Configure automatic backups and retention"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable Schedule Toggle */}
          <div className="shadow-xs flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="schedule-enabled" className="text-sm font-medium">
                Enable automatic scheduled backups
              </Label>
              <p className="text-muted-foreground text-xs">
                Create backups automatically at regular intervals
              </p>
            </div>
            <input
              id="schedule-enabled"
              type="checkbox"
              className="border-primary text-primary focus:ring-ring h-4 w-4 rounded focus:ring-2"
              checked={scheduleConfig.enabled}
              onChange={(e) =>
                onScheduleConfigChange({
                  ...scheduleConfig,
                  enabled: e.target.checked,
                })
              }
            />
          </div>

          {/* Auto-backup before operations */}
          <div className="space-y-3 pl-1">
            <div className="flex items-center gap-2">
              <input
                id="auto-backup-sync"
                type="checkbox"
                className="border-primary text-primary focus:ring-ring h-4 w-4 rounded focus:ring-2"
                checked={scheduleConfig.autoBackupBeforeSync}
                onChange={(e) =>
                  onScheduleConfigChange({
                    ...scheduleConfig,
                    autoBackupBeforeSync: e.target.checked,
                  })
                }
              />
              <Label htmlFor="auto-backup-sync" className="text-sm font-normal">
                Backup before sync operations
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="auto-backup-match"
                type="checkbox"
                className="border-primary text-primary focus:ring-ring h-4 w-4 rounded focus:ring-2"
                checked={scheduleConfig.autoBackupBeforeMatch}
                onChange={(e) =>
                  onScheduleConfigChange({
                    ...scheduleConfig,
                    autoBackupBeforeMatch: e.target.checked,
                  })
                }
              />
              <Label
                htmlFor="auto-backup-match"
                className="text-sm font-normal"
              >
                Backup before matching operations
              </Label>
            </div>
          </div>

          {/* Interval Selector */}
          {scheduleConfig.enabled && (
            <div className="animate-in slide-in-from-top-2 space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4 duration-200 dark:border-slate-800 dark:bg-slate-900/20">
              <div className="space-y-2">
                <Label
                  htmlFor="backup-interval"
                  className="text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  Frequency
                </Label>
                <select
                  id="backup-interval"
                  aria-describedby="backup-interval-desc"
                  value={scheduleConfig.interval}
                  onChange={(e) =>
                    onScheduleConfigChange({
                      ...scheduleConfig,
                      interval: e.target.value as
                        | "daily"
                        | "weekly"
                        | "monthly",
                    })
                  }
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Retention Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="max-backup-count"
                    className="text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Retention
                  </Label>
                  <div className="relative">
                    <Input
                      id="max-backup-count"
                      type="number"
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
                      className="pr-12"
                    />
                    <span className="text-muted-foreground pointer-events-none absolute right-3 top-2.5 text-xs">
                      files
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="max-backup-size"
                    className="text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Size Limit
                  </Label>
                  <div className="relative">
                    <Input
                      id="max-backup-size"
                      type="number"
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
                      className="pr-10"
                    />
                    <span className="text-muted-foreground pointer-events-none absolute right-3 top-2.5 text-xs">
                      MB
                    </span>
                  </div>
                </div>
              </div>

              {/* Schedule Status Display */}
              {(lastScheduledBackup || nextScheduledBackup) && (
                <div className="mt-2 rounded border border-slate-100 bg-white p-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  {lastScheduledBackup && (
                    <div className="flex justify-between">
                      <span>Last backup:</span>
                      <span className="font-medium">
                        {new Date(lastScheduledBackup).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {nextScheduledBackup && (
                    <div className="flex justify-between">
                      <span>Next backup:</span>
                      <span className="font-medium">
                        {new Date(nextScheduledBackup).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                <Save className="mr-2 h-4 w-4" />
                Run Backup Now
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface BackupLocationCardProps {
  searchQuery: string;
  backupLocation: string;
  resolvedDefaultBackupLocation: string;
  onBackupLocationChange: (newLocation: string) => void;
  onOpenBackupLocation: () => void;
}

function BackupLocationCard({
  searchQuery,
  backupLocation,
  resolvedDefaultBackupLocation,
  onBackupLocationChange,
  onOpenBackupLocation,
}: Readonly<BackupLocationCardProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Folder className="h-4 w-4 text-blue-500" />
              {searchQuery
                ? highlightText("Backup Location", searchQuery)
                : "Backup Location"}
            </CardTitle>
            <CardDescription>
              {searchQuery
                ? highlightText("Where to save your backup files", searchQuery)
                : "Where to save your backup files"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              id="backup-location"
              type="text"
              aria-describedby="backup-location-desc"
              value={backupLocation}
              onChange={(e) => onBackupLocationChange(e.target.value)}
              placeholder="Enter backup directory path..."
              className="flex-1"
            />
            <Button
              onClick={onOpenBackupLocation}
              variant="outline"
              size="icon"
              title="Open backup location in file browser"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <p
            id="backup-location-desc"
            className="text-muted-foreground truncate text-xs"
          >
            {backupLocation ||
              `Default: ${resolvedDefaultBackupLocation || "Loading..."}`}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface RestoreFromFileCardProps {
  searchQuery: string;
  selectedBackupFile: File | null;
  isRestoringBackup: boolean;
  backupValidationError: string | null;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRestoreBackup: () => void;
}

function RestoreFromFileCard({
  searchQuery,
  selectedBackupFile,
  isRestoringBackup,
  backupValidationError,
  onFileSelect,
  onRestoreBackup,
}: Readonly<RestoreFromFileCardProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-purple-500" />
              {searchQuery
                ? highlightText("Restore from Backup", searchQuery)
                : "Restore from Backup"}
            </CardTitle>
            <CardDescription>
              {searchQuery
                ? highlightText(
                    "Import and restore all data from a backup file",
                    searchQuery,
                  )
                : "Import and restore all data from a backup file"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
              className={cn(
                "hover:bg-muted/60 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all",
                selectedBackupFile
                  ? "border-purple-500/50 bg-purple-50/50 dark:border-purple-400/30 dark:bg-purple-900/10"
                  : "border-slate-200 hover:border-purple-400/50 dark:border-slate-700",
              )}
            >
              <Upload
                className={cn(
                  "mb-2 h-8 w-8 transition-colors",
                  selectedBackupFile
                    ? "text-purple-500"
                    : "text-muted-foreground",
                )}
              />
              <span className="text-sm font-medium">
                {selectedBackupFile
                  ? selectedBackupFile.name
                  : "Choose backup file or drag and drop"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Supports .json backup files
              </span>
            </label>
          </div>

          {selectedBackupFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <Button
                onClick={onRestoreBackup}
                disabled={isRestoringBackup}
                aria-busy={isRestoringBackup}
                className="w-full"
              >
                {isRestoringBackup ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Restore Selected File
                  </>
                )}
              </Button>
            </motion.div>
          )}

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
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface AvailableBackupsCardProps {
  searchQuery: string;
  localBackups: BackupFile[];
  isLoadingBackups: boolean;
  isRefreshCooldownActive: boolean;
  isShowingAllBackups: boolean;
  isRestoringFromList: string | null;
  isDeletingBackup: string | null;
  onRefreshBackups: () => void;
  onToggleShowAll: () => void;
  onRestoreFromList: (backup: BackupFile) => Promise<void>;
  onDeleteBackup: (filename: string) => Promise<void>;
}

function AvailableBackupsCard({
  searchQuery,
  localBackups,
  isLoadingBackups,
  isRefreshCooldownActive,
  isShowingAllBackups,
  isRestoringFromList,
  isDeletingBackup,
  onRefreshBackups,
  onToggleShowAll,
  onRestoreFromList,
  onDeleteBackup,
}: Readonly<AvailableBackupsCardProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-blue-500" />
                {searchQuery
                  ? highlightText("Available Backups", searchQuery)
                  : "Available Backups"}
              </CardTitle>
              <CardDescription>
                {searchQuery
                  ? highlightText(
                      "Manage and restore from previous backups",
                      searchQuery,
                    )
                  : "Manage and restore from previous backups"}
              </CardDescription>
            </div>
            <Button
              onClick={onRefreshBackups}
              disabled={isLoadingBackups || isRefreshCooldownActive}
              aria-busy={isLoadingBackups}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Refresh backup list"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isLoadingBackups && "animate-spin",
                  !isLoadingBackups && "text-muted-foreground",
                )}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="max-h-[400px] overflow-y-auto pr-1">
            <BackupListContent
              isLoading={isLoadingBackups}
              backups={localBackups}
              isShowingAllBackups={isShowingAllBackups}
              isRestoringFromList={isRestoringFromList}
              isDeletingBackup={isDeletingBackup}
              onRestore={onRestoreFromList}
              onDelete={onDeleteBackup}
              onToggleShowAll={onToggleShowAll}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
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
  const [isRefreshCooldownActive, setIsRefreshCooldownActive] = useState(false);
  const [resolvedDefaultBackupLocation, setResolvedDefaultBackupLocation] =
    useState<string>("");
  const [isContextMissing, setIsContextMissing] = useState(false);
  const [isShowingAllBackups, setIsShowingAllBackups] = useState(false);
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
    setIsRefreshCooldownActive(true);
    refreshCooldownRef.current = setTimeout(() => {
      setIsRefreshCooldownActive(false);
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
        let friendlyMessage = errorMsg;

        // Map error codes to friendly messages
        if (result?.code === "ENOENT") {
          friendlyMessage = "Directory does not exist";
        } else if (result?.code === "EACCES") {
          friendlyMessage = "Permission denied";
        } else if (result?.code === "INVALID_PATH") {
          friendlyMessage = "Invalid backup location path";
        }

        console.error(
          "[BackupRestoreSection] Failed to set backup location:",
          result?.error,
        );
        toast.error(friendlyMessage);
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
    <div id="data-backup" className="space-y-6" aria-busy={isLoadingBackups}>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Configuration & Actions */}
        <div className="space-y-6">
          <BackupScheduleCard
            searchQuery={searchQuery}
            scheduleConfig={scheduleConfig}
            onScheduleConfigChange={onScheduleConfigChange}
            lastScheduledBackup={lastScheduledBackup}
            nextScheduledBackup={nextScheduledBackup}
            isTriggeringBackup={isTriggeringBackup}
            onTriggerBackup={onTriggerBackup}
          />

          <BackupLocationCard
            searchQuery={searchQuery}
            backupLocation={scheduleConfig.backupLocation}
            resolvedDefaultBackupLocation={resolvedDefaultBackupLocation}
            onBackupLocationChange={handleBackupLocationChange}
            onOpenBackupLocation={handleOpenBackupLocation}
          />
        </div>

        {/* Right Column: Restore & History */}
        <div className="space-y-6">
          <RestoreFromFileCard
            searchQuery={searchQuery}
            selectedBackupFile={selectedBackupFile}
            isRestoringBackup={isRestoringBackup}
            backupValidationError={backupValidationError}
            onFileSelect={onFileSelect}
            onRestoreBackup={onRestoreBackup}
          />

          <AvailableBackupsCard
            searchQuery={searchQuery}
            localBackups={localBackups}
            isLoadingBackups={isLoadingBackups}
            isRefreshCooldownActive={isRefreshCooldownActive}
            isShowingAllBackups={isShowingAllBackups}
            isRestoringFromList={isRestoringFromList}
            isDeletingBackup={isDeletingBackup}
            onRefreshBackups={handleRefreshBackups}
            onToggleShowAll={() => setIsShowingAllBackups(!isShowingAllBackups)}
            onRestoreFromList={handleRestoreFromList}
            onDeleteBackup={handleDeleteBackup}
          />
        </div>
      </div>
    </div>
  );
}
