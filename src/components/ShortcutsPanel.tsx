/**
 * @packageDocumentation
 * @module ShortcutsPanel
 * @description Modal dialog component for displaying and searching keyboard shortcuts.
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buildFuse } from "@/utils/fuzzySearch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Keyboard,
  Search,
  Navigation,
  Sparkles,
  Bug,
  Type,
  ArrowUpDown,
  LucideIcon,
} from "lucide-react";
import {
  SHORTCUTS,
  ShortcutCategory,
  formatShortcutKey,
  humanizeScope,
} from "@/utils/shortcuts";

/**
 * Props for the ShortcutsPanel component.
 * @property isOpen - Whether the shortcuts panel is currently visible.
 * @property onClose - Callback function invoked when panel should close.
 * @source
 */
interface ShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Exhaustive mapping of category icons for each shortcut category.
 * Type-checked as Record<ShortcutCategory, LucideIcon> to ensure all categories have icons.
 * @source
 */
const categoryIcons: Record<ShortcutCategory, LucideIcon> = {
  [ShortcutCategory.NAVIGATION]: Navigation,
  [ShortcutCategory.MATCHING]: Type,
  [ShortcutCategory.SYNC]: ArrowUpDown,
  [ShortcutCategory.DEBUG]: Bug,
  [ShortcutCategory.GENERAL]: Sparkles,
};

/**
 * Presentational card component for a single keyboard shortcut.
 * @param props - Component properties.
 * @param props.shortcutItem - The shortcut data to display.
 * @returns Shortcut card element with description and key bindings.
 * @source
 */
