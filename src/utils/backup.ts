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
 * Large backups are exported asynchronously to avoid blocking the UI.
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

    // Calculate backup size
    const backupSize = JSON.stringify(backupData).length;
    console.log(
      `[Backup] Backup size: ${(backupSize / 1024 / 1024).toFixed(2)} MB`,
    );

    // Export to JSON file asynchronously to avoid blocking UI for large payloads
    // Yield to the event loop before starting export
    await new Promise((resolve) => {
      setTimeout(() => {
        try {
          exportToJson(
            backupData as unknown as Record<string, unknown>,
            "kenmei-backup",
          );
          resolve(undefined);
        } catch (error) {
          console.error("[Backup] Failed to export JSON:", error);
          throw error;
        }
      }, 0);
    });

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
  try {
    if (!backupData.metadata) {
      return { valid: false, errors: ["Missing backup metadata"] };
    }

    const allErrors = [
      ...validateMetadata(backupData.metadata),
      ...validateRequiredKeys(backupData),
      ...validateJsonKeys(backupData),
    ];

    return { valid: allErrors.length === 0, errors: allErrors };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ],
    };
  }
}

function validateMetadata(metadata: BackupMetadata): string[] {
  const errors: string[] = [];
  if (!metadata.timestamp) errors.push("Backup metadata missing timestamp");
  if (!metadata.appVersion) errors.push("Backup metadata missing appVersion");
  if (typeof metadata.cacheVersion !== "number")
    errors.push("Backup metadata missing or invalid cacheVersion");

  if (metadata.cacheVersion < CURRENT_CACHE_VERSION)
    errors.push(
      `Backup cache version ${metadata.cacheVersion} is older than current version ${CURRENT_CACHE_VERSION}. Data structure may have changed.`,
    );

  if (metadata.backupVersion > BACKUP_VERSION)
    errors.push(
      `Backup format version ${metadata.backupVersion} is newer than supported version ${BACKUP_VERSION}`,
    );

  if (!Array.isArray(metadata.dataKeys))
    errors.push("Backup metadata dataKeys must be an array");

  return errors;
}

function validateRequiredKeys(backupData: BackupData): string[] {
  const errors: string[] = [];
  const requiredKeys = [STORAGE_KEYS.KENMEI_DATA];
  const missingKeys = requiredKeys.filter(
    (key) => !(key in backupData.data) || backupData.data[key] === undefined,
  );

  if (missingKeys.length > 0)
    errors.push(`Missing required data keys: ${missingKeys.join(", ")}`);

  if (!backupData.data || typeof backupData.data !== "object")
    errors.push("Invalid backup data structure");

  return errors;
}

function validateJsonKeys(backupData: BackupData): string[] {
  const errors: string[] = [];
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

  return errors;
}

/**
 * Maximum allowed backup file size in bytes (10 MB).
 * @internal
 */
const MAX_BACKUP_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate a single match result item for required fields.
 * @internal
 */
function validateMatchResultItem(item: unknown): {
  valid: boolean;
  reason?: string;
} {
  if (typeof item !== "object" || item === null) {
    return {
      valid: false,
      reason: `Item is not an object (got ${typeof item})`,
    };
  }

  const obj = item as Record<string, unknown>;

  // Validate kenmeiManga structure
  const kenmeiManga = obj.kenmeiManga;
  if (
    typeof kenmeiManga !== "object" ||
    kenmeiManga === null ||
    !("title" in kenmeiManga)
  ) {
    return {
      valid: false,
      reason: "Missing required field: kenmeiManga.title",
    };
  }

  // Validate status field
  if (!("status" in obj)) {
    return {
      valid: false,
      reason: "Missing required field: status",
    };
  }

  return { valid: true };
}

/**
 * Helper function to validate and merge match results from backup.
 * Performs strict schema validation on array items to ensure data integrity.
 * @internal
 */
