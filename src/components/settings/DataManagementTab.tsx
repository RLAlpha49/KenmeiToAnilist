/**
 * @packageDocumentation
 * @module DataManagementTab
 * @description Data management tab content component for the Settings page.
 */

import React from "react";
import { motion } from "framer-motion";
import { Database, Download, Bug } from "lucide-react";
import { SettingsSectionShell } from "./SettingsSectionShell";
import { CacheManagementSection } from "./CacheManagementSection";
import { BackupRestoreSection } from "./BackupRestoreSection";
import { DebugToolsSection } from "./DebugToolsSection";
import type { BackupHistoryEntry } from "@/utils/backup";

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

interface CachesToClear {
  auth: boolean;
  settings: boolean;
  sync: boolean;
  import: boolean;
  review: boolean;
  manga: boolean;
  search: boolean;
  other: boolean;
}

interface DataManagementTabProps {
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

/**
 * Data management tab content component.
 * Orchestrates rendering of cache, backup, and debug sections.
 *
 * @source
 */
export function DataManagementTab({
  cachesToClear,
  isClearing,
  cacheCleared,
  backupHistory,
  isCreatingBackup,
  isRestoringBackup,
  autoBackupEnabled,
  selectedBackupFile,
  backupValidationError,
  showBackupHistory,
  isDebugEnabled,
  storageDebuggerEnabled,
  logViewerEnabled,
  logRedactionEnabled,
  stateInspectorEnabled,
  ipcViewerEnabled,
  eventLoggerEnabled,
  confidenceTestExporterEnabled,
  searchQuery,
  highlightedSectionId,
  onCachesToClearChange,
  onClearCaches,
  onCreateBackup,
  onRestoreBackup,
  onToggleAutoBackup,
  onFileSelect,
  onToggleBackupHistory,
  setBackupHistory,
  onToggleDebug,
  onStorageDebuggerChange,
  onLogViewerChange,
  onLogRedactionChange,
  onStateInspectorChange,
  onIpcViewerChange,
  onEventLoggerChange,
  onConfidenceTestExporterChange,
}: Readonly<DataManagementTabProps>) {
  return (
    <>
      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <SettingsSectionShell
          icon={Database}
          title="Data management"
          description="Control cached data stored locally by the application."
          accent="from-sky-500/15 via-cyan-500/10 to-transparent"
          contentClassName="space-y-5"
        >
          <CacheManagementSection
            cachesToClear={cachesToClear}
            isClearing={isClearing}
            cacheCleared={cacheCleared}
            searchQuery={searchQuery}
            highlightedSectionId={highlightedSectionId}
            onCachesToClearChange={onCachesToClearChange}
            onClearCaches={onClearCaches}
          />
        </SettingsSectionShell>
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <div
          id="data-backup"
          className={
            highlightedSectionId === "data-backup"
              ? "rounded-2xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950"
              : ""
          }
        >
          <SettingsSectionShell
            icon={Download}
            title="Backup & restore"
            description="Export and import application data for safe keeping or migration."
            accent="from-violet-500/15 via-purple-500/10 to-transparent"
            className="mt-6"
            contentClassName="space-y-4"
          >
            <BackupRestoreSection
              backupHistory={backupHistory}
              isCreatingBackup={isCreatingBackup}
              isRestoringBackup={isRestoringBackup}
              autoBackupEnabled={autoBackupEnabled}
              selectedBackupFile={selectedBackupFile}
              backupValidationError={backupValidationError}
              showBackupHistory={showBackupHistory}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onCreateBackup={onCreateBackup}
              onRestoreBackup={onRestoreBackup}
              onToggleAutoBackup={onToggleAutoBackup}
              onFileSelect={onFileSelect}
              onToggleBackupHistory={onToggleBackupHistory}
              setBackupHistory={setBackupHistory}
            />
          </SettingsSectionShell>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <div
          id="data-debug"
          className={
            highlightedSectionId === "data-debug"
              ? "rounded-2xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950"
              : ""
          }
        >
          <SettingsSectionShell
            icon={Bug}
            title="Debug tools"
            description="Advanced utilities for troubleshooting and development."
            accent="from-orange-500/15 via-red-500/10 to-transparent"
            contentClassName="space-y-4"
          >
            <DebugToolsSection
              isDebugEnabled={isDebugEnabled}
              storageDebuggerEnabled={storageDebuggerEnabled}
              logViewerEnabled={logViewerEnabled}
              logRedactionEnabled={logRedactionEnabled}
              stateInspectorEnabled={stateInspectorEnabled}
              ipcViewerEnabled={ipcViewerEnabled}
              eventLoggerEnabled={eventLoggerEnabled}
              confidenceTestExporterEnabled={confidenceTestExporterEnabled}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onToggleDebug={onToggleDebug}
              onStorageDebuggerChange={onStorageDebuggerChange}
              onLogViewerChange={onLogViewerChange}
              onLogRedactionChange={onLogRedactionChange}
              onStateInspectorChange={onStateInspectorChange}
              onIpcViewerChange={onIpcViewerChange}
              onEventLoggerChange={onEventLoggerChange}
              onConfidenceTestExporterChange={onConfidenceTestExporterChange}
            />
          </SettingsSectionShell>
        </div>
      </motion.div>
    </>
  );
}
