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
    >
      <SettingsSectionShell
        id="sync-preferences"
        isCollapsible={true}
        isCollapsed={collapsedSections["sync-preferences"] ?? false}
        onCollapsedChange={() => onToggleSection("sync-preferences")}
        icon={RefreshCw}
        title="Sync preferences"
        description="Control how Kenmei data is synchronized to your AniList library."
        accent="from-purple-500/15 via-blue-500/10 to-transparent"
        contentClassName="space-y-5"
      >
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

        <SyncPrivacySection
          syncConfig={syncConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onSyncConfigChange={onSyncConfigChange}
          setSyncConfig={setSyncConfig}
        />
      </SettingsSectionShell>
    </motion.div>
  );
}
