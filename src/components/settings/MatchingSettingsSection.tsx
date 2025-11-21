/**
 * @packageDocumentation
 * @module MatchingSettingsSection
 * @description Individual matching settings sections for the Matching tab.
 */

import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Compass,
  EyeOff,
  Globe2,
  ShieldBan,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { CustomRulesManager } from "./CustomRulesManager";
import { highlightText } from "@/utils/text-highlight";
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
  const sectionVisuals: Record<
    string,
    {
      icon: LucideIcon;
      iconWrapperClass: string;
      accentBarClass: string;
    }
  > = {
    "matching-one-shots": {
      icon: Sparkles,
      iconWrapperClass:
        "bg-emerald-500/15 text-emerald-600 shadow-inner shadow-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200",
      accentBarClass:
        "from-emerald-400/80 via-emerald-500/70 to-emerald-400/80",
    },
    "matching-adult-content": {
      icon: ShieldBan,
      iconWrapperClass:
        "bg-rose-500/15 text-rose-600 shadow-inner shadow-rose-500/20 dark:bg-rose-500/15 dark:text-rose-200",
      accentBarClass: "from-rose-400/80 via-rose-500/70 to-rose-400/80",
    },
    "matching-blur-adult": {
      icon: EyeOff,
      iconWrapperClass:
        "bg-purple-500/15 text-purple-600 shadow-inner shadow-purple-500/20 dark:bg-purple-500/15 dark:text-purple-200",
      accentBarClass: "from-purple-400/80 via-purple-500/70 to-purple-400/80",
    },
    "matching-mangadex": {
      icon: Compass,
      iconWrapperClass:
        "bg-sky-500/15 text-sky-600 shadow-inner shadow-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200",
      accentBarClass: "from-sky-400/80 via-sky-500/70 to-sky-400/80",
    },
    "matching-comick": {
      icon: Globe2,
      iconWrapperClass:
        "bg-amber-500/15 text-amber-600 shadow-inner shadow-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200",
      accentBarClass: "from-amber-400/80 via-amber-500/70 to-amber-400/80",
    },
    "matching-custom-rules": {
      icon: Wand2,
      iconWrapperClass:
        "bg-indigo-500/15 text-indigo-600 shadow-inner shadow-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-200",
      accentBarClass: "from-indigo-400/80 via-blue-500/70 to-sky-400/80",
    },
  };

  const renderToggleSection = (opts: {
    id: string;
    title: string;
    description: string;
    checked?: boolean;
    field?: string;
    disabled?: boolean;
    badge?: string;
    icon?: LucideIcon;
    iconWrapperClass?: string;
    accentBarClass?: string;
  }) => (
    <motion.div
      id={opts.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-200 hover:shadow-md",
          highlightedSectionId === opts.id &&
            "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
        )}
      >
        {opts.accentBarClass ? (
          <span
            aria-hidden="true"
            className={cn(
              "bg-linear-to-r pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80",
              opts.accentBarClass,
            )}
          />
        ) : null}
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-6">
          {opts.icon ? (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "shadow-inner shadow-black/5 dark:shadow-black/40",
                opts.iconWrapperClass,
              )}
            >
              <opts.icon className="h-5 w-5" />
            </div>
          ) : null}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {searchQuery
                  ? highlightText(opts.title, searchQuery)
                  : opts.title}
              </CardTitle>
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
            <CardDescription>
              {searchQuery
                ? highlightText(opts.description, searchQuery)
                : opts.description}
            </CardDescription>
            {opts.badge ? (
              <Badge
                variant="secondary"
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-200"
              >
                {opts.badge}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>
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
      icon?: LucideIcon;
      iconWrapperClass?: string;
      accentBarClass?: string;
    }
  > = {
    "matching-one-shots": {
      id: "matching-one-shots",
      title: "Ignore one shots in automatic matching",
      description:
        "Skip one-shot manga during automatic matching. Useful for reducing noise in match results.",
      field: "shouldIgnoreOneShots",
      checked: matchConfig.shouldIgnoreOneShots,
    },
    "matching-adult-content": {
      id: "matching-adult-content",
      title: "Ignore adult content in automatic matching",
      description:
        "Skip manga marked as adult content during automatic matching. Helps filter NSFW titles.",
      field: "shouldIgnoreAdultContent",
      checked: matchConfig.shouldIgnoreAdultContent,
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
          "group relative overflow-hidden rounded-lg border border-slate-200/70 bg-white/95 p-0 shadow-[0_28px_90px_-60px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950/45 dark:shadow-[0_40px_110px_-65px_rgba(15,23,42,0.85)]",
          highlightedSectionId === "matching-custom-rules" &&
            "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
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
    const visual = sectionVisuals[sectionId];
    return renderToggleSection({ ...descriptor, ...visual });
  }

  return null;
}
