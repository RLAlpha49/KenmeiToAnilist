/**
 * @packageDocumentation
 * @module DataManagementTab
 * @description Data management tab content component for the Settings page.
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Database,
  Download,
  Bug,
  HardDrive,
  Clock3,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/tailwind";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { SettingsSectionShell } from "./SettingsSectionShell";
import { CacheManagementSection } from "./CacheManagementSection";
import { BackupRestoreSection } from "./BackupRestoreSection";
import { DebugToolsSection } from "./DebugToolsSection";
import type { DataManagementProps } from "./types";

/**
 * Get the cache status label based on current state.
 * @param isClearing - Whether caches are currently being cleared.
 * @param isCacheCleared - Whether caches have been cleared.
 * @param selectedCacheCount - Number of selected caches.
 * @returns The status label string.
 */
function getCacheStatusLabel(
  isClearing: boolean,
  isCacheCleared: boolean,
  selectedCacheCount: number,
): string {
  if (isClearing) return "Clearing";
  if (isCacheCleared) return "Cleared";
  if (selectedCacheCount > 0) return "Ready";
  return "Idle";
}

/**
 * Get the cache badge CSS class based on current state.
 * @param pillBaseClass - Base pill styling class.
 * @param isClearing - Whether caches are currently being cleared.
 * @param isCacheCleared - Whether caches have been cleared.
 * @param selectedCacheCount - Number of selected caches.
 * @returns The badge CSS class string.
 */
