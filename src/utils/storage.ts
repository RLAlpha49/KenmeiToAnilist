/**
 * @packageDocumentation
 * @module storage
 * @description Storage utilities for Kenmei data, sync configuration, and match results. Provides abstraction over localStorage and electron-store for persistence and migration.
 */
import type {
  AdvancedMatchFilters,
  FilterPreset,
} from "../types/matching-filters";
import { defaultAdvancedFilters } from "../types/matching-filters";
import { captureError, ErrorType } from "./error-handling";

declare global {
  interface Window {
    electronStore: {
      getItem: (key: string) => Promise<string | null>;
      setItem: (key: string, value: string) => Promise<boolean>;
      removeItem: (key: string) => Promise<boolean>;
      clear: () => Promise<boolean>;
    };
  }
}

/**
 * Manga entry imported from Kenmei.
 * @source
 */
export interface KenmeiManga {
  id: string | number;
  title: string;
  status: string;
  score: number;
  chaptersRead: number;
  volumesRead: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastReadAt?: string;
}

/**
 * Collection of manga entries from a Kenmei import.
 * @source
 */
export interface KenmeiData {
  manga?: KenmeiManga[];
}

/**
 * Statistics for a Kenmei import operation.
 * @source
 */
export interface ImportStats {
  total: number;
  timestamp: string;
  statusCounts: Record<string, number>;
}

/**
 * AniList manga search result with core metadata.
 * @source
 */
export interface AnilistMatch {
  id: number;
  title: {
    english?: string | null;
    romaji?: string | null;
    native?: string | null;
  };
  coverImage?: {
    medium?: string;
    large?: string;
  };
  description?: string;
  status?: string;
  matchConfidence?: number;
}

/**
 * Match result between a Kenmei manga and AniList candidates.
 * @source
 */
export interface MatchResult {
  kenmeiManga: KenmeiManga;
  anilistMatches?: AnilistMatch[];
  selectedMatch?: AnilistMatch;
  status: string;
  matchDate?: string;
}

/**
 * In-memory cache for storage operations to reduce I/O.
 * @source
 */
export const storageCache: Record<string, string> = {};

/**
 * Unified storage abstraction across cache, localStorage, and electron-store.
 * @source
 */
export const storage = {
  /**
   * Retrieves a value from cache or localStorage.
   * @param key - Storage key.
   * @returns The stored value, or null if not found.
   * @source
   */
  getItem: (key: string): string | null => {
    try {
      // Check cache first to avoid redundant reads
      if (key in storageCache) {
        return storageCache[key];
      }

      // Return from localStorage synchronously
      // NOTE: For most accurate data, use getItemAsync() which checks electron-store first
      const value = localStorage.getItem(key);

      // Cache the value
      if (value !== null) {
        storageCache[key] = value;
      }

      return value;
    } catch (error) {
      captureError(
        ErrorType.STORAGE,
        `Error reading from storage key: ${key}`,
        error instanceof Error ? error : new Error(String(error)),
        { key, operation: "read" },
      );
      return null;
    }
  },

  /**
   * Stores a value across all storage layers (cache, localStorage, electron-store).
   * Skips writes if the value hasn't changed in the cache.
   * @param key - Storage key.
   * @param value - Value to store.
   * @source
   */
  setItem: (key: string, value: string): void => {
    try {
      // Redundancy check: skip write if value hasn't changed in cache
      // This prevents unnecessary I/O, but can cause drift if layers get out of sync
      if (storageCache[key] === value) {
        console.debug(`[Storage] 🔍 Skipping redundant write for key: ${key}`);
        return;
      }

      console.debug(
        `[Storage] 🔍 Setting item: ${key} (${value.length} bytes)`,
      );

      // Update cache
      storageCache[key] = value;

      // Store in localStorage for compatibility
      localStorage.setItem(key, value);

      // Also store in electronStore if available
      if (globalThis.electronStore) {
        globalThis.electronStore.setItem(key, value).catch((error) => {
          captureError(
            ErrorType.SYSTEM,
            `Error writing to electron-store: ${key}`,
            error instanceof Error ? error : new Error(String(error)),
            { key, operation: "write", target: "electron-store" },
          );
        });
      }
    } catch (error) {
      captureError(
        ErrorType.STORAGE,
        `Error writing to storage key: ${key}`,
        error instanceof Error ? error : new Error(String(error)),
        { key, operation: "write", valueSize: value.length },
      );
    }
  },

  /**
   * Removes a value from all storage layers.
   * @param key - Storage key to remove.
   * @source
   */
  removeItem: (key: string): void => {
    try {
      console.debug(`[Storage] 🔍 Removing item: ${key}`);

      // Remove from cache
      delete storageCache[key];

      // Remove from localStorage for compatibility
      localStorage.removeItem(key);

      // Also remove from electronStore if available
      if (globalThis.electronStore) {
        globalThis.electronStore.removeItem(key).catch((error) => {
          captureError(
            ErrorType.SYSTEM,
            `Error deleting from electron-store: ${key}`,
            error instanceof Error ? error : new Error(String(error)),
            { key, operation: "delete", target: "electron-store" },
          );
        });
      }
    } catch (error) {
      captureError(
        ErrorType.STORAGE,
        `Error deleting storage key: ${key}`,
        error instanceof Error ? error : new Error(String(error)),
        { key, operation: "delete" },
      );
    }
  },

  /**
   * Clears all storage layers.
   * @source
   */
  clear: (): void => {
    try {
      console.info("[Storage] 🗑️ Clearing all storage...");

      // Clear cache
      const keyCount = Object.keys(storageCache).length;
      for (const key of Object.keys(storageCache)) {
        delete storageCache[key];
      }

      // Clear localStorage for compatibility
      localStorage.clear();

      // Also clear electronStore if available
      if (globalThis.electronStore) {
        globalThis.electronStore.clear().catch((error) => {
          console.warn("[Storage] ❌ Error clearing electron-store:", error);
        });
      }

      console.info(`[Storage] ✅ Cleared ${keyCount} keys from storage`);
    } catch (error) {
      captureError(
        ErrorType.STORAGE,
        "Error clearing all storage layers",
        error instanceof Error ? error : new Error(String(error)),
        { operation: "clear" },
      );
    }
  },

  /**
   * Stores a value to electron-store (authoritative), then syncs to localStorage.
   * @param key - Storage key.
   * @param value - Value to store.
   * @returns Promise that resolves when complete.
   * @source
   */
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (!globalThis.electronStore) {
      // Fallback to sync method if no electron store
      console.debug(
        `[Storage] 🔍 No electron-store available, using sync setItem for ${key}`,
      );
      storage.setItem(key, value);
      return;
    }

    try {
      console.debug(
        `[Storage] 🔍 Async setting item: ${key} (${value.length} bytes)`,
      );

      // Write to electron-store first (authoritative source)
      await globalThis.electronStore.setItem(key, value);

      // Update cache
      storageCache[key] = value;

      // Sync to localStorage
      localStorage.setItem(key, value);

      console.debug(`[Storage] ✅ Async set complete: ${key}`);
    } catch (error) {
      captureError(
        ErrorType.STORAGE,
        `Error async setting item: ${key}`,
        error instanceof Error ? error : new Error(String(error)),
        { key, operation: "write-async", valueSize: value.length },
      );
      throw error;
    }
  },
  /**
   * Retrieves a value, preferring electron-store (authoritative) over localStorage.
   * @param key - Storage key.
   * @returns Promise resolving to the stored value or null.
   * @source
   */
  getItemAsync: async (key: string): Promise<string | null> => {
    if (globalThis.electronStore) {
      try {
        console.debug(`[Storage] 🔍 Async getting item: ${key}`);
        const value = await globalThis.electronStore.getItem(key);
        if (value === null) {
          console.debug(`[Storage] 🔍 Item not found: ${key}`);
        } else {
          console.debug(
            `[Storage] ✅ Found item: ${key} (${value.length} bytes)`,
          );
          localStorage.setItem(key, value); // keep localStorage in sync
          storageCache[key] = value;
        }
        return value;
      } catch (error) {
        captureError(
          ErrorType.SYSTEM,
          `Error reading from electron-store: ${key}`,
          error instanceof Error ? error : new Error(String(error)),
          { key, operation: "read-async", target: "electron-store" },
        );
        console.debug(`[Storage] 🔍 Falling back to localStorage for: ${key}`);
        // fallback to localStorage
        return localStorage.getItem(key);
      }
    }
    // fallback if no electronStore
    console.debug(
      `[Storage] 🔍 No electron-store available, using localStorage for ${key}`,
    );
    return localStorage.getItem(key);
  },
};