function validateAndMergeMatchResults(backupDataStr: string): {
  success: boolean;
  result?: string;
  error?: string;
} {
  try {
    let backupResults: unknown;
    try {
      backupResults = JSON.parse(backupDataStr);
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse JSON: ${
          parseError instanceof Error ? parseError.message : "Unknown error"
        }`,
      };
    }

    // Validate that backupResults is an array
    if (!Array.isArray(backupResults)) {
      return {
        success: false,
        error: `Must be an array, got ${typeof backupResults}`,
      };
    }

    // Collect invalid items
    const invalidItems: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < backupResults.length; i++) {
      const validation = validateMatchResultItem(backupResults[i]);
      if (!validation.valid && validation.reason) {
        invalidItems.push({
          index: i,
          reason: validation.reason,
        });
      }
    }

    // Check if invalid items exceed threshold (>5% or >50 items)
    const invalidThreshold = Math.max(
      backupResults.length * 0.05, // 5%
      50, // or 50 items
    );

    if (invalidItems.length > invalidThreshold) {
      const errorDetails = invalidItems
        .slice(0, 5) // Show first 5 invalid items
        .map((item) => `  [${item.index}]: ${item.reason}`)
        .join("\n");

      const additional =
        invalidItems.length > 5
          ? `\n  ... and ${invalidItems.length - 5} more`
          : "";

      return {
        success: false,
        error: `Validation failed: ${invalidItems.length} invalid items exceed threshold. Examples:\n${errorDetails}${additional}`,
      };
    }

    // Log warning if some items are invalid but within threshold
    if (invalidItems.length > 0) {
      console.warn(
        `[Backup] ${invalidItems.length} match result items failed validation but are within threshold, proceeding with merge`,
        invalidItems.slice(0, 3),
      );
    }

    const mergedResults = mergeMatchResults(backupResults);
    return {
      success: true,
      result: JSON.stringify(mergedResults),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown merge error",
    };
  }
}

/**
 * Restore a single storage key from backupData. Returns an error message string on
 * failure, or null on success / when key not present in backup.
 */
function restoreKeyFromBackup(
  key: string,
  backupData: BackupData,
  options?: { merge?: boolean },
): string | null {
  if (!(key in backupData.data)) return null;

  try {
    if (key === STORAGE_KEYS.MATCH_RESULTS && options?.merge) {
      const mergeResult = validateAndMergeMatchResults(backupData.data[key]);
      if (!mergeResult.success) {
        return `Failed to merge ${key}: ${mergeResult.error}`;
      }
      storage.setItem(key, mergeResult.result || "");
      console.debug("[Backup] Merged match results");
    } else {
      storage.setItem(key, backupData.data[key]);
    }
    return null;
  } catch (error) {
    const message = `Failed to restore ${key}: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    console.error("[Backup]", message);
    return message;
  }
}

/**
 * Update the cache version in storage. Returns error message on failure or null on success.
 */
function updateCacheVersion(): string | null {
  try {
    storage.setItem(
      STORAGE_KEYS.CACHE_VERSION,
      CURRENT_CACHE_VERSION.toString(),
    );
    console.debug("[Backup] Updated cache version to", CURRENT_CACHE_VERSION);
    return null;
  } catch (error) {
    const message = `Failed to update cache version: ${
      error instanceof Error ? error.message : String(error)
    }`;
    console.warn("[Backup] ", message);
    return message;
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

    // Restore each data key using helper to keep control flow simple
    for (const key of BACKUPABLE_KEYS) {
      const err = restoreKeyFromBackup(key, backupData, options);
      if (err) errors.push(err);
    }

    // Update cache version to current version after restore
    const cacheErr = updateCacheVersion();
    if (cacheErr) errors.push(cacheErr);

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
 * Warns if file size exceeds recommended threshold.
 * @param file - File to import as backup.
 * @returns Parsed and validated backup data.
 * @throws {Error} If file cannot be read or is not valid backup format.
 * @source
 */
export async function importBackupFromFile(file: File): Promise<BackupData> {
  try {
    console.log("[Backup] Reading backup file:", file.name);

    // Check file size
    if (file.size > MAX_BACKUP_FILE_SIZE) {
      console.warn(
        `[Backup] Backup file is large (${(file.size / 1024 / 1024).toFixed(2)} MB), this may take a moment to process`,
      );
    } else if (file.size > 5 * 1024 * 1024) {
      console.info(
        `[Backup] Backup file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`,
      );
    }

    // Read file as text
    const fileContent = await file.text();

    // Parse JSON with error handling
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
