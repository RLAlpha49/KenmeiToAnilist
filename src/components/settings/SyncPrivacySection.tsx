/**
 * @packageDocumentation
 * @module SyncPrivacySection
 * @description Privacy settings section for the Sync tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { highlightText } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";
import type { SyncConfig } from "@/utils/storage";

/**
 * Props for SyncPrivacySection component.
 * @source
 */
interface SyncPrivacySectionProps {
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
 * Privacy settings section.
 * Controls the visibility of the user's manga list on AniList.
 * @param props - Component props.
 * @returns The rendered privacy settings section.
 * @source
 */
export function SyncPrivacySection({
  syncConfig,
  searchQuery,
  highlightedSectionId,
  onSyncConfigChange,
  setSyncConfig,
}: Readonly<SyncPrivacySectionProps>) {
  return (
    <motion.div
      id="sync-privacy"
      className={cn(
        "bg-muted/40 rounded-xl border p-4",
        highlightedSectionId === "sync-privacy" &&
          "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">
            {searchQuery
              ? highlightText("Privacy settings", searchQuery)
              : "Privacy settings"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText(
                  "Set AniList entries as private to control visibility and sharing of your synced manga.",
                  searchQuery,
                )
              : "Set AniList entries as private to control visibility and sharing of your synced manga."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="set-private">
            {searchQuery
              ? highlightText("Set entries as private", searchQuery)
              : "Set entries as private"}
          </label>
          <Switch
            id="set-private"
            checked={syncConfig.setPrivate}
            onCheckedChange={(checked) => {
              const newConfig = {
                ...syncConfig,
                setPrivate: checked,
              };
              setSyncConfig(newConfig);
              onSyncConfigChange(newConfig, "setPrivate");
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
