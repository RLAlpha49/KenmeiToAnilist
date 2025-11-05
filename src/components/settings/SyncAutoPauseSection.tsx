/**
 * @packageDocumentation
 * @module SyncAutoPauseSection
 * @description Auto-pause inactive manga section for the Sync tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { highlightText } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";
import type { SyncConfig } from "@/utils/storage";

/**
 * Props for SyncAutoPauseSection component.
 * @source
 */
interface SyncAutoPauseSectionProps {
  /** Current sync configuration. */
  syncConfig: SyncConfig;
  /** Whether custom threshold is currently enabled. */
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
}

/**
 * Auto-pause inactive manga settings section.
 * Controls whether and when to automatically pause inactive manga during sync.
 * @param props - Component props.
 * @returns The rendered auto-pause settings section.
 * @source
 */
export function SyncAutoPauseSection({
  syncConfig,
  useCustomThreshold,
  searchQuery,
  highlightedSectionId,
  onSyncConfigChange,
  onCustomThresholdToggle,
  setSyncConfig,
}: Readonly<SyncAutoPauseSectionProps>) {
  return (
    <motion.div
      id="sync-auto-pause"
      className={cn(
        "bg-muted/40 rounded-xl border p-4",
        highlightedSectionId === "sync-auto-pause" &&
          "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">
            {searchQuery
              ? highlightText("Auto-pause inactive manga", searchQuery)
              : "Auto-pause inactive manga"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText(
                  "Automatically pause and pause sync for manga not updated within the threshold period.",
                  searchQuery,
                )
              : "Automatically pause and pause sync for manga not updated within the threshold period."}
          </p>
        </div>
        <Switch
          id="auto-pause"
          checked={syncConfig.autoPauseInactive}
          onCheckedChange={(checked) => {
            const newConfig = {
              ...syncConfig,
              autoPauseInactive: checked,
            };
            setSyncConfig(newConfig);
            onSyncConfigChange(newConfig, "autoPauseInactive");
          }}
        />
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-1.5">
          <label htmlFor="auto-pause-threshold" className="text-xs font-medium">
            {searchQuery
              ? highlightText("Auto-pause threshold", searchQuery)
              : "Auto-pause threshold"}
          </label>
          <select
            id="auto-pause-threshold"
            className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={
              useCustomThreshold
                ? "custom"
                : syncConfig.autoPauseThreshold.toString()
            }
            onChange={(e) => {
              const value = e.target.value;
              if (value === "custom") {
                onCustomThresholdToggle(true);
              } else {
                onCustomThresholdToggle(false);
                const newConfig = {
                  ...syncConfig,
                  autoPauseThreshold: Number(value),
                };
                setSyncConfig(newConfig);
                onSyncConfigChange(newConfig, "autoPauseThreshold");
              }
            }}
            disabled={!syncConfig.autoPauseInactive}
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">2 months</option>
            <option value="90">3 months</option>
            <option value="180">6 months</option>
            <option value="365">1 year</option>
            <option value="custom">Custom...</option>
          </select>
        </div>

        {useCustomThreshold && (
          <div className="grid gap-1.5">
            <label
              htmlFor="custom-auto-pause-threshold"
              className="text-xs font-medium"
            >
              {searchQuery
                ? highlightText("Custom threshold (days)", searchQuery)
                : "Custom threshold (days)"}
            </label>
            <input
              id="custom-auto-pause-threshold"
              type="number"
              min="1"
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter days"
              value={
                syncConfig.customAutoPauseThreshold ||
                syncConfig.autoPauseThreshold
              }
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(value) && value > 0) {
                  const newConfig = {
                    ...syncConfig,
                    autoPauseThreshold: value,
                    customAutoPauseThreshold: value,
                  };
                  setSyncConfig(newConfig);
                  onSyncConfigChange(newConfig, "customAutoPauseThreshold");
                }
              }}
              disabled={!syncConfig.autoPauseInactive}
            />
          </div>
        )}

        <Alert className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {searchQuery
              ? highlightText(
                  "Auto-pause applies to manga with status READING.",
                  searchQuery,
                )
              : "Auto-pause applies to manga with status READING."}
          </AlertDescription>
        </Alert>
      </div>
    </motion.div>
  );
}
