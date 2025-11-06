/**
 * @packageDocumentation
 * @module backup_listeners
 * @description Registers IPC event listeners for backup-related actions in the Electron main process.
 */

import { BrowserWindow, app, shell } from "electron";
import { secureHandle } from "../listeners-register";
import { promises as fs } from "node:fs";
import path from "node:path";
import Store from "electron-store";
import type { BackupScheduleConfig } from "@/utils/storage";
import {
  createBackupFromData,
  BackupHistoryEntry,
  restoreBackup,
} from "@/utils/backup";
import { BACKUP_CHANNELS } from "./backup-channels";

/**
 * Storage keys for the main process backup store.
 * @source
 */
const MAIN_PROCESS_STORAGE_KEYS = {
  BACKUP_SCHEDULE_CONFIG: "backup_schedule_config",
  BACKUP_HISTORY: "backup_history",
} as const;

/**
 * Default backup schedule configuration used on first initialization.
 * @source
 */
const DEFAULT_BACKUP_SCHEDULE_CONFIG: BackupScheduleConfig = {
  enabled: false,
  interval: "daily",
  maxBackupCount: 10,
  maxBackupSizeMB: 100,
  lastBackupTimestamp: null,
  nextBackupTimestamp: null,
  backupLocation: "",
  autoBackupBeforeSync: false,
  autoBackupBeforeMatch: false,
};

/**
 * Schema for the electron-store backup store.
 * @source
 */
interface BackupStoreSchema {
  [MAIN_PROCESS_STORAGE_KEYS.BACKUP_SCHEDULE_CONFIG]: string;
  [MAIN_PROCESS_STORAGE_KEYS.BACKUP_HISTORY]: string;
}

/**
 * Typed interface for electron-store methods.
 * @source
 */
interface ElectronStoreInterface {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  clear(): void;
}

/**
 * Backup scheduler state tracking timeouts, intervals, and pending updates.
 * @source
 */
interface SchedulerState {
  timeoutId: NodeJS.Timeout | null;
  intervalId: NodeJS.Timeout | null;
  enabled: boolean;
  isRunning: boolean;
  updatePending: boolean;
  pendingConfig: BackupScheduleConfig | null;
}

const schedulerState: SchedulerState = {
  timeoutId: null,
  intervalId: null,
  enabled: false,
  isRunning: false,
  updatePending: false,
  pendingConfig: null,
};

/**
 * File operations mutex to serialize backup, rotation, and delete operations.
 * @source
 */
let fileOpsMutex: Promise<void> = Promise.resolve();

/**
 * Acquires the file operations mutex and returns a release function.
 * Serializes file operations to prevent race conditions.
 * @returns Promise resolving to a release function.
 * @source
 */
async function acquireFileOpsMutex(): Promise<() => void> {
  const currentMutex = fileOpsMutex;
  let releaseMutex: () => void = () => {};

  fileOpsMutex = new Promise((resolve) => {
    releaseMutex = resolve;
  });

  await currentMutex;
  return releaseMutex;
}

// Create store instance
const store =
  new Store<BackupStoreSchema>() as unknown as ElectronStoreInterface;

/**
 * Retrieves backup schedule configuration from the store.
 * @returns Configuration or defaults if not found.
 * @source
 */
function getStoredBackupScheduleConfig(): BackupScheduleConfig {
  try {
    const configJson = store.get(
      MAIN_PROCESS_STORAGE_KEYS.BACKUP_SCHEDULE_CONFIG,
    );
    if (!configJson) return DEFAULT_BACKUP_SCHEDULE_CONFIG;
    return JSON.parse(configJson as string) as BackupScheduleConfig;
  } catch (error) {
    console.error("[BackupIPC] Error retrieving stored config:", error);
    return DEFAULT_BACKUP_SCHEDULE_CONFIG;
  }
}

/**
 * Saves backup schedule configuration to the store.
 * @param config - Configuration to save.
 * @source
 */
function saveStoredBackupScheduleConfig(config: BackupScheduleConfig): void {
  try {
    store.set(
      MAIN_PROCESS_STORAGE_KEYS.BACKUP_SCHEDULE_CONFIG,
      JSON.stringify(config),
    );
  } catch (error) {
    console.error("[BackupIPC] Error saving config to store:", error);
  }
}

/**
 * Retrieves backup history from the store.
 * @returns History array sorted by timestamp (newest first), or empty if not found.
 * @source
 */
function getStoredBackupHistory(): BackupHistoryEntry[] {
  try {
    const historyJson = store.get(MAIN_PROCESS_STORAGE_KEYS.BACKUP_HISTORY);
    if (!historyJson) return [];
    const history = JSON.parse(historyJson as string) as BackupHistoryEntry[];
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("[BackupIPC] Error retrieving stored history:", error);
    return [];
  }
}

/**
 * Saves backup history to the store.
 * @param history - History array to save.
 * @source
 */
function saveStoredBackupHistory(history: BackupHistoryEntry[]): void {
  try {
    store.set(
      MAIN_PROCESS_STORAGE_KEYS.BACKUP_HISTORY,
      JSON.stringify(history),
    );
  } catch (error) {
    console.error("[BackupIPC] Error saving history to store:", error);
  }
}

/**
 * Adds entry to backup history and manages retention limit.
 * @param entry - Backup history entry to add.
 * @param maxRetention - Maximum history entries to keep.
 * @param mainWindow - Main window for sending notifications.
 * @source
 */
function addBackupToStoredHistory(
  entry: BackupHistoryEntry,
  maxRetention: number,
  mainWindow?: BrowserWindow | null,
): void {
  try {
    let history = getStoredBackupHistory();
    history = [entry, ...history];
    history = history.slice(0, Math.max(1, maxRetention));
    saveStoredBackupHistory(history);
    console.log("[BackupIPC] History updated, total backups:", history.length);

    // Notify renderer about history update
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(BACKUP_CHANNELS.ON_HISTORY_UPDATED);
    }
  } catch (error) {
    console.error("[BackupIPC] Failed to add entry to history:", error);
  }
}

/**
 * Reconciles backup history with existing files on disk.
 * Removes history entries for deleted backup files.
 * @param backupFilenames - Array of existing backup filenames.
 * @source
 */
