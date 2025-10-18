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
  /** Current display mode (cards or compact). */
  displayMode: DisplayMode;
  /** Callback to change display mode. */
  setDisplayMode: (mode: DisplayMode) => void;
  /** Current sort option. */
  sortOption: SortOption;
  /** Callback to update sort option. */
  setSortOption: React.Dispatch<React.SetStateAction<SortOption>>;
  /** Current filter options. */
  filters: FilterOptions;
  /** Callback to update filter options. */
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
}

/**
 * Controls for view mode, sorting, and filtering manga entries.
 * Provides display mode toggle, sort/filter dropdowns, and reset button.
 * @source
 */
export const ViewControls: React.FC<ViewControlsProps> = ({
  displayMode,
  setDisplayMode,
  sortOption,
  setSortOption,
  filters,
  setFilters,
}) => {
  const activeFilterCount =
    Number(filters.status !== "all") +
    Number(filters.changes !== "with-changes") +
    Number(filters.library !== "all");

  const isDefaultSort =
    sortOption.field === "title" && sortOption.direction === "asc";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between dark:border-slate-800/60 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          View Mode
        </span>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50/60 p-1 dark:border-slate-800/60 dark:bg-slate-900/40">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 rounded-full px-3 text-xs font-semibold transition ${displayMode === "cards" ? "bg-blue-500/90 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900/50"}`}
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
            variant="ghost"
            size="sm"
            className={`h-8 rounded-full px-3 text-xs font-semibold transition ${displayMode === "compact" ? "bg-blue-500/90 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900/50"}`}
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

      <div className="flex flex-wrap justify-end gap-2">
        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-9 rounded-full border px-3 text-xs font-semibold transition ${isDefaultSort ? "border-slate-200/70 text-slate-600 hover:border-blue-200/60 hover:bg-blue-50/60 dark:border-slate-800/60 dark:text-slate-300 dark:hover:border-blue-900/40 dark:hover:bg-blue-900/30" : "border-blue-300/70 bg-blue-50/70 text-blue-600 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/40 dark:text-blue-200"}`}
            >
              <SortAsc className="mr-1 h-4 w-4" />
              Sort
              {!isDefaultSort && (
                <span className="ml-1 text-[10px] uppercase tracking-wide">
                  {sortOption.field},{" "}
                  {sortOption.direction === "asc" ? "↑" : "↓"}
                </span>
              )}
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
                className="flex items-center justify-between text-sm"
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
            <Button
              variant="ghost"
              size="sm"
              className={`relative h-9 rounded-full border px-3 text-xs font-semibold transition ${activeFilterCount > 0 ? "border-blue-300/70 bg-blue-50/70 text-blue-600 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/40 dark:text-blue-200" : "border-slate-200/70 text-slate-600 hover:border-blue-200/60 hover:bg-blue-50/60 dark:border-slate-800/60 dark:text-slate-300 dark:hover:border-blue-900/40 dark:hover:bg-blue-900/30"}`}
            >
              <Filter className="mr-1 h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white dark:bg-blue-400">
                  {activeFilterCount}
                </span>
              )}
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
                className="flex items-center justify-between text-sm"
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
                className="flex items-center justify-between text-sm"
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
                className="flex items-center justify-between text-sm"
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
          className="h-9 rounded-full border border-slate-200/70 px-4 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800/60 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/40"
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
