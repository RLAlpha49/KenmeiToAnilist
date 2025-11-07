/**
 * @packageDocumentation
 * @module SettingsPage
 * @description Settings page component for the Kenmei to AniList sync tool. Handles authentication, sync preferences, data management, and cache clearing.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import Fuse, { type FuseResult } from "fuse.js";
import { ErrorMessage } from "../components/ui/error-message";
import { ErrorType, createError, AppError } from "../utils/errorHandling";
import { CheckCircle, ChevronsDown, ChevronsUp } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { SettingsSection, SettingsSearchResult } from "../types/settings";
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
  BackupScheduleConfig,
  DEFAULT_BACKUP_SCHEDULE_CONFIG,
} from "../utils/storage";
import { restoreBackup, importBackupFromFile } from "../utils/backup";
import { importMatchResults } from "../utils/exportUtils";
import { motion } from "framer-motion";
import { truncateToastMessage } from "../utils/textHighlight";
import { toast } from "sonner";
import { SettingsHero } from "../components/settings/SettingsHero";
import { SettingsSearchBar } from "../components/settings/SettingsSearchBar";
import { AccountCredentialsSection } from "../components/settings/AccountCredentialsSection";
import { SettingsTabsContainer } from "../components/settings/SettingsTabsContainer";
import { UpdateManagementSection } from "@/components/settings/UpdateManagementSection";

/**
 * Settings page component for the Kenmei to AniList sync tool.
 *
 * Handles authentication, sync preferences, data management, and cache clearing for the user.
 *
 * @source
 */
