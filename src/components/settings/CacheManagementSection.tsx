/**
 * @packageDocumentation
 * @module CacheManagementSection
 * @description Cache management section for the Data tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { Trash2, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { highlightText } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";

/**
 * Cache types that can be cleared individually.
 * @source
 */
interface CachesToClear {
  /** Authentication tokens and login state. */
  auth: boolean;
  /** Settings cache. */
  settings: boolean;
  /** Sync history and records. */
  sync: boolean;
  /** Import operation history. */
  import: boolean;
  /** Matching results. */
  review: boolean;
  /** Manga metadata. */
  manga: boolean;
  /** Search results. */
  search: boolean;
  /** Other caches. */
  other: boolean;
}

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
  cacheCleared: boolean;
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
  cacheCleared,
  searchQuery,
  highlightedSectionId,
  onCachesToClearChange,
  onClearCaches,
}: Readonly<CacheManagementSectionProps>) {
  return (
    <motion.div
      id="data-cache"
      className={cn(
        "bg-muted/40 space-y-4 rounded-xl border p-4",
        highlightedSectionId === "data-cache" &&
          "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Trash2 className="h-4 w-4 text-blue-500" />
          {renderHighlightedText("Clear local cache", searchQuery)}
        </h3>
        <p className="text-muted-foreground text-xs">
          {renderHighlightedText(
            "Select which cached data types to clear and reset. Cache types include authentication, settings, sync, and more.",
            searchQuery,
          )}
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="auth-cache"
            aria-label="Auth Cache - Authentication state"
          >
            <input
              id="auth-cache"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.auth}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  auth: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Auth cache", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "Authentication tokens and login state",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="settings-cache"
            aria-label="Settings Cache - Sync preferences"
          >
            <input
              id="settings-cache"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.settings}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  settings: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Settings cache", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "User settings and sync configuration",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="sync-cache"
            aria-label="Sync Cache - Sync history"
          >
            <input
              id="sync-cache"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.sync}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  sync: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Sync cache", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "Synchronization history and operation records",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="import-cache"
            aria-label="Import Cache - Import history"
          >
            <input
              id="import-cache"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.import}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  import: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Import cache", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "Import operation history and results",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
        </div>

        <div className="space-y-2">
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="review-cache"
            aria-label="Review Cache - Match results"
          >
            <input
              id="review-cache"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.review}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  review: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Review cache", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "Matching results and review data",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="manga-cache"
            aria-label="Manga Cache - Manga metadata"
          >
            <input
              id="manga-cache"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.manga}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  manga: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Manga cache", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "Cached manga titles, details, and metadata",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="search-cache"
            aria-label="Search Cache - Search results"
          >
            <input
              id="search-cache"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.search}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  search: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Search cache", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "Cached search queries and API results",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="other-caches"
            aria-label="Other Caches - Miscellaneous cache data"
          >
            <input
              id="other-caches"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={cachesToClear.other}
              onChange={(e) =>
                onCachesToClearChange({
                  ...cachesToClear,
                  other: e.target.checked,
                })
              }
            />
            <div>
              <span className="text-sm font-medium">
                {renderHighlightedText("Other caches", searchQuery)}
              </span>
              <p className="text-muted-foreground text-xs">
                {renderHighlightedText(
                  "Miscellaneous cache data and temporary storage",
                  searchQuery,
                )}
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400"
          onClick={() =>
            onCachesToClearChange({
              auth: true,
              settings: true,
              sync: true,
              import: true,
              review: true,
              manga: true,
              search: true,
              other: true,
            })
          }
        >
          Select all
        </Button>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400"
          onClick={() =>
            onCachesToClearChange({
              auth: false,
              settings: false,
              sync: false,
              import: false,
              review: false,
              manga: false,
              search: false,
              other: false,
            })
          }
        >
          Deselect all
        </Button>
      </div>

      {(() => {
        let buttonContent;
        if (isClearing) {
          buttonContent = (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Clearing cache...
            </>
          );
        } else if (cacheCleared) {
          buttonContent = (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Cache cleared successfully
            </>
          );
        } else {
          buttonContent = (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear selected caches
            </>
          );
        }
        return (
          <Button
            onClick={onClearCaches}
            variant={cacheCleared ? "outline" : "default"}
            disabled={isClearing || !Object.values(cachesToClear).some(Boolean)}
            className={`w-full disabled:cursor-not-allowed disabled:opacity-60 ${
              cacheCleared
                ? "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/40"
                : ""
            }`}
          >
            {buttonContent}
          </Button>
        );
      })()}
    </motion.div>
  );
}
