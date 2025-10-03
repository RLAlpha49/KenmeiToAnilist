/**
 * @packageDocumentation
 * @module SyncPage/ViewControls
 * @description View controls for the sync page including display mode toggle, sort dropdown, and filter dropdown.
 */

import React from "react";
import { SortAsc, Filter, Check } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DisplayMode, SortOption, FilterOptions } from "./types";

interface ViewControlsProps {
  /** Current display mode (cards or compact) */
  displayMode: DisplayMode;
  /** Callback to change display mode */
  setDisplayMode: (mode: DisplayMode) => void;
  /** Current sort option */
  sortOption: SortOption;
  /** Callback to update sort option */
  setSortOption: React.Dispatch<React.SetStateAction<SortOption>>;
  /** Current filter options */
  filters: FilterOptions;
  /** Callback to update filter options */
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
}

/**
 * ViewControls Component
 *
 * Displays controls for:
 * - Display mode toggle (Cards/Compact view)
 * - Sort dropdown (by title, status, progress, score, or changes)
 * - Filter dropdown (by status, changes, or library membership)
 * - Reset button to restore default view settings
 */
export const ViewControls: React.FC<ViewControlsProps> = ({
  displayMode,
  setDisplayMode,
  sortOption,
  setSortOption,
  filters,
  setFilters,
}) => {
  return (
    <div className="mb-4 flex items-center justify-between">
      {/* Display Mode Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">View:</span>
        <div className="border-input bg-background inline-flex items-center rounded-md border p-1">
          <Button
            variant={displayMode === "cards" ? "default" : "ghost"}
            size="sm"
            className="h-8 rounded-sm px-2"
            onClick={() => setDisplayMode("cards")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
            Cards
          </Button>
          <Button
            variant={displayMode === "compact" ? "default" : "ghost"}
            size="sm"
            className="h-8 rounded-sm px-2"
            onClick={() => setDisplayMode("compact")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <line x1="3" x2="21" y1="6" y2="6" />
              <line x1="3" x2="21" y1="12" y2="12" />
              <line x1="3" x2="21" y1="18" y2="18" />
            </svg>
            Compact
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <SortAsc className="mr-1 h-4 w-4" />
              Sort
              {sortOption.field !== "title" ||
              sortOption.direction !== "asc" ? (
                <span className="ml-1 text-xs opacity-70">
                  (
                  {sortOption.field.charAt(0).toUpperCase() +
                    sortOption.field.slice(1)}
                  , {sortOption.direction === "asc" ? "↑" : "↓"})
                </span>
              ) : null}
              <span className="sr-only">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="p-2">
              <div className="mb-2 flex items-center justify-between">
                <DropdownMenuLabel className="p-0">Sort by</DropdownMenuLabel>
                <div className="flex overflow-hidden rounded-md border">
                  <Button
                    variant={
                      sortOption.direction === "asc" ? "default" : "outline"
                    }
                    size="sm"
                    className="h-7 rounded-none border-0 px-2"
                    onClick={() =>
                      setSortOption((prev) => ({
                        ...prev,
                        direction: "asc",
                      }))
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m3 8 4-4 4 4" />
                      <path d="M7 4v16" />
                      <path d="M11 12h4" />
                      <path d="M11 16h7" />
                      <path d="M11 20h10" />
                    </svg>
                    <span className="sr-only">Ascending</span>
                  </Button>
                  <Button
                    variant={
                      sortOption.direction === "desc" ? "default" : "outline"
                    }
                    size="sm"
                    className="h-7 rounded-none border-0 px-2"
                    onClick={() =>
                      setSortOption((prev) => ({
                        ...prev,
                        direction: "desc",
                      }))
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m3 16 4 4 4-4" />
                      <path d="M7 20V4" />
                      <path d="M11 4h4" />
                      <path d="M11 8h7" />
                      <path d="M11 12h10" />
                    </svg>
                    <span className="sr-only">Descending</span>
                  </Button>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            {[
              { key: "title", label: "Title" },
              { key: "status", label: "Status" },
              { key: "progress", label: "Progress" },
              { key: "score", label: "Score" },
              { key: "changes", label: "Changes count" },
            ].map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                onClick={() =>
                  setSortOption((prev) => ({
                    ...prev,
                    field: opt.key as SortOption["field"],
                  }))
                }
                className="flex justify-between"
              >
                {opt.label}
                {sortOption.field === opt.key && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="mr-1 h-4 w-4" />
              Filter
              <span className="sr-only">Filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            {[
              { key: "all", label: "All statuses" },
              { key: "reading", label: "Reading" },
              { key: "completed", label: "Completed" },
              { key: "planned", label: "Plan to Read" },
              { key: "paused", label: "On Hold" },
              { key: "dropped", label: "Dropped" },
            ].map((s) => (
              <DropdownMenuItem
                key={s.key}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    status: s.key as FilterOptions["status"],
                  }))
                }
                className="flex justify-between"
              >
                {s.label}
                {filters.status === s.key && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Changes</DropdownMenuLabel>
            {[
              { key: "all", label: "All entries" },
              { key: "with-changes", label: "With changes" },
              { key: "no-changes", label: "No changes" },
            ].map((c) => (
              <DropdownMenuItem
                key={c.key}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    changes: c.key as FilterOptions["changes"],
                  }))
                }
                className="flex justify-between"
              >
                {c.label}
                {filters.changes === c.key && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Library</DropdownMenuLabel>
            {[
              { key: "all", label: "All entries" },
              { key: "new", label: "New to library" },
              { key: "existing", label: "Already in library" },
            ].map((l) => (
              <DropdownMenuItem
                key={l.key}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    library: l.key as FilterOptions["library"],
                  }))
                }
                className="flex justify-between"
              >
                {l.label}
                {filters.library === l.key && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            setSortOption({ field: "title", direction: "asc" });
            setFilters({
              status: "all",
              changes: "with-changes",
              library: "all",
            });
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
};
