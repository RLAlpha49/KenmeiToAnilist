/**
 * @packageDocumentation
 * @module storage
 * @description Storage utilities for Kenmei data, sync configuration, and match results. Provides abstraction over localStorage and electron-store for persistence and migration.
 */
import type { AdvancedMatchFilters } from "../types/matchingFilters";
import { DEFAULT_ADVANCED_FILTERS } from "../types/matchingFilters";

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
 * Represents a manga entry from the Kenmei import.
 *
 * Contains metadata about a manga item including reading status, score, and progress.
 *
 * @source
 */
export interface KenmeiManga {
  id: string | number;
  title: string;
  status: string;
  score: number;
  chapters_read: number;
  volumes_read: number;
  notes: string;
  created_at: string;
  updated_at: string;
  last_read_at?: string;
}

/**
 * Represents the complete Kenmei data structure.
 *
 * Contains the collection of manga items and other import metadata.
 *
 * @source
 */
export interface KenmeiData {
  manga?: KenmeiManga[];
  // Add other data properties as needed
}

/**
 * Statistics tracking the import of Kenmei data.
 *
 * Counts total manga imported and breaks down by status category.
 *
 * @source
 */
export interface ImportStats {
  total: number;
  timestamp: string;
  statusCounts: Record<string, number>;
}

/**
 * Represents an AniList manga match with metadata.
 *
 * Minimal representation of an AniList manga entry returned from search/lookup operations.
 *
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
 * Represents a match result between a Kenmei manga entry and AniList candidates.
 *
 * Tracks the original Kenmei entry, available AniList matches, the user's selection,
 * and the status of the matching process.
 *
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
 * In-memory cache for storage operations to reduce redundant reads.
 *
 * Helps minimize repeated access to localStorage and electron-store.
 * Cleared on application restart; not persisted.
 *
 * @source
 */
export const storageCache: Record<string, string> = {};

/**
 * Storage abstraction layer combining in-memory cache, localStorage, and electron-store.
 *
 * Provides a unified interface for persistent storage that respects the three-layer hierarchy:
 * cache → localStorage → electron-store (authoritative source).
 * All operations are internally consistent across layers.
 *
 * @source
 */
export const storage = {
  /**
   * Retrieves a value from storage (cache → localStorage).
   *
   * Checks in-memory cache first, then falls back to localStorage. For most accurate data
   * that reflects electron-store state, use async getter functions instead.
   *
   * @param key - The storage key.
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
      console.error(`[Storage] Error getting item from storage: ${key}`, error);
      return null;
    }
  },

  /**
   * Stores a value across all storage layers (cache → localStorage → electron-store).
   *
   * Updates cache immediately and syncs to localStorage and electron-store asynchronously.
   * **Important**: Skips redundant writes if the in-memory cache already holds the same value.
   * This optimization avoids thrashing localStorage and electron-store during rapid successive writes
   * with the same value, but can cause drift if the storage layers become out of sync.
   *
   * If you suspect cache/localStorage/electron-store drift, clear the cache or use `storage.getItemAsync()`
   * to explicitly sync from the authoritative electron-store layer before writing.
   *
   * @param key - The storage key.
   * @param value - The value to store.
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
          console.error(
            `[Storage] ❌ Error storing ${key} in electron-store:`,
            error,
          );
        });
      }
    } catch (error) {
      console.error(
        `[Storage] ❌ Error setting item in storage: ${key}`,
        error,
      );
    }
  },

  /**
   * Removes a value from all storage layers (cache, localStorage, electron-store).
   *
   * Synchronously removes from cache and localStorage, asynchronously from electron-store.
   *
   * @param key - The storage key to remove.
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
          console.error(
            `[Storage] ❌ Error removing ${key} from electron-store:`,
            error,
          );
        });
      }
    } catch (error) {
      console.error(
        `[Storage] ❌ Error removing item from storage: ${key}`,
        error,
      );
    }
  },

  /**
   * Clears all items from all storage layers (cache, localStorage, electron-store).
   *
   * Complete reset of all stored data across all persistence layers.
   *
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
          console.error("[Storage] ❌ Error clearing electron-store:", error);
        });
      }

      console.info(`[Storage] ✅ Cleared ${keyCount} keys from storage`);
    } catch (error) {
      console.error("[Storage] ❌ Error clearing storage", error);
    }
  },

  /**
   * Asynchronously stores a value to electron-store first, then syncs to localStorage.
   *
   * This is the authoritative async write method that ensures electron-store is updated first
   * (the source of truth) before updating localStorage and cache. Use this for critical
   * persisted state like onboarding flags.
   *
   * @param key - The storage key.
   * @param value - The value to store.
   * @returns A promise that resolves when the write is complete.
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
      console.error(`[Storage] ❌ Error async setting item ${key}:`, error);
      throw error;
    }
  },
  /**
   * Asynchronously retrieves a value from storage, preferring electron-store if available.
   *
   * Checks electron-store first (authoritative source), falls back to localStorage,
   * and keeps both layers synchronized.
   *
   * @param key - The storage key.
   * @returns A promise resolving to the stored value or null if not found.
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
        console.error(
          `[Storage] ❌ Error retrieving ${key} from electron-store:`,
          error,
        );
        console.debug("[Storage] 🔍 Falling back to localStorage");
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
 * Ensures onboarding-specific keys are initialized with default values if missing.
 *
 * Sets ONBOARDING_COMPLETED to "false" and ONBOARDING_STEPS_COMPLETED to "[]"
 * if they don't exist, preventing the onboarding overlay from being unexpectedly
 * re-triggered due to missing initialization.
 *
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
 * Initializes storage by syncing electron-store to localStorage on app startup.
 *
 * Ensures both storage layers are in sync and loads cached values.
 * Should be called once during app initialization.
 *
 * @source
 */
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
      try {
        const electronValue = await globalThis.electronStore.getItem(key);
        if (electronValue !== null) {
          localStorage.setItem(key, electronValue);
          storageCache[key] = electronValue;
          syncCount++;
        }
      } catch (error) {
        console.error(`[Storage] ⚠️ Failed to sync key ${key}:`, error);
      }
    }

    // Also sync auth state
    try {
      const authState = await globalThis.electronStore.getItem("authState");
      if (authState !== null) {
        localStorage.setItem("authState", authState);
        storageCache["authState"] = authState;
        syncCount++;
      }
    } catch (error) {
      console.error("[Storage] ⚠️ Failed to sync authState:", error);
    }

    console.info(
      `[Storage] ✅ Synced ${syncCount} keys from electron-store to localStorage`,
    );

    // Ensure onboarding keys are properly initialized
    await ensureOnboardingKeysInitialized();
  } catch (error) {
    console.error("[Storage] ❌ Storage initialization failed:", error);
  }
}

