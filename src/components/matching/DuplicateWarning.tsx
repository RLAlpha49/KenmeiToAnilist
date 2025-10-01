import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, Search, X } from "lucide-react";
import { Button } from "../ui/button";

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
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950">
        <div className="flex items-start justify-between">
          <div className="flex flex-1 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <h3 className="mb-2 text-base font-semibold text-amber-800 dark:text-amber-200">
                Duplicate AniList Entries Detected
              </h3>
              <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
                The same AniList manga is matched to multiple Kenmei entries.
                This may be unintentional:
              </p>
              <div className="space-y-3">
                {duplicates.map((duplicate) => (
                  <div
                    key={duplicate.anilistId}
                    className="rounded-md border border-amber-200/50 bg-amber-100/60 p-3 dark:border-amber-800/50 dark:bg-amber-900/30"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="font-medium text-amber-900 dark:text-amber-100">
                        AniList: {duplicate.anilistTitle}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onSearchAnilist(duplicate.anilistTitle)
                          }
                          className="h-7 border-amber-300 px-2 text-xs text-amber-700 hover:border-amber-400 hover:bg-amber-200/50 dark:border-amber-700 dark:text-amber-300 dark:hover:border-amber-600 dark:hover:bg-amber-800/50"
                          title={`Search for "${duplicate.anilistTitle}" in the match results below`}
                        >
                          <Search className="mr-1 h-3 w-3" />
                          Search
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
                          className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-200/50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-800/50 dark:hover:text-amber-300"
                          title={`Ignore this duplicate warning for "${duplicate.anilistTitle}"`}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Ignore
                        </Button>
                      </div>
                    </div>
                    <div className="mb-2 text-xs tracking-wide text-amber-800 uppercase dark:text-amber-200">
                      Matched to Kenmei entries:
                    </div>
                    <ul className="space-y-1">
                      {duplicate.kenmeiTitles.map((title) => (
                        <li
                          key={`${duplicate.anilistId}-${title}`}
                          className="flex items-start text-sm text-amber-700 dark:text-amber-300"
                        >
                          <span className="mt-0.5 mr-2 text-amber-500 dark:text-amber-400">
                            •
                          </span>
                          <span>{title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-md border-l-2 border-amber-400 bg-amber-100/40 p-3 text-xs text-amber-600 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                💡 <strong>Tip:</strong> Use the &ldquo;Search&rdquo; button to
                find an AniList title in the match results below. If the
                duplicate is intentional, click &ldquo;Ignore&rdquo; to
                permanently dismiss this warning for that AniList entry.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="ml-2 h-auto min-w-0 flex-shrink-0 p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/50 dark:hover:text-amber-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
