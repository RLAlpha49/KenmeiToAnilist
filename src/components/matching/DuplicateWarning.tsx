import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, Search, X } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface DuplicateEntry {
  anilistId: number;
  anilistTitle: string;
  kenmeiTitles: string[];
}

interface DuplicateWarningProps {
  duplicates: DuplicateEntry[];
  onDismiss: () => void;
  onSearchAnilist: (anilistTitle: string) => void;
  onIgnoreDuplicate: (anilistId: number, anilistTitle: string) => void;
}

export function DuplicateWarning({
  duplicates,
  onDismiss,
  onSearchAnilist,
  onIgnoreDuplicate,
}: Readonly<DuplicateWarningProps>) {
  if (duplicates.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-amber-100/80 to-white/75 shadow-xl shadow-amber-200/40 supports-[backdrop-filter]:backdrop-blur-md dark:border-amber-900/60 dark:from-amber-950/65 dark:via-amber-950/45 dark:to-slate-950/50">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-200/25 via-transparent to-transparent opacity-80 dark:from-amber-900/25" />
        <div className="relative flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-1 items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-700 shadow-inner shadow-amber-200/30 dark:bg-amber-500/18 dark:text-amber-200">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                    Duplicate AniList Entries Detected
                  </h3>
                  <Badge className="rounded-full border border-amber-300/70 bg-amber-200/40 text-[11px] font-semibold tracking-[0.18em] text-amber-700 uppercase dark:border-amber-800/60 dark:bg-amber-900/40 dark:text-amber-300">
                    {duplicates.length} issues
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-amber-700/90 dark:text-amber-300/90">
                  The same AniList manga is mapped to multiple Kenmei entries.
                  Review and resolve to keep your sync pristine.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-9 w-9 rounded-full border border-transparent bg-white/70 text-amber-600 shadow-sm transition hover:border-amber-200 hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-950/60 dark:text-amber-200 dark:hover:border-amber-800 dark:hover:bg-amber-900/40"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3">
            {duplicates.map((duplicate) => (
              <div
                key={duplicate.anilistId}
                className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-100/70 via-white/65 to-amber-50/60 p-4 shadow-sm shadow-amber-200/30 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-amber-800/50 dark:from-amber-900/40 dark:via-amber-950/40 dark:to-amber-950/30"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25)_0%,rgba(255,255,255,0)_70%)] opacity-70 dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2)_0%,rgba(17,24,39,0)_75%)]" />
                <div className="relative flex flex-col gap-4 pt-2 pr-3">
                  <div className="absolute top-3 right-3 z-20 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSearchAnilist(duplicate.anilistTitle)}
                      className="h-8 gap-1 rounded-full border-amber-300/60 bg-white/75 px-3 text-xs font-semibold tracking-[0.18em] text-amber-700 uppercase shadow-sm transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:border-amber-700"
                      title={`Search for "${duplicate.anilistTitle}" in the match results below`}
                    >
                      <Search className="h-3.5 w-3.5" /> Search
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onIgnoreDuplicate(
                          duplicate.anilistId,
                          duplicate.anilistTitle,
                        )
                      }
                      className="h-8 gap-1 rounded-full px-3 text-xs font-semibold tracking-[0.18em] text-amber-600 uppercase transition hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40 dark:hover:text-amber-200"
                      title={`Ignore this duplicate warning for "${duplicate.anilistTitle}"`}
                    >
                      <X className="h-3.5 w-3.5" /> Ignore
                    </Button>
                  </div>
                  <div className="pr-50 sm:pr-58">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      AniList · {duplicate.anilistTitle}
                    </p>
                    <p className="text-xs tracking-[0.18em] text-amber-500/80 uppercase dark:text-amber-300/80">
                      {duplicate.kenmeiTitles.length} Kenmei matches flagged
                    </p>
                  </div>
                  <div className="space-y-2 rounded-xl border border-amber-200/60 bg-white/80 p-3 shadow-inner dark:border-amber-800/60 dark:bg-amber-950/40">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-amber-500 uppercase dark:text-amber-300">
                      Matched Kenmei Entries
                    </div>
                    <ul className="space-y-1.5">
                      {duplicate.kenmeiTitles.map((title) => (
                        <li
                          key={`${duplicate.anilistId}-${title}`}
                          className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-200"
                        >
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                          <span>{title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="relative mt-2 rounded-2xl border border-amber-300/60 bg-amber-100/50 p-4 text-xs text-amber-700 shadow-inner dark:border-amber-800/50 dark:bg-amber-900/25 dark:text-amber-300">
            💡 <strong className="font-semibold">Tip:</strong> Use the “Search”
            action to jump straight to the AniList title in your match results.
            If the duplicate is intentional, tap “Ignore” to permanently dismiss
            the alert for that AniList entry.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