export const ShortcutCard = ({
  shortcutItem,
}: {
  shortcutItem: (typeof SHORTCUTS)[0];
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10"
  >
    <div className="flex flex-col gap-1">
      <p className="text-foreground text-sm font-medium">
        {shortcutItem.description}
      </p>
      {shortcutItem.scope && shortcutItem.scope !== "global" && (
        <Badge variant="outline" className="w-fit text-xs">
          {humanizeScope(shortcutItem.scope)}
        </Badge>
      )}
    </div>
    <div className="flex flex-wrap gap-2">
      {/* Primary key combo */}
      <div className="flex gap-1">
        {formatShortcutKey(shortcutItem.keys)
          .split("+")
          .map((key) => (
            <kbd
              key={`${key}-primary`}
              className="rounded border border-white/20 bg-white/10 px-2 py-1 font-mono text-xs font-semibold text-white/80"
            >
              {key}
            </kbd>
          ))}
      </div>
      {/* Alternative key combos */}
      {shortcutItem.altKeys && shortcutItem.altKeys.length > 0 && (
        <>
          <span className="text-muted-foreground text-xs">/</span>
          {shortcutItem.altKeys.map((altKey) => (
            <div
              key={`${formatShortcutKey(altKey)}-alt`}
              className="flex gap-1"
            >
              {formatShortcutKey(altKey)
                .split("+")
                .map((key) => (
                  <kbd
                    key={`${key}-alt-${formatShortcutKey(altKey)}`}
                    className="rounded border border-white/20 bg-white/10 px-2 py-1 font-mono text-xs font-semibold text-white/80"
                  >
                    {key}
                  </kbd>
                ))}
            </div>
          ))}
        </>
      )}
    </div>
  </motion.div>
);

/**
 * Section component displaying all shortcuts for a given category.
 * @param props - Component properties.
 * @param props.category - The shortcut category to display.
 * @param props.categoryShortcuts - Array of shortcuts in this category.
 * @returns Category section with shortcut cards or null if no shortcuts.
 * @source
 */
export const ShortcutCategorySection = ({
  category,
  categoryShortcuts,
}: {
  category: ShortcutCategory;
  categoryShortcuts: (typeof SHORTCUTS)[0][];
}) => {
  const Icon = categoryIcons[category];

  if (categoryShortcuts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <h3 className="text-foreground text-sm font-semibold">{category}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {categoryShortcuts.length}
        </Badge>
      </div>
      <div className="space-y-2 pl-6">
        {categoryShortcuts.map((shortcut) => (
          <ShortcutCard key={shortcut.id} shortcutItem={shortcut} />
        ))}
      </div>
    </div>
  );
};

/**
 * Modal dialog for displaying keyboard shortcuts with search functionality.
 * @param props - Component properties.
 * @param props.isOpen - Whether the panel is visible.
 * @param props.onClose - Callback invoked when panel should close.
 * @returns Shortcuts modal or null when closed.
 * @source
 */
export function ShortcutsPanel({
  isOpen,
  onClose,
}: Readonly<ShortcutsPanelProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Manage autofocus: focus after a small delay when dialog opens
  useEffect(() => {
    if (isOpen) {
      const timer = globalThis.setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
      return () => globalThis.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  // Memoize categories to prevent recomputation
  const allCategories = useMemo(() => Object.values(ShortcutCategory), []);

  // Filter shortcuts by search query
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) {
      return SHORTCUTS;
    }

    // Precompute keyLabel for each shortcut to enable string-based search
    const shortcutsWithKeyLabels = SHORTCUTS.map((shortcut) => ({
      ...shortcut,
      keyLabel: formatShortcutKey(shortcut.keys),
    }));

    const fuse = buildFuse(shortcutsWithKeyLabels, [
      { name: "description", weight: 0.5 },
      { name: "action", weight: 0.3 },
      { name: "keyLabel", weight: 0.2 },
    ]);

    const results = fuse.search(searchQuery);
    return results.map((result) => result.item);
  }, [searchQuery]);

  // Get shortcuts filtered by category
  const getFilteredByCategory = (category: ShortcutCategory) => {
    return filteredShortcuts.filter((s) => s.category === category);
  };

  // Check if search has results
  const hasResults = filteredShortcuts.length > 0;

  // Handle Escape key to close panel
  const handleEscapeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
        >
          <DialogContent
            className="max-h-[80vh] max-w-3xl overflow-hidden rounded-2xl border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl"
            onKeyDown={handleEscapeKeyDown}
          >
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-500/20 p-2">
                  <Keyboard className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-2xl">
                    Keyboard Shortcuts
                  </DialogTitle>
                  <DialogDescription>
                    Navigate and control the app using your keyboard
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Search Input */}
            <div className="relative">
              <Search className="text-muted-foreground absolute left-3 top-3 h-4 w-4" />
              <Input
                ref={searchInputRef}
                placeholder="Search shortcuts by name or key..."
                className="border-white/10 bg-white/5 pl-10 focus:bg-white/10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search shortcuts"
                aria-describedby="shortcuts-search-status"
                aria-controls="shortcuts-list"
              />
            </div>

            {/* Shortcuts Display */}
            <ScrollArea className="h-[400px] w-full rounded-lg border border-white/10 bg-white/5 p-4">
              {/* Announcements for search results */}
              {searchQuery && (
                <output
                  id="shortcuts-search-status"
                  className="sr-only"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {(() => {
                    const countText =
                      filteredShortcuts.length === 1 ? "shortcut" : "shortcuts";
                    return hasResults
                      ? `Found ${filteredShortcuts.length} ${countText}`
                      : `No shortcuts found matching "${searchQuery}"`;
                  })()}
                </output>
              )}

              <section id="shortcuts-list" aria-label="Search results">
                {hasResults ? (
                  <div className="space-y-6 pr-4">
                    {searchQuery ? (
                      // Show all matching shortcuts when searching
                      <div className="space-y-2">
                        {filteredShortcuts.map((shortcut) => (
                          <ShortcutCard
                            key={shortcut.id}
                            shortcutItem={shortcut}
                          />
                        ))}
                      </div>
                    ) : (
                      // Show organized by category using memoized categories
                      <>
                        {allCategories.map((category) => (
                          <ShortcutCategorySection
                            key={category}
                            category={category}
                            categoryShortcuts={getFilteredByCategory(category)}
                          />
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <p className="text-muted-foreground">
                        No shortcuts found matching &quot;{searchQuery}&quot;
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </ScrollArea>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground flex items-center justify-between border-t border-white/10 pt-4 text-xs"
            >
              <p>
                Press{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">
                  ?
                </kbd>{" "}
                or{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">
                  Ctrl+/
                </kbd>{" "}
                to toggle this panel
              </p>
              <Badge variant="outline">
                {SHORTCUTS.length} shortcuts total
              </Badge>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
