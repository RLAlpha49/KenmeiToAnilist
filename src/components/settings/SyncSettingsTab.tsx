/**
 * @packageDocumentation
 * @module SyncSettingsTab
 * @description Sync tab content component for the Settings page.
 */

import React from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { SettingsSectionShell } from "./SettingsSectionShell";
import { SyncAutoPauseSection } from "./SyncAutoPauseSection";
import { SyncStatusPrioritySection } from "./SyncStatusPrioritySection";
import { SyncPrivacySection } from "./SyncPrivacySection";
import type { SyncConfig } from "@/utils/storage";

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
 * Props for SyncSettingsTab component.
 * @source
 */
interface SyncSettingsTabProps {
  /** Current sync configuration. */
  syncConfig: SyncConfig;
  /** Whether custom threshold is enabled for auto-pause. */
  useCustomThreshold: boolean;
  /** Current search query. */
  searchQuery: string;
  /** Currently highlighted section ID. */
  highlightedSectionId: string | null;
  /** Callback when sync config changes. */
  onSyncConfigChange: (config: SyncConfig, field: string) => void;
  /** Callback to toggle custom threshold. */
  onCustomThresholdToggle: (value: boolean) => void;
  /** Callback to set entire sync config. */
  setSyncConfig: (config: SyncConfig) => void;
  /** Map of section IDs to their collapsed states. */
  collapsedSections: Record<string, boolean>;
  /** Callback to toggle a section's collapsed state. */
  onToggleSection: (sectionId: string) => void;
}

/**
 * Sync tab content component.
 * Orchestrates rendering of all sync-related settings sections.
 * @param props - Component props.
 * @returns The rendered sync settings tab.
 * @source
 */
export function SyncSettingsTab({
  syncConfig,
  useCustomThreshold,
  searchQuery,
  highlightedSectionId,
  onSyncConfigChange,
  onCustomThresholdToggle,
  setSyncConfig,
  collapsedSections,
  onToggleSection,
}: Readonly<SyncSettingsTabProps>) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      data-onboarding="sync-settings"
      className="space-y-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/12 via-sky-500/5 to-transparent p-6 shadow-[0_35px_110px_-70px_rgba(12,48,94,0.45)] dark:border-sky-500/25 dark:from-sky-500/20 dark:via-slate-950/70 dark:to-slate-950/40"
      >
        <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-sky-600 shadow-md backdrop-blur dark:bg-white/10 dark:text-sky-200">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sync automation
              </h2>
              <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
                Decide how aggressively Kenmei updates your AniList library and
                what safeguards are enforced during background sync runs.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <SettingsSectionShell
        id="sync-preferences"
        isCollapsible={true}
        isCollapsed={collapsedSections["sync-preferences"] ?? false}
        onCollapsedChange={() => onToggleSection("sync-preferences")}
        icon={RefreshCw}
        title="Sync preferences"
        description="Control how Kenmei data is synchronized to your AniList library."
        accent="from-sky-500/20 via-blue-500/15 to-transparent"
        contentClassName="space-y-8"
      >
        <div className="space-y-6">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                Rate limiting & pauses
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure auto-pause behaviour to respect AniList limits and your
                comfort thresholds.
              </p>
            </div>
            <SyncAutoPauseSection
              syncConfig={syncConfig}
              useCustomThreshold={useCustomThreshold}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onSyncConfigChange={onSyncConfigChange}
              onCustomThresholdToggle={onCustomThresholdToggle}
              setSyncConfig={setSyncConfig}
            />

            <SyncStatusPrioritySection
              syncConfig={syncConfig}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onSyncConfigChange={onSyncConfigChange}
              setSyncConfig={setSyncConfig}
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Privacy & safeguards
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guard sensitive information while syncing and choose how
                visibility is preserved across automated updates.
              </p>
            </div>
            <SyncPrivacySection
              syncConfig={syncConfig}
              searchQuery={searchQuery}
              highlightedSectionId={highlightedSectionId}
              onSyncConfigChange={onSyncConfigChange}
              setSyncConfig={setSyncConfig}
            />
          </div>
        </div>
      </SettingsSectionShell>
    </motion.div>
  );
}
