/**
 * @packageDocumentation
 * @module SettingsTabsContainer
 * @description Container component for settings tabs with search functionality.
 */

import React from "react";
import { motion } from "framer-motion";
import { Search, RefreshCw, Database } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MatchingSettingsTab } from "./MatchingSettingsTab";
import { SyncSettingsTab } from "./SyncSettingsTab";
import { DataManagementTab } from "./DataManagementTab";
import { MatchingSettingsSection } from "./MatchingSettingsSection";
import { SyncAutoPauseSection } from "./SyncAutoPauseSection";
import { SyncStatusPrioritySection } from "./SyncStatusPrioritySection";
import { SyncPrivacySection } from "./SyncPrivacySection";
import { CacheManagementSection } from "./CacheManagementSection";
import { BackupRestoreSection } from "./BackupRestoreSection";
import { DebugToolsSection } from "./DebugToolsSection";
import type {
  MatchConfig,
  SyncConfig,
  BackupScheduleConfig,
} from "@/utils/storage";
import type { DataManagementProps } from "./types";

/**
 * Search result from settings search.
 * @source
 */
interface SettingsSearchResult {
  /** Matched section information. */
  section: {
    id: string;
    title: string;
    tab: string;
    description?: string;
    keywords?: string[];
  };
  /** Match score (higher = better match). */
  score: number;
}

/**
 * Props for SettingsTabsContainer component.
 * @source
 */
interface SettingsTabsContainerProps extends DataManagementProps {
  /** Search results to display. */
  searchResults: SettingsSearchResult[];
  /** Current matching configuration. */
  matchConfig: MatchConfig;
  /** Current sync configuration. */
  syncConfig: SyncConfig;
  /** Whether custom threshold is enabled for auto-pause. */
  useCustomThreshold: boolean;
  /** Callback when matching config changes. */
  onMatchConfigChange: (config: MatchConfig, field: string) => void;
  /** Callback when sync config changes. */
  onSyncConfigChange: (config: SyncConfig, field: string) => void;
  /** Callback to toggle custom threshold. */
  onCustomThresholdToggle: (value: boolean) => void;
  /** Callback to set entire sync config. */
  setSyncConfig: (config: SyncConfig) => void;
  /** Backup schedule configuration. */
  scheduleConfig: BackupScheduleConfig;
  /** Timestamp of next scheduled backup. */
  nextScheduledBackup: number | null;
  /** Timestamp of last scheduled backup. */
  lastScheduledBackup: number | null;
  /** Whether a manual backup trigger is in progress. */
  isTriggeringBackup: boolean;
  /** Callback when backup schedule config changes. */
  onScheduleConfigChange: (config: BackupScheduleConfig) => void;
  /** Callback to trigger manual backup. */
  onTriggerBackup: () => void;
  /** Optional callback to restore from file. */
  onRestoreBackupFile?: (file: File) => void;
}

/**
 * Settings tabs container component.
 * Orchestrates rendering of three main tabs (Matching, Sync, Data) and search results view.
 * @param props - Component props.
 * @returns The rendered settings tabs container.
 * @source
 */