/**
 * Initializes onboarding keys with default values if missing.
 * @internal
 * @source
 */
async function ensureOnboardingKeysInitialized(): Promise<void> {
  try {
    // Check if ONBOARDING_COMPLETED exists, if not set it to "false"
    const completedExists = await storage.getItemAsync(
      STORAGE_KEYS.ONBOARDING_COMPLETED,
    );
    if (completedExists === null) {
      console.debug(
        "[Storage] 🔧 Initializing ONBOARDING_COMPLETED to 'false'",
      );
      await storage.setItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED, "false");
    }

    // Check if ONBOARDING_STEPS_COMPLETED exists, if not set it to "[]"
    const stepsExist = await storage.getItemAsync(
      STORAGE_KEYS.ONBOARDING_STEPS_COMPLETED,
    );
    if (stepsExist === null) {
      console.debug(
        "[Storage] 🔧 Initializing ONBOARDING_STEPS_COMPLETED to '[]'",
      );
      await storage.setItemAsync(STORAGE_KEYS.ONBOARDING_STEPS_COMPLETED, "[]");
    }
  } catch (error) {
    console.error(
      "[Storage] ⚠️ Failed to ensure onboarding keys initialized:",
      error,
    );
  }
}

/**
 * Syncs electron-store to localStorage on app startup.
 * @source
 */
/**
 * Syncs a single storage key from electron-store to localStorage.
 * @param key - The storage key to sync
 * @returns 1 if synced successfully, 0 otherwise
 */
async function syncStorageKey(key: string): Promise<number> {
  try {
    const electronValue = await globalThis.electronStore?.getItem(key);
    if (electronValue !== null) {
      localStorage.setItem(key, electronValue);
      storageCache[key] = electronValue;
      return 1;
    }
  } catch (error) {
    console.error(`[Storage] ⚠️ Failed to sync key ${key}:`, error);
    captureError(
      ErrorType.STORAGE,
      `Error syncing storage key from electron-store: ${key}`,
      error instanceof Error ? error : new Error(String(error)),
      { key, operation: "sync" },
    );
  }
  return 0;
}

/**
 * Syncs the auth state from electron-store to localStorage.
 * @returns 1 if synced successfully, 0 otherwise
 */
async function syncAuthState(): Promise<number> {
  try {
    const authState = await globalThis.electronStore?.getItem("authState");
    if (authState !== null) {
      localStorage.setItem("authState", authState);
      storageCache["authState"] = authState;
      return 1;
    }
  } catch (error) {
    captureError(
      ErrorType.STORAGE,
      "Error syncing authState from electron-store",
      error instanceof Error ? error : new Error(String(error)),
      { key: "authState", operation: "sync" },
    );
  }
  return 0;
}

export async function initializeStorage(): Promise<void> {
  if (!globalThis.electronStore) {
    console.debug("[Storage] 🔧 Electron store not available, skipping sync");
    return;
  }

  try {
    console.debug("[Storage] 🔄 Syncing electron-store to localStorage...");
    let syncCount = 0;

    // Sync all known storage keys
    const keys = Object.values(STORAGE_KEYS);
    for (const key of keys) {
      syncCount += await syncStorageKey(key);
    }

    // Also sync auth state
    syncCount += await syncAuthState();

    console.info(
      `[Storage] ✅ Synced ${syncCount} keys from electron-store to localStorage`,
    );

    // Ensure onboarding keys are properly initialized
    await ensureOnboardingKeysInitialized();
  } catch (error) {
    captureError(
      ErrorType.STORAGE,
      "Error during storage initialization",
      error instanceof Error ? error : new Error(String(error)),
      { operation: "initialize" },
    );
  }
}

/**
 * Storage keys for persisted state.
 * @source
 */
export const STORAGE_KEYS = {
  KENMEI_DATA: "kenmei_data",
  IMPORT_STATS: "import_stats",
  MATCH_RESULTS: "match_results",
  PENDING_MANGA: "pending_manga",
  CACHE_VERSION: "cache_version",
  SYNC_CONFIG: "sync_config",
  SYNC_STATS: "sync_stats",
  MATCH_CONFIG: "match_config",
  MATCH_FILTERS: "match_filters",
  MATCH_FILTER_PRESETS: "match_filter_presets",
  IGNORED_DUPLICATES: "ignored_duplicates",
  ACTIVE_SYNC_SNAPSHOT: "active_sync_snapshot",
  ANILIST_SEARCH_CACHE: "anilist_search_cache",
  TITLE_NORMALIZATION_CACHE: "title_normalization_cache",
  UPDATE_DISMISSED_VERSIONS: "update_dismissed_versions",
  UPDATE_CHANNEL: "update_channel",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_STEPS_COMPLETED: "onboarding_steps_completed",
  BACKUP_HISTORY: "backup_history",
  AUTO_BACKUP_ENABLED: "auto_backup_enabled",
  SYNC_HISTORY: "sync_history",
  BACKUP_SCHEDULE_CONFIG: "backup_schedule_config",
  READING_HISTORY: "reading_history",
  FAILED_OPERATIONS: "failed_operations",
  SETTINGS_COLLAPSED_SECTIONS: "settings_collapsed_sections",
};

/**
 * Current cache schema version. Increment when breaking changes occur.
 * @source
 */
export const CURRENT_CACHE_VERSION = 1;

/**
 * Sync operation settings.
 * @source
 */
export interface SyncConfig {
  prioritizeAniListStatus: boolean;
  prioritizeAniListProgress: boolean;
  prioritizeAniListScore: boolean;
  preserveCompletedStatus: boolean;
  setPrivate: boolean;
  incrementalSync: boolean;
  autoPauseInactive: boolean;
  autoPauseThreshold: number;
  customAutoPauseThreshold?: number;
  updateStatus: boolean;
  updateProgress: boolean;
  overwriteExisting: boolean;
}

/**
 * Default sync configuration.
 * @source
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  prioritizeAniListStatus: false,
  prioritizeAniListProgress: true,
  prioritizeAniListScore: true,
  preserveCompletedStatus: true,
  incrementalSync: false,
  setPrivate: false,
  autoPauseInactive: false,
  autoPauseThreshold: 60,
  customAutoPauseThreshold: 60,
  updateStatus: true,
  updateProgress: true,
  overwriteExisting: false,
};

/**
 * Metadata fields that custom rules can target.
 * @source
 */
export type CustomRuleTarget =
  | "titles" // All title variants (romaji, english, native, synonyms, alternative_titles)
  | "author" // Author/staff names
  | "genres" // Genre array
  | "tags" // Tag names and categories
  | "format" // Manga format (MANGA, NOVEL, ONE_SHOT, etc.)
  | "country" // Country of origin
  | "source" // Source material (ORIGINAL, MANGA, LIGHT_NOVEL, etc.)
  | "description" // Description text and notes
  | "status"; // Publishing status

/**
 * Regex-based custom matching rule for filtering manga.
 * @source
 */
export interface CustomRule {
  id: string;
  pattern: string;
  description: string;
  enabled: boolean;
  caseSensitive: boolean;
  targetFields: CustomRuleTarget[];
  createdAt: string;
}

/**
 * Set of custom skip and accept rules.
 * @source
 */
export interface CustomRulesConfig {
  skipRules: CustomRule[];
  acceptRules: CustomRule[];
}

/**
 * Title normalization cache storing per-algorithm normalized forms.
 * Maps original titles to their normalized versions for each algorithm.
 * @source
 */
export interface TitleNormalizationCache {
  /**
   * Per-algorithm caches mapping original titles to normalized forms
   */
  caches: {
    [algorithm: string]: Record<string, string>;
  };
  /**
   * Timestamp when cache was last updated
   */
  lastUpdated: number;
  /**
   * Schema version for future migrations
   */
  version: number;
}

/**
 * Default empty title normalization cache.
 * @source
 */
export const DEFAULT_TITLE_NORMALIZATION_CACHE: TitleNormalizationCache = {
  caches: {},
  lastUpdated: Date.now(),
  version: 1,
};

export interface MatchConfig {
  shouldIgnoreOneShots: boolean;
  shouldIgnoreAdultContent: boolean;
  blurAdultContent: boolean;
  enableComickSearch: boolean;
  enableMangaDexSearch: boolean;
  customRules?: CustomRulesConfig;
}

/**
 * Backup interval options.
 * @source
 */
export type BackupInterval = "daily" | "weekly" | "monthly" | "disabled";

/**
 * Automatic backup scheduling configuration.
 * @source
 */
