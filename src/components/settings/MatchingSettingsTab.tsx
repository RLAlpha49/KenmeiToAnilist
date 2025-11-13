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
  collapsedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
}

export function MatchingSettingsTab({
  matchConfig,
  searchQuery,
  highlightedSectionId,
  onMatchConfigChange,
  collapsedSections,
  onToggleSection,
}: Readonly<MatchingSettingsTabProps>) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      data-onboarding="matching-settings"
      className="space-y-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.06 }}
        className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/12 via-emerald-500/5 to-transparent p-6 shadow-[0_35px_110px_-70px_rgba(16,38,61,0.45)] dark:border-emerald-500/25 dark:from-emerald-500/20 dark:via-slate-950/70 dark:to-slate-950/40"
      >
        <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-0 w-px bg-linear-to-b from-transparent via-emerald-500/30 to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-emerald-600 shadow-md backdrop-blur dark:bg-white/10 dark:text-emerald-200">
              <Filter className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Matching automation
              </h2>
              <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
                Fine-tune which titles move through the matching pipeline and how
                extra sources supplement AniList lookups.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <SettingsSectionShell
        id="matching-preferences"
        isCollapsible={true}
        isCollapsed={collapsedSections["matching-preferences"] ?? false}
        onCollapsedChange={() => onToggleSection("matching-preferences")}
        icon={Filter}
        title="Matching preferences"
        description="Configure how manga from Kenmei are automatically matched to AniList entries."
        accent="from-emerald-500/20 via-teal-500/15 to-transparent"
        contentClassName="space-y-8"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                Content filters
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Decide which titles enter the matching queue before scoring
                begins.
              </p>
            </div>
            <div className="space-y-4">
              {[
                "matching-one-shots",
                "matching-adult-content",
                "matching-blur-adult",
              ].map((section) => (
                <MatchingSettingsSection
                  key={section}
                  sectionId={section}
                  matchConfig={matchConfig}
                  searchQuery={searchQuery}
                  highlightedSectionId={highlightedSectionId}
                  onMatchConfigChange={onMatchConfigChange}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Discovery fallbacks
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control which secondary sources supplement AniList searches when
                results are limited.
              </p>
            </div>
            <div className="space-y-4">
              {["matching-mangadex", "matching-comick"].map((section) => (
                <MatchingSettingsSection
                  key={section}
                  sectionId={section}
                  matchConfig={matchConfig}
                  searchQuery={searchQuery}
                  highlightedSectionId={highlightedSectionId}
                  onMatchConfigChange={onMatchConfigChange}
                />
              ))}
            </div>
          </div>
        </div>

        <Alert className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 text-emerald-700 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Matching settings only affect automatic processing. Manual searches
            and overrides remain available regardless of these filters.
          </AlertDescription>
        </Alert>

        <div className="pt-1">
          <MatchingSettingsSection
            sectionId="matching-custom-rules"
            matchConfig={matchConfig}
            searchQuery={searchQuery}
            highlightedSectionId={highlightedSectionId}
            onMatchConfigChange={onMatchConfigChange}
          />
        </div>
      </SettingsSectionShell>
    </motion.div>
  );
}