export function SettingsTabsContainer({
  searchQuery,
  searchResults,
  highlightedSectionId,
  matchConfig,
  syncConfig,
  useCustomThreshold,
  cachesToClear,
  isClearing,
  cacheCleared,
  selectedBackupFile,
  backupValidationError,
  matchImportFile,
  matchImportError,
  isImportingMatches,
  isRestoringBackup,
  isDebugEnabled,
  storageDebuggerEnabled,
  logViewerEnabled,
  logRedactionEnabled,
  stateInspectorEnabled,
  ipcViewerEnabled,
  eventLoggerEnabled,
  confidenceTestExporterEnabled,
  performanceMonitorEnabled,
  onMatchConfigChange,
  onSyncConfigChange,
  onCustomThresholdToggle,
  setSyncConfig,
  onCachesToClearChange,
  onClearCaches,
  onRestoreBackup,
  onRestoreBackupFile,
  onFileSelect,
  onMatchImportFileSelect,
  onImportMatches,
  scheduleConfig,
  nextScheduledBackup,
  lastScheduledBackup,
  isTriggeringBackup,
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
  collapsedSections,
  onToggleSection,
}: Readonly<SettingsTabsContainerProps>) {
  // Render no results message
  const renderNoResults = () => (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-600 dark:bg-slate-900/30">
      <Search className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" />
      <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
        No settings found matching &quot;{searchQuery}&quot;
      </p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
        Try adjusting your search terms or browse all settings by clearing the
        search.
      </p>
    </div>
  );

  // Render search results view - only matching subsections
  const renderSearchResults = () => (
    <div className="space-y-6">
      {/* Matching results */}
      {searchResults.some((r) => r.section.tab === "matching") && (
        <div className="space-y-6 border-b border-slate-200 pb-6 dark:border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Matching
          </h3>
          {searchResults
            .filter((r) => r.section.tab === "matching")
            .map((result) => (
              <React.Fragment key={result.section.id}>
                <MatchingSettingsSection
                  sectionId={result.section.id}
                  matchConfig={matchConfig}
                  searchQuery={searchQuery}
                  highlightedSectionId={highlightedSectionId}
                  onMatchConfigChange={onMatchConfigChange}
                />
              </React.Fragment>
            ))}
        </div>
      )}
      {/* Sync results - only matching subsections */}
      {searchResults.some((r) => r.section.tab === "sync") && (
        <div className="space-y-6 border-b border-slate-200 pb-6 dark:border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sync
          </h3>
          {searchResults.some((r) => r.section.id === "sync-auto-pause") && (
            <SyncAutoPauseSection
              syncConfig={syncConfig}
              useCustomThreshold={useCustomThreshold}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onSyncConfigChange={onSyncConfigChange}
              onCustomThresholdToggle={onCustomThresholdToggle}
              setSyncConfig={setSyncConfig}
            />
          )}
          {searchResults.some(
            (r) => r.section.id === "sync-status-priority",
          ) && (
            <SyncStatusPrioritySection
              syncConfig={syncConfig}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onSyncConfigChange={onSyncConfigChange}
              setSyncConfig={setSyncConfig}
            />
          )}
          {searchResults.some((r) => r.section.id === "sync-privacy") && (
            <SyncPrivacySection
              syncConfig={syncConfig}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onSyncConfigChange={onSyncConfigChange}
              setSyncConfig={setSyncConfig}
            />
          )}
        </div>
      )}
      {/* Data results - only matching subsections */}
      {searchResults.some((r) => r.section.tab === "data") && (
        <div className="space-y-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Data
          </h3>
          {searchResults.some((r) => r.section.id === "data-cache") && (
            <CacheManagementSection
              cachesToClear={cachesToClear}
              isClearing={isClearing}
              cacheCleared={cacheCleared}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onCachesToClearChange={onCachesToClearChange}
              onClearCaches={onClearCaches}
            />
          )}
          {searchResults.some((r) => r.section.id === "data-backup") && (
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
          )}
          {searchResults.some((r) => r.section.id === "data-debug") && (
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
          )}
        </div>
      )}
    </div>
  );

  // Render normal tabs view
  const renderNormalTabs = () => (
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
        <MatchingSettingsTab
          matchConfig={matchConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onMatchConfigChange={onMatchConfigChange}
          collapsedSections={collapsedSections}
          onToggleSection={onToggleSection}
        />
      </TabsContent>

      <TabsContent value="sync" className="space-y-6">
        <SyncSettingsTab
          syncConfig={syncConfig}
          useCustomThreshold={useCustomThreshold}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onSyncConfigChange={onSyncConfigChange}
          onCustomThresholdToggle={onCustomThresholdToggle}
          setSyncConfig={setSyncConfig}
          collapsedSections={collapsedSections}
          onToggleSection={onToggleSection}
        />
      </TabsContent>

      <TabsContent value="data" className="space-y-6">
        <DataManagementTab
          cachesToClear={cachesToClear}
          isClearing={isClearing}
          cacheCleared={cacheCleared}
          selectedBackupFile={selectedBackupFile}
          backupValidationError={backupValidationError}
          matchImportFile={matchImportFile}
          matchImportError={matchImportError}
          isImportingMatches={isImportingMatches}
          isRestoringBackup={isRestoringBackup}
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
          scheduleConfig={scheduleConfig}
          nextScheduledBackup={nextScheduledBackup}
          lastScheduledBackup={lastScheduledBackup}
          isTriggeringBackup={isTriggeringBackup}
          onCachesToClearChange={onCachesToClearChange}
          onClearCaches={onClearCaches}
          onRestoreBackup={onRestoreBackup}
          onRestoreBackupFile={onRestoreBackupFile}
          onFileSelect={onFileSelect}
          onMatchImportFileSelect={onMatchImportFileSelect}
          onImportMatches={onImportMatches}
          onScheduleConfigChange={onScheduleConfigChange}
          onTriggerBackup={onTriggerBackup}
          onToggleDebug={onToggleDebug}
          onStorageDebuggerChange={onStorageDebuggerChange}
          onLogViewerChange={onLogViewerChange}
          onLogRedactionChange={onLogRedactionChange}
          onStateInspectorChange={onStateInspectorChange}
          onIpcViewerChange={onIpcViewerChange}
          onEventLoggerChange={onEventLoggerChange}
          onConfidenceTestExporterChange={onConfidenceTestExporterChange}
          onPerformanceMonitorChange={onPerformanceMonitorChange}
          collapsedSections={collapsedSections}
          onToggleSection={onToggleSection}
        />
      </TabsContent>
    </Tabs>
  );

  // Determine which view to render
  let content;
  if (searchQuery && searchResults.length === 0) {
    content = renderNoResults();
  } else if (searchQuery && searchResults.length > 0) {
    content = renderSearchResults();
  } else {
    content = renderNormalTabs();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-[0_40px_90px_-60px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40 dark:shadow-[0_40px_90px_-60px_rgba(15,23,42,0.9)]"
    >
      {content}
    </motion.div>
  );
}
