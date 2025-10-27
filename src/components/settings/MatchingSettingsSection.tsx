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

interface MatchingSettingsSectionProps {
  sectionId: string;
  matchConfig: MatchConfig;
  searchQuery: string;
  highlightedSectionId: string | null;
  onMatchConfigChange: (config: MatchConfig, field: string) => void;
}

/**
 * Renders individual matching settings sections.
 * Supports one-shots, adult content, blur adult, comick, mangadex, and custom rules.
 *
 * @source
 */
export function MatchingSettingsSection({
  sectionId,
  matchConfig,
  searchQuery,
  highlightedSectionId,
  onMatchConfigChange,
}: Readonly<MatchingSettingsSectionProps>) {
  if (sectionId === "matching-one-shots") {
    return (
      <motion.div
        id="matching-one-shots"
        className={cn(
          "bg-muted/40 rounded-xl border p-4",
          highlightedSectionId === "matching-one-shots" &&
            "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="ignore-one-shots"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {searchQuery
                ? highlightText(
                    "Ignore one shots in automatic matching",
                    searchQuery,
                  )
                : "Ignore one shots in automatic matching"}
            </label>
            <p className="text-muted-foreground text-xs">
              {searchQuery
                ? highlightText(
                    "Skip one-shot manga during automatic matching. Useful for reducing noise in match results.",
                    searchQuery,
                  )
                : "Skip one-shot manga during automatic matching. Useful for reducing noise in match results."}
            </p>
          </div>
          <Switch
            id="ignore-one-shots"
            checked={matchConfig.ignoreOneShots}
            onCheckedChange={(checked) => {
              const updated = { ...matchConfig, ignoreOneShots: checked };
              onMatchConfigChange(updated, "ignoreOneShots");
            }}
          />
        </div>
      </motion.div>
    );
  }

  if (sectionId === "matching-adult-content") {
    return (
      <motion.div
        id="matching-adult-content"
        className={cn(
          "bg-muted/40 rounded-xl border p-4",
          highlightedSectionId === "matching-adult-content" &&
            "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="ignore-adult-content"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {searchQuery
                ? highlightText(
                    "Ignore adult content in automatic matching",
                    searchQuery,
                  )
                : "Ignore adult content in automatic matching"}
            </label>
            <p className="text-muted-foreground text-xs">
              {searchQuery
                ? highlightText(
                    "Skip manga marked as adult content during automatic matching. Helps filter NSFW titles.",
                    searchQuery,
                  )
                : "Skip manga marked as adult content during automatic matching. Helps filter NSFW titles."}
            </p>
          </div>
          <Switch
            id="ignore-adult-content"
            checked={matchConfig.ignoreAdultContent}
            onCheckedChange={(checked) => {
              const updated = { ...matchConfig, ignoreAdultContent: checked };
              onMatchConfigChange(updated, "ignoreAdultContent");
            }}
          />
        </div>
      </motion.div>
    );
  }

  if (sectionId === "matching-blur-adult") {
    return (
      <motion.div
        id="matching-blur-adult"
        className={cn(
          "bg-muted/40 rounded-xl border p-4",
          highlightedSectionId === "matching-blur-adult" &&
            "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="blur-adult-content"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {searchQuery
                ? highlightText("Blur adult content images", searchQuery)
                : "Blur adult content images"}
            </label>
            <p className="text-muted-foreground text-xs">
              {searchQuery
                ? highlightText(
                    "Automatically blur cover images for manga marked as adult content for privacy.",
                    searchQuery,
                  )
                : "Automatically blur cover images for manga marked as adult content for privacy."}
            </p>
          </div>
          <Switch
            id="blur-adult-content"
            checked={matchConfig.blurAdultContent}
            onCheckedChange={(checked) => {
              const updated = { ...matchConfig, blurAdultContent: checked };
              onMatchConfigChange(updated, "blurAdultContent");
            }}
          />
        </div>
      </motion.div>
    );
  }

  if (sectionId === "matching-comick") {
    return (
      <motion.div
        id="matching-comick"
        className={cn(
          "bg-muted/40 rounded-xl border p-4",
          highlightedSectionId === "matching-comick" &&
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
                htmlFor="enable-comick-search"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {searchQuery
                  ? highlightText(
                      "Enable Comick alternative search",
                      searchQuery,
                    )
                  : "Enable Comick alternative search"}
              </label>
              <Badge variant="secondary" className="text-xs">
                Unavailable
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {searchQuery
                ? highlightText(
                    "Use Comick as a fallback search source when AniList doesn't have enough results. Currently unavailable due to API downtime.",
                    searchQuery,
                  )
                : "Use Comick as a fallback search source when AniList doesn't have enough results. Currently unavailable due to API downtime."}
            </p>
          </div>
          <Switch
            id="enable-comick-search"
            checked={false}
            disabled
            onCheckedChange={() => {
              // Disabled - Comick is down
            }}
          />
        </div>
      </motion.div>
    );
  }

  if (sectionId === "matching-mangadex") {
    return (
      <motion.div
        id="matching-mangadex"
        className={cn(
          "bg-muted/40 rounded-xl border p-4",
          highlightedSectionId === "matching-mangadex" &&
            "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="enable-mangadex-search"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {searchQuery
                ? highlightText(
                    "Enable MangaDex alternative search",
                    searchQuery,
                  )
                : "Enable MangaDex alternative search"}
            </label>
            <p className="text-muted-foreground text-xs">
              {searchQuery
                ? highlightText(
                    "Use MangaDex as a fallback search source when AniList doesn't have enough results.",
                    searchQuery,
                  )
                : "Use MangaDex as a fallback search source when AniList doesn't have enough results."}
            </p>
          </div>
          <Switch
            id="enable-mangadex-search"
            checked={matchConfig.enableMangaDexSearch}
            onCheckedChange={(checked) => {
              const updated = { ...matchConfig, enableMangaDexSearch: checked };
              onMatchConfigChange(updated, "enableMangaDexSearch");
            }}
          />
        </div>
      </motion.div>
    );
  }

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

  return null;
}
