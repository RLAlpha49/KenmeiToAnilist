/**
 * @packageDocumentation
 * @module SettingsSearchBar
 * @description Search bar component for settings page with keyboard shortcut support and result feedback.
 */

import React from "react";
import { Search, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";

/**
 * Search result from settings search.
 * @source
 */
interface SearchResult {
  /** Matched section information. */
  section: { id: string; title: string; tab: string };
  /** Match score (higher = better match). */
  score: number;
}

/**
 * Props for SettingsSearchBar component.
 * @source
 */
interface SettingsSearchBarProps {
  /** Current search query. */
  searchQuery: string;
  /** Results from the current search. */
  searchResults: SearchResult[];
  /** Reference to search input element. */
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  /** Callback when search query changes. */
  onSearchChange: (query: string) => void;
}

/**
 * Search bar component for filtering settings sections.
 * Supports keyboard shortcut (Ctrl+F) and displays result count.
 * @param props - Component props.
 * @returns The rendered search bar.
 * @source
 */
/**
 * Formats the search results count display text based on the count.
 * @param count - Number of results found
 * @returns Formatted string for display
 */
function formatResultsCountText(count: number): string {
  return `${count} ${count === 1 ? "match" : "matches"}`;
}

export function SettingsSearchBar({
  searchQuery,
  searchResults,
  searchInputRef,
  onSearchChange,
}: Readonly<SettingsSearchBarProps>) {
  const hasQuery = searchQuery.trim().length > 0;
  const resultsCount = hasQuery ? searchResults.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/75 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40 dark:shadow-[0_24px_80px_-40px_rgba(15,23,42,0.9)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.18),transparent_60%)]" />
      <div className="relative flex flex-col gap-4">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search settings, preferences, and tools (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-12 rounded-2xl border border-slate-200/80 bg-white/90 pl-12 pr-12 text-sm shadow-inner transition focus-visible:border-indigo-400 focus-visible:ring-0 dark:border-white/10 dark:bg-slate-950/60"
            aria-label="Search settings"
            data-search-input="settings"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20 dark:hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/20 dark:text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-left text-xs sm:text-[13px]">
              Search across matching logic, sync automation, and data tools.
            </p>
          </div>
          {hasQuery ? (
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide",
                resultsCount > 0
                  ? "border-emerald-400/40 bg-emerald-100/70 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-rose-400/40 bg-rose-100/70 text-rose-700 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-200",
              )}
            >
              {resultsCount > 0
                ? formatResultsCountText(resultsCount)
                : "No results"}
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {[
                [
                  "Matching",
                  "bg-purple-100 text-purple-700 dark:bg-purple-400/20 dark:text-purple-200",
                ],
                [
                  "Sync",
                  "bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200",
                ],
                [
                  "Data",
                  "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
                ],
              ].map(([label, tone]) => (
                <Badge
                  key={label}
                  variant="outline"
                  className={cn(
                    "border-transparent px-3 py-1 text-[11px] font-medium uppercase tracking-wide",
                    tone,
                  )}
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {hasQuery && resultsCount === 0 && (
          <p className="rounded-2xl border border-rose-200/40 bg-rose-100/40 px-3 py-2 text-xs text-rose-700 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-200">
            No settings match that search. Try a different phrase or browse the
            sections below.
          </p>
        )}
      </div>
    </motion.div>
  );
}