export interface BackupScheduleConfig {
  enabled: boolean;
  interval: BackupInterval;
  lastBackupTimestamp: number | null;
  nextBackupTimestamp: number | null;
  maxBackupCount: number;
  maxBackupSizeMB: number;
  backupLocation: string;
  autoBackupBeforeSync: boolean;
  autoBackupBeforeMatch: boolean;
}

/**
 * Default backup schedule configuration.
 * @source
 */
export const DEFAULT_BACKUP_SCHEDULE_CONFIG: BackupScheduleConfig = {
  enabled: false,
  interval: "weekly",
  lastBackupTimestamp: null,
  nextBackupTimestamp: null,
  maxBackupCount: 10,
  maxBackupSizeMB: 100,
  backupLocation: "",
  autoBackupBeforeSync: false,
  autoBackupBeforeMatch: false,
};

/**
 * Reading history entry capturing manga progress at a point in time.
 * @source
 */
export interface ReadingHistoryEntry {
  timestamp: number; // Unix timestamp in milliseconds
  mangaId: string | number; // Kenmei manga ID
  title: string; // Manga title for display
  chaptersRead: number; // Chapters read at this timestamp
  status: string; // Reading status (reading, completed, etc.)
  anilistId?: number; // Optional AniList media ID if matched
}

/**
 * Enumeration of failed operation types.
 * @source
 */
export enum FailedOperationType {
  SYNC_UPDATE = "sync_update",
  SYNC_DELETE = "sync_delete",
  MATCH_SEARCH = "match_search",
  AUTH_TOKEN_EXCHANGE = "auth_token_exchange",
}

/**
 * Structure for a single failed operation with retry metadata.
 * @source
 */
export interface FailedOperation {
  id: string; // Unique identifier, timestamp-based
  type: FailedOperationType;
  timestamp: number; // When it failed
  retryCount: number; // How many times retried
  lastRetryTimestamp: number | null; // When last retry was attempted
  error: string; // Error message
  errorCode?: string; // Error code if available
  payload: unknown; // Operation-specific data
  context?: Record<string, unknown>; // Additional context
  permanentlyFailed?: boolean; // True if max retries exceeded and should not be retried
}

/**
 * Queue structure for managing failed operations.
 * @source
 */
export interface FailedOperationsQueue {
  operations: FailedOperation[];
  lastUpdated: number;
  version: number;
}

/**
 * Default failed operations queue structure.
 * @source
 */
export const DEFAULT_FAILED_OPERATIONS_QUEUE: FailedOperationsQueue = {
  operations: [],
  lastUpdated: Date.now(),
  version: 1,
};

/**
 * Maximum number of failed operations to store.
 * @source
 */
export const MAX_FAILED_OPERATIONS = 100;

/**
 * Maximum number of retry attempts before giving up.
 * @source
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Number of days to keep failed operations before auto-removal.
 * @source
 */
export const FAILED_OPERATION_EXPIRY_DAYS = 7;

/**
 * Reading history storage with entries and metadata.
 * @source
 */
export interface ReadingHistory {
  entries: ReadingHistoryEntry[];
  lastUpdated: number; // Unix timestamp of last update
  version: number; // Schema version for future migrations
}

/**
 * Default reading history (empty).
 * @source
 */
export const DEFAULT_READING_HISTORY: ReadingHistory = {
  entries: [],
  lastUpdated: Date.now(),
  version: 1,
};

/**
 * Maximum reading history entries retained (365 days).
 * @source
 */
export const MAX_READING_HISTORY_ENTRIES = 365;

/**
 * Default match configuration.
 * @source
 */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  shouldIgnoreOneShots: false,
  shouldIgnoreAdultContent: false,
  blurAdultContent: true,
  enableComickSearch: false, // Temporarily disabled - Comick unavailable
  enableMangaDexSearch: true,
  customRules: {
    skipRules: [],
    acceptRules: [],
  },
};

/**
 * Saves Kenmei data and updates import stats and cache version.
 * @param data - The Kenmei data to save.
 * @source
 */
export function saveKenmeiData(data: KenmeiData): void {
  try {
    console.info(
      `[Storage] 💾 Saving Kenmei data: ${data.manga?.length || 0} entries`,
    );
    storage.setItem(STORAGE_KEYS.KENMEI_DATA, JSON.stringify(data));

    // Also save import stats for quick access on dashboard
    const stats: ImportStats = {
      total: data.manga?.length || 0,
      timestamp: new Date().toISOString(),
      statusCounts: getStatusCountsFromData(data),
    };

    storage.setItem(STORAGE_KEYS.IMPORT_STATS, JSON.stringify(stats));

    // Save the current cache version if not already saved
    if (!storage.getItem(STORAGE_KEYS.CACHE_VERSION)) {
      console.debug(
        "[Storage] 🔍 Setting cache version to:",
        CURRENT_CACHE_VERSION,
      );
      storage.setItem(
        STORAGE_KEYS.CACHE_VERSION,
        CURRENT_CACHE_VERSION.toString(),
      );
    }

    console.info("[Storage] ✅ Kenmei data saved successfully");
  } catch (error) {
    console.error("[Storage] ❌ Error saving Kenmei data to storage", error);
  }
}

/**
 * Retrieves saved Kenmei data.
 * @returns The Kenmei data or null if not found.
 * @source
 */
export function getKenmeiData(): KenmeiData | null {
  try {
    console.debug("[Storage] 🔍 Retrieving Kenmei data...");
    const data = storage.getItem(STORAGE_KEYS.KENMEI_DATA);
    if (data) {
      const parsed = JSON.parse(data);
      console.info(
        `[Storage] ✅ Retrieved Kenmei data: ${parsed.manga?.length || 0} entries`,
      );
      return parsed;
    }
    console.debug("[Storage] 🔍 No Kenmei data found");
    return null;
  } catch (error) {
    console.error(
      "[Storage] ❌ Error retrieving Kenmei data from storage",
      error,
    );
    return null;
  }
}

/**
 * Retrieves saved import statistics.
 * @returns The import stats or null if not found.
 * @source
 */
export function getImportStats(): ImportStats | null {
  try {
    console.debug("[Storage] 🔍 Retrieving import stats...");
    const stats = storage.getItem(STORAGE_KEYS.IMPORT_STATS);
    if (stats) {
      const parsed = JSON.parse(stats);
      console.debug(
        `[Storage] ✅ Retrieved import stats: ${parsed.total} total entries`,
      );
      return parsed;
    }
    console.debug("[Storage] 🔍 No import stats found");
    return null;
  } catch (error) {
    console.error(
      "[Storage] ❌ Error retrieving import stats from storage",
      error,
    );
    return null;
  }
}

/**
 * Calculates status counts from Kenmei data.
 * @param data - The Kenmei data to analyze.
 * @returns Map of status to entry count.
 * @internal
 * @source
 */
