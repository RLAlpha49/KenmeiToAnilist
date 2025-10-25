/**
 * @packageDocumentation
 * @module SettingsPage
 * @description Settings page component for the Kenmei to AniList sync tool. Handles authentication, sync preferences, data management, and cache clearing.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ErrorMessage } from "../components/ui/error-message";
import { ErrorType, createError, AppError } from "../utils/errorHandling";
import { Button } from "../components/ui/button";
import {
  CheckCircle,
  RefreshCw,
  Trash2,
  Key,
  Database,
  UserCircle,
  Clock,
  AlertTriangle,
  Link,
  InfoIcon,
  Search,
  Bug,
  Loader2,
  ShieldCheck,
  Download,
  Check,
  Upload,
  History,
} from "lucide-react";
import { useAuthActions, useAuthState } from "../hooks/useAuth";
import { useAutoUpdater } from "../hooks/useAutoUpdater";
import { useDebugActions, useDebugState } from "../contexts/DebugContext";
import { useOnboarding } from "../contexts/OnboardingContext";
import { APICredentials } from "../types/auth";
import { DEFAULT_ANILIST_CONFIG, DEFAULT_AUTH_PORT } from "../config/anilist";
import {
  STORAGE_KEYS,
  getSyncConfig,
  saveSyncConfig,
  SyncConfig,
  getMatchConfig,
  saveMatchConfig,
  MatchConfig,
  storage,
} from "../utils/storage";
import {
  createBackup,
  getBackupHistory,
  clearBackupHistory,
  restoreBackup,
  importBackupFromFile,
  BackupHistoryEntry,
} from "../utils/backup";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { motion } from "framer-motion";
import {
  getAppVersion,
  getAppVersionStatus,
  AppVersionStatus,
  compareVersions,
} from "../utils/app-version";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { SettingsHero } from "../components/settings/SettingsHero";
import { SettingsSectionShell } from "../components/settings/SettingsSectionShell";

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

/**
 * Settings page component for the Kenmei to AniList sync tool.
 *
 * Handles authentication, sync preferences, data management, and cache clearing for the user.
 *
 * @source
 */
