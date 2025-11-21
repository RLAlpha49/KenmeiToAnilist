/**
 * @packageDocumentation
 * @module CacheManagementSection
 * @description Cache management section for the Data tab.
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  RefreshCw,
  CheckCircle,
  Lock,
  Settings,
  ArrowLeftRight,
  Download,
  FileText,
  BookOpen,
  Search,
  Database,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/Separator";
import { highlightText } from "@/utils/text-highlight";
import { cn } from "@/utils/tailwind";
import { CachesToClear } from "./types";

/**
 * Props for CacheManagementSection component.
 * @source
 */
interface CacheManagementSectionProps {
  /** Which caches are selected for clearing. */
  cachesToClear: CachesToClear;
  /** Whether cache clearing is in progress. */
  isClearing: boolean;
  /** Whether caches were successfully cleared. */
  isCacheCleared: boolean;
  /** Current search query. */
  searchQuery: string;
  /** Currently highlighted section ID. */
  highlightedSectionId: string | null;
  /** Callback when cache selection changes. */
  onCachesToClearChange: (caches: CachesToClear) => void;
  /** Callback to execute cache clearing. */
  onClearCaches: () => void;
}

/**
 * Helper function to render text with highlighting if search query exists.
 * Reduces cognitive complexity by extracting conditional highlighting pattern.
 * @param text - The text to potentially highlight.
 * @param searchQuery - The search query to highlight with.
 * @returns Highlighted text or plain text.
 * @source
 */
const renderHighlightedText = (
  text: string,
  searchQuery: string,
): React.ReactNode => {
  return searchQuery ? highlightText(text, searchQuery) : text;
};

/**
 * Cache management section component.
 * Allows users to select and clear various types of cached data.
 * @param props - Component props.
 * @returns The rendered cache management section.
 * @source
 */
export function CacheManagementSection({
  cachesToClear,
  isClearing,
  isCacheCleared,
  searchQuery,
  highlightedSectionId,
  onCachesToClearChange,
  onClearCaches,
}: Readonly<CacheManagementSectionProps>) {
  const cacheTypes = [
    {
      id: "shouldClearAuthCache",
      label: "Auth cache",
      description: "Authentication tokens and login state",
      icon: Lock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      id: "shouldClearSettingsCache",
      label: "Settings cache",
      description: "User settings and sync configuration",
      icon: Settings,
      color: "text-slate-500",
      bg: "bg-slate-500/10",
    },
    {
      id: "shouldClearSyncCache",
      label: "Sync cache",
      description: "Synchronization history and operation records",
      icon: ArrowLeftRight,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      id: "shouldClearImportCache",
      label: "Import cache",
      description: "Import operation history and results",
      icon: Download,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      id: "shouldClearReviewCache",
      label: "Review cache",
      description: "Matching results and review data",
      icon: FileText,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      id: "shouldClearMangaCache",
      label: "Manga cache",
      description: "Cached manga titles, details, and metadata",
      icon: BookOpen,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
    {
      id: "shouldClearSearchCache",
      label: "Search cache",
      description: "Cached search queries and API results",
      icon: Search,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      id: "shouldClearOtherCache",
      label: "Other caches",
      description: "Miscellaneous cache data and temporary storage",
      icon: Database,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ] as const;

  const handleToggle = (id: keyof CachesToClear) => {
    onCachesToClearChange({
      ...cachesToClear,
      [id]: !cachesToClear[id],
    });
  };

  const handleSelectAll = () => {
    const allSelected = Object.keys(cachesToClear).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as CachesToClear,
    );
    onCachesToClearChange(allSelected);
  };

  const handleDeselectAll = () => {
    const noneSelected = Object.keys(cachesToClear).reduce(
      (acc, key) => ({ ...acc, [key]: false }),
      {} as CachesToClear,
    );
    onCachesToClearChange(noneSelected);
  };

  const selectedCount = Object.values(cachesToClear).filter(Boolean).length;

  return (
    <motion.div
      id="data-cache"
      className={cn(
        "bg-muted/40 space-y-6 rounded-xl border p-6",
        highlightedSectionId === "data-cache" &&
          "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Trash2 className="h-4 w-4 text-blue-500" />
            {renderHighlightedText("Clear local cache", searchQuery)}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {renderHighlightedText(
              "Select which cached data types to clear and reset.",
              searchQuery,
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="h-8 text-xs"
          >
            Select all
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeselectAll}
            className="h-8 text-xs"
          >
            Deselect all
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cacheTypes.map((type) => {
          const isSelected = cachesToClear[type.id];
          return (
            <button
              key={type.id}
              onClick={() => handleToggle(type.id)}
              className={cn(
                "group relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-md",
                isSelected
                  ? "border-blue-500/50 bg-blue-50/50 dark:border-blue-400/30 dark:bg-blue-900/10"
                  : "border-slate-200 bg-white hover:border-blue-300/50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900",
              )}
            >
              <div className="flex w-full items-start justify-between">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    isSelected
                      ? "bg-blue-500 text-white dark:bg-blue-400 dark:text-slate-900"
                      : cn(type.bg, type.color),
                  )}
                >
                  <type.icon className="h-4 w-4" />
                </div>
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                    isSelected
                      ? "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-900"
                      : "border-slate-300 bg-transparent dark:border-slate-600",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  {renderHighlightedText(type.label, searchQuery)}
                </span>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {renderHighlightedText(type.description, searchQuery)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          {(() => {
            if (selectedCount === 0) return "No caches selected";
            const plural = selectedCount === 1 ? "" : "s";
            return `${selectedCount} cache type${plural} selected`;
          })()}
        </p>
        <Button
          onClick={onClearCaches}
          variant={isCacheCleared ? "outline" : "default"}
          disabled={isClearing || selectedCount === 0}
          className={cn(
            "min-w-[180px] transition-all",
            isCacheCleared &&
              "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30",
          )}
        >
          {(() => {
            if (isClearing) {
              return (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              );
            }
            if (isCacheCleared) {
              return (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Cleared!
                </>
              );
            }
            return (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Selected
              </>
            );
          })()}
        </Button>
      </div>
    </motion.div>
  );
}