export function getStatusCountsFromData(
  data: KenmeiData,
): Record<string, number> {
  if (!data?.manga?.length) return {};

  return data.manga.reduce(
    (acc: Record<string, number>, manga: KenmeiManga) => {
      const status = manga.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

/**
 * Retrieves saved match results with cache version check.
 * @returns The match results or null if not found or incompatible version.
 * @source
 */
export function getSavedMatchResults(): MatchResult[] | null {
  try {
    console.debug("[Storage] 🔍 Retrieving saved match results...");

    // Check cache version compatibility
    const savedVersion = Number.parseInt(
      storage.getItem(STORAGE_KEYS.CACHE_VERSION) || "0",
      10,
    );
    if (savedVersion !== CURRENT_CACHE_VERSION && savedVersion !== 0) {
      console.warn(
        `[Storage] ⚠️ Cache version mismatch. Saved: ${savedVersion}, Current: ${CURRENT_CACHE_VERSION}`,
      );
      return null; // Consider the cache invalid if versions don't match
    }

    const savedResults = storage.getItem(STORAGE_KEYS.MATCH_RESULTS);
    if (savedResults) {
      const parsed = JSON.parse(savedResults);
      console.info(`[Storage] ✅ Retrieved ${parsed.length} match results`);
      return parsed;
    }
    console.debug("[Storage] 🔍 No match results found");
    return null;
  } catch (error) {
    captureError(
      ErrorType.STORAGE,
      "Error parsing saved match results",
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: "read-match-results",
        isParseError: error instanceof SyntaxError,
      },
    );
    return null;
  }
}

/**
 * Merges new match results with existing ones, preserving user progress.
 * @param newResults - The new matching results to merge.
 * @returns Merged results with preserved user selections and status.
 * @source
 */
export function mergeMatchResults(newResults: MatchResult[]): MatchResult[] {
  try {
    console.info(
      `[Storage] 🔄 Merging ${newResults.length} new match results...`,
    );

    // Get existing results
    const existingResults = getSavedMatchResults();
    if (
      !existingResults ||
      !Array.isArray(existingResults) ||
      existingResults.length === 0
    ) {
      console.info(
        "[Storage] ✅ No existing match results to merge, using new results",
      );
      return newResults;
    }

    console.debug(
      `[Storage] 🔍 Merging ${newResults.length} new results with ${existingResults.length} existing results`,
    );

    // Create a map of existing results for quick lookup by both ID and title
    const existingById = new Map<string, MatchResult>();
    const existingByTitle = new Map<string, MatchResult>();

    for (const match of existingResults) {
      if (match.kenmeiManga?.id != null) {
        existingById.set(match.kenmeiManga.id.toString(), match);
      }
      if (match.kenmeiManga?.title != null) {
        existingByTitle.set(match.kenmeiManga.title.toLowerCase(), match);
      }
    }

    // Process new results, preserving user progress from existing matches
    const processedResults = newResults.map((newMatch) => {
      // Try to find existing match by ID first
      let existingMatch =
        newMatch.kenmeiManga?.id === null
          ? undefined
          : existingById.get(newMatch.kenmeiManga.id.toString());

      // If not found by ID, try title (case insensitive)
      if (!existingMatch && newMatch.kenmeiManga?.title != null) {
        existingMatch = existingByTitle.get(
          newMatch.kenmeiManga.title.toLowerCase(),
        );
      }

      // If we found a match AND it has user progress (not pending), preserve it
      if (existingMatch && existingMatch.status !== "pending") {
        // Take new anilist matches but keep user's selected match and status
        return {
          ...newMatch,
          status: existingMatch.status,
          selectedMatch: existingMatch.selectedMatch,
          matchDate: existingMatch.matchDate,
        };
      }

      // Otherwise use the new match
      return newMatch;
    });

    // Create sets to track what we've processed
    const processedIds = new Set<string>();
    const processedTitles = new Set<string>();

    // Add all processed results to the tracking sets with better null handling
    for (const result of processedResults) {
      if (result.kenmeiManga?.id != null) {
        processedIds.add(result.kenmeiManga.id.toString());
      }
      if (result.kenmeiManga?.title != null) {
        processedTitles.add(result.kenmeiManga.title.toLowerCase());
      }
    }

    // Find existing results that weren't in the new results and add them
    const unprocessedExistingResults = existingResults.filter(
      (existingMatch) => {
        // Skip if we already processed this manga by ID
        if (
          existingMatch.kenmeiManga?.id != null &&
          processedIds.has(existingMatch.kenmeiManga.id.toString())
        ) {
          return false;
        }

        // Skip if we already processed this manga by title
        if (
          existingMatch.kenmeiManga?.title != null &&
          processedTitles.has(existingMatch.kenmeiManga.title.toLowerCase())
        ) {
          return false;
        }

        // This is an existing result that wasn't in the new batch, so include it
        return true;
      },
    );

    if (unprocessedExistingResults.length > 0) {
      console.debug(
        `[Storage] 🔍 Adding ${unprocessedExistingResults.length} existing results that weren't in the new batch`,
      );
    }

    // Combine processed results with unprocessed existing results
    const mergedResults = [...processedResults, ...unprocessedExistingResults];

    console.debug(
      `[Storage] 🔍 Merged results: ${mergedResults.length} total items`,
    );

    // Check how many preserved matches we have
    const preservedCount = mergedResults.filter(
      (m) => m.status !== "pending",
    ).length;
    console.info(
      `[Storage] ✅ Merge complete: ${mergedResults.length} total, preserved ${preservedCount} user reviews`,
    );

    return mergedResults;
  } catch (error) {
    console.error("[Storage] ❌ Error merging match results", error);
    return newResults; // Fall back to new results on error
  }
}

/**
 * Saves sync configuration.
 * @param config - The sync configuration to save.
 * @source
 */
export function saveSyncConfig(config: SyncConfig): void {
  try {
    storage.setItem(STORAGE_KEYS.SYNC_CONFIG, JSON.stringify(config));
  } catch (error) {
    console.error("[Storage] Error saving sync config to storage", error);
  }
}

/**
 * Retrieves sync configuration, using defaults if not found.
 * @returns The saved sync configuration or default.
 * @source
 */
export function getSyncConfig(): SyncConfig {
  try {
    const config = storage.getItem(STORAGE_KEYS.SYNC_CONFIG);
    return config ? JSON.parse(config) : DEFAULT_SYNC_CONFIG;
  } catch (error) {
    console.error("[Storage] Error retrieving sync config from storage", error);
    return DEFAULT_SYNC_CONFIG;
  }
}

/**
 * Saves match configuration.
 * @param config - The match configuration to save.
 * @source
 */
export function saveMatchConfig(config: MatchConfig): void {
  try {
    storage.setItem(STORAGE_KEYS.MATCH_CONFIG, JSON.stringify(config));
  } catch (error) {
    console.error("[Storage] Error saving match config to storage", error);
  }
}

/**
 * Retrieves match configuration, using defaults if not found.
 * @returns The saved match configuration or default.
 * @source
 */
export function getMatchConfig(): MatchConfig {
  try {
    const config = storage.getItem(STORAGE_KEYS.MATCH_CONFIG);
    if (!config) {
      return DEFAULT_MATCH_CONFIG;
    }
    const parsed = JSON.parse(config);

    // Migrate custom rules before returning if they exist
    if (parsed.customRules) {
      const skipRules = Array.isArray(parsed.customRules.skipRules)
        ? parsed.customRules.skipRules.map(migrateCustomRule)
        : [];
      const acceptRules = Array.isArray(parsed.customRules.acceptRules)
        ? parsed.customRules.acceptRules.map(migrateCustomRule)
        : [];
      parsed.customRules = { skipRules, acceptRules };
    }

    // Merge with defaults to ensure new fields like customRules are always populated
    // Support legacy property names by mapping older keys to the new ones
    if (
      typeof parsed.ignoreOneShots === "boolean" &&
      parsed.shouldIgnoreOneShots === undefined
    ) {
      parsed.shouldIgnoreOneShots = parsed.ignoreOneShots;
      delete parsed.ignoreOneShots;
    }
    if (
      typeof parsed.ignoreAdultContent === "boolean" &&
      parsed.shouldIgnoreAdultContent === undefined
    ) {
      parsed.shouldIgnoreAdultContent = parsed.ignoreAdultContent;
      delete parsed.ignoreAdultContent;
    }

    return { ...DEFAULT_MATCH_CONFIG, ...parsed };
  } catch (error) {
    console.error(
      "[Storage] Error retrieving match config from storage",
      error,
    );
    return DEFAULT_MATCH_CONFIG;
  }
}

/**
 * Retrieves advanced match filters, using defaults if not found.
 * Validates and clamps all values to acceptable ranges.
 * @returns The advanced match filters.
 * @source
 */
/**
 * Sanitizes and validates confidence range values (0-100).
 * Ensures min <= max by swapping if needed.
 */
function sanitizeConfidenceRange(parsed: Record<string, unknown>): {
  min: number;
  max: number;
} {
  let minConfidence = 0;
  let maxConfidence = 100;

  const confidence = parsed.confidence as Record<string, unknown> | undefined;
  if (typeof confidence?.min === "number") {
    minConfidence = Math.max(0, Math.min(100, confidence.min));
  }
  if (typeof confidence?.max === "number") {
    maxConfidence = Math.max(0, Math.min(100, confidence.max));
  }

  // Ensure min <= max
  if (minConfidence > maxConfidence) {
    [minConfidence, maxConfidence] = [maxConfidence, minConfidence];
  }

  return { min: minConfidence, max: maxConfidence };
}

/**
 * Validates and extracts string array from parsed data.
 */
function validateStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Sanitizes and validates year range (1900-2100).
 * Ensures min <= max by swapping if needed.
 */
function sanitizeYearRange(parsed: Record<string, unknown>): {
  min: number | null;
  max: number | null;
} {
  const yearRange: { min: number | null; max: number | null } = {
    min: null,
    max: null,
  };

  const yr = parsed.yearRange as Record<string, unknown> | undefined;
  if (!yr) {
    return yearRange;
  }

  const minYear = typeof yr.min === "number" ? yr.min : null;
  const maxYear = typeof yr.max === "number" ? yr.max : null;

  // Clamp to reasonable range
  if (minYear !== null) {
    yearRange.min = Math.max(1900, Math.min(2100, minYear));
  }
  if (maxYear !== null) {
    yearRange.max = Math.max(1900, Math.min(2100, maxYear));
  }

  // Ensure min <= max if both are set
  if (
    yearRange.min !== null &&
    yearRange.max !== null &&
    yearRange.min > yearRange.max
  ) {
    [yearRange.min, yearRange.max] = [yearRange.max, yearRange.min];
  }

  return yearRange;
}

export function getMatchFilters(): AdvancedMatchFilters {
  try {
    const saved = storage.getItem(STORAGE_KEYS.MATCH_FILTERS);
    if (!saved) {
      return defaultAdvancedFilters;
    }

    const parsed = JSON.parse(saved);

    // Validate and sanitize all fields
    const confidence = sanitizeConfidenceRange(parsed);
    const formats = validateStringArray(parsed.formats);
    const genres = validateStringArray(parsed.genres);
    const publicationStatuses = validateStringArray(parsed.publicationStatuses);
    const tags = validateStringArray(parsed.tags);
    const yearRange = sanitizeYearRange(parsed);

    return {
      confidence,
      formats,
      genres,
      publicationStatuses,
      yearRange,
      tags,
    };
  } catch (error) {
    console.error("[Storage] Failed to load match filters:", error);
    return defaultAdvancedFilters;
  }
}

/**
 * Saves advanced match filters.
 * @param filters - The advanced match filters to save.
 * @source
 */
export function saveMatchFilters(filters: AdvancedMatchFilters): void {
  try {
    storage.setItem(STORAGE_KEYS.MATCH_FILTERS, JSON.stringify(filters));
    console.debug("[Storage] Saved match filters:", filters);
  } catch (error) {
    console.error("[Storage] Failed to save match filters:", error);
  }
}

/**
 * Retrieves user-created filter presets.
 * @returns Array of filter presets, empty array if none found or error.
 * @source
 */
export function getFilterPresets(): FilterPreset[] {
  try {
    const saved = storage.getItem(STORAGE_KEYS.MATCH_FILTER_PRESETS);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      console.error("[Storage] Filter presets is not an array");
      return [];
    }

    // Validate each preset structure
    const validPresets = parsed.filter((preset): preset is FilterPreset => {
      return (
        typeof preset === "object" &&
        typeof preset.id === "string" &&
        typeof preset.name === "string" &&
        typeof preset.filters === "object" &&
        typeof preset.createdAt === "string" &&
        typeof preset.updatedAt === "string"
      );
    });

    return validPresets;
  } catch (error) {
    console.error("[Storage] Failed to load filter presets:", error);
    return [];
  }
}

/**
 * Saves filter presets array.
 * @param presets - Array of filter presets to save.
 * @source
 */
export function saveFilterPresets(presets: FilterPreset[]): void {
  try {
    storage.setItem(STORAGE_KEYS.MATCH_FILTER_PRESETS, JSON.stringify(presets));
    console.debug("[Storage] Saved filter presets:", presets.length);
  } catch (error) {
    console.error("[Storage] Failed to save filter presets:", error);
  }
}

/**
 * Adds a new filter preset.
 * @param preset - Preset data without id and timestamps.
 * @returns The created preset with id and timestamps.
 * @source
 */
export function addFilterPreset(
  preset: Omit<FilterPreset, "id" | "createdAt" | "updatedAt">,
): FilterPreset {
  const presets = getFilterPresets();
  const now = new Date().toISOString();
  const newPreset: FilterPreset = {
    ...preset,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    createdAt: now,
    updatedAt: now,
  };

  presets.push(newPreset);
  saveFilterPresets(presets);

  console.debug("[Storage] Added filter preset:", newPreset.name);
  return newPreset;
}

/**
 * Updates an existing filter preset.
 * @param presetId - ID of preset to update.
 * @param updates - Partial preset data to update.
 * @returns True if updated successfully, false if not found.
 * @source
 */
export function updateFilterPreset(
  presetId: string,
  updates: Partial<Omit<FilterPreset, "id" | "createdAt" | "updatedAt">>,
): boolean {
  const presets = getFilterPresets();
  const index = presets.findIndex((p) => p.id === presetId);

  if (index === -1) {
    console.error("[Storage] Filter preset not found:", presetId);
    return false;
  }

  presets[index] = {
    ...presets[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveFilterPresets(presets);
  console.debug("[Storage] Updated filter preset:", presetId);
  return true;
}

/**
 * Deletes a filter preset.
 * @param presetId - ID of preset to delete.
 * @returns True if deleted successfully, false if not found.
 * @source
 */
export function deleteFilterPreset(presetId: string): boolean {
  const presets = getFilterPresets();
  const filtered = presets.filter((p) => p.id !== presetId);

  if (filtered.length === presets.length) {
    console.error("[Storage] Filter preset not found:", presetId);
    return false;
  }

  saveFilterPresets(filtered);
  console.debug("[Storage] Deleted filter preset:", presetId);
  return true;
}

/**
 * Saves backup schedule configuration.
 * @param config - The backup schedule configuration to save.
 * @source
 */
export function saveBackupScheduleConfig(config: BackupScheduleConfig): void {
  try {
    storage.setItem(
      STORAGE_KEYS.BACKUP_SCHEDULE_CONFIG,
      JSON.stringify(config),
    );
  } catch (error) {
    console.error(
      "[Storage] Error saving backup schedule config to storage",
      error,
    );
  }
}

/**
 * Retrieves reading history, using defaults if not found.
 * @returns The reading history.
 * @source
 */
export function getReadingHistory(): ReadingHistory {
  try {
    const stored = storage.getItem(STORAGE_KEYS.READING_HISTORY);
    if (!stored) {
      return DEFAULT_READING_HISTORY;
    }

    const parsed = JSON.parse(stored) as ReadingHistory;

    // Validate structure
    if (
      !Array.isArray(parsed.entries) ||
      typeof parsed.lastUpdated !== "number" ||
      typeof parsed.version !== "number"
    ) {
      console.warn(
        "[Storage] Invalid reading history structure, using defaults",
      );
      return DEFAULT_READING_HISTORY;
    }

    return parsed;
  } catch (error) {
    console.error("[Storage] Failed to load reading history:", error);
    return DEFAULT_READING_HISTORY;
  }
}

/**
 * Saves reading history.
 * @param history - The reading history to save.
 * @source
 */
export function saveReadingHistory(history: ReadingHistory): void {
  try {
    storage.setItem(STORAGE_KEYS.READING_HISTORY, JSON.stringify(history));
    console.debug(
      "[Storage] Saved reading history:",
      history.entries.length,
      "entries",
    );
  } catch (error) {
    console.error("[Storage] Failed to save reading history:", error);
  }
}

/**
 * Converts timestamp to local date string (YYYY-MM-DD).
 * @param timestamp - Unix timestamp in milliseconds.
 * @returns Local date string in YYYY-MM-DD format.
 * @source
 */
export function getLocalDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Records reading history snapshots with deduplication and retention limits.
 * @param entries - Reading history entries to record.
 * @source
 */
export function recordReadingHistory(entries: ReadingHistoryEntry[]): void {
  if (!entries.length) return;

  const history = getReadingHistory();
  const now = Date.now();

  // Create a map of existing entries by mangaId and date for deduplication (using local date)
  const existingMap = new Map<string, ReadingHistoryEntry>();
  for (const entry of history.entries) {
    const entryDate = getLocalDateString(entry.timestamp);
    const key = `${entry.mangaId}_${entryDate}`;
    existingMap.set(key, entry);
  }

  // Add or update entries
  for (const entry of entries) {
    const entryDate = getLocalDateString(entry.timestamp);
    const key = `${entry.mangaId}_${entryDate}`;

    // Only update if chapters changed or it's a new entry
    const existing = existingMap.get(key);
    if (!existing || existing.chaptersRead !== entry.chaptersRead) {
      existingMap.set(key, entry);
    }
  }

  // Convert back to array and sort by timestamp (newest first)
  const allEntries = Array.from(existingMap.values()).sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  // Enforce maximum entries limit per manga to avoid disproportionate truncation
  const entriesByManga = new Map<string | number, ReadingHistoryEntry[]>();
  for (const entry of allEntries) {
    if (!entriesByManga.has(entry.mangaId)) {
      entriesByManga.set(entry.mangaId, []);
    }
    entriesByManga.get(entry.mangaId)!.push(entry);
  }

  // Trim each manga's history to max entries, keeping newest
  const maxPerManga = 365;
  const trimmedEntries: ReadingHistoryEntry[] = [];
  for (const mangaEntries of entriesByManga.values()) {
    if (mangaEntries.length > maxPerManga) {
      trimmedEntries.push(...mangaEntries.slice(0, maxPerManga));
    } else {
      trimmedEntries.push(...mangaEntries);
    }
  }

  // Sort final list by timestamp (newest first)
  trimmedEntries.sort((a, b) => b.timestamp - a.timestamp);

  const updatedHistory: ReadingHistory = {
    entries: trimmedEntries,
    lastUpdated: now,
    version: 1,
  };

  saveReadingHistory(updatedHistory);
}

/**
 * Clears all reading history from storage.
 * @source
 */
export function clearReadingHistory(): void {
  try {
    storage.removeItem(STORAGE_KEYS.READING_HISTORY);
    console.info("[Storage] Cleared reading history");
  } catch (error) {
    console.error("[Storage] Failed to clear reading history:", error);
  }
}

/**
 * Retrieves failed operations queue, filtering out expired ones.
 * @returns The failed operations queue.
 * @source
 */
export function getFailedOperations(): FailedOperationsQueue {
  try {
    const stored = storage.getItem(STORAGE_KEYS.FAILED_OPERATIONS);
    if (!stored) {
      // Return a deep clone of DEFAULT_FAILED_OPERATIONS_QUEUE
      // to avoid mutating the constant
      return {
        operations: [],
        lastUpdated: Date.now(),
        version: DEFAULT_FAILED_OPERATIONS_QUEUE.version,
      };
    }

    const parsed = JSON.parse(stored) as FailedOperationsQueue;

    // Validate structure
    if (
      !Array.isArray(parsed.operations) ||
      typeof parsed.lastUpdated !== "number" ||
      typeof parsed.version !== "number"
    ) {
      console.warn(
        "[Storage] Invalid failed operations structure, using defaults",
      );
      // Return a fresh copy instead of the constant
      return {
        operations: [],
        lastUpdated: Date.now(),
        version: DEFAULT_FAILED_OPERATIONS_QUEUE.version,
      };
    }

    // Filter out expired operations
    const now = Date.now();
    const expiryMs = FAILED_OPERATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const validOperations = parsed.operations.filter(
      (op) => now - op.timestamp < expiryMs,
    );

    // If we filtered out any operations, save the updated queue
    if (validOperations.length < parsed.operations.length) {
      const updated: FailedOperationsQueue = {
        operations: validOperations,
        lastUpdated: now,
        version: parsed.version,
      };
      storage.setItem(STORAGE_KEYS.FAILED_OPERATIONS, JSON.stringify(updated));
      console.debug(
        `[Storage] Removed ${parsed.operations.length - validOperations.length} expired operations`,
      );
      return updated;
    }

    return parsed;
  } catch (error) {
    console.error("[Storage] Failed to load failed operations:", error);
    // Return a fresh copy instead of the constant
    return {
      operations: [],
      lastUpdated: Date.now(),
      version: DEFAULT_FAILED_OPERATIONS_QUEUE.version,
    };
  }
}

/**
 * Adds a failed operation to the queue, enforcing size limits.
 * @param operation - The failed operation to add.
 * @returns The created failed operation with ID and timestamp.
 * @source
 */
export function addFailedOperation(
  operation: Omit<
    FailedOperation,
    "id" | "timestamp" | "retryCount" | "lastRetryTimestamp"
  >,
): FailedOperation {
  try {
    const queue = getFailedOperations();
    const now = Date.now();

    // Create full operation object
    const fullOperation: FailedOperation = {
      id: `${now}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: now,
      retryCount: 0,
      lastRetryTimestamp: null,
      ...operation,
    };

    // Add to queue
    queue.operations.push(fullOperation);

    // Enforce size limit (remove oldest if exceeded)
    if (queue.operations.length > MAX_FAILED_OPERATIONS) {
      const toRemove = queue.operations.length - MAX_FAILED_OPERATIONS;
      queue.operations = queue.operations
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(toRemove);
      console.debug(
        `[Storage] Removed ${toRemove} oldest failed operations to stay within limit`,
      );
    }

    queue.lastUpdated = now;

    // Save updated queue
    storage.setItem(STORAGE_KEYS.FAILED_OPERATIONS, JSON.stringify(queue));
    console.info(`[Storage] Added failed operation: ${fullOperation.id}`);

    return fullOperation;
  } catch (error) {
    console.error("[Storage] Failed to add operation to queue:", error);
    throw error;
  }
}

/**
 * Updates a failed operation in the queue.
 * @param id - The operation ID.
 * @param updates - Partial updates to apply.
 * @returns The updated operation, or null if not found.
 * @source
 */
export function updateFailedOperation(
  id: string,
  updates: Partial<FailedOperation>,
): FailedOperation | null {
  try {
    const queue = getFailedOperations();
    const operation = queue.operations.find((op) => op.id === id);

    if (!operation) {
      console.warn(`[Storage] Failed operation not found: ${id}`);
      return null;
    }

    // Apply updates
    Object.assign(operation, updates);
    queue.lastUpdated = Date.now();

    // Save updated queue
    storage.setItem(STORAGE_KEYS.FAILED_OPERATIONS, JSON.stringify(queue));
    console.debug(`[Storage] Updated failed operation: ${id}`);

    return operation;
  } catch (error) {
    console.error("[Storage] Failed to update operation:", error);
    throw error;
  }
}

/**
 * Removes a failed operation from the queue.
 * @param id - The operation ID.
 * @returns True if removed, false if not found.
 * @source
 */
export function removeFailedOperation(id: string): boolean {
  try {
    const queue = getFailedOperations();
    const initialLength = queue.operations.length;

    queue.operations = queue.operations.filter((op) => op.id !== id);
    queue.lastUpdated = Date.now();

    // Save updated queue
    storage.setItem(STORAGE_KEYS.FAILED_OPERATIONS, JSON.stringify(queue));

    const removed = queue.operations.length < initialLength;
    if (removed) {
      console.info(`[Storage] Removed failed operation: ${id}`);
    }

    return removed;
  } catch (error) {
    console.error("[Storage] Failed to remove operation:", error);
    throw error;
  }
}

/**
 * Clears failed operations, optionally filtered by type.
 * @param type - Optional operation type to clear; if omitted, clears all.
 * @source
 */
export function clearFailedOperations(type?: FailedOperationType): void {
  try {
    const queue = getFailedOperations();
    const initialLength = queue.operations.length;

    if (type) {
      queue.operations = queue.operations.filter((op) => op.type !== type);
      console.info(
        `[Storage] Cleared ${initialLength - queue.operations.length} failed ${type} operations`,
      );
    } else {
      queue.operations = [];
      console.info("[Storage] Cleared all failed operations");
    }

    queue.lastUpdated = Date.now();
    storage.setItem(STORAGE_KEYS.FAILED_OPERATIONS, JSON.stringify(queue));
  } catch (error) {
    console.error("[Storage] Failed to clear operations:", error);
  }
}

/**
 * Increments retry count and last retry timestamp.
 * Marks as permanently failed if max retries exceeded.
 * @param id - The operation ID.
 * @source
 */
export function incrementRetryCount(id: string): void {
  try {
    const queue = getFailedOperations();
    const operation = queue.operations.find((op) => op.id === id);

    if (operation) {
      operation.retryCount += 1;
      operation.lastRetryTimestamp = Date.now();

      // Mark as permanently failed if max retries exceeded
      if (operation.retryCount >= MAX_RETRY_ATTEMPTS) {
        operation.permanentlyFailed = true;
        console.debug(
          `[Storage] Operation ${id} marked as permanently failed after ${MAX_RETRY_ATTEMPTS} retries`,
        );
      }

      queue.lastUpdated = Date.now();

      storage.setItem(STORAGE_KEYS.FAILED_OPERATIONS, JSON.stringify(queue));
      console.debug(
        `[Storage] Incremented retry count for operation ${id}: ${operation.retryCount}`,
      );
    }
  } catch (error) {
    console.error("[Storage] Failed to increment retry count:", error);
  }
}

/**
 * Data payload for a failed sync operation.
 * @source
 */
export interface FailedSyncOperationData {
  mediaId: number;
  title: string;
  status: string;
  progress: number;
  score: number;
  private?: boolean;
  coverImage?: string | null;
  error: string;
  errorCode?: string;
  // Sync configuration snapshot for faithful retry
  previousValues?: {
    status: string;
    progress: number;
    score: number;
    private: boolean;
  } | null;
  syncMetadata?: {
    useIncrementalSync: boolean;
    targetProgress?: number;
    progress?: number;
    step?: number;
  } | null;
}

/**
 * Adds a failed sync operation with typed data.
 * @param data - The sync operation data.
 * @returns The created failed operation.
 * @source
 */
export function addFailedSyncOperation(
  data: FailedSyncOperationData,
): FailedOperation {
  const {
    mediaId,
    title,
    status,
    progress,
    score,
    private: isPrivate,
    coverImage,
    error,
    errorCode,
    previousValues,
    syncMetadata,
  } = data;
  return addFailedOperation({
    type: FailedOperationType.SYNC_UPDATE,
    error,
    errorCode,
    payload: {
      mediaId,
      title,
      status,
      progress,
      score,
      private: isPrivate ?? false,
      coverImage,
      previousValues: previousValues ?? null,
      syncMetadata: syncMetadata ?? null,
    },
    context: {
      failedAt: new Date().toISOString(),
    },
  });
}

/**
 * Retrieves backup schedule configuration, using defaults if not found.
 * @returns The saved backup schedule configuration or default.
 * @source
 */
export function getBackupScheduleConfig(): BackupScheduleConfig {
  try {
    const config = storage.getItem(STORAGE_KEYS.BACKUP_SCHEDULE_CONFIG);
    return config
      ? { ...DEFAULT_BACKUP_SCHEDULE_CONFIG, ...JSON.parse(config) }
      : DEFAULT_BACKUP_SCHEDULE_CONFIG;
  } catch (error) {
    console.error(
      "[Storage] Error retrieving backup schedule config from storage",
      error,
    );
    return DEFAULT_BACKUP_SCHEDULE_CONFIG;
  }
}

/**
 * Checks basic validation of a custom rule.
 * @param rule - The rule to check.
 * @returns Error message if invalid, undefined if valid.
 * @internal
 * @source
 */
function checkBasicValidation(rule: CustomRule): string | undefined {
  if (!rule.pattern || rule.pattern.trim() === "") {
    return "Pattern cannot be empty";
  }
  if (!rule.description || rule.description.trim() === "") {
    return "Description cannot be empty";
  }
  if (
    !rule.targetFields ||
    !Array.isArray(rule.targetFields) ||
    rule.targetFields.length === 0
  ) {
    return "At least one target field must be selected";
  }
  return undefined;
}

/**
 * Validates target fields are all valid CustomRuleTarget values.
 * @param targetFields - Fields to validate.
 * @returns Error message if invalid, undefined if all valid.
 * @internal
 * @source
 */
function validateTargetFields(
  targetFields: CustomRuleTarget[],
): string | undefined {
  const validTargets = new Set<CustomRuleTarget>([
    "titles",
    "author",
    "genres",
    "tags",
    "format",
    "country",
    "source",
    "description",
    "status",
  ]);
  const invalidFields = targetFields.filter(
    (field) => !validTargets.has(field),
  );
  if (invalidFields.length > 0) {
    return `Invalid target field(s): ${invalidFields.join(", ")}`;
  }
  return undefined;
}

/**
 * Checks if pattern contains ReDoS-vulnerable constructs.
 * @param pattern - The regex pattern to check.
 * @returns Warning if vulnerable, undefined if safe.
 * @internal
 * @source
 */
function checkRedosVulnerabilities(pattern: string): string | undefined {
  const redosWarning =
    "⚠️ This pattern may cause performance issues (ReDoS vulnerability). Consider simplifying: avoid nested quantifiers like (a+)+, overlapping alternations like (a|aa)+, or catastrophic patterns like (.*a)*. See regex documentation for safer alternatives.";

  // Detect nested quantifiers: (a+)+, (\w*)*, etc.
  if (/(\w+[+*?]|\([^)]+\)[+*?])[+*?]/.test(pattern)) {
    return redosWarning;
  }

  // Detect overlapping alternations: (a|aa)+, (ab|a)*, etc.
  if (/\([^|]+\|[^|]+\)[+*]/.test(pattern)) {
    return redosWarning;
  }

  // Detect catastrophic dot-star: ^(.*...)*, (.*a)*, etc.
  if (/\^?\(\.\*[^)]*\)[+*]/.test(pattern)) {
    return redosWarning;
  }

  return undefined;
}

/**
 * Checks for overly broad or complex patterns.
 * @param pattern - The regex pattern to check.
 * @returns Warning if problematic, undefined if acceptable.
 * @internal
 * @source
 */
function checkBroadPatterns(pattern: string): string | undefined {
  const broadPatterns = [
    /^(\.\*|\^?\.\*\$?|\(\.\*\))$/, // .* or ^.*$ or (.*)
    /^\(\|.*\|?\)$/, // (|...) empty alternations
    /^\|/, // starts with |
  ];

  for (const broadPattern of broadPatterns) {
    if (broadPattern.test(pattern)) {
      return `⚠️ This pattern matches almost everything. It will ${
        pattern === ".*" || pattern === "^.*$"
          ? "likely match all manga titles"
          : "match very broad sets of titles"
      }. Make sure this is intentional.`;
    }
  }

  // Check for unbounded repeats without anchors
  if (/^[^$]*[+*].*[+*]/.test(pattern) && !/[\^$]/.test(pattern)) {
    return "⚠️ Pattern has multiple unbounded repeats without anchors. Consider using ^ or $ to make it more specific, or use bounded quantifiers like {1,100}.";
  }

  // Check for very long patterns
  if (pattern.length > 200) {
    return "⚠️ This pattern is very long (>200 characters) and may be difficult to maintain. Consider breaking it into multiple simpler rules.";
  }

  return undefined;
}

/**
 * Validates a custom rule for syntax, security, and performance issues.
 * @param rule - The rule to validate.
 * @returns Validation result with error or warning messages.
 * @source
 */
export function validateCustomRule(rule: CustomRule): {
  valid: boolean;
  error?: string;
  warning?: string;
} {
  // Check basic validation
  const basicError = checkBasicValidation(rule);
  if (basicError) {
    return { valid: false, error: basicError };
  }

  // Validate target fields
  const targetFieldsError = validateTargetFields(rule.targetFields);
  if (targetFieldsError) {
    return { valid: false, error: targetFieldsError };
  }

  // Validate regex pattern syntax
  try {
    new RegExp(rule.pattern, rule.caseSensitive ? "u" : "ui");
  } catch (error) {
    return {
      valid: false,
      error: `Invalid regex pattern: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }

  // Check for ReDoS vulnerabilities
  const trimmedPattern = rule.pattern.trim();
  const redosWarning = checkRedosVulnerabilities(trimmedPattern);
  if (redosWarning) {
    return { valid: true, warning: redosWarning };
  }

  // Check for broad patterns
  const broadWarning = checkBroadPatterns(trimmedPattern);
  if (broadWarning) {
    return { valid: true, warning: broadWarning };
  }

  return { valid: true };
}

/**
 * Migrates rule to current format, defaulting targetFields to ['titles'] for backward compatibility.
 * @param rule - Partial rule (may be missing targetFields).
 * @returns Complete rule with all required properties.
 * @source
 */
export function migrateCustomRule(rule: Partial<CustomRule>): CustomRule {
  // Generate a stable ID if missing
  const id =
    rule.id || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    pattern: rule.pattern || "",
    description: rule.description || "",
    enabled: rule.enabled ?? true,
    caseSensitive: rule.caseSensitive ?? false,
    targetFields:
      rule.targetFields && rule.targetFields.length > 0
        ? rule.targetFields
        : ["titles"],
    createdAt: rule.createdAt || new Date().toISOString(),
  };
}

/**
 * AniList entry marked as ignored duplicate.
 * @source
 */
export interface IgnoredDuplicate {
  anilistId: number;
  anilistTitle: string;
  ignoredAt: number; // timestamp
}

/**
 * Adds an AniList entry to the ignored duplicates list.
 * @param anilistId - The AniList ID to ignore.
 * @param anilistTitle - The AniList title for reference.
 * @source
 */
export function addIgnoredDuplicate(
  anilistId: number,
  anilistTitle: string,
): void {
  try {
    const ignored = getIgnoredDuplicates();

    // Check if already ignored
    if (ignored.some((item) => item.anilistId === anilistId)) {
      return;
    }

    // Add new ignored entry
    ignored.push({
      anilistId,
      anilistTitle,
      ignoredAt: Date.now(),
    });

    storage.setItem(STORAGE_KEYS.IGNORED_DUPLICATES, JSON.stringify(ignored));
  } catch (error) {
    console.error("[Storage] Error saving ignored duplicate to storage", error);
  }
}

/**
 * Retrieves all ignored duplicate entries.
 * @returns Array of ignored duplicates, or empty array if none exist.
 * @source
 */
export function getIgnoredDuplicates(): IgnoredDuplicate[] {
  try {
    const ignored = storage.getItem(STORAGE_KEYS.IGNORED_DUPLICATES);
    return ignored ? JSON.parse(ignored) : [];
  } catch (error) {
    console.error(
      "[Storage] Error retrieving ignored duplicates from storage",
      error,
    );
    return [];
  }
}

/**
 * Removes an AniList entry from the ignored duplicates list.
 * @param anilistId - The AniList ID to un-ignore.
 * @source
 */
export function removeIgnoredDuplicate(anilistId: number): void {
  try {
    const ignored = getIgnoredDuplicates();
    const filtered = ignored.filter((item) => item.anilistId !== anilistId);
    storage.setItem(STORAGE_KEYS.IGNORED_DUPLICATES, JSON.stringify(filtered));
  } catch (error) {
    console.error(
      "[Storage] Error removing ignored duplicate from storage",
      error,
    );
  }
}

/**
 * Clears all ignored duplicates.
 * @source
 */
export function clearIgnoredDuplicates(): void {
  try {
    storage.removeItem(STORAGE_KEYS.IGNORED_DUPLICATES);
  } catch (error) {
    console.error(
      "[Storage] Error clearing ignored duplicates from storage",
      error,
    );
  }
}

/**
 * Checks if an AniList ID is in the ignored duplicates list.
 * @param anilistId - The AniList ID to check.
 * @returns True if the ID is ignored, false otherwise.
 * @source
 */
export function isAniListIdIgnored(anilistId: number): boolean {
  try {
    const ignored = getIgnoredDuplicates();
    return ignored.some((item) => item.anilistId === anilistId);
  } catch (error) {
    console.error("[Storage] Error checking if AniList ID is ignored", error);
    return false;
  }
}

/**
 * Checks if onboarding has been completed (uses authoritative async storage).
 * @returns Promise resolving to true if onboarding completed, false otherwise.
 * @source
 */
export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    const value = await storage.getItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED);
    return value === "true";
  } catch (error) {
    console.error(
      "[Storage] Error checking onboarding completion status",
      error,
    );
    return false;
  }
}

