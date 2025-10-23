/**
 * Backup and restore utilities for application data
 * Provides comprehensive backup functionality including history management,
 * validation, and conflict resolution
 */

import {
  storage,
  STORAGE_KEYS,
  CURRENT_CACHE_VERSION,
  mergeMatchResults,
} from "@/utils/storage";
import { getAppVersion } from "@/utils/app-version";
import { exportToJson } from "@/utils/exportUtils";

/**
 * Interface for backup metadata.
 * Includes version information and data structure details.
 * @source
 */
export interface BackupMetadata {
  /** ISO timestamp of when backup was created */
  timestamp: string;
  /** Application version when backup was created */
  appVersion: string;
  /** Cache version for data structure compatibility */
  cacheVersion: number;
  /** Backup format version for future compatibility */
  backupVersion: number;
  /** List of storage keys included in this backup */
  dataKeys: string[];
}

/**
 * Interface for backup data structure.
 * Contains metadata and all backed-up application data.
 * @source
 */
export interface BackupData {
  /** Metadata about the backup */
  metadata: BackupMetadata;
  /** Raw storage values for each key */
  data: Record<string, string>;
}

/**
 * Interface for backup history entries.
 * Tracks backup metadata for restore history.
 * @source
 */
export interface BackupHistoryEntry {
  /** Unique identifier for this backup entry */
  id: string;
  /** Timestamp when backup was created (milliseconds) */
  timestamp: number;
  /** Application version at time of backup */
  appVersion: string;
  /** Storage keys included in this backup */
  dataKeys: string[];
  /** Size of backup in bytes */
  size: number;
}

/**
 * Storage key for backup history in localStorage.
 * @internal Not included in STORAGE_KEYS to avoid circular dependency.
 * @source
 */
export const BACKUP_HISTORY_KEY = "backup_history";

/**
 * Maximum number of backups to keep in history.
 * @source
 */
export const MAX_BACKUP_HISTORY = 5;

/**
 * Current backup format version.
 * Increment when backup schema changes to ensure compatibility.
 * @source
 */
export const BACKUP_VERSION = 1;

/**
 * Storage keys that should be included in backups.
 * Excludes transient keys (ACTIVE_SYNC_SNAPSHOT, UPDATE_DISMISSED_VERSIONS).
 * @source
 */
export const BACKUPABLE_KEYS = [
  STORAGE_KEYS.KENMEI_DATA,
  STORAGE_KEYS.IMPORT_STATS,
  STORAGE_KEYS.MATCH_RESULTS,
  STORAGE_KEYS.PENDING_MANGA,
  STORAGE_KEYS.CACHE_VERSION,
  STORAGE_KEYS.SYNC_CONFIG,
  STORAGE_KEYS.SYNC_STATS,
  STORAGE_KEYS.MATCH_CONFIG,
  STORAGE_KEYS.IGNORED_DUPLICATES,
  STORAGE_KEYS.ANILIST_SEARCH_CACHE,
  STORAGE_KEYS.ONBOARDING_COMPLETED,
] as const;

/**
 * Validation result from backup validation.
 * @source
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Creates a complete backup of application data and triggers file download.
 * Automatically adds entry to backup history and manages history limit.
 * @returns Unique identifier for the created backup.
 * @throws {Error} If backup creation or export fails.
 * @source
 */
