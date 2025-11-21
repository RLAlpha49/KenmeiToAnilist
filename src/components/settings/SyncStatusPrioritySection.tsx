/**
 * @packageDocumentation
 * @module SyncStatusPrioritySection
 * @description Status priority settings section for the Sync tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { ArrowUpFromLine } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { highlightText } from "@/utils/text-highlight";
import { cn } from "@/utils/tailwind";
import type { SyncConfig } from "@/utils/storage";

/**
 * Props for SyncStatusPrioritySection component.
 * @source
 */
interface SyncStatusPrioritySectionProps {
  /** Current sync configuration. */
  syncConfig: SyncConfig;
  /** Current search query. */
  searchQuery: string;
  /** Currently highlighted section ID. */
  highlightedSectionId: string | null;
  /** Callback when sync config changes. */
  onSyncConfigChange: (config: SyncConfig, field: string) => void;
  /** Callback to set entire sync config. */
  setSyncConfig: (config: SyncConfig) => void;
}

/**
 * Status priority settings section.
 * Controls which AniList values override Kenmei data during sync.
 * @param props - Component props.
 * @returns The rendered status priority section.
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
        highlightedSectionId === "sync-status-priority" &&
          "rounded-xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpFromLine className="h-4 w-4 text-slate-500" />
              {searchQuery
                ? highlightText("Status priority", searchQuery)
                : "Status priority"}
            </CardTitle>
            <CardDescription>
              {searchQuery
                ? highlightText(
                    "Control which source takes priority: AniList or Kenmei data during sync operations.",
                    searchQuery,
                  )
                : "Control which source takes priority: AniList or Kenmei data during sync operations."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="shadow-xs flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="preserve-completed"
                >
                  {searchQuery
                    ? highlightText("Preserve completed status", searchQuery)
                    : "Preserve completed status"}
                </label>
                <p className="text-muted-foreground text-xs">
                  Prevent overwriting &apos;Completed&apos; status on AniList
                </p>
              </div>
              <Switch
                id="preserve-completed"
                checked={syncConfig.preserveCompletedStatus}
                onCheckedChange={(checked) => {
                  const updatedConfig = {
                    ...syncConfig,
                    preserveCompletedStatus: checked,
                  };
                  setSyncConfig(updatedConfig);
                  onSyncConfigChange(updatedConfig, "preserveCompletedStatus");
                }}
              />
            </div>

            <div className="shadow-xs flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="prioritize-anilist-status"
                >
                  {searchQuery
                    ? highlightText("Prioritize AniList status", searchQuery)
                    : "Prioritize AniList status"}
                </label>
                <p className="text-muted-foreground text-xs">
                  Use AniList status if it differs from Kenmei
                </p>
              </div>
              <Switch
                id="prioritize-anilist-status"
                checked={syncConfig.prioritizeAniListStatus}
                onCheckedChange={(checked) => {
                  const updatedConfig = {
                    ...syncConfig,
                    prioritizeAniListStatus: checked,
                  };
                  setSyncConfig(updatedConfig);
                  onSyncConfigChange(updatedConfig, "prioritizeAniListStatus");
                }}
              />
            </div>

            <div className="shadow-xs flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="prioritize-anilist-progress"
                >
                  {searchQuery
                    ? highlightText("Prioritize AniList progress", searchQuery)
                    : "Prioritize AniList progress"}
                </label>
                <p className="text-muted-foreground text-xs">
                  Use AniList chapter progress if higher
                </p>
              </div>
              <Switch
                id="prioritize-anilist-progress"
                checked={syncConfig.prioritizeAniListProgress}
                onCheckedChange={(checked) => {
                  const updatedConfig = {
                    ...syncConfig,
                    prioritizeAniListProgress: checked,
                  };
                  setSyncConfig(updatedConfig);
                  onSyncConfigChange(
                    updatedConfig,
                    "prioritizeAniListProgress",
                  );
                }}
              />
            </div>

            <div className="shadow-xs flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="prioritize-anilist-score"
                >
                  {searchQuery
                    ? highlightText("Prioritize AniList score", searchQuery)
                    : "Prioritize AniList score"}
                </label>
                <p className="text-muted-foreground text-xs">
                  Use AniList score if available
                </p>
              </div>
              <Switch
                id="prioritize-anilist-score"
                checked={syncConfig.prioritizeAniListScore}
                onCheckedChange={(checked) => {
                  const updatedConfig = {
                    ...syncConfig,
                    prioritizeAniListScore: checked,
                  };
                  setSyncConfig(updatedConfig);
                  onSyncConfigChange(updatedConfig, "prioritizeAniListScore");
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