/**
 * Storage keys used for Kenmei data, import stats, match results, and configuration.
 *
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
  IGNORED_DUPLICATES: "ignored_duplicates",
  ACTIVE_SYNC_SNAPSHOT: "active_sync_snapshot",
  ANILIST_SEARCH_CACHE: "anilist_search_cache",
  UPDATE_DISMISSED_VERSIONS: "update_dismissed_versions",
  UPDATE_CHANNEL: "update_channel",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_STEPS_COMPLETED: "onboarding_steps_completed",
  BACKUP_HISTORY: "backup_history",
  AUTO_BACKUP_ENABLED: "auto_backup_enabled",
  SYNC_HISTORY: "sync_history",
  BACKUP_SCHEDULE_CONFIG: "backup_schedule_config",
  READING_HISTORY: "reading_history",
};

/**
 * The current cache version. Increment this when incompatible changes are made to the data structure.
 *
 * @source
 */
export const CURRENT_CACHE_VERSION = 1;

/**
 * Sync configuration options for the application.
 *
 * @source
 */
export type SyncConfig = {
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
};

/**
 * The default sync configuration.
 *
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
 * Matching configuration options for automatic manga matching.
 *
 * @source
 */
/**
 * Represents a single custom matching rule.
 *
 * @property id - Unique identifier (timestamp-based)
 * @property pattern - Regex pattern string to match against manga titles
 * @property description - User-friendly label describing the rule's purpose
 * @property enabled - Whether the rule is currently active
 * @property caseSensitive - Whether pattern matching should be case-sensitive
 * @property createdAt - ISO timestamp of rule creation
 *
 * @example
 * ```typescript
 * const skipAnthologies: CustomRule = {
 *   id: "1234567890_abc123",
 *   pattern: "anthology",
 *   description: "Skip anthology collections",
 *   enabled: true,
 *   caseSensitive: false,
 *   createdAt: "2025-10-25T12:00:00.000Z"
 * };
 * ```
 *
 * @source
 */

