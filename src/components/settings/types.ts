import type { BackupHistoryEntry } from "@/utils/backup";

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
  backupHistory: BackupHistoryEntry[];
  isCreatingBackup: boolean;
  isRestoringBackup: boolean;
  autoBackupEnabled: boolean;
  selectedBackupFile: File | null;
  backupValidationError: string | null;
  showBackupHistory: boolean;
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
  onCreateBackup: () => void;
  onRestoreBackup: () => void;
  onToggleAutoBackup: (enabled: boolean) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBackupHistory: (show: boolean) => void;
  setBackupHistory: (history: BackupHistoryEntry[]) => void;
  onToggleDebug: () => void;
  onStorageDebuggerChange: (enabled: boolean) => void;
  onLogViewerChange: (enabled: boolean) => void;
  onLogRedactionChange: (enabled: boolean) => void;
  onStateInspectorChange: (enabled: boolean) => void;
  onIpcViewerChange: (enabled: boolean) => void;
  onEventLoggerChange: (enabled: boolean) => void;
  onConfidenceTestExporterChange: (enabled: boolean) => void;
}
