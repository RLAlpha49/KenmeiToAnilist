import type { BackupScheduleConfig } from "@/utils/storage";

/**
 * Cache types that can be cleared individually.
 * Each boolean flag represents whether that cache type should be cleared.
 * @source
 */
export interface CachesToClear {
  /** Whether to clear authentication tokens and login state cache. */
  shouldClearAuthCache: boolean;
  /** Whether to clear sync settings and preferences cache. */
  shouldClearSettingsCache: boolean;
  /** Whether to clear synchronization history cache. */
  shouldClearSyncCache: boolean;
  /** Whether to clear import operation history cache. */
  shouldClearImportCache: boolean;
  /** Whether to clear matching results cache. */
  shouldClearReviewCache: boolean;
  /** Whether to clear manga titles and metadata cache. */
  shouldClearMangaCache: boolean;
  /** Whether to clear search queries and results cache. */
  shouldClearSearchCache: boolean;
  /** Whether to clear miscellaneous cache data. */
  shouldClearOtherCache: boolean;
}

/**
 * Props for the Data Management tab component.
 * Aggregates all state and handlers for cache management, backup/restore, and debug tools.
 * @source
 */
export interface DataManagementProps {
  // Cache state
  /** Which cache types to clear when clear action is triggered. */
  cachesToClear: CachesToClear;
  /** Whether caches are currently being cleared. */
  isClearing: boolean;
  /** Whether caches were successfully cleared (success flag). */
  isCacheCleared: boolean;

  // Backup/restore state
  /** Currently selected backup file for restore operations. */
  selectedBackupFile: File | null;
  /** Error message if backup file validation fails. */
  backupValidationError: string | null;
  /** Backup schedule configuration. */
  scheduleConfig: BackupScheduleConfig;
  /** Timestamp of next scheduled backup or null. */
  nextScheduledBackup: number | null;
  /** Timestamp of last scheduled backup or null. */
  lastScheduledBackup: number | null;
  /** Whether a manual backup is currently being triggered. */
  isTriggeringBackup: boolean;
  /** Whether a backup restore operation is in progress. */
  isRestoringBackup: boolean;

  // Debug tools state
  /** Whether the debug menu is enabled. */
  isDebugEnabled: boolean;
  /** Whether storage debugger panel is enabled. */
  isStorageDebuggerEnabled: boolean;
  /** Whether log viewer panel is enabled. */
  isLogViewerEnabled: boolean;
  /** Whether log redaction is enabled in the log viewer. */
  isLogRedactionEnabled: boolean;
  /** Whether state inspector panel is enabled. */
  isStateInspectorEnabled: boolean;
  /** Whether IPC viewer panel is enabled. */
  isIpcViewerEnabled: boolean;
  /** Whether event logger panel is enabled. */
  isEventLoggerEnabled: boolean;
  /** Whether confidence test exporter is enabled. */
  isConfidenceTestExporterEnabled: boolean;
  /** Whether performance monitor is enabled. */
  isPerformanceMonitorEnabled: boolean;

  // Search/UI state
  /** Current search query for filtering sections. */
  searchQuery: string;
  /** ID of currently highlighted section. */
  highlightedSectionId: string | null;

  // Cache handlers
  /** Callback to update which caches to clear. */
  onCachesToClearChange: (caches: CachesToClear) => void;
  /** Callback to execute cache clearing. */
  onClearCaches: () => void;

  // Backup/restore handlers
  /** Callback to trigger backup restore from previously uploaded file. */
  onRestoreBackup: () => void;
  /** Optional callback to restore from file directly. */
  onRestoreBackupFile?: (file: File) => void;
  /** Callback when user selects a backup file. */
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to update backup schedule configuration. */
  onScheduleConfigChange: (config: BackupScheduleConfig) => void;
  /** Callback to trigger manual backup creation. */
  onTriggerBackup: () => void;

  // Debug tools handlers
  /** Callback to toggle debug menu on/off. */
  onToggleDebug: () => void;
  /** Callback to toggle storage debugger panel. */
  onStorageDebuggerChange: (enabled: boolean) => void;
  /** Callback to toggle log viewer panel. */
  onLogViewerChange: (enabled: boolean) => void;
  /** Callback to toggle log redaction in viewer. */
  onLogRedactionChange: (enabled: boolean) => void;
  /** Callback to toggle state inspector panel. */
  onStateInspectorChange: (enabled: boolean) => void;
  /** Callback to toggle IPC viewer panel. */
  onIpcViewerChange: (enabled: boolean) => void;
  /** Callback to toggle event logger panel. */
  onEventLoggerChange: (enabled: boolean) => void;
  /** Callback to toggle confidence test exporter. */
  onConfidenceTestExporterChange: (enabled: boolean) => void;
  /** Callback to toggle performance monitor. */
  onPerformanceMonitorChange: (enabled: boolean) => void;

  // Collapsed sections state
  /** Map of section IDs to their collapsed states. */
  collapsedSections: Record<string, boolean>;
  /** Callback to toggle a section's collapsed state. */
  onToggleSection: (sectionId: string) => void;
}
