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

interface SyncSettingsTabProps {
  syncConfig: SyncConfig;
  useCustomThreshold: boolean;
  searchQuery: string;
  highlightedSectionId: string | null;
  onSyncConfigChange: (config: SyncConfig, field: string) => void;
  onCustomThresholdToggle: (value: boolean) => void;
  setSyncConfig: (config: SyncConfig) => void;
}

/**
 * Sync tab content component.
 * Orchestrates rendering of all sync-related settings sections.
 *
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
}: Readonly<SyncSettingsTabProps>) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      data-onboarding="sync-settings"
    >
      <SettingsSectionShell
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
