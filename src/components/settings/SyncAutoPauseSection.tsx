/**
 * @packageDocumentation
 * @module SyncAutoPauseSection
 * @description Auto-pause inactive manga section for the Sync tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { highlightText } from "@/utils/text-highlight";
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
  isCustomThresholdEnabled: boolean;
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
  isCustomThresholdEnabled,
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
        highlightedSectionId === "sync-auto-pause" &&
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
                <Clock className="h-4 w-4 text-slate-500" />
                {searchQuery
                  ? highlightText("Auto-pause inactive manga", searchQuery)
                  : "Auto-pause inactive manga"}
              </CardTitle>
              <CardDescription>
                {searchQuery
                  ? highlightText(
                      "Automatically pause sync for manga not updated within the threshold period.",
                      searchQuery,
                    )
                  : "Automatically pause sync for manga not updated within the threshold period."}
              </CardDescription>
            </div>
            <Switch
              id="auto-pause"
              checked={syncConfig.autoPauseInactive}
              onCheckedChange={(checked) => {
                const updatedConfig = {
                  ...syncConfig,
                  autoPauseInactive: checked,
                };
                setSyncConfig(updatedConfig);
                onSyncConfigChange(updatedConfig, "autoPauseInactive");
              }}
            />
          </div>
        </CardHeader>
        {syncConfig.autoPauseInactive && (
          <CardContent className="animate-in slide-in-from-top-2 space-y-4 duration-200">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="auto-pause-threshold">
                  {searchQuery
                    ? highlightText("Auto-pause threshold", searchQuery)
                    : "Auto-pause threshold"}
                </Label>
                <select
                  id="auto-pause-threshold"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={
                    isCustomThresholdEnabled
                      ? "custom"
                      : syncConfig.autoPauseThreshold.toString()
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "custom") {
                      onCustomThresholdToggle(true);
                    } else {
                      onCustomThresholdToggle(false);
                      const updatedConfig = {
                        ...syncConfig,
                        autoPauseThreshold: Number(value),
                      };
                      setSyncConfig(updatedConfig);
                      onSyncConfigChange(updatedConfig, "autoPauseThreshold");
                    }
                  }}
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

              {isCustomThresholdEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="custom-auto-pause-threshold">
                    {searchQuery
                      ? highlightText("Custom threshold (days)", searchQuery)
                      : "Custom threshold (days)"}
                  </Label>
                  <Input
                    id="custom-auto-pause-threshold"
                    type="number"
                    min="1"
                    placeholder="Enter days"
                    value={
                      syncConfig.customAutoPauseThreshold ||
                      syncConfig.autoPauseThreshold
                    }
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(value) && value > 0) {
                        const updatedConfig = {
                          ...syncConfig,
                          autoPauseThreshold: value,
                          customAutoPauseThreshold: value,
                        };
                        setSyncConfig(updatedConfig);
                        onSyncConfigChange(
                          updatedConfig,
                          "customAutoPauseThreshold",
                        );
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <Alert className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
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
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