/**
 * Sets the onboarding completion status (uses authoritative async storage).
 * @param completed - Whether onboarding has been completed.
 * @returns Promise that resolves when complete.
 * @source
 */
export async function setOnboardingCompleted(
  completed: boolean,
): Promise<void> {
  try {
    await storage.setItemAsync(
      STORAGE_KEYS.ONBOARDING_COMPLETED,
      String(completed),
    );
  } catch (error) {
    console.error(
      "[Storage] Error setting onboarding completion status",
      error,
    );
  }
}

/**
 * Resets onboarding status to show wizard again.
 * @source
 */
export function resetOnboarding(): void {
  try {
    storage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
  } catch (error) {
    console.error("[Storage] Error resetting onboarding status", error);
  }
}

/**
 * Validates a sync snapshot object for completeness and correctness.
 * @param snapshot - The snapshot to validate.
 * @returns Validation result with status and optional reason.
 * @source
 */
export function validateSyncSnapshot(snapshot: unknown): {
  valid: boolean;
  reason?: string;
} {
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, reason: "Snapshot is not an object" };
  }

  const snap = snapshot as Record<string, unknown>;

  if (!Array.isArray(snap.entries)) {
    return { valid: false, reason: "Missing or invalid entries array" };
  }

  if (!Array.isArray(snap.uniqueMediaIds)) {
    return { valid: false, reason: "Missing or invalid uniqueMediaIds array" };
  }

  if (!Array.isArray(snap.remainingMediaIds)) {
    return {
      valid: false,
      reason: "Missing or invalid remainingMediaIds array",
    };
  }

  if (snap.remainingMediaIds.length === 0) {
    return { valid: false, reason: "No remaining entries in snapshot" };
  }

  if (!snap.progress || typeof snap.progress !== "object") {
    return { valid: false, reason: "Missing or invalid progress object" };
  }

  if (typeof snap.timestamp !== "number") {
    return { valid: false, reason: "Missing or invalid timestamp" };
  }

  if (snap.timestamp > Date.now()) {
    return { valid: false, reason: "Timestamp is in the future" };
  }

  return { valid: true };
}