export async function createBackup(): Promise<string> {
  try {
    console.log("[Backup] Creating backup...");

    // Collect all backupable data
    const backupData: BackupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        appVersion: getAppVersion(),
        cacheVersion: CURRENT_CACHE_VERSION,
        backupVersion: BACKUP_VERSION,
        dataKeys: [...BACKUPABLE_KEYS],
      },
      data: {},
    };

    // Gather data for each backupable key
    // Use the async getter which prefers electron-store when available and keeps localStorage synchronized.
    for (const key of BACKUPABLE_KEYS) {
      try {
        // Prefer authoritative electron-store when present
        // getItemAsync will fall back to localStorage if electron-store is not available
        // and will keep localStorage in sync when electron-store is used.
        const value = await storage.getItemAsync(key);
        if (value !== null) {
          backupData.data[key] = value;
        }
      } catch (e) {
        console.warn(
          `[Backup] Failed to read key ${key} from storage async getter:`,
          e,
        );
        // Fallback to synchronous getter
        const fallback = storage.getItem(key);
        if (fallback !== null) {
          backupData.data[key] = fallback;
        }
      }
    }

    // Generate backup ID
    const backupId = `backup_${Date.now()}`;

    // Export to JSON file (triggers download)
    exportToJson(
      backupData as unknown as Record<string, unknown>,
      "kenmei-backup",
    );

    // Calculate backup size
    const backupSize = JSON.stringify(backupData).length;

    // Add to backup history
    const historyEntry: BackupHistoryEntry = {
      id: backupId,
      timestamp: Date.now(),
      appVersion: backupData.metadata.appVersion,
      dataKeys: backupData.metadata.dataKeys,
      size: backupSize,
    };

    addBackupToHistory(historyEntry);

    console.log("[Backup] Backup created successfully:", backupId);
    return backupId;
  } catch (error) {
    console.error("[Backup] Failed to create backup:", error);
    throw new Error(
      `Failed to create backup: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Retrieves backup history from storage.
 * Returns entries sorted by timestamp in descending order (newest first).
 * @returns Array of backup history entries.
 * @source
 */
export function getBackupHistory(): BackupHistoryEntry[] {
  try {
    const historyJson = storage.getItem(STORAGE_KEYS.BACKUP_HISTORY);
    if (!historyJson) {
      return [];
    }

    const history: BackupHistoryEntry[] = JSON.parse(historyJson);
    // Sort by timestamp descending (newest first)
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("[Backup] Failed to retrieve backup history:", error);
    return [];
  }
}

/**
 * Adds entry to backup history and manages history limit.
 * Prepends new entry and removes oldest entries when history exceeds MAX_BACKUP_HISTORY.
 * @param entry - Backup history entry to add.
 * @internal Used internally by createBackup.
 * @source
 */
export function addBackupToHistory(entry: BackupHistoryEntry): void {
  try {
    let history = getBackupHistory();

    // Prepend new entry (newest first)
    history = [entry, ...history];

    // Maintain history limit by removing oldest entries
    history = history.slice(0, MAX_BACKUP_HISTORY);

    // Save to storage
    storage.setItem(STORAGE_KEYS.BACKUP_HISTORY, JSON.stringify(history));
    console.log("[Backup] History updated, total backups:", history.length);
  } catch (error) {
    console.error("[Backup] Failed to add entry to backup history:", error);
  }
}

/**
 * Clears all backup history from storage.
 * @source
 */
export function clearBackupHistory(): void {
  try {
    storage.removeItem(STORAGE_KEYS.BACKUP_HISTORY);
    console.log("[Backup] Backup history cleared");
  } catch (error) {
    console.error("[Backup] Failed to clear backup history:", error);
  }
}

/**
 * Validates backup data structure and compatibility.
 * Checks for required keys, version compatibility, and data integrity.
 * @param backupData - Backup data to validate.
 * @returns Validation result with valid flag and any errors found.
 * @internal Used internally by importBackupFromFile and restoreBackup.
 * @source
 */
export function validateBackup(backupData: BackupData): ValidationResult {
  const errors: string[] = [];

  try {
    // Check metadata exists and has required properties
    if (!backupData.metadata) {
      errors.push("Missing backup metadata");
      return { valid: false, errors };
    }

    // Check metadata required fields
    if (!backupData.metadata.timestamp) {
      errors.push("Backup metadata missing timestamp");
    }
    if (!backupData.metadata.appVersion) {
      errors.push("Backup metadata missing appVersion");
    }
    if (typeof backupData.metadata.cacheVersion !== "number") {
      errors.push("Backup metadata missing or invalid cacheVersion");
    }

    // Check cache version compatibility
    if (backupData.metadata.cacheVersion < CURRENT_CACHE_VERSION) {
      errors.push(
        `Backup cache version ${backupData.metadata.cacheVersion} is older than current version ${CURRENT_CACHE_VERSION}. Data structure may have changed.`,
      );
    }

    // Check backup version compatibility
    if (backupData.metadata.backupVersion > BACKUP_VERSION) {
      errors.push(
        `Backup format version ${backupData.metadata.backupVersion} is newer than supported version ${BACKUP_VERSION}`,
      );
    }

    // Check dataKeys is an array
    if (!Array.isArray(backupData.metadata.dataKeys)) {
      errors.push("Backup metadata dataKeys must be an array");
    }

    // Check required keys are present
    const requiredKeys = [STORAGE_KEYS.KENMEI_DATA];
    const missingKeys = requiredKeys.filter(
      (key) => !(key in backupData.data) || backupData.data[key] === undefined,
    );

    if (missingKeys.length > 0) {
      errors.push(`Missing required data keys: ${missingKeys.join(", ")}`);
    }

    // Check data structure is valid
    if (!backupData.data || typeof backupData.data !== "object") {
      errors.push("Invalid backup data structure");
    }

    // Attempt to parse critical JSON data to ensure validity
    const jsonKeys = [
      STORAGE_KEYS.KENMEI_DATA,
      STORAGE_KEYS.MATCH_RESULTS,
      STORAGE_KEYS.SYNC_CONFIG,
      STORAGE_KEYS.MATCH_CONFIG,
    ];

    for (const key of jsonKeys) {
      if (backupData.data[key]) {
        try {
          JSON.parse(backupData.data[key]);
        } catch {
          errors.push(`Key '${key}' contains invalid JSON`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(
      `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return { valid: false, errors };
  }
}

