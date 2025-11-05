/**
 * @packageDocumentation
 * @module MatchingSettingsSection
 * @description Individual matching settings sections for the Matching tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CustomRulesManager } from "./CustomRulesManager";
import { highlightText } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";
import type { MatchConfig } from "@/utils/storage";

/**
 * Props for MatchingSettingsSection component.
 * @source
 */
interface MatchingSettingsSectionProps {
  /** Unique identifier for this settings section. */
  sectionId: string;
  /** Current matching configuration. */
  matchConfig: MatchConfig;
  /** Current search query. */
  searchQuery: string;
  /** Currently highlighted section ID. */
  highlightedSectionId: string | null;
  /** Callback when matching config changes. */
  onMatchConfigChange: (config: MatchConfig, field: string) => void;
}

/**
 * Renders individual matching settings sections.
 * Supports one-shots, adult content, blur adult, comick, mangadex, and custom rules.
 * @param props - Component props.
 * @returns The rendered matching settings section.
 * @source
 */
export function MatchingSettingsSection({
  sectionId,
  matchConfig,
  searchQuery,
  highlightedSectionId,
  onMatchConfigChange,
}: Readonly<MatchingSettingsSectionProps>) {
  const renderToggleSection = (opts: {
    id: string;
    title: string;
    description: string;
    checked?: boolean;
    field?: string;
    disabled?: boolean;
    badge?: string;
  }) => (
    <motion.div
      id={opts.id}
      className={cn(
        "bg-muted/40 rounded-xl border p-4",
        highlightedSectionId === opts.id &&
          "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor={opts.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {searchQuery
                ? highlightText(opts.title, searchQuery)
                : opts.title}
            </label>
            {opts.badge && (
              <Badge variant="secondary" className="text-xs">
                {opts.badge}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText(opts.description, searchQuery)
              : opts.description}
          </p>
        </div>
        <Switch
          id={opts.id}
          checked={!!opts.checked}
          disabled={!!opts.disabled}
          onCheckedChange={(checked) => {
            if (!opts.field || opts.disabled) return;
            const updated = {
              ...matchConfig,
              ...(opts.field ? { [opts.field]: checked } : {}),
            } as MatchConfig;
            onMatchConfigChange(updated, opts.field);
          }}
        />
      </div>
    </motion.div>
  );

  // Map sectionId to a small descriptor used by the generic renderer.
  const sectionMap: Record<
    string,
    {
      id: string;
      title: string;
      description: string;
      field?: string;
      disabled?: boolean;
      badge?: string;
      checked?: boolean;
    }
  > = {
    "matching-one-shots": {
      id: "matching-one-shots",
      title: "Ignore one shots in automatic matching",
      description:
        "Skip one-shot manga during automatic matching. Useful for reducing noise in match results.",
      field: "ignoreOneShots",
      checked: matchConfig.ignoreOneShots,
    },
    "matching-adult-content": {
      id: "matching-adult-content",
      title: "Ignore adult content in automatic matching",
      description:
        "Skip manga marked as adult content during automatic matching. Helps filter NSFW titles.",
      field: "ignoreAdultContent",
      checked: matchConfig.ignoreAdultContent,
    },
    "matching-blur-adult": {
      id: "matching-blur-adult",
      title: "Blur adult content images",
      description:
        "Automatically blur cover images for manga marked as adult content for privacy.",
      field: "blurAdultContent",
      checked: matchConfig.blurAdultContent,
    },
    "matching-mangadex": {
      id: "matching-mangadex",
      title: "Enable MangaDex alternative search",
      description:
        "Use MangaDex as a fallback search source when AniList doesn't have enough results.",
      field: "enableMangaDexSearch",
      checked: matchConfig.enableMangaDexSearch,
    },
    "matching-comick": {
      id: "matching-comick",
      title: "Enable Comick alternative search",
      description:
        "Use Comick as a fallback search source when AniList doesn't have enough results. Currently unavailable due to API downtime.",
      disabled: true,
      badge: "Unavailable",
      checked: false,
    },
  };

  if (sectionId === "matching-custom-rules") {
    return (
      <motion.div
        id="matching-custom-rules"
        className={cn(
          highlightedSectionId === "matching-custom-rules" &&
            "rounded-xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <CustomRulesManager />
      </motion.div>
    );
  }

  const descriptor = sectionMap[sectionId];
  if (descriptor) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return renderToggleSection(descriptor as any);
  }

  return null;
}
