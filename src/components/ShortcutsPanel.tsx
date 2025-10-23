/**
 * @packageDocumentation
 * @module ShortcutsPanel
 * @description Modal dialog component for displaying and searching keyboard shortcuts.
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  RefreshCw,
  Bug,
  HelpCircle,
} from "lucide-react";
import {
  SHORTCUTS,
  ShortcutCategory,
  formatShortcutKey,
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

const categoryIcons = {
  [ShortcutCategory.NAVIGATION]: Navigation,
  [ShortcutCategory.MATCHING]: RefreshCw,
  [ShortcutCategory.SYNC]: RefreshCw,
  [ShortcutCategory.DEBUG]: Bug,
  [ShortcutCategory.GENERAL]: HelpCircle,
};

/**
 * Renders a keyboard shortcuts reference panel as a modal dialog.
 * Displays shortcuts organized by category with search functionality.
 * Allows users to discover and reference all available keyboard shortcuts.
 * @param props - Component props.
 * @returns The rendered shortcuts panel dialog.
 * @source
 */
export function ShortcutsPanel({
  isOpen,
  onClose,
}: Readonly<ShortcutsPanelProps>) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter shortcuts based on search query
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) {
      return SHORTCUTS;
    }

    const query = searchQuery.toLowerCase();
    return SHORTCUTS.filter((shortcut) => {
      const keyString = formatShortcutKey(shortcut.keys).toLowerCase();
      return (
        shortcut.description.toLowerCase().includes(query) ||
        keyString.includes(query) ||
        shortcut.action.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  // Get shortcuts by category from filtered results
  const getFilteredByCategory = (category: ShortcutCategory) => {
    return filteredShortcuts.filter((s) => s.category === category);
  };

  // Check if any shortcuts match current search
  const hasResults = filteredShortcuts.length > 0;

  const ShortcutCard = ({
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
            {shortcutItem.scope}
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
            {shortcutItem.altKeys.map((altKey, altIdx) => (
              <div key={`${altIdx}-alt`} className="flex gap-1">
                {formatShortcutKey(altKey)
                  .split("+")
                  .map((key) => (
                    <kbd
                      key={`${key}-alt-${altIdx}`}
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

  const ShortcutCategorySection = ({
    category,
  }: {
    category: ShortcutCategory;
  }) => {
    const categoryShortcuts = getFilteredByCategory(category);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
        >
          <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden rounded-2xl border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl">
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
                placeholder="Search shortcuts by name or key..."
                className="border-white/10 bg-white/5 pl-10 focus:bg-white/10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Shortcuts Display */}
            <ScrollArea className="h-[400px] w-full rounded-lg border border-white/10 bg-white/5 p-4">
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
                    // Show organized by category
                    <>
                      {Object.values(ShortcutCategory).map((category) => (
                        <ShortcutCategorySection
                          key={category}
                          category={category}
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