function reconcileStoredHistory(backupFilenames: string[]): void {
  try {
    let history = getStoredBackupHistory();
    const originalCount = history.length;

    // Create a set of existing filenames for quick lookup
    const existingFilenamesSet = new Set(backupFilenames);

    // Filter history to only include backups whose stored filename exists
    // Fall back to filename reconstruction for old entries without stored filename
    history = history.filter((entry) => {
      if (entry.filename) {
        // Use stored filename if available
        return existingFilenamesSet.has(entry.filename);
      }
      // Fallback: reconstruct filename from timestamp for old entries
      const reconstructedFilename = `backup-${entry.timestamp}.json`;
      return existingFilenamesSet.has(reconstructedFilename);
    });

    if (history.length < originalCount) {
      console.log(
        `[BackupIPC] Reconciled history: removed ${originalCount - history.length} entries`,
      );
      saveStoredBackupHistory(history);
    }
  } catch (error) {
    console.error("[BackupIPC] Failed to reconcile history:", error);
  }
}

/**
 * Calculates interval in milliseconds based on the backup interval setting.
 * @param interval - Backup interval ('daily', 'weekly', 'monthly', 'disabled').
 * @returns Interval in milliseconds.
 * @source
 */
function calculateIntervalMs(interval: string): number {
  const intervals: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };
  return intervals[interval] || 0;
}

/**
 * Lists backup files in a directory.
 * @param backupDir - Path to the backups directory.
 * @returns Array of backup file information sorted by modification time (newest first).
 * @source
 */
async function listBackupFiles(
  backupDir: string,
): Promise<Array<{ name: string; path: string; size: number; mtime: number }>> {
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles: Array<{
      name: string;
      path: string;
      size: number;
      mtime: number;
    }> = [];

    for (const file of files) {
      if (file.startsWith("backup-") && file.endsWith(".json")) {
        const filePath = path.join(backupDir, file);
        const stat = await fs.stat(filePath);
        backupFiles.push({
          name: file,
          path: filePath,
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      }
    }

    return backupFiles.sort((a, b) => b.mtime - a.mtime);
  } catch (error) {
    console.error("[BackupIPC] Error listing backup files:", error);
    return [];
  }
}

/**
 * Performs backup rotation according to retention policy.
 * @param backupDir - Path to the backups directory.
 * @param config - Backup schedule configuration with retention limits.
 * @param mainWindow - Main window for sending notifications.
 * @source
 */
async function performRotation(
  backupDir: string,
  config: BackupScheduleConfig,
  mainWindow?: BrowserWindow | null,
): Promise<void> {
  try {
    const backupFiles = await listBackupFiles(backupDir);
    const filesToDelete: Array<{
      name: string;
      path: string;
      size: number;
      mtime: number;
    }> = [];

    if (backupFiles.length > config.maxBackupCount) {
      for (let i = config.maxBackupCount; i < backupFiles.length; i++) {
        filesToDelete.push(backupFiles[i]);
      }
    }

    let totalSize = backupFiles.reduce((sum, f) => sum + f.size, 0);
    const maxSizeBytes = config.maxBackupSizeMB * 1024 * 1024;
    let sizeIndex = config.maxBackupCount;

    while (totalSize > maxSizeBytes && sizeIndex < backupFiles.length) {
      const file = backupFiles[sizeIndex];
      totalSize -= file.size;
      if (!filesToDelete.includes(file)) {
        filesToDelete.push(file);
      }
      sizeIndex += 1;
    }

    for (const file of filesToDelete) {
      try {
        await fs.unlink(file.path);
        console.log("[BackupIPC] Deleted old backup:", file.name);
      } catch (deleteError) {
        console.error("[BackupIPC] Failed to delete backup file:", deleteError);
      }
    }

    const remainingFilenames = backupFiles
      .filter((f) => !filesToDelete.includes(f))
      .map((f) => f.name);
    reconcileStoredHistory(remainingFilenames);

    console.log(
      `[BackupIPC] Backup rotation complete. Remaining backups: ${remainingFilenames.length}`,
    );

    // Notify renderer that history was updated due to rotation
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(BACKUP_CHANNELS.ON_HISTORY_UPDATED);
      console.debug(
        "[BackupIPC] Sent ON_HISTORY_UPDATED notification to renderer after rotation",
      );
    }
  } catch (error) {
    console.error("[BackupIPC] Error during backup rotation:", error);
  }
}

/**
 * Performs backup logic shared by immediate and scheduled backups using file mutex.
 * @param mainWindow - Main window for sending notifications.
 * @param config - Current backup schedule configuration.
 * @param mode - Either 'immediate' or 'scheduled' for logging purposes.
 * @returns Backup result with success, backupId, and optional error.
 * @source
 */
async function performBackupWithMutex(
  mainWindow: BrowserWindow | null,
  config: BackupScheduleConfig,
  mode: "immediate" | "scheduled" = "immediate",
): Promise<{
  success: boolean;
  backupId?: string;
  error?: string;
}> {
  const release = await acquireFileOpsMutex();
  try {
    return await performBackup(mainWindow, config, mode);
  } finally {
    release();
  }
}

/**
 * Collects backupable data from the electron store.
 * @returns Object mapping storage keys to their stringified values.
 * @source
 */
