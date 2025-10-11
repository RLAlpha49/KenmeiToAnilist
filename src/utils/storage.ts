/**
 * @packageDocumentation
 * @module storage
 * @description Storage utilities for Kenmei data, sync configuration, and match results. Provides abstraction over localStorage and electron-store for persistence and migration.
 */
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
 * Represents a manga entry in Kenmei.
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
 * Represents the Kenmei data structure.
 *
 * @source
 */
export interface KenmeiData {
  manga?: KenmeiManga[];
  // Add other data properties as needed
}

/**
 * Represents import statistics for Kenmei data.
 *
 * @source
 */
export interface ImportStats {
  total: number;
  timestamp: string;
  statusCounts: Record<string, number>;
}

/**
 * Represents an AniList match for a manga entry.
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
 * Represents a match result between Kenmei and AniList.
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
 * In-memory cache for storage values to avoid redundant operations.
 *
 * @source
 */
export const storageCache: Record<string, string> = {};

/**
 * Storage utility to abstract storage operations. Replaces direct localStorage usage with electron-store for persistence.
 *
 * @source
 */
export const storage = {
  /**
   * Get an item from storage
   * @param key The key of the item to get
   * @returns The stored value or null if not found
   */
  getItem: (key: string): string | null => {
    try {
      // Check cache first to avoid redundant reads
      if (key in storageCache) {
        return storageCache[key];
      }

      // For compatibility with existing code, we need to return synchronously
      // But electronStore API is asynchronous, so we fall back to localStorage
      const value = localStorage.getItem(key);
      // Cache the value
      if (value !== null) {
        storageCache[key] = value;
      }

      // Asynchronously update from electron-store if available (won't affect current return)
      if (globalThis.electronStore) {
        globalThis.electronStore
          .getItem(key)
          .then((electronValue) => {
            if (electronValue !== null && electronValue !== value) {
              // Update localStorage and cache if electron-store has a different value
              localStorage.setItem(key, electronValue);
              storageCache[key] = electronValue;
            }
          })
          .catch((error) => {
            // Only log errors in development
            if (process.env.NODE_ENV === "development") {
              console.error(
                `[Storage] Error retrieving ${key} from electron-store:`,
                error,
              );
            }
          });
      }

      return value;
    } catch (error) {
      console.error(`[Storage] Error getting item from storage: ${key}`, error);
      return null;
    }
  },

  /**
   * Set an item in storage
   * @param key The key to store the value under
   * @param value The value to store
   */
  setItem: (key: string, value: string): void => {
    try {
      // Check if value changed to avoid redundant operations
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
   * Remove an item from storage
   * @param key The key of the item to remove
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
   * Clear all items from storage
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
   * Async get an item from storage, always preferring Electron storage if available.
   * Updates localStorage for compatibility.
   * @param key The key of the item to get
   * @returns Promise<string | null>
   */
  getItemAsync: async (key: string): Promise<string | null> => {
    if (globalThis.electronStore) {
      try {
        console.debug(`[Storage] 🔍 Async getting item: ${key}`);
        const value = await globalThis.electronStore.getItem(key);
        if (value !== null) {
          console.debug(
            `[Storage] ✅ Found item: ${key} (${value.length} bytes)`,
          );
          localStorage.setItem(key, value); // keep localStorage in sync
          storageCache[key] = value;
        } else {
          console.debug(`[Storage] 🔍 Item not found: ${key}`);
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
  IGNORED_DUPLICATES: "ignored_duplicates",
  ACTIVE_SYNC_SNAPSHOT: "active_sync_snapshot",
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
export type MatchConfig = {
  ignoreOneShots: boolean;
  ignoreAdultContent: boolean;
  blurAdultContent: boolean;
  enableComickSearch: boolean;
  enableMangaDexSearch: boolean;
};

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
};

/**
 * Saves Kenmei manga data to storage and updates import stats and cache version.
 *
 * @param data - The Kenmei data to save.
 * @example
 * ```ts
 * saveKenmeiData(data);
 * ```
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
 * Gets Kenmei manga data from storage.
 *
 * @returns The saved Kenmei data or null if not found.
 * @example
 * ```ts
 * const data = getKenmeiData();
 * ```
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
 * Gets import statistics from storage.
 *
 * @returns The import stats or null if not found.
 * @example
 * ```ts
 * const stats = getImportStats();
 * ```
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
 * @internal
 * Calculate status counts from Kenmei data
 * @param data The Kenmei data
 * @returns An object with counts for each status
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
 * Gets saved match results from storage, checking cache version compatibility.
 *
 * @returns The saved match results or null if not found or incompatible.
 * @example
 * ```ts
 * const results = getSavedMatchResults();
 * ```
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
 * @param newResults - The new matching results.
 * @returns Merged results with preserved user progress.
 * @example
 * ```ts
 * const merged = mergeMatchResults(newResults);
 * ```
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
 * @param config - The sync configuration to save.
 * @example
 * ```ts
 * saveSyncConfig(config);
 * ```
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
 * Gets sync configuration from storage.
 *
 * @returns The saved sync configuration or default config if not found.
 * @example
 * ```ts
 * const config = getSyncConfig();
 * ```
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
 * @param config - The match configuration to save.
 * @example
 * ```ts
 * saveMatchConfig(config);
 * ```
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
 * Gets match configuration from storage.
 *
 * @returns The saved match configuration or default config if not found.
 * @example
 * ```ts
 * const config = getMatchConfig();
 * ```
 * @source
 */
export function getMatchConfig(): MatchConfig {
  try {
    const config = storage.getItem(STORAGE_KEYS.MATCH_CONFIG);
    return config ? JSON.parse(config) : DEFAULT_MATCH_CONFIG;
  } catch (error) {
    console.error(
      "[Storage] Error retrieving match config from storage",
      error,
    );
    return DEFAULT_MATCH_CONFIG;
  }
}

/**
 * Interface for tracking ignored duplicate AniList entries
 */
export interface IgnoredDuplicate {
  anilistId: number;
  anilistTitle: string;
  ignoredAt: number; // timestamp
}

/**
 * Save an ignored duplicate entry to storage
 *
 * @param anilistId - The AniList ID to ignore
 * @param anilistTitle - The AniList title
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
 * Get all ignored duplicate entries from storage
 *
 * @returns Array of ignored duplicate entries
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
 * Remove an ignored duplicate entry from storage
 *
 * @param anilistId - The AniList ID to un-ignore
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
 * Clear all ignored duplicate entries from storage
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
 * Check if a specific AniList ID is ignored
 *
 * @param anilistId - The AniList ID to check
 * @returns True if the ID is ignored, false otherwise
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
