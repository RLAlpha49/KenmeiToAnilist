/**
 * @packageDocumentation
 * @module SettingsSearchBar
 * @description Search bar component for settings page with keyboard shortcut support and result feedback.
 */

import React from "react";
import { Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";

interface SettingsSearchBarProps {
  searchQuery: string;
  searchResults: Array<{
    section: { id: string; title: string; tab: string };
    score: number;
  }>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (query: string) => void;
}

/**
 * Search bar component for filtering settings sections.
 * Supports keyboard shortcut (Ctrl+F) and displays result count.
 *
 * @source
 */
export function SettingsSearchBar({
  searchQuery,
  searchResults,
  searchInputRef,
  onSearchChange,
}: Readonly<SettingsSearchBarProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
      <Input
        ref={searchInputRef}
        type="text"
        placeholder="Search settings... (Ctrl+F)"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="rounded-2xl border border-slate-200 bg-white/80 pl-12 pr-10 backdrop-blur-sm transition dark:border-white/10 dark:bg-slate-950/40"
        aria-label="Search settings"
        data-search-input="settings"
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange("")}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          aria-label="Clear search"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      {searchQuery && searchResults.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Found {searchResults.length} result
          {searchResults.length === 1 ? "" : "s"}
        </p>
      )}
      {searchQuery && searchResults.length === 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          No results found
        </p>
      )}
    </motion.div>
  );
}