export function SettingsPage() {
  // All settings section IDs that can be collapsed
  const SECTION_IDS = [
    "matching-preferences",
    "sync-preferences",
    "data-management",
    "backup-restore",
    "debug-tools",
    "update-management",
  ] as const;

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
    performanceMonitorEnabled,
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
    setPerformanceMonitorEnabled,
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
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(
    null,
  );
  const [backupValidationError, setBackupValidationError] = useState<
    string | null
  >(null);

  // Backup schedule state
  const [scheduleConfig, setScheduleConfig] = useState<BackupScheduleConfig>(
    DEFAULT_BACKUP_SCHEDULE_CONFIG,
  );
  const [nextScheduledBackup, setNextScheduledBackup] = useState<number | null>(
    null,
  );
  const [lastScheduledBackup, setLastScheduledBackup] = useState<number | null>(
    null,
  );
  const [isTriggeringBackup, setIsTriggeringBackup] = useState(false);

  // Match import state
  const [selectedMatchImportFile, setSelectedMatchImportFile] =
    useState<File | null>(null);

  // Settings search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SettingsSearchResult[]>(
    [],
  );
  const [highlightedSectionId, setHighlightedSectionId] = useState<
    string | null
  >(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  /**
   * Saves sync configuration with debug event logging.
   * @param config - Updated sync configuration to save.
   * @param changedField - The name of the configuration field that changed.
   * @source
   */
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

  /**
   * Saves match configuration with debug event logging.
   * @param config - Updated match configuration to save.
   * @param changedField - The name of the configuration field that changed.
   * @source
   */
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
    setMatchConfig(config);
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

  // Create searchable settings sections index
  const settingsSections = useMemo<SettingsSection[]>(() => {
    type SectionDef = Omit<SettingsSection, "tab">;

    const grouped: Record<string, SectionDef[]> = {
      matching: [
        {
          id: "matching-one-shots",
          title: "Ignore one shots in automatic matching",
          description: "Skip one-shot manga during automatic matching",
          keywords: ["skip", "filter", "one-shot", "exclude"],
        },
        {
          id: "matching-adult-content",
          title: "Ignore adult content in automatic matching",
          description: "Skip adult content manga during automatic matching",
          keywords: ["nsfw", "adult", "18+", "filter", "ignore"],
        },
        {
          id: "matching-blur-adult",
          title: "Blur adult content images",
          description: "Blur cover images marked as adult content",
          keywords: ["privacy", "nsfw", "blur", "hide", "censor"],
        },
        {
          id: "matching-comick",
          title: "Enable Comick alternative search",
          description: "Use Comick as a fallback search source",
          keywords: ["fallback", "alternative", "source", "comick"],
        },
        {
          id: "matching-mangadex",
          title: "Enable MangaDex alternative search",
          description: "Use MangaDex as a fallback search source",
          keywords: ["fallback", "alternative", "source", "mangadex"],
        },
        {
          id: "matching-custom-rules",
          title: "Custom Matching Rules",
          description:
            "Define regex patterns to automatically skip or accept manga",
          keywords: ["advanced", "regex", "filter", "pattern", "custom"],
        },
      ],
      sync: [
        {
          id: "sync-auto-pause",
          title: "Auto-pause inactive manga",
          description:
            "Automatically pause and pause sync for manga not updated within the threshold period",
          keywords: [
            "inactive",
            "pause",
            "automatic",
            "timeout",
            "threshold",
            "sync",
          ],
        },
        {
          id: "sync-status-priority",
          title: "Status priority toggles",
          description:
            "Control which source takes priority: AniList or Kenmei data during sync",
          keywords: [
            "reading",
            "completed",
            "dropped",
            "priority",
            "status",
            "anilist",
            "kenmei",
            "source",
          ],
        },
        {
          id: "sync-privacy",
          title: "Privacy settings",
          description:
            "Set AniList entries as private to control visibility and sharing of your synced manga",
          keywords: [
            "private",
            "public",
            "visibility",
            "privacy",
            "sharing",
            "anilist",
          ],
        },
      ],
      data: [
        {
          id: "data-cache",
          title: "Cache Management",
          description:
            "Select which cached data types to clear and reset. Cache types include authentication, settings, sync, and more",
          keywords: [
            "clear",
            "reset",
            "storage",
            "cache",
            "authentication",
            "settings",
            "sync",
            "manga",
            "search",
            "temp",
          ],
        },
        {
          id: "data-backup",
          title: "Backup & Restore",
          description:
            "Export and save all Kenmei data as backups, or import and restore from previously created backup files",
          keywords: [
            "export",
            "import",
            "backup",
            "restore",
            "save",
            "download",
            "upload",
            "history",
          ],
        },
        {
          id: "data-debug",
          title: "Debug Tools",
          description:
            "Enable debug features including logs, logger, storage inspection, state inspection, IPC monitoring, and confidence testing",
          keywords: [
            "developer",
            "debug",
            "logs",
            "logger",
            "tools",
            "storage",
            "state",
            "ipc",
            "confidence",
            "test",
            "redact",
            "event",
          ],
        },
      ],
    };

    return Object.entries(grouped).flatMap(([tab, items]) =>
      items.map((it) => ({ ...it, tab: tab as SettingsSection["tab"] })),
    );
  }, []);

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse<SettingsSection>(settingsSections, {
      keys: [
        { name: "title", weight: 0.3 },
        { name: "description", weight: 0.5 },
        { name: "keywords", weight: 0.2 },
      ],
      threshold: 0.2,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 3,
      ignoreLocation: true,
    });
  }, [settingsSections]);

  /**
   * Performs fuzzy search on settings sections using Fuse.js.
   * @param query - Search query string.
   * @returns Array of settings search results with scores and matches.
   * @source
   */
  const performSearch = useCallback(
    (query: string): SettingsSearchResult[] => {
      if (!query.trim()) {
        return [];
      }
      const results: FuseResult<SettingsSection>[] = fuse.search(query);
      console.log("[Settings] Search results for query:", query, results);
      return results.map((result) => ({
        section: result.item,
        score: result.score || 0,
        matches: result.matches ? Array.from(result.matches) : [],
      }));
    },
    [fuse],
  );

  /**
   * Handles search query input changes and updates search results.
   * @param value - The new search query value.
   * @source
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      sessionStorage.setItem("settings-search-query", value);

      // Update search results
      if (value.trim()) {
        const results = performSearch(value);
        setSearchResults(results);
      } else {
        setSearchResults([]);
        setHighlightedSectionId(null);
      }
    },
    [performSearch],
  );

  // Load search query from session on mount
  useEffect(() => {
    const savedQuery = sessionStorage.getItem("settings-search-query");
    if (savedQuery) {
      setSearchQuery(savedQuery);
      // Perform search with saved query
      const results = fuse.search(savedQuery).map(
        (result) =>
          ({
            section: result.item,
            score: result.score || 0,
            matches: result.matches || [],
          }) as SettingsSearchResult,
      );
      if (results.length > 0) {
        setSearchResults(results);
      }
    }
  }, []);

  // Keyboard shortcut handler for Ctrl+F (Windows/Linux) and Cmd+F (macOS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track previous credential values to prevent unnecessary updates
  const prevCredentialsRef = useRef({
    id: "",
    secret: "",
    uri: "",
  });

  // Update error state when auth error changes
  useEffect(() => {
    if (authError) {
      setError(createError(ErrorType.AUTH, authError));
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

  // Load backup schedule config on mount
  useEffect(() => {
    const loadScheduleConfig = async () => {
      try {
        console.debug("[Settings] Loading backup schedule config...");
        const config = await globalThis.electronBackup?.getScheduleConfig?.();
        if (config) {
          setScheduleConfig(config);
        }
        const status = await globalThis.electronBackup?.getBackupStatus?.();
        if (status) {
          setLastScheduledBackup(status.lastBackup);
          setNextScheduledBackup(status.nextBackup);
        }
        console.info("[Settings] ✅ Backup schedule config loaded");
      } catch (error) {
        console.error(
          "[Settings] ❌ Failed to load backup schedule config:",
          error,
        );
      }
    };
    loadScheduleConfig();
  }, []);

  // Listen for backup events
  useEffect(() => {
    const cleanupComplete = globalThis.electronBackup?.onBackupComplete?.(
      (data: { backupId: string; timestamp: number }) => {
        console.info("[Settings] Scheduled backup completed:", data.backupId);
        toast.success("Scheduled backup completed", {
          description: `Backup created at ${new Date(data.timestamp).toLocaleString()}`,
        });
        setLastScheduledBackup(data.timestamp);
        // Refresh status to get next backup time
        globalThis.electronBackup?.getBackupStatus?.().then(
          (
            status:
              | {
                  isRunning: boolean;
                  lastBackup: number | null;
                  nextBackup: number | null;
                }
              | undefined,
          ) => {
            setNextScheduledBackup(status?.nextBackup ?? null);
          },
        );
      },
    );

    const cleanupError = globalThis.electronBackup?.onBackupError?.(
      (error: string) => {
        console.error("[Settings] Scheduled backup failed:", error);
        toast.error("Scheduled backup failed", {
          description: truncateToastMessage(error, 200).component,
        });
      },
    );

    return () => {
      cleanupComplete?.();
      cleanupError?.();
    };
  }, []);

  // Load update channel preference from storage on mount
  useEffect(() => {
    try {
      const savedChannel = storage.getItem(STORAGE_KEYS.UPDATE_CHANNEL);
      if (savedChannel === "beta" || savedChannel === "stable") {
        setUpdateChannel(savedChannel);
        console.debug(
          `[Settings] ✅ Loaded update channel preference: ${savedChannel}`,
        );
      }
    } catch (err) {
      console.error(
        "[Settings] ❌ Failed to load update channel preference:",
        err,
      );
    }
  }, []);

  // Save update channel preference to storage whenever it changes
  useEffect(() => {
    try {
      storage.setItem(STORAGE_KEYS.UPDATE_CHANNEL, updateChannel);
      console.debug(
        `[Settings] 💾 Saved update channel preference: ${updateChannel}`,
      );
    } catch (err) {
      console.error(
        "[Settings] ❌ Failed to save update channel preference:",
        err,
      );
    }
  }, [updateChannel]);

  // Load collapsed sections state from storage on mount
  useEffect(() => {
    try {
      const savedCollapsedSections = storage.getItem(
        STORAGE_KEYS.SETTINGS_COLLAPSED_SECTIONS,
      );
      if (savedCollapsedSections) {
        const parsed = JSON.parse(savedCollapsedSections);
        setCollapsedSections(parsed);
        console.debug("[Settings] ✅ Loaded collapsed sections state:", parsed);
      }
    } catch (err) {
      console.error(
        "[Settings] ❌ Failed to load collapsed sections state:",
        err,
      );
    }
  }, []);

  // Persist collapsed sections state to storage with debouncing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      try {
        storage.setItem(
          STORAGE_KEYS.SETTINGS_COLLAPSED_SECTIONS,
          JSON.stringify(collapsedSections),
        );
        console.debug(
          "[Settings] 💾 Saved collapsed sections state:",
          collapsedSections,
        );
      } catch (err) {
        console.error(
          "[Settings] ❌ Failed to save collapsed sections state:",
          err,
        );
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [collapsedSections]);

  /**
   * Toggles the collapsed state of a specific settings section.
   * @param sectionId - The ID of the section to toggle.
   * @source
   */
  const handleToggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  /**
   * Toggles all settings sections between fully collapsed and fully expanded states.
   * @source
   */
  const handleExpandCollapseAll = useCallback(() => {
    const allCollapsed = SECTION_IDS.every((id) => collapsedSections[id]);

    setCollapsedSections(
      SECTION_IDS.reduce(
        (acc, id) => ({
          ...acc,
          [id]: !allCollapsed,
        }),
        {},
      ),
    );
  }, [collapsedSections]);

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
          ErrorType.AUTH,
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
          ErrorType.AUTH,
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
   * Handles restoring a backup file directly from the backup list.
   * @param file - The backup file to restore from
   * @source
   */
  const handleRestoreBackupFile = async (file: File) => {
    try {
      console.info("[Settings] 📥 Restoring backup from list file:", file.name);
      setIsRestoringBackup(true);
      setBackupValidationError(null);

      // Import and validate backup
      const backupData = await importBackupFromFile(file);

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
      console.error("[Settings] ❌ Failed to restore backup from list:", err);
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
   * Handles changes to backup schedule configuration.
   * @source
   */
  const handleScheduleConfigChange = async (
    newConfig: BackupScheduleConfig,
  ) => {
    // Save previous config for potential revert
    const previousConfig = scheduleConfig;

    try {
      setScheduleConfig(newConfig);
      const result =
        await globalThis.electronBackup?.setScheduleConfig?.(newConfig);

      if (!result?.success) {
        // Revert to previous config if update failed
        setScheduleConfig(previousConfig);
        const errorMessage = result?.error || "Unknown error";
        console.error(
          "[Settings] Failed to update backup schedule:",
          errorMessage,
        );
        toast.error("Failed to update backup schedule", {
          description: truncateToastMessage(errorMessage, 200).component,
        });
        return;
      }

      console.info("[Settings] Backup schedule config updated:", newConfig);
      recordEvent({
        type: "backup.schedule-updated",
        message: `Backup schedule ${newConfig.enabled ? "enabled" : "disabled"} (${newConfig.interval})`,
        level: "info",
        metadata: { config: newConfig },
      });
      // Refresh status to get updated next backup time
      const status = await globalThis.electronBackup?.getBackupStatus?.();
      if (status) {
        setNextScheduledBackup(status.nextBackup);
      }
    } catch (error) {
      // Revert to previous config on exception
      setScheduleConfig(previousConfig);
      console.error("[Settings] Exception updating backup schedule:", error);
      toast.error("Failed to update backup schedule", {
        description: truncateToastMessage(
          error instanceof Error ? error.message : "Unknown error",
          200,
        ).component,
      });
    }
  };

  /**
   * Handles manual trigger of a scheduled backup.
   * @source
   */
  const handleTriggerScheduledBackup = async () => {
    try {
      setIsTriggeringBackup(true);
      console.info("[Settings] Manually triggering scheduled backup...");
      const result = await globalThis.electronBackup?.triggerBackup?.();
      if (result?.success) {
        toast.success("Backup created successfully", {
          description: `Backup ID: ${result.backupId}`,
        });
        // Refresh backup status from main process
        const status = await globalThis.electronBackup?.getBackupStatus?.();
        if (status) {
          setLastScheduledBackup(status.lastBackup);
          setNextScheduledBackup(status.nextBackup);
        }
      } else {
        throw new Error(result?.error || "Unknown error");
      }
    } catch (error) {
      console.error("[Settings] Failed to trigger backup:", error);
      toast.error("Failed to create backup", {
        description: truncateToastMessage(
          error instanceof Error ? error.message : "Unknown error",
          200,
        ).component,
      });
    } finally {
      setIsTriggeringBackup(false);
    }
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
   * Handles file selection for match import.
   * @source
   */
  const handleMatchImportFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMatchImportFile(file);
      console.debug("[Settings] 📄 Match import file selected:", file.name);
    }
  };

  /**
   * Handles match import from selected file.
   * Validates the file format and imports matches according to the selected strategy.
   * @source
   */
  const handleImportMatches = async (
    file: File,
    strategy: "replace" | "merge" | "skip-duplicates",
  ) => {
    try {
      console.info("[Settings] 📥 Importing matches...", { strategy });

      const stats = await importMatchResults(file, { strategy });

      // Clear selection
      setSelectedMatchImportFile(null);

      // Show success toast with statistics
      const { imported, merged, skipped, conflicts } = stats;
      const summary = [
        imported > 0 && `${imported} imported`,
        merged > 0 && `${merged} merged`,
        skipped > 0 && `${skipped} skipped`,
        conflicts > 0 && `${conflicts} conflicts`,
      ]
        .filter(Boolean)
        .join(", ");

      toast.success(`Successfully imported matches: ${summary || "completed"}`);

      recordEvent({
        type: "settings.match-import",
        message: `Imported ${imported} matches using ${strategy} strategy`,
        level: "info",
        metadata: { strategy, ...stats },
      });
    } catch (err) {
      let errorMessage = "Unknown import error";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String((err as { message: unknown }).message);
      }

      console.error("[Settings] ❌ Match import error:", err);
      toast.error(`Match import failed: ${errorMessage}`);

      recordEvent({
        type: "settings.match-import-error",
        message: `Match import failed: ${errorMessage}`,
        level: "error",
        metadata: { error: errorMessage },
      });
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
   * Checks for updates using the configured update channel preference.
   * Updates state with version info or error message.
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
   * Initiates download of an available update.
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
   * Installs the downloaded update by quitting the app and applying changes.
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

  // Computed value for button state
  const allCollapsed = SECTION_IDS.every((id) => collapsedSections[id]);

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
      >
        <AccountCredentialsSection
          authState={authState}
          isLoading={isLoading}
          useCustomCredentials={useCustomCredentials}
          onToggleCustomCredentials={setUseCustomCredentials}
          clientId={clientId}
          onClientIdChange={setClientId}
          clientSecret={clientSecret}
          onClientSecretChange={setClientSecret}
          redirectUri={redirectUri}
          onRedirectUriChange={setRedirectUri}
          defaultCredentialStatus={defaultCredentialStatus}
          customCredentialStatus={customCredentialStatus}
        />
      </SettingsHero>

      <SettingsSearchBar
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onSearchChange={handleSearchChange}
      />

      {!searchQuery && (
        <div className="flex justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandCollapseAll}
                  className="text-xs text-slate-600 dark:text-slate-400"
                >
                  {allCollapsed ? (
                    <>
                      <ChevronsUp className="mr-2 h-4 w-4" />
                      Expand All
                    </>
                  ) : (
                    <>
                      <ChevronsDown className="mr-2 h-4 w-4" />
                      Collapse All
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {allCollapsed ? "Expand all sections" : "Collapse all sections"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

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
            retry={error.type === ErrorType.AUTH ? handleLogin : undefined}
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

      <SettingsTabsContainer
        searchQuery={searchQuery}
        searchResults={searchResults}
        highlightedSectionId={highlightedSectionId}
        matchConfig={matchConfig}
        syncConfig={syncConfig}
        useCustomThreshold={useCustomThreshold}
        cachesToClear={cachesToClear}
        isClearing={isClearing}
        cacheCleared={cacheCleared}
        isRestoringBackup={isRestoringBackup}
        selectedBackupFile={selectedBackupFile}
        backupValidationError={backupValidationError}
        isDebugEnabled={isDebugEnabled}
        storageDebuggerEnabled={storageDebuggerEnabled}
        logViewerEnabled={logViewerEnabled}
        logRedactionEnabled={logRedactionEnabled}
        stateInspectorEnabled={stateInspectorEnabled}
        ipcViewerEnabled={ipcViewerEnabled}
        eventLoggerEnabled={eventLoggerEnabled}
        confidenceTestExporterEnabled={confidenceTestExporterEnabled}
        performanceMonitorEnabled={performanceMonitorEnabled}
        onMatchConfigChange={saveMatchConfigWithEvent}
        onSyncConfigChange={saveSyncConfigWithEvent}
        onCustomThresholdToggle={setUseCustomThreshold}
        setSyncConfig={setSyncConfig}
        onCachesToClearChange={setCachesToClear}
        onClearCaches={handleClearCache}
        onRestoreBackup={handleImportBackup}
        onRestoreBackupFile={handleRestoreBackupFile}
        onFileSelect={handleFileSelect}
        matchImportFile={selectedMatchImportFile}
        matchImportError={null}
        isImportingMatches={false}
        onMatchImportFileSelect={handleMatchImportFileSelect}
        onImportMatches={handleImportMatches}
        scheduleConfig={scheduleConfig}
        nextScheduledBackup={nextScheduledBackup}
        lastScheduledBackup={lastScheduledBackup}
        isTriggeringBackup={isTriggeringBackup}
        onScheduleConfigChange={handleScheduleConfigChange}
        onTriggerBackup={handleTriggerScheduledBackup}
        onToggleDebug={toggleDebug}
        onStorageDebuggerChange={setStorageDebuggerEnabled}
        onLogViewerChange={setLogViewerEnabled}
        onLogRedactionChange={setLogRedactionEnabled}
        onStateInspectorChange={setStateInspectorEnabled}
        onIpcViewerChange={setIpcViewerEnabled}
        onEventLoggerChange={setEventLoggerEnabled}
        onConfidenceTestExporterChange={setConfidenceTestExporterEnabled}
        onPerformanceMonitorChange={setPerformanceMonitorEnabled}
        collapsedSections={collapsedSections}
        onToggleSection={handleToggleSection}
      />
      <UpdateManagementSection
        updateChannel={updateChannel}
        isCheckingUpdate={isCheckingUpdate}
        updateInfo={updateInfo}
        updateError={updateError}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        isDownloaded={isDownloaded}
        highlightedSectionId={highlightedSectionId}
        onUpdateChannelChange={setUpdateChannel}
        onCheckForUpdates={handleCheckForUpdates}
        onDownloadUpdate={handleDownloadUpdate}
        onInstallUpdate={handleInstallUpdate}
        onOpenExternal={handleOpenExternal}
        collapsedSections={collapsedSections}
        onToggleSection={handleToggleSection}
      />
    </motion.div>
  );
}