/**
 * Target metadata fields for custom matching rules.
 *
 * @remarks
 * Determines which metadata fields a custom rule pattern should check:
 * - `titles`: All title variants (romaji, english, native, synonyms, alternative_titles)
 * - `author`: Author/staff names (filtered by Story, Art, Original Creator roles)
 * - `genres`: Genre array (Action, Romance, Fantasy, etc.)
 * - `tags`: Tag names and categories (Overpowered MC, Time Travel, etc.)
 * - `format`: Publication format (MANGA, NOVEL, ONE_SHOT, MANHWA, MANHUA)
 * - `country`: Country of origin (JP, KR, CN, etc.)
 * - `source`: Source material (ORIGINAL, MANGA, LIGHT_NOVEL, etc.)
 * - `description`: Description text and notes (HTML stripped from description)
 * - `status`: Publishing status (FINISHED, PUBLISHING, etc.)
 *
 * @example
 * ```typescript
 * const targets: CustomRuleTarget[] = ['titles', 'genres'];
 * // Pattern will check both title fields and genres
 * ```
 *
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
 * Custom matching rule for filtering manga based on regex patterns.
 *
 * @property id - Unique identifier for the rule
 * @property pattern - Regular expression pattern to match against
 * @property description - Human-readable description of what the rule does
 * @property enabled - Whether the rule is currently active
 * @property caseSensitive - Whether pattern matching should be case-sensitive
 * @property targetFields - Which metadata fields to check (defaults to ['titles'] for backward compatibility)
 * @property createdAt - ISO timestamp when the rule was created
 *
 * @remarks
 * The `targetFields` array determines which metadata fields the pattern checks.
 * Pattern matches if it matches ANY of the selected fields.
 * Array fields (genres, tags, synonyms) are flattened to strings for matching.
 * Missing fields are treated as non-match (not error).
 *
 * @example
 * ```typescript
 * const skipRule: CustomRule = {
 *   id: "rule-123",
 *   pattern: "isekai|reincarnation",
 *   description: "Skip isekai manga",
 *   enabled: true,
 *   caseSensitive: false,
 *   targetFields: ['genres', 'tags'], // Check genres and tags, not titles
 *   createdAt: "2025-10-25T12:00:00.000Z"
 * };
 * ```
 *
 * @source
 */
export type CustomRule = {
  id: string;
  pattern: string;
  description: string;
  enabled: boolean;
  caseSensitive: boolean;
  targetFields: CustomRuleTarget[];
  createdAt: string;
};

/**
 * Configuration for custom matching rules.
 *
 * @property skipRules - Rules for automatically excluding manga from matching results
 * @property acceptRules - Rules for automatically boosting confidence scores for matches
 *
 * @remarks
 * Skip rules are evaluated before ranking and prevent manga from appearing in results.
 * Accept rules are evaluated after ranking and boost confidence scores to ensure inclusion.
 * Both rule types check all title variants (romaji, english, native, synonyms, alternative titles).
 *
 * @source
 */
export type CustomRulesConfig = {
  skipRules: CustomRule[];
  acceptRules: CustomRule[];
};

export type MatchConfig = {
  ignoreOneShots: boolean;
  ignoreAdultContent: boolean;
  blurAdultContent: boolean;
  enableComickSearch: boolean;
  enableMangaDexSearch: boolean;
  customRules?: CustomRulesConfig;
};

/**
 * Backup schedule intervals.
 *
 * @source
 */
export type BackupInterval = "daily" | "weekly" | "monthly" | "disabled";

/**
 * Configuration for automatic backup scheduling.
 *
 * @property enabled - Whether automatic backups are enabled
 * @property interval - How often to create backups
 * @property lastBackupTimestamp - Unix timestamp of the last scheduled backup
 * @property nextBackupTimestamp - Unix timestamp of the next scheduled backup
 * @property maxBackupCount - Maximum number of backups to keep
 * @property maxBackupSizeMB - Maximum total backup size in megabytes
 * @property backupLocation - Full path to directory where backups are saved
 * @property autoBackupBeforeSync - Whether to auto-backup before sync operations
 * @property autoBackupBeforeMatch - Whether to auto-backup before match operations
 *
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
 * The default backup schedule configuration.
 *
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
 * Single reading history entry capturing manga progress at a point in time.
 * Used for trend analysis and velocity calculations.
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
 * Reading history storage structure with metadata.
 */
export interface ReadingHistory {
  entries: ReadingHistoryEntry[];
  lastUpdated: number; // Unix timestamp of last update
  version: number; // Schema version for future migrations
}

/**
 * Default reading history structure.
 */
export const DEFAULT_READING_HISTORY: ReadingHistory = {
  entries: [],
  lastUpdated: Date.now(),
  version: 1,
};

/**
 * Maximum number of history entries to retain (365 days worth).
 */
export const MAX_READING_HISTORY_ENTRIES = 365;

