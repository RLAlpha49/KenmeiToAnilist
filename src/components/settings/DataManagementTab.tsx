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
import type { DataManagementProps } from "./types";

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
 * Data management tab content component.
 * Orchestrates rendering of cache, backup, and debug sections.
 * @param props - Component props from DataManagementProps.
 * @returns The rendered data management tab.
 * @source
 */
export function DataManagementTab({
  cachesToClear,
  isClearing,
  cacheCleared,
  selectedBackupFile,
  backupValidationError,
  isDebugEnabled,
  storageDebuggerEnabled,
  logViewerEnabled,
  logRedactionEnabled,
  stateInspectorEnabled,
  ipcViewerEnabled,
  eventLoggerEnabled,
  confidenceTestExporterEnabled,
  performanceMonitorEnabled,
  searchQuery,
  highlightedSectionId,
  scheduleConfig,
  nextScheduledBackup,
  lastScheduledBackup,
  isTriggeringBackup,
  isRestoringBackup,
  onCachesToClearChange,
  onClearCaches,
  onRestoreBackup,
  onRestoreBackupFile,
  onFileSelect,
  onScheduleConfigChange,
  onTriggerBackup,
  onToggleDebug,
  onStorageDebuggerChange,
  onLogViewerChange,
  onLogRedactionChange,
  onStateInspectorChange,
  onIpcViewerChange,
  onEventLoggerChange,
  onConfidenceTestExporterChange,
  onPerformanceMonitorChange,
}: Readonly<DataManagementProps>) {
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
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              scheduleConfig={scheduleConfig}
              nextScheduledBackup={nextScheduledBackup}
              lastScheduledBackup={lastScheduledBackup}
              isTriggeringBackup={isTriggeringBackup}
              isRestoringBackup={isRestoringBackup}
              selectedBackupFile={selectedBackupFile}
              backupValidationError={backupValidationError}
              onScheduleConfigChange={onScheduleConfigChange}
              onTriggerBackup={onTriggerBackup}
              onRestoreBackup={onRestoreBackup}
              onRestoreBackupFile={onRestoreBackupFile}
              onFileSelect={onFileSelect}
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
              performanceMonitorEnabled={performanceMonitorEnabled}
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
              onPerformanceMonitorChange={onPerformanceMonitorChange}
            />
          </SettingsSectionShell>
        </div>
      </motion.div>
    </>
  );
}
