/**
 * @packageDocumentation
 * @module MatchingSettingsTab
 * @description Matching tab content component for the Settings page.
 */

import React from "react";
import { motion } from "framer-motion";
import { Filter, Info } from "lucide-react";
import { SettingsSectionShell } from "./SettingsSectionShell";
import { MatchingSettingsSection } from "./MatchingSettingsSection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { MatchConfig } from "@/utils/storage";

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

interface MatchingSettingsTabProps {
  matchConfig: MatchConfig;
  searchQuery: string;
  highlightedSectionId: string | null;
  onMatchConfigChange: (config: MatchConfig, field: string) => void;
}

/**
 * Matching tab content component.
 * Orchestrates rendering of all matching-related settings sections.
 *
 * @source
 */
export function MatchingSettingsTab({
  matchConfig,
  searchQuery,
  highlightedSectionId,
  onMatchConfigChange,
}: Readonly<MatchingSettingsTabProps>) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      data-onboarding="matching-settings"
    >
      <SettingsSectionShell
        icon={Filter}
        title="Matching preferences"
        description="Configure how manga from Kenmei are automatically matched to AniList entries."
        accent="from-emerald-500/15 via-teal-500/10 to-transparent"
        contentClassName="space-y-5"
      >
        <MatchingSettingsSection
          sectionId="matching-one-shots"
          matchConfig={matchConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onMatchConfigChange={onMatchConfigChange}
        />

        <MatchingSettingsSection
          sectionId="matching-adult-content"
          matchConfig={matchConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onMatchConfigChange={onMatchConfigChange}
        />

        <MatchingSettingsSection
          sectionId="matching-blur-adult"
          matchConfig={matchConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onMatchConfigChange={onMatchConfigChange}
        />

        <MatchingSettingsSection
          sectionId="matching-comick"
          matchConfig={matchConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onMatchConfigChange={onMatchConfigChange}
        />

        <MatchingSettingsSection
          sectionId="matching-mangadex"
          matchConfig={matchConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onMatchConfigChange={onMatchConfigChange}
        />

        <MatchingSettingsSection
          sectionId="matching-custom-rules"
          matchConfig={matchConfig}
          searchQuery={searchQuery}
          highlightedSectionId={highlightedSectionId}
          onMatchConfigChange={onMatchConfigChange}
        />

        <Alert className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Matching settings only affect the automatic matching process. You
            can always manually search for manga regardless of these filters.
          </AlertDescription>
        </Alert>
      </SettingsSectionShell>
    </motion.div>
  );
}