export function SettingsPage() {
  const {
    authState,
    isLoading,
    error: authError,
    statusMessage,
    customCredentials,
  } = useAuthState();

  const {
    login,
    refreshToken,
    logout,
    cancelAuth,
    setCredentialSource,
    updateCustomCredentials,
  } = useAuthActions();

  const {
    isDebugEnabled,
    storageDebuggerEnabled,
    logViewerEnabled,
    logRedactionEnabled,
    stateInspectorEnabled,
    ipcViewerEnabled,
    eventLoggerEnabled,
    confidenceTestExporterEnabled,
  } = useDebugState();

  const {
    toggleDebug,
    setStorageDebuggerEnabled,
    setLogViewerEnabled,
    setLogRedactionEnabled,
    setStateInspectorEnabled,
    setIpcViewerEnabled,
    setEventLoggerEnabled,
    setConfidenceTestExporterEnabled,
    recordEvent,
  } = useDebugActions();

  const { completeStep, isActive } = useOnboarding();

  // Auto-updater hook for managing download/install operations
  const { isDownloading, downloadProgress, isDownloaded } = useAutoUpdater();

  const prevCredentialSourceRef = useRef<"default" | "custom">(
    authState.credentialSource,
  );

  const [error, setError] = useState<AppError | null>(null);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showStatusMessage, setShowStatusMessage] = useState(true);
  const [cachesToClear, setCachesToClear] = useState({
    auth: false,
    settings: false,
    sync: false,
    import: false,
    review: false,
    manga: false,
    search: false,
    other: false,
  });
  const [useCustomCredentials, setUseCustomCredentials] = useState(
    authState.credentialSource === "custom",
  );
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(
    `http://localhost:${DEFAULT_AUTH_PORT}/callback`,
  );
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(getSyncConfig());
  const [matchConfig, setMatchConfig] = useState<MatchConfig>(getMatchConfig());
  const [useCustomThreshold, setUseCustomThreshold] = useState<boolean>(
    typeof syncConfig.autoPauseThreshold === "string" ||
      ![1, 7, 14, 30, 60, 90, 180, 365].includes(
        Number(syncConfig.autoPauseThreshold),
      ),
  );
  // Version status state
  const [versionStatus, setVersionStatus] = useState<AppVersionStatus | null>(
    null,
  );
  // Update Check State
  const [updateChannel, setUpdateChannel] = useState<"stable" | "beta">(
    "stable",
  );
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<null | {
    version: string;
    url: string;
    isBeta: boolean;
  }>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Backup management state
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(
    storage.getItem(STORAGE_KEYS.AUTO_BACKUP_ENABLED) === "true",
  );
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(
    null,
  );
  const [backupValidationError, setBackupValidationError] = useState<
    string | null
  >(null);
  const [showBackupHistory, setShowBackupHistory] = useState(false);

  // Wrapper functions to log events when configs are saved
  const saveSyncConfigWithEvent = (
    config: SyncConfig,
    changedField: string,
  ) => {
    recordEvent({
      type: "settings.sync-config-update",
      message: `Sync config updated: ${changedField}`,
      level: "info",
      metadata: { changedField, config },
    });
    saveSyncConfig(config);
  };

  const saveMatchConfigWithEvent = (
    config: MatchConfig,
    changedField: string,
  ) => {
    recordEvent({
      type: "settings.match-config-update",
      message: `Match config updated: ${changedField}`,
      level: "info",
      metadata: { changedField, config },
    });
    saveMatchConfig(config);
  };

  /**
   * Opens an external URL in the default browser or system default application.
   * Prefers Electron API if available, otherwise falls back to standard browser open.
   * @param url - The URL to open.
   * @returns A React event handler function.
   * @source
   */
  const handleOpenExternal = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (globalThis.electronAPI?.shell?.openExternal) {
      globalThis.electronAPI.shell.openExternal(url);
    } else {
      // Fallback to regular link behavior if not in Electron
      globalThis.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Track previous credential values to prevent unnecessary updates
  const prevCredentialsRef = useRef({
    id: "",
    secret: "",
    uri: "",
  });

  // Update error state when auth error changes
  useEffect(() => {
    if (authError) {
      setError(createError(ErrorType.AUTHENTICATION, authError));
    } else {
      setError(null);
    }
  }, [authError]);

  // Update credential source when toggle changes, but avoid infinite loop
  useEffect(() => {
    const newSource = useCustomCredentials ? "custom" : "default";
    // Only update if actually changed and not from authState sync
    if (newSource !== prevCredentialSourceRef.current) {
      prevCredentialSourceRef.current = newSource;
      setCredentialSource(newSource);
    }
  }, [useCustomCredentials, setCredentialSource]);

  // Update local state if authState.credentialSource changes externally
  useEffect(() => {
    if (authState.credentialSource !== prevCredentialSourceRef.current) {
      prevCredentialSourceRef.current = authState.credentialSource;
      setUseCustomCredentials(authState.credentialSource === "custom");
    }
  }, [authState.credentialSource]);

  // Update custom credentials when fields change
  useEffect(() => {
    if (useCustomCredentials && clientId && clientSecret && redirectUri) {
      // Only update if values actually changed
      if (
        clientId !== prevCredentialsRef.current.id ||
        clientSecret !== prevCredentialsRef.current.secret ||
        redirectUri !== prevCredentialsRef.current.uri
      ) {
        // Update the ref
        prevCredentialsRef.current = {
          id: clientId,
          secret: clientSecret,
          uri: redirectUri,
        };

        // Update context
        updateCustomCredentials(clientId, clientSecret, redirectUri);
      }
    }
  }, [
    useCustomCredentials,
    clientId,
    clientSecret,
    redirectUri,
    updateCustomCredentials,
  ]);

  // Reset error when auth state changes
  useEffect(() => {
    if (authState.isAuthenticated) {
      setError(null);

      // If we have a status message and authentication is complete,
      // set a timeout to clear the status message
      if (statusMessage && !isLoading) {
        const timer = setTimeout(() => {
          setShowStatusMessage(false);
        }, 3000); // Auto-dismiss after 3 seconds

        return () => clearTimeout(timer);
      }
    } else {
      // Reset the status message visibility when not authenticated
      setShowStatusMessage(true);
    }
  }, [authState.isAuthenticated, statusMessage, isLoading]);

  // Track auth completion for onboarding
  useEffect(() => {
    if (isActive && authState.isAuthenticated && !isLoading) {
      completeStep("auth");
    }
  }, [authState.isAuthenticated, isActive, isLoading, completeStep]);

  // Add a timeout to detect stuck loading state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (isLoading) {
      // If loading state persists for more than 20 seconds, trigger a refresh
      timeoutId = setTimeout(() => {
        console.warn(
          "[Settings] Loading state persisted for too long - triggering refresh",
        );
        handleRefreshPage();
      }, 20000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);

  // Add a useEffect to load custom credential settings from localStorage on initial mount
  useEffect(() => {
    try {
      console.debug("[Settings] 🔍 Loading custom credential settings...");

      // Load custom credentials toggle state
      const savedUseCustom = localStorage.getItem("useCustomCredentials");
      if (savedUseCustom) {
        setUseCustomCredentials(JSON.parse(savedUseCustom));
        console.debug(
          `[Settings] 🔍 Custom credentials enabled: ${savedUseCustom}`,
        );
      }

      // Load saved custom credentials if they exist
      const savedCustomCreds = localStorage.getItem("customCredentials");
      if (savedCustomCreds) {
        const credentials = JSON.parse(savedCustomCreds);
        setClientId(credentials.clientId || "");
        setClientSecret(credentials.clientSecret || "");
        setRedirectUri(
          credentials.redirectUri ||
            `http://localhost:${DEFAULT_AUTH_PORT}/callback`,
        );

        console.info("[Settings] ✅ Loaded custom credentials from storage");

        // Also update context with saved credentials
        if (
          credentials.clientId &&
          credentials.clientSecret &&
          credentials.redirectUri
        ) {
          updateCustomCredentials(
            credentials.clientId,
            credentials.clientSecret,
            credentials.redirectUri,
          );
        }
      }
    } catch (err) {
      console.error(
        "[Settings] ❌ Failed to load saved credential settings:",
        err,
      );
    }
  }, []);

  // Save custom credentials toggle state whenever it changes
  useEffect(() => {
    console.debug(
      `[Settings] 🔍 Saving custom credentials toggle: ${useCustomCredentials}`,
    );
    localStorage.setItem(
      "useCustomCredentials",
      JSON.stringify(useCustomCredentials),
    );
  }, [useCustomCredentials]);

  // Save custom credentials whenever they change
  useEffect(() => {
    if (clientId || clientSecret || redirectUri) {
      console.debug("[Settings] 🔍 Saving custom credentials to storage");
      localStorage.setItem(
        "customCredentials",
        JSON.stringify({
          clientId,
          clientSecret,
          redirectUri,
        }),
      );
    }
  }, [clientId, clientSecret, redirectUri]);

  // Initialize fields from customCredentials prop when it changes
  useEffect(() => {
    if (customCredentials) {
      // Use refs to avoid unnecessary state updates
      if (clientId !== customCredentials.clientId) {
        setClientId(customCredentials.clientId);
      }
      if (clientSecret !== customCredentials.clientSecret) {
        setClientSecret(customCredentials.clientSecret);
      }
      if (redirectUri !== customCredentials.redirectUri) {
        setRedirectUri(customCredentials.redirectUri);
      }
    }
  }, [customCredentials]);

  // Version status useEffect
  useEffect(() => {
    let mounted = true;
    getAppVersionStatus().then((status) => {
      if (mounted) setVersionStatus(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Load backup history on mount
  useEffect(() => {
    setBackupHistory(getBackupHistory());
  }, []);

  /**
   * Initiates AniList OAuth login flow with either custom or default credentials.
   * @source
   */
  const handleLogin = async () => {
    try {
      console.info(
        `[Settings] 🔐 Initiating AniList login (${useCustomCredentials ? "custom" : "default"} credentials)`,
      );

      // Create credentials object based on source
      const credentials: APICredentials = useCustomCredentials
        ? {
            source: "custom",
            clientId,
            clientSecret,
            redirectUri,
          }
        : {
            source: "default",
            clientId: DEFAULT_ANILIST_CONFIG.clientId,
            clientSecret: DEFAULT_ANILIST_CONFIG.clientSecret,
            redirectUri: DEFAULT_ANILIST_CONFIG.redirectUri,
          };

      await login(credentials);
      console.info("[Settings] ✅ Login initiated successfully");
    } catch (err: unknown) {
      console.error("[Settings] ❌ Login failed:", err);
      setError(
        createError(
          ErrorType.AUTHENTICATION,
          err instanceof Error
            ? err.message
            : "Failed to authenticate with AniList. Please try again.",
        ),
      );
    }
  };

  /**
   * Cancels an ongoing OAuth authentication process.
   * @source
   */
  const handleCancelAuth = async () => {
    try {
      console.info("[Settings] 🚫 Cancelling authentication...");
      await cancelAuth();
      console.info("[Settings] ✅ Authentication cancelled successfully");
    } catch (err) {
      console.error("[Settings] ❌ Failed to cancel authentication:", err);
      setError(
        createError(
          ErrorType.AUTHENTICATION,
          err instanceof Error
            ? err.message
            : "Failed to cancel authentication. Please try again.",
        ),
      );
    }
  };

  /**
   * Clears selected caches (localStorage, search cache, etc.) and displays result notification.
   * Iterates through browser storage items and removes those matching selected cache types.
   * @source
   */
  const handleClearCache = async () => {
    console.info("[Settings] 🗑️ Starting cache clear operation...");
    setCacheCleared(false);
    setIsClearing(true);
    setError(null);

    const anySelected = Object.values(cachesToClear).some(Boolean);
    if (!anySelected) {
      console.warn("[Settings] ⚠️ No cache types selected for clearing");
      setIsClearing(false);
      return;
    }

    console.debug(
      "[Settings] 🔍 Cache types selected:",
      Object.entries(cachesToClear)
        .filter(([, v]) => v)
        .map(([k]) => k),
    );

    const pushIfMissing = (arr: string[], value: string) => {
      if (!arr.includes(value)) arr.push(value);
    };

    const matchStorageKeyToRule = (
      key: string,
      value: string,
      rules: { patterns: string[]; target: string[] }[],
    ): boolean => {
      for (const { patterns, target } of rules) {
        if (patterns.some((p) => key.includes(p))) {
          pushIfMissing(target, value);
          return true;
        }
      }
      return false;
    };

    const getCacheKeysByType = (): Record<string, string[]> => {
      const base: Record<string, string[]> = {
        auth: ["authState", "customCredentials", "useCustomCredentials"],
        search: ["anilist_search_cache"],
        manga: ["anilist_manga_cache"],
        review: ["match_results", "pending_manga", "matching_progress"],
        import: ["kenmei_data", "import_history", "import_stats"],
        sync: ["anilist_sync_history"],
        settings: ["sync_config", "theme"],
        other: ["cache_version"],
      };

      if (STORAGE_KEYS && typeof STORAGE_KEYS === "object") {
        const rules: { patterns: string[]; target: string[] }[] = [
          { patterns: ["MATCH", "REVIEW"], target: base.review },
          { patterns: ["IMPORT"], target: base.import },
          { patterns: ["CACHE"], target: base.other },
        ];

        for (const [key, value] of Object.entries(STORAGE_KEYS)) {
          if (typeof value !== "string") continue;
          const matched = matchStorageKeyToRule(key, value, rules);
          if (!matched) {
            pushIfMissing(base.other, value);
          }
        }
      }

      return base;
    };

    const clearExternalCaches = async (services: {
      clearSearchCache?: () => void;
      clearMangaCache?: () => void;
      cacheDebugger?: { resetAllCaches?: () => void };
    }) => {
      try {
        if (
          cachesToClear.search &&
          typeof services.clearSearchCache === "function"
        ) {
          services.clearSearchCache();
          console.debug("[Settings] 🧹 Search cache cleared");
        }
        if (
          cachesToClear.manga &&
          typeof services.clearMangaCache === "function"
        ) {
          services.clearMangaCache();
          console.debug("[Settings] 🧹 Manga cache cleared");
        }
        if (
          cachesToClear.search &&
          cachesToClear.manga &&
          services.cacheDebugger?.resetAllCaches
        ) {
          services.cacheDebugger.resetAllCaches();
          console.debug("[Settings] 🧹 All in-memory caches reset");
        }
      } catch (e) {
        console.warn("[Settings] Failed to clear external caches", e);
      }
    };

    const clearStorageKeys = (keys: string[]) => {
      for (const cacheKey of keys) {
        try {
          localStorage.removeItem(cacheKey);
          if (
            globalThis.electronStore &&
            typeof globalThis.electronStore.removeItem === "function"
          ) {
            globalThis.electronStore.removeItem(cacheKey);
            console.debug(
              `[Settings] 🧹 Cleared Electron Store cache: ${cacheKey}`,
            );
          }
          console.debug(`[Settings] 🧹 Cleared cache: ${cacheKey}`);
        } catch (e) {
          console.warn(`[Settings] Failed to clear cache: ${cacheKey}`, e);
        }
      }
    };

    const deleteIndexedDB = () => {
      try {
        const req = globalThis.indexedDB?.deleteDatabase("anilist-cache");
        if (!req) return;
        req.onsuccess = () =>
          console.debug(
            "[Settings] 🧹 Successfully deleted IndexedDB database",
          );
        req.onerror = () =>
          console.error("[Settings] Error deleting IndexedDB database");
      } catch (e) {
        console.warn("[Settings] Failed to clear IndexedDB:", e);
      }
    };

    const showResultSummary = () => {
      const clearedSummary = Object.entries(cachesToClear)
        .filter(([, selected]) => selected)
        .map(([type]) => `✅ Cleared ${type} cache`)
        .join("\n");

      try {
        globalThis.alert(
          "Cache Cleared Successfully!\n\n" +
            clearedSummary +
            "\n\nYou may need to restart the application for all changes to take effect.",
        );
      } catch (e) {
        console.warn("[Settings] Failed to show alert:", e);
      }
    };

    try {
      // Get all cache clearing functions
      const { clearMangaCache, cacheDebugger } = await import(
        "../api/matching/search-service"
      );
      const { clearSearchCache } = await import("../api/anilist/client");

      await clearExternalCaches({
        clearSearchCache,
        clearMangaCache,
        cacheDebugger,
      });

      const keysByType = getCacheKeysByType();
      const keysToRemove: string[] = [];

      for (const [type, selected] of Object.entries(cachesToClear)) {
        if (!selected) continue;
        const keys = keysByType[type];
        if (Array.isArray(keys)) keysToRemove.push(...keys);
      }

      const uniqueKeys = [...new Set(keysToRemove)];
      console.debug(
        "[Settings] 🧹 Clearing the following localStorage keys:",
        uniqueKeys,
      );

      clearStorageKeys(uniqueKeys);

      if (anySelected) deleteIndexedDB();

      console.info("[Settings] ✅ Selected caches cleared successfully");
      setCacheCleared(true);
      showResultSummary();
      setTimeout(() => setCacheCleared(false), 5000);
    } catch (err) {
      console.error("[Settings] ❌ Error clearing cache:", err);
      setError(
        createError(
          ErrorType.SYSTEM,
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while clearing cache",
        ),
      );
    } finally {
      setIsClearing(false);
    }
  };

  /**
   * Dismisses error messages from display.
   * @source
   */
  const dismissError = () => {
    console.debug("[Settings] 🔍 Dismissing error message");
    setError(null);
  };

  /**
   * Creates a backup of all application data and triggers download.
   * Updates backup history and shows success message.
   * @source
   */
  const handleCreateBackup = async () => {
    try {
      console.info("[Settings] 📦 Starting backup creation...");
      setIsCreatingBackup(true);
      setBackupValidationError(null);

      const backupId = await createBackup();

      // Update backup history
      setBackupHistory(getBackupHistory());

      console.info("[Settings] ✅ Backup created successfully:", backupId);

      // Show success message (using browser toast or similar)
      recordEvent({
        type: "backup.created",
        message: "Application data backup created successfully",
        level: "info",
        metadata: { backupId },
      });
    } catch (err) {
      console.error("[Settings] ❌ Failed to create backup:", err);
      const message =
        err instanceof Error ? err.message : "Failed to create backup";
      setBackupValidationError(message);
      recordEvent({
        type: "backup.error",
        message: `Backup creation failed: ${message}`,
        level: "error",
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  /**
   * Handles import of backup file from user selection.
   * Validates and prompts for restore mode (Replace vs Merge) before restoring.
   * @source
   */
  const handleImportBackup = async () => {
    if (!selectedBackupFile) {
      setBackupValidationError("No file selected");
      return;
    }

    try {
      console.info(
        "[Settings] 📥 Importing backup file:",
        selectedBackupFile.name,
      );
      setIsRestoringBackup(true);
      setBackupValidationError(null);

      // Import and validate backup
      const backupData = await importBackupFromFile(selectedBackupFile);

      // Show confirmation dialog with details
      const shouldRestore = globalThis.confirm(
        `Restore backup from ${new Date(backupData.metadata.timestamp).toLocaleString()}?\n\n` +
          `App Version: ${backupData.metadata.appVersion}\n` +
          `This will overwrite your current data. Create a backup first if needed.`,
      );

      if (!shouldRestore) {
        console.info("[Settings] 🚫 Backup restore cancelled by user");
        setIsRestoringBackup(false);
        return;
      }

      // Show merge vs replace dialog
      const useMergeMode = globalThis.confirm(
        "How would you like to restore match results?\n\n" +
          "🔄 MERGE (OK): Combine existing matches with backup matches\n" +
          "   • Preserves your current match selections\n" +
          "   • Only MATCH_RESULTS are merged, other data is replaced\n\n" +
          "🔁 REPLACE (Cancel): Completely overwrite all data\n" +
          "   • Discards current data entirely\n" +
          "   • Fully reverts to backup state\n\n" +
          "Choose MERGE (OK) to preserve existing matches, or REPLACE (Cancel) to completely restore the backup.",
      );

      console.info(
        "[Settings] 📋 Restore mode selected:",
        useMergeMode ? "Merge" : "Replace",
      );

      // Restore backup with selected mode
      const result = await restoreBackup(backupData, { merge: useMergeMode });

      if (result.success) {
        console.info(
          "[Settings] ✅ Backup restored successfully (mode:",
          useMergeMode ? "Merge" : "Replace",
          ")",
        );
        recordEvent({
          type: "backup.restored",
          message: `Application data restored from backup (${useMergeMode ? "Merge" : "Replace"} mode)`,
          level: "info",
          metadata: { mergeMode: useMergeMode },
        });

        // Clear file selection
        setSelectedBackupFile(null);

        // Reload page to refresh all data
        setTimeout(() => {
          globalThis.location.reload();
        }, 1000);
      } else {
        throw new Error(result.errors.join("; "));
      }
    } catch (err) {
      console.error("[Settings] ❌ Failed to restore backup:", err);
      const message =
        err instanceof Error ? err.message : "Failed to restore backup";
      setBackupValidationError(message);
      recordEvent({
        type: "backup.error",
        message: `Backup restore failed: ${message}`,
        level: "error",
      });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  /**
   * Toggles automatic backup setting.
   * @source
   */
  const handleToggleAutoBackup = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    storage.setItem(
      STORAGE_KEYS.AUTO_BACKUP_ENABLED,
      enabled ? "true" : "false",
    );
    console.info("[Settings] 🔄 Auto-backup toggled:", enabled);
    recordEvent({
      type: "backup.auto-backup-toggled",
      message: `Auto-backup ${enabled ? "enabled" : "disabled"}`,
      level: "info",
    });
  };

  /**
   * Handles file selection for backup import.
   * @source
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedBackupFile(file);
      setBackupValidationError(null);
      console.debug("[Settings] 📄 File selected:", file.name);
    }
  };

  /**
   * Refreshes the page, clearing error states and reloading the view.
   * @source
   */
  const handleRefreshPage = () => {
    console.info("[Settings] 🔄 Refreshing page...");
    // Clear error states and status messages
    setError(null);
    globalThis.location.reload();
  };

  /**
   * Calculates remaining time until authentication token expiry.
   * @returns A formatted string representing hours and days remaining, or "unknown" if unavailable.
   * @source
   */
  const calculateExpiryTime = () => {
    if (!authState.expiresAt) return "unknown";

    const hoursRemaining = Math.round(
      (authState.expiresAt - Date.now()) / 3600000,
    );

    if (hoursRemaining > 24) {
      const days = Math.floor(hoursRemaining / 24);
      const hours = hoursRemaining % 24;
      return `${days}d ${hours}h`;
    }

    return `${hoursRemaining}h`;
  };

  /**
   * Retrieves the last sync metadata from localStorage.
   * Returns formatted timestamp and summary of the last sync operation.
   * @returns Object containing label, hint, and sync summary information.
   * @source
   */
  const readLastSyncMetadata = () => {
    if (globalThis.window === undefined || !globalThis.localStorage) {
      return {
        label: "Unavailable",
        hint: "Sync history will appear after your first run.",
      };
    }

    try {
      const historyRaw = globalThis.localStorage.getItem(
        "anilist_sync_history",
      );
      if (!historyRaw) {
        return {
          label: "Never",
          hint: "No syncs have been recorded yet.",
        };
      }

      const history = JSON.parse(historyRaw);
      if (!Array.isArray(history) || history.length === 0) {
        return {
          label: "Never",
          hint: "Run a sync to capture your first history entry.",
        };
      }

      const latest = history[0];
      const timestamp = latest?.timestamp ? new Date(latest.timestamp) : null;
      const formattedDate =
        timestamp && !Number.isNaN(timestamp.valueOf())
          ? timestamp.toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Recently";

      const summaryBits: string[] = [];
      if (typeof latest?.successfulUpdates === "number") {
        summaryBits.push(`${latest.successfulUpdates} successful`);
      }
      if (
        typeof latest?.failedUpdates === "number" &&
        latest.failedUpdates > 0
      ) {
        summaryBits.push(`${latest.failedUpdates} failed`);
      }
      if (typeof latest?.totalEntries === "number") {
        summaryBits.push(`${latest.totalEntries} total`);
      }

      return {
        label: formattedDate,
        hint:
          summaryBits.length > 0
            ? summaryBits.join(" • ")
            : "Latest sync details captured locally.",
      };
    } catch (err) {
      console.error("[Settings] Error parsing sync history:", err);
      return {
        label: "Never",
        hint: "Sync history could not be parsed.",
      };
    }
  };

  /**
   * Check for updates using electron-updater IPC.
   * Uses the configured update channel preference.
   * @source
   */
  const handleCheckForUpdates = async () => {
    console.info("[Settings] 🔍 Checking for updates...");
    setIsCheckingUpdate(true);
    setUpdateError(null);
    setUpdateInfo(null);
    try {
      const result = await globalThis.electronUpdater.checkForUpdates({
        allowPrerelease: updateChannel === "beta",
      });

      if (result.updateAvailable && result.version) {
        setUpdateInfo({
          version: result.version,
          url: `https://github.com/RLAlpha49/KenmeiToAnilist/releases/tag/v${result.version}`,
          isBeta: updateChannel === "beta",
        });
        console.info(`[Settings] ✅ Update available: ${result.version}`);
      } else {
        console.info("[Settings] ℹ️ No updates available");
        // Show info message that no updates are available
        setUpdateError("You're already on the latest version!");
      }
    } catch (e) {
      console.error("[Settings] ❌ Error checking for updates:", e);
      setUpdateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  /**
   * Download an available update.
   * Progress is tracked via the useAutoUpdater hook.
   * @source
   */
  const handleDownloadUpdate = async () => {
    console.info("[Settings] 📥 Starting update download...");
    try {
      await globalThis.electronUpdater.downloadUpdate();
      console.info("[Settings] ✅ Update download initiated");
    } catch (e) {
      console.error("[Settings] ❌ Error downloading update:", e);
      setUpdateError(e instanceof Error ? e.message : "Download failed");
    }
  };

  /**
   * Install the downloaded update.
   * Quits the application and applies the update.
   * @source
   */
  const handleInstallUpdate = async () => {
    console.info("[Settings] 🔄 Installing update...");
    try {
      await globalThis.electronUpdater.installUpdate();
      console.info("[Settings] ✅ Update installed");
    } catch (e) {
      console.error("[Settings] ❌ Error installing update:", e);
      setUpdateError(e instanceof Error ? e.message : "Installation failed");
    }
  };

  const defaultCredentialStatus = useMemo(() => {
    const missing: string[] = [];
    const defaultClientId = DEFAULT_ANILIST_CONFIG.clientId?.trim() ?? "";
    const defaultClientSecret =
      DEFAULT_ANILIST_CONFIG.clientSecret?.trim() ?? "";
    if (!defaultClientId) missing.push("Client ID");
    if (!defaultClientSecret) missing.push("Client Secret");
    return {
      hasCredentials: missing.length === 0,
      missing,
    };
  }, []);

  const customCredentialStatus = useMemo(() => {
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();
    const trimmedRedirectUri = redirectUri.trim();
    const missing: string[] = [];
    if (!trimmedClientId) missing.push("Client ID");
    if (!trimmedClientSecret) missing.push("Client Secret");
    if (!trimmedRedirectUri) missing.push("Redirect URI");
    return {
      complete: missing.length === 0,
      missing,
    };
  }, [clientId, clientSecret, redirectUri]);

  const credentialsBlocked = useCustomCredentials
    ? !customCredentialStatus.complete
    : !defaultCredentialStatus.hasCredentials;
  const disableAuthActions = isLoading || credentialsBlocked;

  const expiresLabel = useMemo(
    () => (authState.isAuthenticated ? calculateExpiryTime() : undefined),
    [authState.expiresAt, authState.isAuthenticated],
  );

  const credentialSourceLabel = useMemo(
    () => (useCustomCredentials ? "Custom credentials" : "Default credentials"),
    [useCustomCredentials],
  );

  const versionLabel = useMemo(() => {
    if (!versionStatus) return undefined;
    if (versionStatus.status === "stable") return "Stable channel";
    if (versionStatus.status === "beta") return "Beta channel";
    if (versionStatus.status === "development") return "Development";
    return undefined;
  }, [versionStatus]);

  const lastSyncMetadata = useMemo(
    () => readLastSyncMetadata(),
    [cacheCleared, authState.isAuthenticated],
  );

  const accountControls = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            AniList authentication
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-200/80">
            Manage how the app connects to AniList and switch between built-in
            or custom credentials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            className={`border ${authState.isAuthenticated ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"}`}
          >
            {authState.isAuthenticated ? "Session active" : "Session inactive"}
          </Badge>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 dark:border-white/15 dark:bg-white/10">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-100/80">
              Custom keys
            </span>
            <Switch
              checked={useCustomCredentials}
              onCheckedChange={setUseCustomCredentials}
              disabled={authState.isAuthenticated}
              aria-label="Toggle custom AniList credentials"
            />
          </div>
        </div>
      </div>

      {authState.isAuthenticated && (
        <Alert
          variant="destructive"
          className="mt-4 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs text-rose-600 dark:text-rose-100">
            You must sign out before changing API credentials.
          </AlertDescription>
        </Alert>
      )}

      {!authState.isAuthenticated && (
        <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-amber-700 dark:text-amber-50">
            Not connected
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-100/80">
            Authenticate with AniList using the hero actions above to enable
            migrations.
          </AlertDescription>
        </Alert>
      )}

      {!useCustomCredentials && !defaultCredentialStatus.hasCredentials && (
        <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-amber-700 dark:text-amber-100">
            Default credentials missing
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-100/80">
            {`Default credentials missing (${defaultCredentialStatus.missing.join(", ")}). Provide `}
            <code className="font-mono">VITE_ANILIST_CLIENT_ID</code>
            {" and "}
            <code className="font-mono">VITE_ANILIST_CLIENT_SECRET</code>
            {
              " in your environment or switch to custom credentials before signing in."
            }
          </AlertDescription>
        </Alert>
      )}

      {useCustomCredentials && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <label
              htmlFor="client-id"
              className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200/80"
            >
              Client ID
            </label>
            <input
              id="client-id"
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-0"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={authState.isAuthenticated || isLoading}
              placeholder="Your AniList client ID"
            />
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="client-secret"
              className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200/80"
            >
              Client Secret
            </label>
            <input
              id="client-secret"
              type="password"
              className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-0"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              disabled={authState.isAuthenticated || isLoading}
              placeholder="Your AniList client secret"
            />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <label
              htmlFor="redirect-uri"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200/80"
            >
              <Link className="h-3.5 w-3.5" />
              Redirect URI
            </label>
            <input
              id="redirect-uri"
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-0"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              disabled={authState.isAuthenticated || isLoading}
              placeholder={`http://localhost:${DEFAULT_AUTH_PORT}/callback`}
            />
            <p className="text-xs text-slate-600 dark:text-slate-200/70">
              Must match the redirect URI registered in your AniList
              application.
            </p>
          </div>
          <p className="text-xs text-slate-600 md:col-span-2 dark:text-slate-200/70">
            You can create a new client in{" "}
            <a
              href="https://anilist.co/settings/developer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline-offset-4 transition hover:text-indigo-500 hover:underline dark:text-indigo-200 dark:hover:text-indigo-100"
              onClick={handleOpenExternal(
                "https://anilist.co/settings/developer",
              )}
            >
              AniList Developer Settings
            </a>
          </p>
          {!customCredentialStatus.complete && (
            <Alert className="border-rose-200 bg-rose-50 text-rose-700 md:col-span-2 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs text-rose-600 dark:text-rose-100">
                {`Custom credentials incomplete. Missing: ${customCredentialStatus.missing.join(", ")}. All fields are required before authenticating.`}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-200/80">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200/80">
          <Clock className="h-3 w-3" />
          {authState.isAuthenticated
            ? `Token expires in ${expiresLabel ?? "unknown"}`
            : "No active session"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200/80">
          <Key className="h-3 w-3" />
          {credentialSourceLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200/80">
          <ShieldCheck className="h-3 w-3" />
          Stored locally only
        </span>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="relative mx-auto max-w-[1200px] space-y-8 px-4 pb-12 pt-6 md:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <SettingsHero
        isAuthenticated={authState.isAuthenticated}
        username={authState.username}
        avatarUrl={authState.avatarUrl}
        statusMessage={
          statusMessage && showStatusMessage && !error ? statusMessage : null
        }
        isLoading={isLoading}
        disableLogin={disableAuthActions}
        onLogin={handleLogin}
        onRefreshToken={refreshToken}
        onLogout={logout}
        onClearStatus={() => setShowStatusMessage(false)}
        onCancelAuth={handleCancelAuth}
        credentialSourceLabel={credentialSourceLabel}
        expiresLabel={expiresLabel}
        versionLabel={versionLabel}
      >
        {accountControls}
      </SettingsHero>

      {error && (
        <motion.div
          className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-4 backdrop-blur-lg"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <ErrorMessage
            message={error.message}
            type={error.type}
            dismiss={dismissError}
            retry={
              error.type === ErrorType.AUTHENTICATION ? handleLogin : undefined
            }
          />
        </motion.div>
      )}

      {cacheCleared && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 backdrop-blur-lg"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span>Selected caches cleared successfully.</span>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-[0_40px_90px_-60px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40 dark:shadow-[0_40px_90px_-60px_rgba(15,23,42,0.9)]"
      >
        <Tabs defaultValue="matching" className="space-y-6">
          <TabsList className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600 backdrop-blur md:flex-row md:items-center md:justify-start md:gap-3 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <TabsTrigger
              value="matching"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-5 py-3.5 font-medium text-slate-600 transition hover:border-slate-200 hover:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg dark:hover:border-white/20 dark:hover:text-white dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-white/20 dark:data-[state=active]:text-white"
            >
              <Search className="h-4 w-4" />
              Matching
            </TabsTrigger>
            <TabsTrigger
              value="sync"
              data-onboarding="sync-tab"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-5 py-3.5 font-medium text-slate-600 transition hover:border-slate-200 hover:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg dark:hover:border-white/20 dark:hover:text-white dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-white/20 dark:data-[state=active]:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Sync
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-5 py-3.5 font-medium text-slate-600 transition hover:border-slate-200 hover:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg dark:hover:border-white/20 dark:hover:text-white dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-white/20 dark:data-[state=active]:text-white"
            >
              <Database className="h-4 w-4" />
              Data
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="matching"
            className="space-y-6"
            data-onboarding="settings-form"
          >
            <motion.div variants={itemVariants} initial="hidden" animate="show">
              <SettingsSectionShell
                icon={Search}
                title="Matching preferences"
                description="Configure how your manga is matched with AniList entries during search and sync."
                accent="from-emerald-500/15 via-teal-500/10 to-transparent"
                contentClassName="space-y-5"
              >
                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-medium">
                        Ignore one shots in automatic matching
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Skip one-shot manga during automatic matching. They will
                        still appear in manual searches.
                      </p>
                    </div>
                    <Switch
                      id="ignore-one-shots"
                      checked={matchConfig.ignoreOneShots}
                      onCheckedChange={(checked) => {
                        const newConfig = {
                          ...matchConfig,
                          ignoreOneShots: checked,
                        };
                        setMatchConfig(newConfig);
                        saveMatchConfigWithEvent(newConfig, "ignoreOneShots");
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-medium">
                        Ignore adult content in automatic matching
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Skip adult content manga during automatic matching. They
                        will still appear in manual searches.
                      </p>
                    </div>
                    <Switch
                      id="ignore-adult-content"
                      checked={matchConfig.ignoreAdultContent}
                      onCheckedChange={(checked) => {
                        const newConfig = {
                          ...matchConfig,
                          ignoreAdultContent: checked,
                        };
                        setMatchConfig(newConfig);
                        saveMatchConfigWithEvent(
                          newConfig,
                          "ignoreAdultContent",
                        );
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-medium">
                        Blur adult content images
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Blur cover images of adult content manga for privacy.
                        Click to reveal the image temporarily.
                      </p>
                    </div>
                    <Switch
                      id="blur-adult-content"
                      checked={matchConfig.blurAdultContent}
                      onCheckedChange={(checked) => {
                        const newConfig = {
                          ...matchConfig,
                          blurAdultContent: checked,
                        };
                        setMatchConfig(newConfig);
                        saveMatchConfigWithEvent(newConfig, "blurAdultContent");
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium">
                          Enable Comick alternative search
                        </h3>
                        <Badge
                          variant="secondary"
                          className="bg-yellow-100 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        >
                          Disabled
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Comick fallback search is temporarily disabled as the
                        service has been taken down. The API may return once
                        Comick fully transitions as a tracking site.
                      </p>
                    </div>
                    <Switch
                      id="enable-comick-search"
                      checked={false}
                      disabled
                      onCheckedChange={() => {
                        // No-op: Comick fallback is disabled
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-medium">
                        Enable MangaDex alternative search
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Use MangaDex as a fallback to find manga when AniList
                        search returns no results. Will be ignored when rate
                        limited and continue searching normally.
                      </p>
                    </div>
                    <Switch
                      id="enable-mangadex-search"
                      checked={matchConfig.enableMangaDexSearch}
                      onCheckedChange={(checked) => {
                        const newConfig = {
                          ...matchConfig,
                          enableMangaDexSearch: checked,
                        };
                        setMatchConfig(newConfig);
                        saveMatchConfigWithEvent(
                          newConfig,
                          "enableMangaDexSearch",
                        );
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                >
                  <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/50">
                    <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-800 dark:text-blue-200">
                      About matching settings
                    </AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      Some settings only affect automatic matching. All manga
                      types will still be available when using manual search
                      functionality.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              </SettingsSectionShell>
            </motion.div>
          </TabsContent>

          <TabsContent value="sync" className="space-y-6">
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="show"
              data-onboarding="sync-settings"
            >
              <SettingsSectionShell
                icon={RefreshCw}
                title="Sync preferences"
                description="Control how Kenmei data is synchronized to your AniList library."
                accent="from-purple-500/15 via-blue-500/10 to-transparent"
                contentClassName="space-y-5"
              >
                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">
                        Auto-pause inactive manga
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Automatically pause manga that haven&apos;t been updated
                        recently.
                      </p>
                    </div>
                    <Switch
                      id="auto-pause"
                      checked={syncConfig.autoPauseInactive}
                      onCheckedChange={(checked) => {
                        const newConfig = {
                          ...syncConfig,
                          autoPauseInactive: checked,
                        };
                        setSyncConfig(newConfig);
                        saveSyncConfigWithEvent(newConfig, "autoPauseInactive");
                      }}
                    />
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="grid gap-1.5">
                      <label
                        htmlFor="auto-pause-threshold"
                        className="text-xs font-medium"
                      >
                        Auto-pause threshold
                      </label>
                      <select
                        id="auto-pause-threshold"
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={
                          useCustomThreshold
                            ? "custom"
                            : syncConfig.autoPauseThreshold.toString()
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "custom") {
                            setUseCustomThreshold(true);
                          } else {
                            setUseCustomThreshold(false);
                            const newConfig = {
                              ...syncConfig,
                              autoPauseThreshold: Number(value),
                            };
                            setSyncConfig(newConfig);
                            saveSyncConfigWithEvent(
                              newConfig,
                              "autoPauseThreshold",
                            );
                          }
                        }}
                        disabled={!syncConfig.autoPauseInactive}
                      >
                        <option value="1">1 day</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                        <option value="60">2 months</option>
                        <option value="90">3 months</option>
                        <option value="180">6 months</option>
                        <option value="365">1 year</option>
                        <option value="custom">Custom...</option>
                      </select>
                    </div>

                    {useCustomThreshold && (
                      <div className="grid gap-1.5">
                        <label
                          htmlFor="custom-auto-pause-threshold"
                          className="text-xs font-medium"
                        >
                          Custom threshold (days)
                        </label>
                        <input
                          id="custom-auto-pause-threshold"
                          type="number"
                          min="1"
                          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Enter days"
                          value={
                            syncConfig.customAutoPauseThreshold ||
                            syncConfig.autoPauseThreshold
                          }
                          onChange={(e) => {
                            const value = Number.parseInt(e.target.value);
                            if (!Number.isNaN(value) && value > 0) {
                              const newConfig = {
                                ...syncConfig,
                                autoPauseThreshold: value,
                                customAutoPauseThreshold: value,
                              };
                              setSyncConfig(newConfig);
                              saveSyncConfigWithEvent(
                                newConfig,
                                "customAutoPauseThreshold",
                              );
                            }
                          }}
                          disabled={!syncConfig.autoPauseInactive}
                        />
                      </div>
                    )}

                    <Alert className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Auto-pause applies to manga with status READING.
                      </AlertDescription>
                    </Alert>
                  </div>
                </motion.div>

                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                >
                  <div className="mb-4">
                    <h3 className="text-sm font-medium">Status priority</h3>
                    <p className="text-muted-foreground text-xs">
                      Configure which AniList values override Kenmei data during
                      sync.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-sm" htmlFor="preserve-completed">
                        Preserve completed status
                      </label>
                      <Switch
                        id="preserve-completed"
                        checked={syncConfig.preserveCompletedStatus}
                        onCheckedChange={(checked) => {
                          const newConfig = {
                            ...syncConfig,
                            preserveCompletedStatus: checked,
                          };
                          setSyncConfig(newConfig);
                          saveSyncConfigWithEvent(
                            newConfig,
                            "preserveCompletedStatus",
                          );
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label
                        className="text-sm"
                        htmlFor="prioritize-anilist-status"
                      >
                        Prioritize AniList status
                      </label>
                      <Switch
                        id="prioritize-anilist-status"
                        checked={syncConfig.prioritizeAniListStatus}
                        onCheckedChange={(checked) => {
                          const newConfig = {
                            ...syncConfig,
                            prioritizeAniListStatus: checked,
                          };
                          setSyncConfig(newConfig);
                          saveSyncConfigWithEvent(
                            newConfig,
                            "prioritizeAniListStatus",
                          );
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label
                        className="text-sm"
                        htmlFor="prioritize-anilist-progress"
                      >
                        Prioritize AniList progress
                      </label>
                      <Switch
                        id="prioritize-anilist-progress"
                        checked={syncConfig.prioritizeAniListProgress}
                        onCheckedChange={(checked) => {
                          const newConfig = {
                            ...syncConfig,
                            prioritizeAniListProgress: checked,
                          };
                          setSyncConfig(newConfig);
                          saveSyncConfigWithEvent(
                            newConfig,
                            "prioritizeAniListProgress",
                          );
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label
                        className="text-sm"
                        htmlFor="prioritize-anilist-score"
                      >
                        Prioritize AniList score
                      </label>
                      <Switch
                        id="prioritize-anilist-score"
                        checked={syncConfig.prioritizeAniListScore}
                        onCheckedChange={(checked) => {
                          const newConfig = {
                            ...syncConfig,
                            prioritizeAniListScore: checked,
                          };
                          setSyncConfig(newConfig);
                          saveSyncConfigWithEvent(
                            newConfig,
                            "prioritizeAniListScore",
                          );
                        }}
                      />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="bg-muted/40 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-medium">Privacy settings</h3>
                      <p className="text-muted-foreground text-xs">
                        Control privacy for synchronized entries.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm" htmlFor="set-private">
                        Set entries as private
                      </label>
                      <Switch
                        id="set-private"
                        checked={syncConfig.setPrivate}
                        onCheckedChange={(checked) => {
                          const newConfig = {
                            ...syncConfig,
                            setPrivate: checked,
                          };
                          setSyncConfig(newConfig);
                          saveSyncConfigWithEvent(newConfig, "setPrivate");
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              </SettingsSectionShell>
            </motion.div>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <motion.div variants={itemVariants} initial="hidden" animate="show">
              <SettingsSectionShell
                icon={Database}
                title="Data management"
                description="Control cached data stored locally by the application."
                accent="from-sky-500/15 via-cyan-500/10 to-transparent"
                contentClassName="space-y-5"
              >
                <motion.div
                  className="bg-muted/40 space-y-4 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <Trash2 className="h-4 w-4 text-blue-500" />
                      Clear local cache
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Select which types of cached data to remove.
                    </p>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="auth-cache"
                        aria-label="Auth Cache - Authentication state"
                      >
                        <input
                          id="auth-cache"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.auth}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              auth: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Auth cache
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Authentication state
                          </p>
                        </div>
                      </label>
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="settings-cache"
                        aria-label="Settings Cache - Sync preferences"
                      >
                        <input
                          id="settings-cache"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.settings}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              settings: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Settings cache
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Sync preferences
                          </p>
                        </div>
                      </label>
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="sync-cache"
                        aria-label="Sync Cache - Sync history"
                      >
                        <input
                          id="sync-cache"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.sync}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              sync: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Sync cache
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Sync history
                          </p>
                        </div>
                      </label>
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="import-cache"
                        aria-label="Import Cache - Import history"
                      >
                        <input
                          id="import-cache"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.import}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              import: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Import cache
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Import history
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="review-cache"
                        aria-label="Review Cache - Match results"
                      >
                        <input
                          id="review-cache"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.review}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              review: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Review cache
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Matching results
                          </p>
                        </div>
                      </label>
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="manga-cache"
                        aria-label="Manga Cache - AniList manga data"
                      >
                        <input
                          id="manga-cache"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.manga}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              manga: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Manga cache
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Manga metadata
                          </p>
                        </div>
                      </label>
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="search-cache"
                        aria-label="Search Cache - Search results"
                      >
                        <input
                          id="search-cache"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.search}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              search: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Search cache
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Search results
                          </p>
                        </div>
                      </label>
                      <label
                        className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                        htmlFor="other-caches"
                        aria-label="Other Caches - Miscellaneous cache data"
                      >
                        <input
                          id="other-caches"
                          type="checkbox"
                          className="border-primary text-primary h-4 w-4 rounded"
                          checked={cachesToClear.other}
                          onChange={(e) =>
                            setCachesToClear({
                              ...cachesToClear,
                              other: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <span className="text-sm font-medium">
                            Other caches
                          </span>
                          <p className="text-muted-foreground text-xs">
                            Miscellaneous application data
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400"
                      onClick={() =>
                        setCachesToClear({
                          auth: true,
                          settings: true,
                          sync: true,
                          import: true,
                          review: true,
                          manga: true,
                          search: true,
                          other: true,
                        })
                      }
                    >
                      Select all
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400"
                      onClick={() =>
                        setCachesToClear({
                          auth: false,
                          settings: false,
                          sync: false,
                          import: false,
                          review: false,
                          manga: false,
                          search: false,
                          other: false,
                        })
                      }
                    >
                      Deselect all
                    </Button>
                  </div>

                  {(() => {
                    let buttonContent;
                    if (isClearing) {
                      buttonContent = (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Clearing cache...
                        </>
                      );
                    } else if (cacheCleared) {
                      buttonContent = (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Cache cleared successfully
                        </>
                      );
                    } else {
                      buttonContent = (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Clear selected caches
                        </>
                      );
                    }
                    return (
                      <Button
                        onClick={handleClearCache}
                        variant={cacheCleared ? "outline" : "default"}
                        disabled={
                          isClearing ||
                          !Object.values(cachesToClear).some(Boolean)
                        }
                        className={`w-full disabled:cursor-not-allowed disabled:opacity-60 ${
                          cacheCleared
                            ? "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/40"
                            : ""
                        }`}
                      >
                        {buttonContent}
                      </Button>
                    );
                  })()}
                </motion.div>
              </SettingsSectionShell>
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" animate="show">
              <SettingsSectionShell
                icon={Download}
                title="Backup & Restore"
                description="Export and restore your complete application data."
                accent="from-violet-500/15 via-purple-500/10 to-transparent"
                contentClassName="space-y-5"
              >
                <motion.div
                  className="bg-muted/40 space-y-4 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  {/* Export Section */}
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <Download className="h-4 w-4 text-violet-500" />
                      Create Backup
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Export all your Kenmei data, match results, sync
                      configuration, and import statistics.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <label
                      className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
                      htmlFor="auto-backup-enabled"
                      aria-label="Enable automatic backups"
                    >
                      <input
                        id="auto-backup-enabled"
                        type="checkbox"
                        className="border-primary text-primary h-4 w-4 rounded"
                        checked={autoBackupEnabled}
                        onChange={(e) =>
                          handleToggleAutoBackup(e.target.checked)
                        }
                      />
                      <div>
                        <span className="text-sm font-medium">
                          Enable automatic backups
                        </span>
                        <p className="text-muted-foreground text-xs">
                          Create backups before sync and matching operations
                        </p>
                      </div>
                    </label>
                  </div>

                  <Button
                    onClick={handleCreateBackup}
                    disabled={isCreatingBackup}
                    className="w-full"
                  >
                    {isCreatingBackup ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating backup...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Create Backup Now
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

                {/* Import Section */}
                <motion.div
                  className="bg-muted/40 space-y-4 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <Upload className="h-4 w-4 text-purple-500" />
                      Restore from Backup
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Import a previously created backup file to restore your
                      data.
                    </p>
                  </div>

                  <Separator />

                  <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Warning:</strong> Restoring from backup will
                        overwrite your current data. Create a backup first if
                        needed.
                      </p>
                    </div>
                  </div>

                  <div>
                    <input
                      type="file"
                      id="backup-file-input"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="backup-file-input"
                      className="hover:bg-muted/60 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors"
                    >
                      <Upload className="text-muted-foreground mb-2 h-8 w-8" />
                      <span className="text-sm font-medium">
                        {selectedBackupFile
                          ? selectedBackupFile.name
                          : "Choose backup file or drag and drop"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        JSON backup file
                      </span>
                    </label>
                  </div>

                  <Button
                    onClick={handleImportBackup}
                    disabled={isRestoringBackup || !selectedBackupFile}
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
                </motion.div>

                {/* Backup History Section */}
                <motion.div
                  className="bg-muted/40 space-y-4 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <History className="h-4 w-4 text-indigo-500" />
                        Recent Backups
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        Last {Math.min(backupHistory.length, 5)} backups
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBackupHistory(!showBackupHistory)}
                    >
                      {showBackupHistory ? "Hide" : "Show"}
                    </Button>
                  </div>

                  {showBackupHistory && (
                    <>
                      <Separator />
                      {backupHistory.length > 0 ? (
                        <div className="space-y-2">
                          {backupHistory.map((entry) => (
                            <div
                              key={entry.id}
                              className="hover:bg-muted/60 flex items-center justify-between rounded-md p-3 transition-colors"
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </p>
                                <div className="flex gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    v{entry.appVersion}
                                  </Badge>
                                  <span className="text-muted-foreground text-xs">
                                    {(entry.size / 1024).toFixed(2)} KB
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          <Separator className="my-2" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              clearBackupHistory();
                              setBackupHistory([]);
                            }}
                          >
                            Clear History
                          </Button>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No backups available yet. Create one to get started.
                        </p>
                      )}
                    </>
                  )}
                </motion.div>
              </SettingsSectionShell>
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" animate="show">
              <SettingsSectionShell
                icon={Bug}
                title="Debug tools"
                description="Advanced utilities for troubleshooting and development."
                accent="from-orange-500/15 via-red-500/10 to-transparent"
                contentClassName="space-y-4"
              >
                <motion.div
                  className="bg-muted/40 space-y-4 rounded-xl border p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-medium">Debug menu</h3>
                      <p className="text-muted-foreground text-xs">
                        Enable the in-app debug hub to access advanced
                        diagnostics.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm" htmlFor="debug-enabled">
                        Enable debug menu
                      </label>
                      <Switch
                        id="debug-enabled"
                        checked={isDebugEnabled}
                        onCheckedChange={toggleDebug}
                      />
                    </div>
                  </div>
                  {isDebugEnabled ? (
                    <div className="space-y-4">
                      <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
                        <div className="flex gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Heads up:</strong> Debug tools expose
                            persistent data and captured logs that may include
                            sensitive information. Enable them only on trusted
                            devices and disable when finished troubleshooting.
                          </p>
                        </div>
                      </div>
                      <div className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">
                                Log viewer
                              </h4>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              Inspect captured console output, filter by
                              severity, and export logs for support.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Enable panel
                            </span>
                            <Switch
                              id="log-viewer-enabled"
                              checked={logViewerEnabled}
                              onCheckedChange={(checked) =>
                                setLogViewerEnabled(Boolean(checked))
                              }
                            />
                          </div>
                        </div>
                        <div className="bg-muted/30 mt-3 flex flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              Redact sensitive data
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Automatically sanitize tokens and credentials in
                              captured logs.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Redact
                            </span>
                            <Switch
                              id="log-redaction-enabled"
                              checked={logRedactionEnabled}
                              onCheckedChange={(checked) =>
                                setLogRedactionEnabled(Boolean(checked))
                              }
                              disabled={!logViewerEnabled}
                            />
                          </div>
                        </div>
                        <p className="text-muted-foreground mt-3 text-xs">
                          Logs can contain access tokens or other
                          personally-identifiable information. Review before
                          exporting or sharing.
                        </p>
                      </div>
                      <div className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">
                                Storage debugger
                              </h4>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              Inspect and edit Electron Store alongside
                              localStorage from the debug command center.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Enable panel
                            </span>
                            <Switch
                              id="storage-debugger-enabled"
                              checked={storageDebuggerEnabled}
                              onCheckedChange={(checked) =>
                                setStorageDebuggerEnabled(Boolean(checked))
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <div className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">
                                State inspector
                              </h4>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              View live auth, sync, and settings state. Edit
                              snapshots to simulate runtime scenarios safely.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Enable panel
                            </span>
                            <Switch
                              id="state-inspector-enabled"
                              checked={stateInspectorEnabled}
                              onCheckedChange={(checked) =>
                                setStateInspectorEnabled(Boolean(checked))
                              }
                            />
                          </div>
                        </div>
                        <p className="text-muted-foreground mt-3 text-xs">
                          Changes applied through the inspector update in-app
                          state immediately. Export values before experimenting
                          for easy rollback.
                        </p>
                      </div>
                      <div className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">
                                Event logger
                              </h4>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              Review captured user actions and system events.
                              Filter the timeline by event type or time window
                              to trace workflows.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Enable panel
                            </span>
                            <Switch
                              id="event-logger-enabled"
                              checked={eventLoggerEnabled}
                              onCheckedChange={(checked) =>
                                setEventLoggerEnabled(Boolean(checked))
                              }
                            />
                          </div>
                        </div>
                        <p className="text-muted-foreground mt-3 text-xs">
                          Events are recorded while debug mode is active.
                          Disable the panel to stop tracking and clear the
                          in-memory history.
                        </p>
                      </div>
                      <div className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">
                                IPC traffic monitor
                              </h4>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              Capture renderer ↔ main IPC messages for
                              troubleshooting communication issues.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Enable panel
                            </span>
                            <Switch
                              id="ipc-viewer-enabled"
                              checked={ipcViewerEnabled}
                              onCheckedChange={(checked) =>
                                setIpcViewerEnabled(Boolean(checked))
                              }
                            />
                          </div>
                        </div>
                        <p className="text-muted-foreground mt-3 text-xs">
                          When disabled, IPC messages are not recorded – enable
                          only while debugging to avoid collecting unnecessary
                          data.
                        </p>
                      </div>
                      <div className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">
                                Confidence test exporter
                              </h4>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              Show buttons on match cards to export and copy
                              test commands for debugging confidence
                              calculations. Helpful for reporting issues with
                              specific match scores.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Enable
                            </span>
                            <Switch
                              id="confidence-test-exporter-enabled"
                              checked={confidenceTestExporterEnabled}
                              onCheckedChange={(checked) =>
                                setConfidenceTestExporterEnabled(
                                  Boolean(checked),
                                )
                              }
                            />
                          </div>
                        </div>
                        <p className="text-muted-foreground mt-3 text-xs">
                          When enabled, debug buttons appear next to confidence
                          badges on each match card, allowing you to generate
                          and copy commands for reproducing the confidence
                          calculation locally or sharing in bug reports.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Turn on the debug menu to manage individual tools.
                    </p>
                  )}
                </motion.div>
              </SettingsSectionShell>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Check for Updates Section */}
      <SettingsSectionShell
        icon={RefreshCw}
        title="Check for updates"
        description="Stay current with the latest Kenmei → AniList improvements."
        accent="from-sky-500/15 via-blue-500/10 to-transparent"
        className="mt-6"
        contentClassName="space-y-5"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <RadioGroup
            value={updateChannel}
            onValueChange={(v) => setUpdateChannel(v as "stable" | "beta")}
            className="flex flex-row gap-4"
            aria-label="Update Channel"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="stable" id="update-stable" />
              <label htmlFor="update-stable" className="text-sm font-medium">
                Stable
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="beta" id="update-beta" />
              <label htmlFor="update-beta" className="text-sm font-medium">
                Beta/Early Access
              </label>
            </div>
          </RadioGroup>
          <Button
            onClick={handleCheckForUpdates}
            disabled={isCheckingUpdate}
            aria-label="Check for updates"
            className="w-full md:w-auto"
          >
            {isCheckingUpdate ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check for Updates
              </>
            )}
          </Button>
        </div>
        {updateError && (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
            {updateError}
          </div>
        )}
        {updateInfo && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Badge
                className={
                  updateInfo.isBeta
                    ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                    : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                }
              >
                {updateInfo.isBeta ? "Beta/Early Access" : "Stable"}
              </Badge>
              <span className="font-mono text-xs text-slate-200">
                Latest: {updateInfo.version}
              </span>
              <button
                type="button"
                aria-label="View release on GitHub"
                className="text-blue-300 underline transition hover:text-blue-200"
                onClick={handleOpenExternal(updateInfo.url)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (globalThis.electronAPI?.shell?.openExternal) {
                      globalThis.electronAPI.shell.openExternal(updateInfo.url);
                    } else {
                      globalThis.open(
                        updateInfo.url,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }
                }}
              >
                View release notes
              </button>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-200">
              <span className="font-mono">Current: {getAppVersion()}</span>
              {(() => {
                const current = getAppVersion().replace(/^v/, "");
                const latest = updateInfo.version.replace(/^v/, "");
                if (current === latest) {
                  return (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Up to date
                    </Badge>
                  );
                }
                if (compareVersions(current, latest) < 0) {
                  return (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Update available
                    </Badge>
                  );
                }
                return (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    Development build
                  </Badge>
                );
              })()}
            </div>

            {/* Download/Install Actions */}
            <div className="space-y-3">
              {/* Download Progress Bar */}
              {(isDownloading || downloadProgress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Downloading...</span>
                    <span>{Math.round(downloadProgress * 100)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/50">
                    <div
                      className="bg-linear-to-r h-full from-blue-500 to-cyan-500 transition-all duration-300"
                      style={{ width: `${downloadProgress * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Download Button */}
              {!isDownloading && !isDownloaded && (
                <Button
                  onClick={handleDownloadUpdate}
                  disabled={isCheckingUpdate}
                  className="w-full"
                  variant="default"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Update
                </Button>
              )}

              {/* Install Button */}
              {isDownloaded && !isDownloading && (
                <Button
                  onClick={handleInstallUpdate}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Install Update
                </Button>
              )}
            </div>
          </div>
        )}
      </SettingsSectionShell>

      {/* Application Info Section */}
      <SettingsSectionShell
        icon={InfoIcon}
        title="Application insights"
        description="Quick glance."
        accent="from-indigo-500/15 via-purple-500/10 to-transparent"
        className="mt-6"
        contentClassName="space-y-6"
        badge={
          <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
            Version {getAppVersion()}
          </Badge>
        }
      >
        {(() => {
          let channelLabel: string;
          if (versionStatus === null) {
            channelLabel = "Checking channel status";
          } else if (versionStatus.status === "stable") {
            channelLabel = "Stable channel";
          } else if (versionStatus.status === "beta") {
            channelLabel = "Beta channel";
          } else {
            channelLabel = "Development channel";
          }
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-200">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
                <Clock className="h-3.5 w-3.5" />
                {channelLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
                <UserCircle className="h-3.5 w-3.5" />
                {authState.isAuthenticated
                  ? "Session active"
                  : "Session inactive"}
              </span>
            </div>
          );
        })()}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="bg-muted/40 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-900 dark:text-slate-300">
              <Clock className="h-4 w-4" /> Last synced
            </div>
            <p className="mt-2 text-sm text-white">{lastSyncMetadata.label}</p>
            <p className="text-xs text-slate-900/80 dark:text-slate-300/80">
              {lastSyncMetadata.hint}
            </p>
          </div>
          <div className="bg-muted/40 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-900 dark:text-slate-300">
              <Key className="h-4 w-4" /> Credentials
            </div>
            <p className="mt-2 text-sm text-white">{credentialSourceLabel}</p>
            <p className="text-xs text-slate-900/80 dark:text-slate-300/80">
              {useCustomCredentials
                ? "Using custom AniList API keys"
                : "Using built-in credentials"}
            </p>
          </div>
          <div className="bg-muted/40 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-900 dark:text-slate-300">
              <UserCircle className="h-4 w-4" /> Authentication
            </div>
            <p className="mt-2 text-sm text-white">
              {authState.isAuthenticated ? "Connected" : "Not connected"}
            </p>
            <p className="text-xs text-slate-900/80 dark:text-slate-300/80">
              {authState.isAuthenticated
                ? `Expires in ${expiresLabel ?? "unknown"}`
                : "Sign in to unlock sync features"}
            </p>
          </div>
        </div>
      </SettingsSectionShell>
    </motion.div>
  );
}