/**
 * Checks if a sync snapshot is stale based on age.
 * @param timestamp - Snapshot timestamp in milliseconds.
 * @param maxAgeHours - Max age before stale (default 24 hours).
 * @returns True if stale, false otherwise.
 * @source
 */
export function isSyncSnapshotStale(
  timestamp: number,
  maxAgeHours: number = 24,
): boolean {
  const ageInHours = (Date.now() - timestamp) / (1000 * 60 * 60);
  return ageInHours > maxAgeHours;
}

/**
 * Removes stale or invalid sync snapshots.
 * @source
 */
export function cleanupStaleSyncSnapshot(): void {
  try {
    const storedSnapshot = storage.getItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
    if (!storedSnapshot) {
      return;
    }

    const parsed = JSON.parse(storedSnapshot);
    const validation = validateSyncSnapshot(parsed);

    if (!validation.valid) {
      console.warn(
        `[Storage] Removing invalid sync snapshot: ${validation.reason}`,
      );
      storage.removeItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
      return;
    }

    if (isSyncSnapshotStale(parsed.timestamp)) {
      const ageHours = Math.round(
        (Date.now() - parsed.timestamp) / (1000 * 60 * 60),
      );
      console.warn(
        `[Storage] Removing stale sync snapshot (${ageHours} hours old)`,
      );
      storage.removeItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
    }
  } catch (error) {
    console.error("[Storage] Error cleaning up sync snapshot:", error);
    storage.removeItem(STORAGE_KEYS.ACTIVE_SYNC_SNAPSHOT);
  }
}

