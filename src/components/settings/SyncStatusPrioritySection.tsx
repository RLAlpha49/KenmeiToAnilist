/**
 * @packageDocumentation
 * @module SyncStatusPrioritySection
 * @description Status priority settings section for the Sync tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { highlightText } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";
import type { SyncConfig } from "@/utils/storage";

interface SyncStatusPrioritySectionProps {
  syncConfig: SyncConfig;
  searchQuery: string;
  highlightedSectionId: string | null;
  onSyncConfigChange: (config: SyncConfig, field: string) => void;
  setSyncConfig: (config: SyncConfig) => void;
}

/**
 * Status priority settings section.
 * Controls which AniList values override Kenmei data during sync.
 *
 * @source
 */
export function SyncStatusPrioritySection({
  syncConfig,
  searchQuery,
  highlightedSectionId,
  onSyncConfigChange,
  setSyncConfig,
}: Readonly<SyncStatusPrioritySectionProps>) {
  return (
    <motion.div
      id="sync-status-priority"
      className={cn(
        "bg-muted/40 rounded-xl border p-4",
        highlightedSectionId === "sync-status-priority" &&
          "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-medium">
          {searchQuery
            ? highlightText("Status priority", searchQuery)
            : "Status priority"}
        </h3>
        <p className="text-muted-foreground text-xs">
          {searchQuery
            ? highlightText(
                "Control which source takes priority: AniList or Kenmei data during sync operations.",
                searchQuery,
              )
            : "Control which source takes priority: AniList or Kenmei data during sync operations."}
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm" htmlFor="preserve-completed">
            {searchQuery
              ? highlightText("Preserve completed status", searchQuery)
              : "Preserve completed status"}
          </label>
          <Switch
            id="preserve-completed"
            checked={syncConfig.preserveCompletedStatus}
            onCheckedChange={(checked) => {
              const newConfig = {
                ...syncConfig,
                preserveCompletedStatus: checked,
              };
              setSyncConfig(newConfig);
              onSyncConfigChange(newConfig, "preserveCompletedStatus");
            }}
          />
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm" htmlFor="prioritize-anilist-status">
            {searchQuery
              ? highlightText("Prioritize AniList status", searchQuery)
              : "Prioritize AniList status"}
          </label>
          <Switch
            id="prioritize-anilist-status"
            checked={syncConfig.prioritizeAniListStatus}
            onCheckedChange={(checked) => {
              const newConfig = {
                ...syncConfig,
                prioritizeAniListStatus: checked,
              };
              setSyncConfig(newConfig);
              onSyncConfigChange(newConfig, "prioritizeAniListStatus");
            }}
          />
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm" htmlFor="prioritize-anilist-progress">
            {searchQuery
              ? highlightText("Prioritize AniList progress", searchQuery)
              : "Prioritize AniList progress"}
          </label>
          <Switch
            id="prioritize-anilist-progress"
            checked={syncConfig.prioritizeAniListProgress}
            onCheckedChange={(checked) => {
              const newConfig = {
                ...syncConfig,
                prioritizeAniListProgress: checked,
              };
              setSyncConfig(newConfig);
              onSyncConfigChange(newConfig, "prioritizeAniListProgress");
            }}
          />
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm" htmlFor="prioritize-anilist-score">
            {searchQuery
              ? highlightText("Prioritize AniList score", searchQuery)
              : "Prioritize AniList score"}
          </label>
          <Switch
            id="prioritize-anilist-score"
            checked={syncConfig.prioritizeAniListScore}
            onCheckedChange={(checked) => {
              const newConfig = {
                ...syncConfig,
                prioritizeAniListScore: checked,
              };
              setSyncConfig(newConfig);
              onSyncConfigChange(newConfig, "prioritizeAniListScore");
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
