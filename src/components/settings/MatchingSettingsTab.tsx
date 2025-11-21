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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
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
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.06 }}
      >
        <Card className="border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/10">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Filter className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl">Matching Automation</CardTitle>
              <CardDescription className="text-base">
                Fine-tune which titles move through the matching pipeline and
                how extra sources supplement AniList lookups.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
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
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                Content filters
              </div>
              <p className="text-muted-foreground text-xs">
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
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />{" "}
                Discovery fallbacks
              </div>
              <p className="text-muted-foreground text-xs">
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
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
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