/**
 * Retrieves the title normalization cache from storage.
 * @returns The normalization cache or default empty cache if not found.
 * @source
 */
export function getTitleNormalizationCache(): TitleNormalizationCache {
  try {
    const cached = storage.getItem(STORAGE_KEYS.TITLE_NORMALIZATION_CACHE);
    if (cached) {
      const parsed = JSON.parse(cached);
      console.debug(
        `[Storage] 📖 Retrieved title normalization cache with ${Object.keys(parsed.caches || {}).length} algorithms`,
      );
      return parsed;
    }
    console.debug(
      "[Storage] 📖 No title normalization cache found, returning empty",
    );
    return DEFAULT_TITLE_NORMALIZATION_CACHE;
  } catch (error) {
    console.error(
      "[Storage] ❌ Error retrieving title normalization cache",
      error,
    );
    return DEFAULT_TITLE_NORMALIZATION_CACHE;
  }
}

/**
 * Saves the title normalization cache to storage.
 * Applies worker-produced deltas to update the cache incrementally.
 * @param cache - The cache to save.
 * @source
 */
export function saveTitleNormalizationCache(
  cache: TitleNormalizationCache,
): void {
  try {
    storage.setItem(
      STORAGE_KEYS.TITLE_NORMALIZATION_CACHE,
      JSON.stringify(cache),
    );
    console.info(
      `[Storage] 💾 Saved title normalization cache with ${Object.keys(cache.caches).length} algorithms`,
    );
  } catch (error) {
    console.error("[Storage] ❌ Error saving title normalization cache", error);
  }
}

