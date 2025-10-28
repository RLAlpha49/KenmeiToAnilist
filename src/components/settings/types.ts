import type { BackupScheduleConfig } from "@/utils/storage";

export interface CachesToClear {
  auth: boolean;
  settings: boolean;
  sync: boolean;
  import: boolean;
  review: boolean;
  manga: boolean;
  search: boolean;
  other: boolean;
}

export interface DataManagementProps {
  cachesToClear: CachesToClear;
  isClearing: boolean;
  cacheCleared: boolean;
  selectedBackupFile: File | null;
  backupValidationError: string | null;
  isDebugEnabled: boolean;
  storageDebuggerEnabled: boolean;
  logViewerEnabled: boolean;
  logRedactionEnabled: boolean;
  stateInspectorEnabled: boolean;
  ipcViewerEnabled: boolean;
  eventLoggerEnabled: boolean;
  confidenceTestExporterEnabled: boolean;
  searchQuery: string;
  highlightedSectionId: string | null;
  onCachesToClearChange: (caches: CachesToClear) => void;
  onClearCaches: () => void;
  onRestoreBackup: () => void;
  onRestoreBackupFile?: (file: File) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  scheduleConfig: BackupScheduleConfig;
  nextScheduledBackup: number | null;
  lastScheduledBackup: number | null;
  isTriggeringBackup: boolean;
  isRestoringBackup: boolean;
  onScheduleConfigChange: (config: BackupScheduleConfig) => void;
  onTriggerBackup: () => void;
  onToggleDebug: () => void;
  onStorageDebuggerChange: (enabled: boolean) => void;
  onLogViewerChange: (enabled: boolean) => void;
  onLogRedactionChange: (enabled: boolean) => void;
  onStateInspectorChange: (enabled: boolean) => void;
  onIpcViewerChange: (enabled: boolean) => void;
  onEventLoggerChange: (enabled: boolean) => void;
  onConfidenceTestExporterChange: (enabled: boolean) => void;
}