function collectBackupData(): Record<string, string> {
  const backupableKeys = [
    "kenmei_data",
    "import_stats",
    "match_results",
    "pending_manga",
    "cache_version",
    "sync_config",
    "sync_stats",
    "match_config",
    "ignored_duplicates",
    "anilist_search_cache",
    "onboarding_completed",
  ];

  const dataMap: Record<string, string> = {};
  for (const key of backupableKeys) {
    const value = store.get(key);
    if (value !== undefined) {
      dataMap[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
  }
  return dataMap;
}

/**
 * Writes backup data to file and records in history.
 * @param backupDir - Path to the backups directory.
 * @param data - Backup data object.
 * @param backupId - Unique backup identifier.
 * @param size - Size of the backup.
 * @param appVersion - Application version string.
 * @param config - Backup schedule configuration.
 * @param mainWindow - Main window for sending notifications.
 * @source
 */
async function writeBackupAndRecordHistory(
  backupDir: string,
  data: unknown,
  backupId: string,
  size: number,
  appVersion: string,
  config: BackupScheduleConfig,
  mainWindow: BrowserWindow | null,
): Promise<void> {
  const timestamp = Date.now();
  const backupPath = path.join(
    backupDir,
    `backup-${timestamp}-${backupId}.json`,
  );

  await fs.writeFile(backupPath, JSON.stringify(data, null, 2));
  console.log(`[BackupIPC] Backup created: ${backupPath}`);

  // Extract metadata safely with type guards
  const metadata = (data as Record<string, unknown>).metadata as Record<
    string,
    unknown
  >;
  const dataKeys = Array.isArray(metadata.dataKeys) ? metadata.dataKeys : [];

  const historyEntry: BackupHistoryEntry = {
    id: backupId,
    timestamp,
    appVersion,
    dataKeys: dataKeys as string[],
    size,
    filename: `backup-${timestamp}-${backupId}.json`,
  };
  addBackupToStoredHistory(historyEntry, config.maxBackupCount, mainWindow);
}

/**
 * Updates backup schedule config with next run timestamp.
 * @param config - Current backup schedule configuration.
 * @param timestamp - Current timestamp for calculation.
 * @source
 */
function updateBackupScheduleConfig(
  config: BackupScheduleConfig,
  timestamp: number,
): void {
  const intervalMs = calculateIntervalMs(config.interval);
  const nextBackupTimestamp = timestamp + intervalMs;

  const updatedConfig: BackupScheduleConfig = {
    ...config,
    lastBackupTimestamp: timestamp,
    nextBackupTimestamp,
  };
  saveStoredBackupScheduleConfig(updatedConfig);
}

/**
 * Notifies renderer of successful backup completion.
 * @param mainWindow - Main window for sending notification.
 * @param backupId - Backup identifier.
 * @param timestamp - Backup creation timestamp.
 * @source
 */
function notifyBackupComplete(
  mainWindow: BrowserWindow | null,
  backupId: string,
  timestamp: number,
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(BACKUP_CHANNELS.ON_BACKUP_COMPLETE, {
      backupId,
      timestamp,
    });
  }
}

/**
 * Handles backup errors and notifies renderer.
 * @param mainWindow - Main window for sending error notification.
 * @param error - The error encountered.
 * @returns Error message string.
 * @source
 */
function handleBackupError(
  mainWindow: BrowserWindow | null,
  error: unknown,
): string {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.error("[BackupIPC] Error during backup:", error);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(BACKUP_CHANNELS.ON_BACKUP_ERROR, errorMessage);
  }
  return errorMessage;
}

/**
 * Performs backup logic for both immediate and scheduled backups.
 * Collects data, writes backup file, performs rotation, and emits events.
 * @param mainWindow - Main window for sending notifications.
 * @param config - Current backup schedule configuration.
 * @param mode - Either 'immediate' or 'scheduled' for logging purposes.
 * @returns Backup result with success, backupId, and optional error.
 * @source
 */