/**
 * Merges worker-produced deltas into the canonical normalization cache.
 * Applies added and modified entries from each algorithm.
 * @param deltas - Delta entries by algorithm.
 * @source
 */
export function applyNormalizationCacheDeltas(
  deltas?: Record<
    string,
    {
      added: Record<string, string>;
      modified: Record<string, string>;
    }
  >,
): void {
  if (!deltas || Object.keys(deltas).length === 0) {
    console.debug("[Storage] 📖 No deltas to apply to normalization cache");
    return;
  }

  try {
    const cache = getTitleNormalizationCache();

    for (const [algorithm, delta] of Object.entries(deltas)) {
      if (!cache.caches[algorithm]) {
        cache.caches[algorithm] = {};
      }

      // Apply additions
      Object.assign(cache.caches[algorithm], delta.added);

      // Apply modifications
      Object.assign(cache.caches[algorithm], delta.modified);
    }

    cache.lastUpdated = Date.now();
    saveTitleNormalizationCache(cache);

    console.info(
      `[Storage] ✅ Applied normalization cache deltas for ${Object.keys(deltas).length} algorithms`,
    );
  } catch (error) {
    console.error(
      "[Storage] ❌ Error applying normalization cache deltas",
      error,
    );
  }
}

/**
 * Clears the title normalization cache.
 * @source
 */
export function clearTitleNormalizationCache(): void {
  try {
    storage.removeItem(STORAGE_KEYS.TITLE_NORMALIZATION_CACHE);
    console.info("[Storage] 🧹 Cleared title normalization cache");
  } catch (error) {
    console.error(
      "[Storage] ❌ Error clearing title normalization cache",
      error,
    );
  }
}