/**
 * The default match configuration.
 *
 * @source
 */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  ignoreOneShots: false,
  ignoreAdultContent: false,
  blurAdultContent: true,
  enableComickSearch: false, // Temporarily disabled - Comick unavailable
  enableMangaDexSearch: true,
  customRules: {
    skipRules: [],
    acceptRules: [],
  },
};

/**
 * Saves Kenmei manga data to storage and updates import stats and cache version.
 *
 * Also calculates and saves import statistics for quick dashboard access.
 *
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
 * Retrieves Kenmei manga data from storage.
 *
 * @returns The saved Kenmei data or null if not found.
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
 * Retrieves import statistics from storage.
 *
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
 *
 * Aggregates the number of manga entries for each reading status.
 *
 * @param data - The Kenmei data to analyze.
 * @returns An object mapping status strings to entry counts.
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
 * Retrieves saved match results from storage with cache version compatibility check.
 *
 * Validates the cache version before returning to ensure data is compatible with current app.
 *
 * @returns The saved match results or null if not found or incompatible.
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
    console.error(
      "[Storage] ❌ Error retrieving saved match results from storage",
      error,
    );
    return null;
  }
}

/**
 * Merges new match results with existing ones to preserve user progress.
 *
 * Maintains user selections and review status while updating with new match candidates.
 * Results not present in the new batch are preserved.
 *
 * @param newResults - The new matching results to merge.
 * @returns Merged results with preserved user progress and selections.
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
 * Saves sync configuration to storage.
 *
 * Persists user's sync preferences across sessions.
 *
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
 * Retrieves sync configuration from storage.
 *
 * Falls back to default configuration if not found or on error.
 *
 * @returns The saved sync configuration or default if not found.
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
 * Saves match configuration to storage.
 *
 * Persists user's match preferences and filters across sessions.
 *
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
 * Retrieves match configuration from storage.
 *
 * Falls back to default configuration if not found or on error.
 *
 * @returns The saved match configuration or default if not found.
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
 * Retrieves saved advanced match filters from storage.
 * Returns default filters if none are saved.
 * Validates and clamps all values to acceptable ranges.
 * @returns The advanced match filters configuration.
 * @source
 */
export function getMatchFilters(): AdvancedMatchFilters {
  try {
    const saved = storage.getItem(STORAGE_KEYS.MATCH_FILTERS);
    if (!saved) {
      return DEFAULT_ADVANCED_FILTERS;
    }

    const parsed = JSON.parse(saved);

    // Validate and sanitize confidence values
    let minConfidence = 0;
    let maxConfidence = 100;

    if (typeof parsed.confidence?.min === "number") {
      minConfidence = Math.max(0, Math.min(100, parsed.confidence.min));
    }
    if (typeof parsed.confidence?.max === "number") {
      maxConfidence = Math.max(0, Math.min(100, parsed.confidence.max));
    }

    // Ensure min <= max
    if (minConfidence > maxConfidence) {
      [minConfidence, maxConfidence] = [maxConfidence, minConfidence];
    }

    // Validate and sanitize array fields
    const validateStringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value.filter((item): item is string => typeof item === "string");
    };

    const formats = validateStringArray(parsed.formats);
    const genres = validateStringArray(parsed.genres);
    const publicationStatuses = validateStringArray(parsed.publicationStatuses);

    return {
      confidence: { min: minConfidence, max: maxConfidence },
      formats,
      genres,
      publicationStatuses,
    };
  } catch (error) {
    console.error("[Storage] Failed to load match filters:", error);
    return DEFAULT_ADVANCED_FILTERS;
  }
}

