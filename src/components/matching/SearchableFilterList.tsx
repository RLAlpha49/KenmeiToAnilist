import React, { useMemo } from "react";
import { buildFuse } from "@/utils/fuzzy-search";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";

/**
 * Props for the SearchableFilterList component.
 * @property items - Array of items to display as checkboxes
 * @property selectedItems - Currently selected items
 * @property onToggle - Callback when an item checkbox is toggled
 * @property label - Label formatter function (optional, defaults to item toString)
 * @property showSelectClear - Whether to show Select All/Clear buttons
 * @property onSelectAll - Callback for select all button
 * @property onClearAll - Callback for clear all button
 * @property maxHeight - Max height for scrollable container
 * @property searchPlaceholder - Placeholder text for search input
 */
interface SearchableFilterListProps<T> {
  items: T[];
  selectedItems: T[];
  onToggle: (item: T) => void;
  label?: (item: T) => string;
  showSelectClear?: boolean;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  maxHeight?: string;
  searchPlaceholder?: string;
  getItemId?: (item: T) => string;
}

/**
 * Reusable component for displaying a searchable, filterable list of checkboxes.
 * Used by filter panels to avoid code duplication.
 *
 * @template T - The type of items in the list
 * @returns React component
 */
export function SearchableFilterList<T extends string | { name: string }>({
  items,
  selectedItems,
  onToggle,
  label = (item) => (typeof item === "string" ? item : item.name),
  showSelectClear = true,
  onSelectAll,
  onClearAll,
  maxHeight = "12rem",
  searchPlaceholder = "Search...",
  getItemId = (item) => {
    if (typeof item === "string") {
      return item;
    }
    const namedItem = item as { name: string };
    return namedItem.name || String(item);
  },
}: Readonly<SearchableFilterListProps<T>>): React.ReactElement {
  const [searchValue, setSearchValue] = React.useState("");

  // Memoize filtered items based on search query
  const filteredItems = useMemo(() => {
    if (!searchValue.trim()) return items;

    const searchItems = items.map((item) => ({
      name: label(item),
      originalItem: item,
    }));

    const fuse = buildFuse(searchItems, ["name"]);
    const results = fuse.search(searchValue);
    return results.map(
      (result: { item: { originalItem: T } }) => result.item.originalItem,
    );
  }, [items, searchValue, label]);

  const selectedCount = selectedItems.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {items.length > 0 ? label(items[0]) : ""}
          </div>
          {selectedCount > 0 && (
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
              ({selectedCount} selected)
            </span>
          )}
        </div>

        {showSelectClear && (
          <div className="flex gap-2">
            {onSelectAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="h-6 text-xs"
              >
                Select All
              </Button>
            )}
            {onClearAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-6 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Search input */}
      <Input
        type="text"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        aria-label={searchPlaceholder}
      />

      {/* Item list */}
      <div
        className="space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
        style={{ maxHeight }}
      >
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const itemId = getItemId(item);
            return (
              <div key={itemId} className="flex items-center gap-2">
                <Checkbox
                  id={`item-${itemId}`}
                  checked={selectedItems.includes(item)}
                  onCheckedChange={() => onToggle(item)}
                />
                <label
                  htmlFor={`item-${itemId}`}
                  className="cursor-pointer text-sm text-slate-700 dark:text-slate-300"
                >
                  {label(item)}
                </label>
              </div>
            );
          })
        ) : (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            No items found
          </p>
        )}
      </div>
    </div>
  );
}