/**
 * Restores application data from backup.
 * Validates backup before restoration and optionally merges match results.
 * @param backupData - Backup data to restore.
 * @param options - Restoration options.
 * @param options.merge - If true, merge match results instead of replacing (default: false).
 * @returns Success status and any error messages.
 * @throws {Error} If validation fails or restoration encounters critical error.
 * @source
 */
export async function restoreBackup(
  backupData: BackupData,
  options?: { merge?: boolean },
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    console.log("[Backup] Starting restore process...");

    // Validate backup
    const validation = validateBackup(backupData);
    if (!validation.valid) {
      console.error("[Backup] Validation failed:", validation.errors);
      throw new Error(
        `Backup validation failed: ${validation.errors.join("; ")}`,
      );
    }

    // Restore each data key
    for (const key of BACKUPABLE_KEYS) {
      if (key in backupData.data) {
        try {
          // Special handling for match results with merge option
          if (key === STORAGE_KEYS.MATCH_RESULTS && options?.merge) {
            const backupResults = JSON.parse(backupData.data[key]);
            const mergedResults = mergeMatchResults(backupResults);
            storage.setItem(key, JSON.stringify(mergedResults));
            console.debug("[Backup] Merged match results");
          } else {
            // Standard restore (replace)
            storage.setItem(key, backupData.data[key]);
          }
        } catch (error) {
          const message = `Failed to restore ${key}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          console.error("[Backup]", message);
          errors.push(message);
        }
      }
    }

    // Update cache version to current version after restore
    try {
      storage.setItem(
        STORAGE_KEYS.CACHE_VERSION,
        CURRENT_CACHE_VERSION.toString(),
      );
      console.debug("[Backup] Updated cache version to", CURRENT_CACHE_VERSION);
    } catch (error) {
      console.warn("[Backup] Failed to update cache version:", error);
    }

    if (errors.length > 0) {
      console.warn("[Backup] Restore completed with errors:", errors);
      return { success: false, errors };
    }

    console.log("[Backup] Restore completed successfully");
    return { success: true, errors: [] };
  } catch (error) {
    const message = `Restore error: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    console.error("[Backup]", message);
    errors.push(message);
    return { success: false, errors };
  }
}

/**
 * Imports backup from file and validates it.
 * Reads file content and parses JSON backup format.
 * @param file - File to import as backup.
 * @returns Parsed and validated backup data.
 * @throws {Error} If file cannot be read or is not valid backup format.
 * @source
 */
export async function importBackupFromFile(file: File): Promise<BackupData> {
  try {
    console.log("[Backup] Reading backup file:", file.name);

    // Read file as text
    const fileContent = await file.text();

    // Parse JSON
    let backupData: BackupData;
    try {
      backupData = JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error(
        `Invalid backup file format: ${
          parseError instanceof Error ? parseError.message : "JSON parse error"
        }`,
      );
    }

    // Validate backup structure
    const validation = validateBackup(backupData);
    if (!validation.valid) {
      throw new Error(
        `Backup validation failed: ${validation.errors.join("; ")}`,
      );
    }

    console.log("[Backup] File imported and validated successfully");
    return backupData;
  } catch (error) {
    const message = `Failed to import backup: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    console.error("[Backup]", message);
    throw new Error(message);
  }
}