function getCacheBadgeClass(
  pillBaseClass: string,
  isClearing: boolean,
  isCacheCleared: boolean,
  selectedCacheCount: number,
): string {
  if (isClearing)
    return cn(
      pillBaseClass,
      "bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-100",
    );
  if (isCacheCleared)
    return cn(
      pillBaseClass,
      "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100",
    );
  if (selectedCacheCount > 0)
    return cn(
      pillBaseClass,
      "bg-slate-900/10 text-slate-700 dark:bg-white/10 dark:text-white",
    );
  return cn(
    pillBaseClass,
    "bg-slate-300/20 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  );
}

/**
 * Get the cache description based on selected cache count.
 * @param selectedCacheCount - Number of selected caches.
 * @returns The description string.
 */
function getCacheDescription(selectedCacheCount: number): string {
  if (selectedCacheCount > 0) {
    const plural = selectedCacheCount === 1 ? "" : "s";
    return `${selectedCacheCount} cache${plural} selected for clearing.`;
  }
  return "Select the caches you want to refresh before running a clear.";
}

/**
 * Get the cache caption based on current state.
 * @param isClearing - Whether caches are currently being cleared.
 * @param isCacheCleared - Whether caches have been cleared.
 * @returns The caption string.
 */
function getCacheCaption(isClearing: boolean, isCacheCleared: boolean): string {
  if (isClearing) return "Currently clearing caches…";
  if (isCacheCleared) return "Last action: caches cleared successfully.";
  return "No recent cache clear.";
}

/**
 * Get the backup badge label based on current state.
 * @param backupValidationError - Backup validation error if any.
 * @param scheduleConfigEnabled - Whether backup scheduling is enabled.
 * @returns The badge label string.
 */
function getBackupBadgeLabel(
  backupValidationError: string | null,
  scheduleConfigEnabled: boolean,
): string {
  if (backupValidationError) return "Needs attention";
  if (scheduleConfigEnabled) return "Scheduled";
  return "Manual";
}

/**
 * Get the backup badge CSS class based on current state.
 * @param pillBaseClass - Base pill styling class.
 * @param backupValidationError - Backup validation error if any.
 * @param scheduleConfigEnabled - Whether backup scheduling is enabled.
 * @returns The badge CSS class string.
 */
function getBackupBadgeClass(
  pillBaseClass: string,
  backupValidationError: string | null,
  scheduleConfigEnabled: boolean,
): string {
  if (backupValidationError)
    return cn(
      pillBaseClass,
      "bg-rose-500/20 text-rose-700 dark:bg-rose-500/25 dark:text-rose-100",
    );
  if (scheduleConfigEnabled)
    return cn(
      pillBaseClass,
      "bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-100",
    );
  return cn(
    pillBaseClass,
    "bg-slate-300/20 text-slate-600 dark:bg-white/5 dark:text-slate-300",
  );
}

/**
 * Get the backup description based on current state.
 * @param backupValidationError - Backup validation error if any.
 * @param scheduleConfigEnabled - Whether backup scheduling is enabled.
 * @param nextBackupDisplay - Formatted next backup time string.
 * @returns The description string.
 */
function getBackupDescription(
  backupValidationError: string | null,
  scheduleConfigEnabled: boolean,
  nextBackupDisplay: string,
): string {
  if (backupValidationError) return backupValidationError;
  if (scheduleConfigEnabled) return `Next backup ${nextBackupDisplay}.`;
  return "Automatic backups are disabled.";
}

/**
 * Get the debug tools count description.
 * @param activeDebugTools - Number of active debug tools.
 * @returns The description string.
 */
function getDebugToolsDescription(activeDebugTools: number): string {
  if (activeDebugTools > 0) {
    const plural = activeDebugTools === 1 ? "" : "s";
    return `${activeDebugTools} tool${plural} enabled.`;
  }
  return "All tools disabled.";
}

/**
 * Get the debug badge CSS class based on current state.
 * @param pillBaseClass - Base pill styling class.
 * @param isDebugEnabled - Whether debug mode is enabled.
 * @returns The badge CSS class string.
 */
function getDebugBadgeClass(
  pillBaseClass: string,
  isDebugEnabled: boolean,
): string {
  if (isDebugEnabled)
    return cn(
      pillBaseClass,
      "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100",
    );
  return cn(
    pillBaseClass,
    "bg-slate-300/20 text-slate-500 dark:bg-white/5 dark:text-slate-200",
  );
}

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

type QuickStat = {
  id: string;
  title: string;
  description: string;
  caption?: string;
  icon: LucideIcon;
  iconWrapperClass: string;
  accentClass: string;
  badge?: {
    label: string;
    className: string;
  };
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
  isCacheCleared,
  selectedBackupFile,
  backupValidationError,
  isDebugEnabled,
  isStorageDebuggerEnabled,
  isLogViewerEnabled,
  isLogRedactionEnabled,
  isStateInspectorEnabled,
  isIpcViewerEnabled,
  isEventLoggerEnabled,
  isConfidenceTestExporterEnabled,
  isPerformanceMonitorEnabled,
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
  collapsedSections,
  onToggleSection,
}: Readonly<DataManagementProps>) {
  const pillBaseClass =
    "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide";

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) {
      return "Not scheduled";
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "Not scheduled";
    }
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedCacheCount =
    Object.values(cachesToClear).filter(Boolean).length;

  const cacheStatusLabel = getCacheStatusLabel(
    isClearing,
    isCacheCleared,
    selectedCacheCount,
  );

  const cacheBadgeClass = getCacheBadgeClass(
    pillBaseClass,
    isClearing,
    isCacheCleared,
    selectedCacheCount,
  );

  const cacheDescription = getCacheDescription(selectedCacheCount);
  const cacheCaption = getCacheCaption(isClearing, isCacheCleared);

  const nextBackupDisplay = formatTimestamp(
    nextScheduledBackup ?? scheduleConfig.nextBackupTimestamp ?? null,
  );
  const lastBackupDisplay = formatTimestamp(
    lastScheduledBackup ?? scheduleConfig.lastBackupTimestamp ?? null,
  );

  const backupBadgeLabel = getBackupBadgeLabel(
    backupValidationError,
    scheduleConfig.enabled,
  );

  const backupBadgeClass = getBackupBadgeClass(
    pillBaseClass,
    backupValidationError,
    scheduleConfig.enabled,
  );

  const backupDescription = getBackupDescription(
    backupValidationError,
    scheduleConfig.enabled,
    nextBackupDisplay,
  );
  const backupCaption = `Last backup ${lastBackupDisplay}.`;

  const debugBadgeLabel = isDebugEnabled ? "Enabled" : "Disabled";
  const debugBadgeClass = getDebugBadgeClass(pillBaseClass, isDebugEnabled);

  const activeDebugTools = [
    isStorageDebuggerEnabled,
    isLogViewerEnabled,
    isLogRedactionEnabled,
    isStateInspectorEnabled,
    isIpcViewerEnabled,
    isEventLoggerEnabled,
    isConfidenceTestExporterEnabled,
    isPerformanceMonitorEnabled,
  ].filter(Boolean).length;

  const debugDescription = isDebugEnabled
    ? "Developer instrumentation is visible this session."
    : "Developer instrumentation is hidden until enabled.";
  const debugCaption = getDebugToolsDescription(activeDebugTools);

  const quickStats: QuickStat[] = [
    {
      id: "cache",
      title: "Cache readiness",
      description: cacheDescription,
      caption: cacheCaption,
      icon: HardDrive,
      iconWrapperClass:
        "bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-200",
      accentClass: "from-cyan-500/70 via-sky-500/70 to-teal-400/70",
      badge: { label: cacheStatusLabel, className: cacheBadgeClass },
    },
    {
      id: "backup",
      title: "Backup posture",
      description: backupDescription,
      caption: backupCaption,
      icon: Clock3,
      iconWrapperClass:
        "bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-200",
      accentClass: "from-purple-500/70 via-violet-500/70 to-sky-500/70",
      badge: { label: backupBadgeLabel, className: backupBadgeClass },
    },
    {
      id: "debug",
      title: "Debug visibility",
      description: debugDescription,
      caption: debugCaption,
      icon: ShieldCheck,
      iconWrapperClass:
        "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200",
      accentClass: "from-emerald-500/70 via-teal-500/70 to-green-400/70",
      badge: { label: debugBadgeLabel, className: debugBadgeClass },
    },
  ];

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="bg-linear-to-br from-cyan-500/12 relative overflow-hidden rounded-3xl border border-cyan-500/20 via-cyan-500/5 to-transparent p-6 shadow-[0_35px_110px_-70px_rgba(10,54,79,0.45)] dark:border-cyan-500/25 dark:from-cyan-500/20 dark:via-slate-950/70 dark:to-slate-950/40"
      >
        <div className="absolute -left-24 -top-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-cyan-600 shadow-md backdrop-blur dark:bg-white/10 dark:text-cyan-200">
            <Database className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Data controls
            </h2>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Manage cached results, schedule backups, and enable debugging
              tooling to keep Kenmei running smoothly across sessions.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.18 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {quickStats.map((stat) => (
          <div
            key={stat.id}
            className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_28px_100px_-70px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-slate-950/50 dark:shadow-[0_30px_110px_-75px_rgba(15,23,42,0.85)]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "bg-linear-to-r pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-90",
                stat.accentClass,
              )}
            />
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                stat.iconWrapperClass,
              )}
            >
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {stat.title}
                </p>
                {stat.badge ? (
                  <span className={stat.badge.className}>
                    {stat.badge.label}
                  </span>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {stat.description}
              </p>
              {stat.caption ? (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {stat.caption}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </motion.div>

      <SettingsSectionShell
        id="data-management"
        isCollapsible={true}
        isCollapsed={collapsedSections["data-management"] ?? false}
        onCollapsedChange={() => onToggleSection("data-management")}
        icon={Database}
        title="Cache & local data"
        description="Control cached data stored locally by the application."
        accent="from-cyan-500/20 via-sky-500/15 to-transparent"
        contentClassName="space-y-6"
        className={cn(
          "transition-shadow duration-300 hover:shadow-[0_32px_120px_-80px_rgba(15,23,42,0.5)]",
          highlightedSectionId === "data-cache" &&
            "ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-cyan-400 dark:ring-offset-slate-950",
        )}
      >
        <CacheManagementSection
          cachesToClear={cachesToClear}
          isClearing={isClearing}
          isCacheCleared={isCacheCleared}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onCachesToClearChange={onCachesToClearChange}
          onClearCaches={onClearCaches}
        />
      </SettingsSectionShell>

      <SettingsSectionShell
        id="backup-restore"
        isCollapsible={true}
        isCollapsed={collapsedSections["backup-restore"] ?? false}
        onCollapsedChange={() => onToggleSection("backup-restore")}
        icon={Download}
        title="Backup & restore"
        description="Export and import application data for safe keeping or migration."
        accent="from-violet-500/20 via-purple-500/15 to-transparent"
        contentClassName="space-y-6"
        className={cn(
          "transition-shadow duration-300 hover:shadow-[0_32px_120px_-80px_rgba(15,23,42,0.5)]",
          highlightedSectionId === "data-backup" &&
            "ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-purple-400 dark:ring-offset-slate-950",
        )}
      >
        {backupValidationError ? (
          <Alert className="rounded-2xl border border-rose-400/40 bg-rose-500/10 text-rose-900 dark:border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <AlertTitle className="text-sm font-semibold text-rose-900 dark:text-rose-50">
                  Backup file needs attention
                </AlertTitle>
                <AlertDescription className="mt-1 text-xs leading-relaxed">
                  {backupValidationError}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ) : null}
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

      <SettingsSectionShell
        id="debug-tools"
        isCollapsible={true}
        isCollapsed={collapsedSections["debug-tools"] ?? false}
        onCollapsedChange={() => onToggleSection("debug-tools")}
        icon={Bug}
        title="Debug tools"
        description="Advanced utilities for troubleshooting and development."
        accent="from-orange-500/20 via-rose-500/15 to-transparent"
        contentClassName="space-y-6"
        className={cn(
          "transition-shadow duration-300 hover:shadow-[0_32px_120px_-80px_rgba(15,23,42,0.5)]",
          highlightedSectionId === "data-debug" &&
            "ring-2 ring-rose-500 ring-offset-2 ring-offset-white dark:ring-rose-400 dark:ring-offset-slate-950",
        )}
      >
        <DebugToolsSection
          isDebugEnabled={isDebugEnabled}
          isStorageDebuggerEnabled={isStorageDebuggerEnabled}
          isLogViewerEnabled={isLogViewerEnabled}
          isLogRedactionEnabled={isLogRedactionEnabled}
          isStateInspectorEnabled={isStateInspectorEnabled}
          isIpcViewerEnabled={isIpcViewerEnabled}
          isEventLoggerEnabled={isEventLoggerEnabled}
          isConfidenceTestExporterEnabled={isConfidenceTestExporterEnabled}
          isPerformanceMonitorEnabled={isPerformanceMonitorEnabled}
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
    </motion.div>
  );
}
