/**
 * @packageDocumentation
 * @module SyncPrivacySection
 * @description Privacy settings section for the Sync tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { highlightText } from "@/utils/text-highlight";
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
        highlightedSectionId === "sync-privacy" &&
          "rounded-xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-slate-500" />
                {searchQuery
                  ? highlightText("Privacy settings", searchQuery)
                  : "Privacy settings"}
              </CardTitle>
              <CardDescription>
                {searchQuery
                  ? highlightText(
                      "Set AniList entries as private to control visibility and sharing of your synced manga.",
                      searchQuery,
                    )
                  : "Set AniList entries as private to control visibility and sharing of your synced manga."}
              </CardDescription>
            </div>
            <Switch
              id="set-private"
              checked={syncConfig.setPrivate}
              onCheckedChange={(checked) => {
                const updatedConfig = {
                  ...syncConfig,
                  setPrivate: checked,
                };
                setSyncConfig(updatedConfig);
                onSyncConfigChange(updatedConfig, "setPrivate");
              }}
            />
          </div>
        </CardHeader>
      </Card>
    </motion.div>
  );
}