async function performBackup(
  mainWindow: BrowserWindow | null,
  config: BackupScheduleConfig,
  mode: "immediate" | "scheduled" = "immediate",
): Promise<{
  success: boolean;
  backupId?: string;
  error?: string;
}> {
  try {
    const logMode = mode === "immediate" ? "immediate" : "scheduled";
    console.log(`[BackupIPC] Performing ${logMode} backup...`);

    let backupDir = config.backupLocation || getDefaultBackupLocation();
    backupDir = ensureBackupLocationInitialized({
      ...config,
      backupLocation: backupDir,
    }).backupLocation;

    await fs.mkdir(backupDir, { recursive: true });

    // Collect all backupable data from electron-store
    const dataMap = collectBackupData();

    // Get the app version from Electron
    const appVersion = app.getVersion();
    const { data, backupId, size } = createBackupFromData(dataMap, appVersion);

    const timestamp = Date.now();

    // Write backup to file and record in history
    await writeBackupAndRecordHistory(
      backupDir,
      data as unknown,
      backupId,
      size,
      appVersion,
      config,
      mainWindow,
    );

    await performRotation(backupDir, config, mainWindow);

    // Update schedule config with next run time
    updateBackupScheduleConfig(config, timestamp);

    if (mode === "scheduled") {
      const intervalMs = calculateIntervalMs(config.interval);
      const nextBackupTimestamp = timestamp + intervalMs;
      console.log(
        "[BackupIPC] Updated config with next run at:",
        new Date(nextBackupTimestamp).toISOString(),
      );
    }

    // Notify renderer of successful backup
    notifyBackupComplete(mainWindow, backupId, timestamp);

    return { success: true, backupId };
  } catch (error) {
    const errorMessage = handleBackupError(mainWindow, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Creates an immediate backup outside the scheduled interval.
 * @param mainWindow - Main window for sending notifications.
 * @returns Backup result with success, backupId, and optional error.
 * @source
 */
async function createImmediateBackup(
  mainWindow: BrowserWindow | null,
): Promise<{
  success: boolean;
  backupId?: string;
  error?: string;
}> {
  if (schedulerState.isRunning) {
    console.warn("[BackupIPC] Backup already in progress");
    return {
      success: false,
      error: "Backup already in progress, please wait",
    };
  }

  schedulerState.isRunning = true;

  try {
    const config = getStoredBackupScheduleConfig();
    return await performBackupWithMutex(mainWindow, config, "immediate");
  } finally {
    schedulerState.isRunning = false;
  }
}

/**
 * Performs a scheduled backup and handles queued scheduler updates.
 * Implements mutex pattern to prevent race conditions.
 * @param mainWindow - Main window for sending notifications.
 * @param config - Current backup schedule configuration.
 * @source
 */
async function performScheduledBackup(
  mainWindow: BrowserWindow | null,
  config: BackupScheduleConfig,
): Promise<void> {
  if (schedulerState.isRunning) {
    console.warn("[BackupIPC] Backup already in progress, skipping");
    return;
  }

  schedulerState.isRunning = true;

  try {
    await performBackupWithMutex(mainWindow, config, "scheduled");
  } finally {
    schedulerState.isRunning = false;

    // If updateScheduler() was called while backup was running, process the pending update now
    // This ensures the scheduler always uses the latest configuration
    if (schedulerState.updatePending && schedulerState.pendingConfig) {
      console.log(
        "[BackupIPC] Processing pending scheduler update after backup completion",
      );
      const pendingConfig = schedulerState.pendingConfig;
      schedulerState.updatePending = false;
      schedulerState.pendingConfig = null;
      updateScheduler(mainWindow, pendingConfig);
    }
  }
}

/**
 * Validates backup schedule configuration values.
 * @param config - Configuration object to validate.
 * @returns Validation result with boolean valid flag and optional validated config or error.
 * @source
 */
function validateScheduleConfig(config: unknown): {
  valid: boolean;
  error?: string;
  validated?: BackupScheduleConfig;
} {
  if (!config || typeof config !== "object") {
    return { valid: false, error: "Config must be an object" };
  }

  const cfg = config as Record<string, unknown>;

  // Explicitly validate enabled as boolean
  if (typeof cfg.enabled !== "boolean") {
    return {
      valid: false,
      error: `Invalid enabled value. Must be a boolean, got ${typeof cfg.enabled}`,
    };
  }

  const validIntervals = ["daily", "weekly", "monthly"];
  if (!validIntervals.includes(cfg.interval as string)) {
    return {
      valid: false,
      error: `Invalid interval '${cfg.interval}'. Must be one of: ${validIntervals.join(", ")}`,
    };
  }

  let maxBackupCount = Number(cfg.maxBackupCount);
  if (!Number.isInteger(maxBackupCount)) {
    return { valid: false, error: "maxBackupCount must be an integer" };
  }
  maxBackupCount = Math.max(1, Math.min(50, maxBackupCount));

  let maxBackupSizeMB = Number(cfg.maxBackupSizeMB);
  if (!Number.isInteger(maxBackupSizeMB)) {
    return { valid: false, error: "maxBackupSizeMB must be an integer" };
  }
  maxBackupSizeMB = Math.max(10, Math.min(1000, maxBackupSizeMB));

  const validated: BackupScheduleConfig = {
    enabled: cfg.enabled,
    interval: cfg.interval as "daily" | "weekly" | "monthly",
    maxBackupCount,
    maxBackupSizeMB,
    lastBackupTimestamp:
      typeof cfg.lastBackupTimestamp === "number"
        ? cfg.lastBackupTimestamp
        : null,
    nextBackupTimestamp:
      typeof cfg.nextBackupTimestamp === "number"
        ? cfg.nextBackupTimestamp
        : null,
    backupLocation:
      typeof cfg.backupLocation === "string" ? cfg.backupLocation : "",
    autoBackupBeforeSync:
      typeof cfg.autoBackupBeforeSync === "boolean"
        ? cfg.autoBackupBeforeSync
        : false,
    autoBackupBeforeMatch:
      typeof cfg.autoBackupBeforeMatch === "boolean"
        ? cfg.autoBackupBeforeMatch
        : false,
  };

  return { valid: true, validated };
}

/**
 * Emits a status change event to the renderer with current backup scheduler status.
 * @param mainWindow - Main window for sending notification.
 * @source
 */
function emitStatusChanged(mainWindow: BrowserWindow | null): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const config = getStoredBackupScheduleConfig();
    mainWindow.webContents.send(BACKUP_CHANNELS.ON_STATUS_CHANGED, {
      isRunning: schedulerState.isRunning,
      lastBackup: config.lastBackupTimestamp,
      nextBackup: config.nextBackupTimestamp,
    });

    console.debug("[BackupIPC] Sent ON_STATUS_CHANGED notification");
  }
}

/**
 * Updates the backup scheduler with new configuration.
 * Implements mutex pattern to queue updates during active backups.
 * Separates timeout for initial run from interval for repeating runs.
 * @param mainWindow - Main window for sending notifications.
 * @param config - New backup schedule configuration.
 * @source
 */
function updateScheduler(
  mainWindow: BrowserWindow | null,
  config: BackupScheduleConfig,
): void {
  try {
    // MUTEX: If a backup is currently running, queue this update instead of applying it immediately
    // This prevents race conditions where:
    // 1. Config is updated while backup is running
    // 2. Timers are cleared and new ones started with stale config
    // 3. Backup completes and restarts with outdated schedule
    if (schedulerState.isRunning) {
      console.log("[BackupIPC] Backup in progress; queueing scheduler update");
      schedulerState.updatePending = true;
      schedulerState.pendingConfig = config;
      return;
    }

    // Clear existing timeout and interval separately
    if (schedulerState.timeoutId !== null) {
      clearTimeout(schedulerState.timeoutId);
      schedulerState.timeoutId = null;
    }
    if (schedulerState.intervalId !== null) {
      clearInterval(schedulerState.intervalId);
      schedulerState.intervalId = null;
    }

    if (!config.enabled) {
      console.log("[BackupIPC] Backup scheduler disabled");
      schedulerState.enabled = false;
      return;
    }

    const intervalMs = calculateIntervalMs(config.interval);
    if (intervalMs === 0) {
      console.warn("[BackupIPC] Invalid backup interval:", config.interval);
      return;
    }

    // Calculate next backup time:
    // If this is the first enable (lastBackupTimestamp is null), trigger immediately
    // Otherwise, schedule for last backup + interval
    const now = Date.now();
    let nextBackup: number;

    if (config.lastBackupTimestamp === null) {
      // First run: set nextBackup to now to trigger immediate backup via the overdue path
      nextBackup = now;
      console.log(
        `[BackupIPC] First backup enable detected. Running immediately, then scheduling every ${config.interval} (${Math.round(intervalMs / 1000 / 60)} minutes)`,
      );
    } else {
      // Subsequent runs: calculate from last backup timestamp
      nextBackup = config.lastBackupTimestamp + intervalMs;
      const timeUntilNextBackup = Math.max(0, nextBackup - now);
      console.log(
        `[BackupIPC] Scheduling backups every ${config.interval} (${Math.round(intervalMs / 1000 / 60)} minutes). Next backup in ${Math.round(timeUntilNextBackup / 1000 / 60)} minutes`,
      );
    }

    const updatedConfig: BackupScheduleConfig = {
      ...config,
      nextBackupTimestamp: nextBackup,
    };
    saveStoredBackupScheduleConfig(updatedConfig);

    const timeUntilNextBackup = Math.max(0, nextBackup - now);

    if (timeUntilNextBackup === 0) {
      console.log("[BackupIPC] Backup is overdue, running immediately");
      performScheduledBackup(mainWindow, updatedConfig).catch((error) => {
        console.error("[BackupIPC] Error in immediate backup:", error);
      });

      schedulerState.intervalId = setInterval(() => {
        console.log("[BackupIPC] Backup interval triggered");
        // Re-fetch config on each interval to ensure we use latest settings
        const freshConfig = getStoredBackupScheduleConfig();
        performScheduledBackup(mainWindow, freshConfig).catch((error) => {
          console.error("[BackupIPC] Error in interval backup:", error);
        });
      }, intervalMs);
    } else {
      schedulerState.timeoutId = setTimeout(() => {
        console.log("[BackupIPC] Initial scheduled backup triggered");
        // Re-fetch config before executing to ensure we use latest settings
        const freshConfig = getStoredBackupScheduleConfig();
        performScheduledBackup(mainWindow, freshConfig).catch((error) => {
          console.error("[BackupIPC] Error in initial backup:", error);
        });

        schedulerState.intervalId = setInterval(() => {
          console.log("[BackupIPC] Backup interval triggered");
          // Re-fetch config on each interval to ensure we use latest settings
          const freshConfig = getStoredBackupScheduleConfig();
          performScheduledBackup(mainWindow, freshConfig).catch((error) => {
            console.error("[BackupIPC] Error in interval backup:", error);
          });
        }, intervalMs);
      }, timeUntilNextBackup);
    }

    schedulerState.enabled = true;
    emitStatusChanged(mainWindow);
  } catch (error) {
    console.error("[BackupIPC] Error updating scheduler:", error);
  }
}

/**
 * Gets the default backup location path.
 * @returns Default path to backups directory in userData.
 * @source
 */
function getDefaultBackupLocation(): string {
  return path.join(app.getPath("userData"), "backups");
}

/**
 * Initializes backup location in config if empty.
 * @param config - Backup schedule config to check/update.
 * @returns Config with backupLocation populated if it was empty.
 * @source
 */
function ensureBackupLocationInitialized(
  config: BackupScheduleConfig,
): BackupScheduleConfig {
  if (!config.backupLocation || config.backupLocation.trim() === "") {
    return {
      ...config,
      backupLocation: getDefaultBackupLocation(),
    };
  }
  return config;
}

/**
 * Validates backup location path for security and existence.
 * Enforces absolute paths and rejects directory traversal attempts.
 * @param location - Backup location path to validate.
 * @returns Tuple of [isValid, errorMessage].
 * @source
 */
function validateBackupLocationPath(location: string): [boolean, string?] {
  if (!location || typeof location !== "string") {
    return [false, "Backup location must be a non-empty string"];
  }

  const trimmed = location.trim();
  if (!trimmed) {
    return [false, "Backup location cannot be empty"];
  }

  // Require absolute paths (platform-aware)
  if (!path.isAbsolute(trimmed)) {
    return [false, "Backup location must be an absolute path"];
  }

  // Normalize the path to resolve any `.` or `..` segments
  const normalized = path.normalize(trimmed);

  // Reject paths containing `..` after normalization as a safety check
  if (normalized.includes("..")) {
    return [
      false,
      "Invalid backup location path - directory traversal detected",
    ];
  }

  // Platform-aware check for invalid characters
  if (process.platform === "win32") {
    // Windows: reject < > " | ? * (but NOT colons, which are valid in drive letters like C:\)
    // Check for invalid characters first
    const windowsInvalidChars = /[<>"|?*]/;
    if (windowsInvalidChars.test(normalized)) {
      return [false, "Backup location contains invalid characters"];
    }

    // Validate Windows path format: must start with drive letter and colon
    // Colons should only appear at position 1 (drive letter), e.g., C:\
    const driveLetterPattern = /^[a-zA-Z]:\\/;
    if (!driveLetterPattern.test(normalized)) {
      return [
        false,
        String.raw`Invalid Windows path format - must start with drive letter (e.g., C:\)`,
      ];
    }

    // Check for additional colons outside the drive letter position
    const restOfPath = normalized.substring(2); // Skip the drive letter part (e.g., "C:")
    if (restOfPath.includes(":")) {
      return [
        false,
        "Backup location contains invalid colon character outside drive letter",
      ];
    }
  }

  // Restrict to app userData directory for security
  const userDataPath = app.getPath("userData");

  // Windows: case-insensitive comparison; other platforms: case-sensitive
  const isWithinUserData =
    process.platform === "win32"
      ? normalized.toLowerCase().startsWith(userDataPath.toLowerCase())
      : normalized.startsWith(userDataPath);

  if (!isWithinUserData) {
    return [
      false,
      `Backup location must be within the app's data folder. Please select a directory under: ${userDataPath}`,
    ];
  }

  return [true];
}

/**
 * Extracts the error code from a filesystem error.
 * @param error - The filesystem error object
 * @returns The error code (ENOENT, EACCES, or undefined)
 */
function getFileSystemErrorCode(
  error: unknown,
): "ENOENT" | "EACCES" | undefined {
  if (error instanceof Error && "code" in error) {
    if (error.code === "ENOENT") return "ENOENT";
    if (error.code === "EACCES") return "EACCES";
  }
  return undefined;
}

/**
 * Checks if a backup location directory exists and is accessible.
 * Creates the directory if it doesn't exist, and validates read/write permissions.
 * @param location - The normalized backup location path
 * @returns Tuple of [isAccessible, errorMessage?]
 * @source
 */
async function checkBackupLocationAccessibility(
  location: string,
): Promise<[boolean, string?]> {
  try {
    // Try to access the location - will throw if it doesn't exist or lacks permissions
    await fs.access(location);
    return [true];
  } catch (error) {
    const errorCode = getFileSystemErrorCode(error);

    // Directory doesn't exist - try to create it
    if (errorCode === "ENOENT") {
      try {
        await fs.mkdir(location, { recursive: true });
        return [true];
      } catch (mkdirError) {
        const message =
          mkdirError instanceof Error ? mkdirError.message : "Unknown error";
        return [false, `Failed to create backup directory: ${message}`];
      }
    }

    // Permission denied
    if (errorCode === "EACCES") {
      return [
        false,
        `Permission denied - cannot write to backup location. Please choose a folder you have write access to.`,
      ];
    }

    // Other filesystem errors
    const message = error instanceof Error ? error.message : "Unknown error";
    return [false, `Cannot access backup location: ${message}`];
  }
}

/**
 * Validates a backup filename to ensure it's safe for file operations.
 * Checks for proper format, traversal attempts, and invalid separators.
 * @param filename - The filename to validate
 * @returns Tuple of [isValid, errorMessage?]
 * @source
 */
function validateBackupFilename(filename: string): [boolean, string?] {
  // Ensure filename is a string
  if (typeof filename !== "string") {
    return [false, "Filename must be a string"];
  }

  // Ensure filename matches backup-*.json pattern
  if (!filename.startsWith("backup-") || !filename.endsWith(".json")) {
    return [false, "Invalid backup file format"];
  }

  // Ensure no directory traversal
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    return [false, "Invalid backup filename"];
  }

  return [true];
}

/**
 * Lists backup files in the configured backup location.
 * @param backupLocation - Path to the backups directory.
 * @returns Array of backup file information sorted by timestamp (newest first).
 * @source
 */
async function listBackupsInLocation(
  backupLocation: string,
): Promise<Array<{ name: string; timestamp: number; size: number }>> {
  try {
    await fs.mkdir(backupLocation, { recursive: true });
    const files = await fs.readdir(backupLocation);

    const backupFiles: Array<{
      name: string;
      timestamp: number;
      size: number;
    }> = [];

    for (const file of files) {
      if (file.startsWith("backup-") && file.endsWith(".json")) {
        const filePath = path.join(backupLocation, file);
        const stat = await fs.stat(filePath);
        // Extract timestamp from filename: "backup-1234567890.json" -> 1234567890
        const match = /backup-(\d+)\.json/.exec(file);
        const timestamp = match ? Number.parseInt(match[1], 10) : stat.mtimeMs;

        backupFiles.push({
          name: file,
          timestamp,
          size: stat.size,
        });
      }
    }

    // Sort by timestamp descending (newest first)
    return backupFiles.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("[BackupIPC] Error listing backups:", error);
    return [];
  }
}

/**
 * Deletes a specific backup file using the file operations mutex.
 * @param backupLocation - Path to the backups directory.
 * @param filename - Name of the file to delete.
 * @returns Success status.
 * @source
 */
async function deleteBackupFileWithMutex(
  backupLocation: string,
  filename: string,
): Promise<{ success: boolean; error?: string }> {
  const release = await acquireFileOpsMutex();
  try {
    return await deleteBackupFile(backupLocation, filename);
  } finally {
    release();
  }
}

/**
 * Deletes a specific backup file from the configured location.
 * @param backupLocation - Path to the backups directory.
 * @param filename - Name of the file to delete.
 * @returns Success status.
 * @source
 */
async function deleteBackupFile(
  backupLocation: string,
  filename: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate filename to prevent directory traversal
    if (
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("..")
    ) {
      return { success: false, error: "Invalid backup filename" };
    }

    if (!filename.startsWith("backup-") || !filename.endsWith(".json")) {
      return { success: false, error: "Invalid backup file format" };
    }

    const filePath = path.join(backupLocation, filename);
    await fs.unlink(filePath);
    console.log("[BackupIPC] Deleted backup file:", filename);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[BackupIPC] Error deleting backup file:", error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Registers IPC event listeners for backup-related actions in the Electron main process.
 * Handles all backup operations: config management, file operations, scheduler control, and history tracking.
 * @param mainWindow - The Electron main window.
 * @source
 */
export function setupBackupIPC(mainWindow: BrowserWindow): void {
  // Note: We no longer use ipcMain.removeHandler since we're using secureHandle
  // which registers handlers directly without prior cleanup needed

  console.log("[BackupIPC] Setting up backup IPC handlers...");

  secureHandle(
    BACKUP_CHANNELS.GET_SCHEDULE_CONFIG,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Electron.IpcMainInvokeEvent) => {
      try {
        const config = getStoredBackupScheduleConfig();
        console.debug("[BackupIPC] Returning backup schedule config");
        return config;
      } catch (error) {
        console.error(
          "[BackupIPC] Error getting backup schedule config:",
          error,
        );
        return DEFAULT_BACKUP_SCHEDULE_CONFIG;
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.SET_SCHEDULE_CONFIG,
    (_event: Electron.IpcMainInvokeEvent, config: unknown) => {
      try {
        const validation = validateScheduleConfig(config);
        if (!validation.valid) {
          console.warn(
            "[BackupIPC] Invalid schedule config rejected:",
            validation.error,
          );
          return { success: false, error: validation.error };
        }

        let validatedConfig = validation.validated!;
        // Ensure backup location is initialized
        validatedConfig = ensureBackupLocationInitialized(validatedConfig);

        console.debug("[BackupIPC] Setting backup schedule config");

        saveStoredBackupScheduleConfig(validatedConfig);
        updateScheduler(mainWindow, validatedConfig);
        emitStatusChanged(mainWindow);

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          "[BackupIPC] Error setting backup schedule config:",
          error,
        );
        return { success: false, error: errorMessage };
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.GET_BACKUP_LOCATION,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Electron.IpcMainInvokeEvent) => {
      try {
        const config = getStoredBackupScheduleConfig();
        const location = ensureBackupLocationInitialized(config).backupLocation;

        console.debug("[BackupIPC] Returning backup location");

        return { success: true, data: location };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[BackupIPC] Error getting backup location:", error);
        return { success: false, error: errorMessage };
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.SET_BACKUP_LOCATION,
    async (_event: Electron.IpcMainInvokeEvent, location: unknown) => {
      try {
        // Input validation: ensure location is a string
        if (typeof location !== "string") {
          console.warn(
            "[BackupIPC] SET_BACKUP_LOCATION: Invalid location type:",
            typeof location,
          );
          return {
            success: false,
            error: "Backup location must be a string",
            code: "INVALID_TYPE",
          };
        }

        const [isValid, errorMsg] = validateBackupLocationPath(location);
        if (!isValid) {
          console.warn(
            "[BackupIPC] Invalid backup location rejected:",
            errorMsg,
          );
          // Extract error code from validation
          let code = "INVALID_PATH";
          if (errorMsg?.includes("does not exist")) code = "ENOENT";
          if (errorMsg?.includes("permission")) code = "EACCES";
          return { success: false, error: errorMsg, code };
        }

        // Check accessibility and create directory if needed
        const normalizedPath = path.normalize(location.trim());
        const [isAccessible, accessError] =
          await checkBackupLocationAccessibility(normalizedPath);
        if (!isAccessible) {
          console.warn(
            "[BackupIPC] Backup location is not accessible:",
            accessError,
          );
          // Extract error code from accessibility check
          let code = "INVALID_PATH";
          if (accessError?.includes("does not exist")) code = "ENOENT";
          if (accessError?.includes("Permission denied")) code = "EACCES";
          return { success: false, error: accessError, code };
        }

        const config = getStoredBackupScheduleConfig();
        const updatedConfig: BackupScheduleConfig = {
          ...config,
          backupLocation: normalizedPath,
        };

        console.debug("[BackupIPC] Updating backup location");

        saveStoredBackupScheduleConfig(updatedConfig);

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[BackupIPC] Error setting backup location:", error);
        return { success: false, error: errorMessage, code: "UNKNOWN_ERROR" };
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.OPEN_BACKUP_LOCATION,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_event: Electron.IpcMainInvokeEvent) => {
      try {
        const config = getStoredBackupScheduleConfig();
        const location = ensureBackupLocationInitialized(config).backupLocation;

        console.debug("[BackupIPC] Opening backup location");

        await fs.mkdir(location, { recursive: true });
        await shell.openPath(location);

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[BackupIPC] Error opening backup location:", error);
        return { success: false, error: errorMessage };
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.LIST_LOCAL_BACKUPS,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_event: Electron.IpcMainInvokeEvent) => {
      try {
        const config = getStoredBackupScheduleConfig();
        const location = ensureBackupLocationInitialized(config).backupLocation;

        // Defensive check: ensure location is initialized and not empty
        if (
          !location ||
          typeof location !== "string" ||
          location.trim().length === 0
        ) {
          const errorMsg =
            "Backup location has not been configured. Please select a backup location in settings.";
          console.warn(
            "[BackupIPC] LIST_LOCAL_BACKUPS: Backup location not initialized",
          );
          return { success: false, error: errorMsg };
        }

        // Input validation: ensure location is valid after initialization
        const [isValid, errorMsg] = validateBackupLocationPath(location);
        if (!isValid) {
          const sanitizedLocation = location.substring(0, 50); // Limit for security
          console.warn(
            "[BackupIPC] LIST_LOCAL_BACKUPS: Invalid backup location:",
            errorMsg,
          );
          return {
            success: false,
            error: `Invalid backup location: ${sanitizedLocation}. Reason: ${errorMsg}`,
          };
        }

        // Check accessibility and surface permission issues early
        const [isAccessible, accessError] =
          await checkBackupLocationAccessibility(location);
        if (!isAccessible) {
          console.warn(
            "[BackupIPC] LIST_LOCAL_BACKUPS: Backup location is not accessible:",
            accessError,
          );
          return { success: false, error: accessError };
        }

        console.debug("[BackupIPC] Listing backups");

        const backups = await listBackupsInLocation(location);

        return { success: true, data: backups };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[BackupIPC] Error listing local backups:", error);
        return { success: false, error: errorMessage };
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.DELETE_BACKUP,
    async (_event: Electron.IpcMainInvokeEvent, filename: unknown) => {
      try {
        // Ensure filename is a string before validation
        if (typeof filename !== "string") {
          console.warn(
            "[BackupIPC] DELETE_BACKUP: Invalid filename type:",
            typeof filename,
          );
          return { success: false, error: "Filename must be a string" };
        }

        // Input validation: validate filename
        const [isFilenameValid, filenameError] =
          validateBackupFilename(filename);
        if (!isFilenameValid) {
          console.warn(
            "[BackupIPC] DELETE_BACKUP: Invalid filename:",
            filenameError,
          );
          return { success: false, error: filenameError };
        }

        const config = getStoredBackupScheduleConfig();
        const location = ensureBackupLocationInitialized(config).backupLocation;

        // Validate backup location
        const [isValid, errorMsg] = validateBackupLocationPath(location);
        if (!isValid) {
          console.warn(
            "[BackupIPC] DELETE_BACKUP: Invalid backup location:",
            errorMsg,
          );
          return { success: false, error: errorMsg };
        }

        console.log("[BackupIPC] Deleting backup:", filename);
        const result = await deleteBackupFileWithMutex(location, filename);

        // Reconcile history and notify renderer after successful deletion
        if (result.success) {
          // List remaining backup files to reconcile history
          const remainingFiles = await listBackupFiles(location);
          const remainingFilenames = remainingFiles.map((f) => f.name);
          reconcileStoredHistory(remainingFilenames);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(BACKUP_CHANNELS.ON_HISTORY_UPDATED);
            console.debug(
              "[BackupIPC] Sent ON_HISTORY_UPDATED notification to renderer after deletion",
            );
          }
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[BackupIPC] Error deleting backup:", error);
        return { success: false, error: errorMessage };
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.TRIGGER_BACKUP,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_event: Electron.IpcMainInvokeEvent) => {
      console.log("[BackupIPC] Manual backup trigger requested");
      return createImmediateBackup(mainWindow);
    },
    mainWindow,
  );

  // CREATE_NOW is semantically equivalent to TRIGGER_BACKUP - both create an immediate backup
  secureHandle(
    BACKUP_CHANNELS.CREATE_NOW,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_event: Electron.IpcMainInvokeEvent) => {
      console.log("[BackupIPC] Immediate backup creation requested");
      return createImmediateBackup(mainWindow);
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.GET_BACKUP_STATUS,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Electron.IpcMainInvokeEvent) => {
      try {
        const config = getStoredBackupScheduleConfig();
        return {
          isRunning: schedulerState.isRunning,
          lastBackup: config.lastBackupTimestamp,
          nextBackup: config.nextBackupTimestamp,
        };
      } catch (error) {
        console.error("[BackupIPC] Error getting backup status:", error);
        return {
          isRunning: false,
          lastBackup: null,
          nextBackup: null,
        };
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.GET_BACKUP_HISTORY,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Electron.IpcMainInvokeEvent) => {
      try {
        const history = getStoredBackupHistory();
        console.debug(
          "[BackupIPC] Returning backup history with",
          history.length,
          "entries",
        );
        return history;
      } catch (error) {
        console.error("[BackupIPC] Error getting backup history:", error);
        return [];
      }
    },
    mainWindow,
  );

  secureHandle(
    BACKUP_CHANNELS.CLEAR_HISTORY,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Electron.IpcMainInvokeEvent) => {
      try {
        console.log("[BackupIPC] Clearing backup history...");
        store.delete(MAIN_PROCESS_STORAGE_KEYS.BACKUP_HISTORY);
        console.log("[BackupIPC] Backup history cleared");

        // Notify renderer that history was updated
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(BACKUP_CHANNELS.ON_HISTORY_UPDATED);
          console.debug(
            "[BackupIPC] Sent ON_HISTORY_UPDATED notification to renderer",
          );
        }

        return { success: true };
      } catch (error) {
        console.error("[BackupIPC] Error clearing backup history:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    mainWindow,
  );

  // Read a specific backup file's contents and return as text
  secureHandle(
    BACKUP_CHANNELS.READ_LOCAL_BACKUP,
    async (_event: Electron.IpcMainInvokeEvent, filename: unknown) => {
      try {
        // Ensure filename is a string before validation
        if (typeof filename !== "string") {
          console.warn(
            "[BackupIPC] READ_LOCAL_BACKUP: Invalid filename type:",
            typeof filename,
          );
          return { success: false, error: "Filename must be a string" };
        }

        // Input validation: validate filename
        const [isFilenameValid, filenameError] =
          validateBackupFilename(filename);
        if (!isFilenameValid) {
          console.warn(
            "[BackupIPC] READ_LOCAL_BACKUP: Invalid filename:",
            filenameError,
          );
          return { success: false, error: filenameError };
        }

        const config = getStoredBackupScheduleConfig();
        const location = ensureBackupLocationInitialized(config).backupLocation;

        // Validate backup location
        const [isValid, errorMsg] = validateBackupLocationPath(location);
        if (!isValid) {
          console.warn(
            "[BackupIPC] READ_LOCAL_BACKUP: Invalid backup location:",
            errorMsg,
          );
          return { success: false, error: errorMsg };
        }

        const filePath = path.join(location, filename);

        console.debug("[BackupIPC] Reading backup file");

        const contents = await fs.readFile(filePath, { encoding: "utf-8" });

        const maxSizeBytes = 100 * 1024 * 1024;
        if (contents.length > maxSizeBytes) {
          console.warn(
            "[BackupIPC] READ_LOCAL_BACKUP: File exceeds maximum size:",
            contents.length,
          );
          return { success: false, error: "Backup file exceeds maximum size" };
        }

        return { success: true, data: contents };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[BackupIPC] Error reading local backup file:", error);
        return { success: false, error: errorMessage };
      }
    },
    mainWindow,
  );

  // Restore from a local backup file
  secureHandle(
    BACKUP_CHANNELS.RESTORE_LOCAL_BACKUP,
    async (
      _event: Electron.IpcMainInvokeEvent,
      filename: unknown,
      options: unknown,
    ) => {
      try {
        // Ensure filename is a string before validation
        if (typeof filename !== "string") {
          console.warn(
            "[BackupIPC] RESTORE_LOCAL_BACKUP: Invalid filename type:",
            typeof filename,
          );
          return { success: false, errors: ["Filename must be a string"] };
        }

        // Input validation: validate filename
        const [isFilenameValid, filenameError] =
          validateBackupFilename(filename);
        if (!isFilenameValid) {
          console.warn(
            "[BackupIPC] RESTORE_LOCAL_BACKUP: Invalid filename:",
            filenameError,
          );
          return {
            success: false,
            errors: [filenameError || "Invalid filename"],
          };
        }

        const config = getStoredBackupScheduleConfig();
        const location = ensureBackupLocationInitialized(config).backupLocation;

        // Validate backup location
        const [isValid, errorMsg] = validateBackupLocationPath(location);
        if (!isValid) {
          console.warn(
            "[BackupIPC] RESTORE_LOCAL_BACKUP: Invalid backup location:",
            errorMsg,
          );
          return {
            success: false,
            errors: [errorMsg || "Invalid backup location"],
          };
        }

        const filePath = path.join(location, filename);

        console.info("[BackupIPC] Restoring from backup file:", filePath);

        // Read the backup file
        const contents = await fs.readFile(filePath, { encoding: "utf-8" });

        // Parse and validate the backup
        const backupData = JSON.parse(contents);

        // Parse options (merge mode)
        const restoreOptions =
          options && typeof options === "object" && "merge" in options
            ? { merge: (options as { merge?: boolean }).merge }
            : {};

        // Restore the backup
        const result = await restoreBackup(backupData, restoreOptions);

        if (result.success) {
          console.info(
            "[BackupIPC] Backup restored successfully from:",
            filePath,
          );
        } else {
          console.error(
            "[BackupIPC] Restore failed with errors:",
            result.errors,
          );
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[BackupIPC] Error restoring backup:", error);
        return { success: false, errors: [errorMessage] };
      }
    },
    mainWindow,
  );

  try {
    const config = getStoredBackupScheduleConfig();
    if (config.enabled) {
      console.log("[BackupIPC] Initializing backup scheduler on app start");
      updateScheduler(mainWindow, config);
    }
  } catch (error) {
    console.error("[BackupIPC] Error initializing backup scheduler:", error);
  }

  console.log("[BackupIPC] ✅ Backup IPC handlers registered");
}