/**
 * Saves advanced match filters to storage.
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
 * Saves backup schedule configuration to storage.
 *
 * Persists user's backup schedule preferences across sessions.
 *
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
 * Retrieves reading history from storage.
 * Returns default empty history if none exists.
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
 * Saves reading history to storage.
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
 * Helper to get local date string from timestamp for consistent dedup and habit computation.
 * Uses local timezone to avoid day boundary mismatches.
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
 * Records a reading history snapshot for manga entries.
 * Deduplicates entries from the same day (local time) for the same manga.
 * Enforces maximum entries per manga to distribute retention fairly.
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
  let allEntries = Array.from(existingMap.values()).sort(
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
 * Retrieves backup schedule configuration from storage.
 *
 * Falls back to default configuration if not found or on error.
 *
 * @returns The saved backup schedule configuration or default if not found.
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
 * Checks for basic validation errors in a custom rule.
 *
 * @param rule - The custom rule to check
 * @returns Error message if invalid, undefined if valid
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
 *
 * @param targetFields - The target fields to validate
 * @returns Error message if invalid fields found, undefined if all valid
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
 *
 * @param pattern - The regex pattern to check
 * @returns Warning message if vulnerable, undefined if safe
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
 *
 * @param pattern - The regex pattern to check
 * @returns Warning message if problematic, undefined if acceptable
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
 * Validates a custom matching rule for correctness and safety.
 *
 * @param rule - The custom rule to validate
 * @returns Validation result with error or warning messages
 *
 * @remarks
 * Performs comprehensive validation including:
 * - Pattern and description non-empty checks
 * - Regex syntax validation
 * - ReDoS vulnerability detection (nested quantifiers, overlapping alternations)
 * - Overly broad pattern detection
 * - Target fields validation
 *
 * @example
 * ```typescript
 * const rule: CustomRule = {
 *   id: "123",
 *   pattern: "anthology",
 *   description: "Skip anthologies",
 *   enabled: true,
 *   caseSensitive: false,
 *   targetFields: ['titles'],
 *   createdAt: new Date().toISOString()
 * };
 * const result = validateCustomRule(rule);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 *
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
 * Migrates a custom rule from older format to current format.
 *
 * @param rule - Partial custom rule (may be missing targetFields)
 * @returns Complete custom rule with all required properties
 *
 * @remarks
 * Ensures backward compatibility by defaulting `targetFields` to `['titles']`
 * if the property is missing. This allows existing rules created before the
 * metadata field selection feature to continue working without modification.
 *
 * @example
 * ```typescript
 * const oldRule = { id: "1", pattern: "test", ... }; // no targetFields
 * const migratedRule = migrateCustomRule(oldRule);
 * // migratedRule.targetFields === ['titles']
 * ```
 *
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
 * Represents an AniList entry that has been marked as a duplicate to ignore.
 *
 * @source
 */
export interface IgnoredDuplicate {
  anilistId: number;
  anilistTitle: string;
  ignoredAt: number; // timestamp
}

/**
 * Marks an AniList entry as ignored duplicate for future operations.
 *
 * Prevents this entry from being offered as a match in future sessions.
 *
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
 * Retrieves all ignored duplicate entries from storage.
 *
 * @returns Array of ignored duplicate entries, or empty array if none exist.
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
 *
 * Allows this entry to be offered as a match again in future operations.
 *
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
 * Clears all ignored duplicate entries from storage.
 *
 * Resets the duplicate ignore list, allowing all previously ignored entries to be offered again.
 *
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
 * Checks whether a specific AniList ID is in the ignored duplicates list.
 *
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
 * Checks if the onboarding wizard has been completed (async version for authoritative consistency).
 *
 * Uses async getItemAsync() to fetch from the authoritative electron-store source first,
 * ensuring consistency across storage layers. Only the exact string "true" is considered true.
 *
 * @returns {Promise<boolean>} Promise that resolves to true if onboarding has been completed, false otherwise
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
 * Sets the onboarding completion status (async version for authoritative persistence).
 *
 * Uses async setItemAsync() to ensure electron-store (authoritative source) is updated first,
 * then syncs to localStorage for consistency across storage layers.
 *
 * @param {boolean} completed - Whether the onboarding has been completed
 * @returns {Promise<void>} Promise that resolves when the write is complete
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
 * Resets the onboarding status to allow the wizard to show again
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
 * @param snapshot - The snapshot object to validate.
 * @returns Validation result with status and optional reason.
 * @example
 * const result = validateSyncSnapshot(parsed);
 * if (!result.valid) {
 *   console.error("Invalid snapshot:", result.reason);
 * }
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
 * Checks if a sync snapshot is stale based on its timestamp.
 * @param timestamp - The snapshot timestamp in milliseconds.
 * @param maxAgeHours - Maximum age in hours before considering stale (default 24 hours).
 * @returns True if the snapshot is stale, false otherwise.
 * @example
 * if (isSyncSnapshotStale(snapshot.timestamp)) {
 *   console.warn("Snapshot is older than 24 hours");
 * }
 */
export function isSyncSnapshotStale(
  timestamp: number,
  maxAgeHours: number = 24,
): boolean {
  const ageInHours = (Date.now() - timestamp) / (1000 * 60 * 60);
  return ageInHours > maxAgeHours;
}

/**
 * Cleans up stale sync snapshots from storage.
 * Removes snapshots that are older than the maximum age or invalid.
 * @example
 * cleanupStaleSyncSnapshot(); // Remove stale snapshots on app start
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
