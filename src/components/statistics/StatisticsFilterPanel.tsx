import React, { useState, useMemo } from "react";
import { formatLabel, statusLabel } from "@/components/matching/labels";
import {
  SlidersHorizontal,
  Target,
  Calendar,
  BookOpen,
  TrendingUp,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { RangeSlider } from "@/components/ui/slider";
import type { StatisticsFilters } from "@/types/statistics";
import type { MatchStatus } from "@/api/anilist/types";
import { DEFAULT_STATISTICS_FILTERS } from "@/types/statistics";
import { SearchableFilterList } from "@/components/matching/SearchableFilterList";
import {
  toDateInputValue,
  parseDateInputValue,
} from "@/components/matching/filterUtils";

/**
 * Props for the StatisticsFilterPanel component.
 * @property filters - Current filter state.
 * @property onFiltersChange - Callback when filters are modified.
 * @property availableGenres - List of available genres to filter by.
 * @property availableFormats - List of available formats to filter by.
 * @property availableStatuses - List of available match statuses to filter by.
 * @property matchCount - Total number of matches after filtering.
 * @source
 */
interface StatisticsFilterPanelProps {
  filters: StatisticsFilters;
  onFiltersChange: (filters: StatisticsFilters) => void;
  availableGenres: string[];
  availableFormats: string[];
  availableStatuses: MatchStatus[];
  availableTags: string[];
  matchCount: number;
}

/**
 * Filter preset configuration for quick-apply filtering.
 * @source
 */
interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: typeof Target;
  filters: Partial<StatisticsFilters>;
}

/**
 * Built-in filter presets for statistics filtering.
 * @source
 */
const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "high-confidence",
    name: "High Confidence",
    description: "Matches with 80%+ confidence",
    icon: Target,
    filters: {
      confidenceRange: { min: 80, max: 100 },
    },
  },
  {
    id: "recent",
    name: "Recently Matched",
    description: "Matched in the last 30 days",
    icon: Calendar,
    filters: {
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
    },
  },
  {
    id: "action-adventure",
    name: "Action/Adventure",
    description: "Action and Adventure genres",
    icon: TrendingUp,
    filters: {
      genres: ["Action", "Adventure"],
    },
  },
  {
    id: "manga-only",
    name: "Manga Only",
    description: "Exclude novels",
    icon: BookOpen,
    filters: {
      formats: ["MANGA"],
    },
  },
  {
    id: "completed-reading",
    name: "Matched Entries",
    description: "Successfully matched entries",
    icon: CheckCircle,
    filters: {
      statuses: ["matched"],
    },
  },
];

/**
 * Statistics filter panel component with collapsible sections for filtering data.
 * @source
 */
export function StatisticsFilterPanel({
  filters,
  onFiltersChange,
  availableGenres,
  availableFormats,
  availableStatuses,
  availableTags,
  matchCount,
}: Readonly<StatisticsFilterPanelProps>): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.genres.length > 0) count++;
    if (filters.formats.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.confidenceRange.min > 0 || filters.confidenceRange.max < 100)
      count++;
    return count;
  }, [filters]);

  const handleConfidenceChange = (value: { min: number; max: number }) => {
    onFiltersChange({ ...filters, confidenceRange: value });
  };

  const handleFormatToggle = (format: string) => {
    const newFormats = filters.formats.includes(format)
      ? filters.formats.filter((f) => f !== format)
      : [...filters.formats, format];
    onFiltersChange({ ...filters, formats: newFormats });
  };

  const handleStatusToggle = (status: MatchStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleDateRangeChange = (
    type: "start" | "end",
    value: string | null,
  ) => {
    const newDateRange = { ...filters.dateRange };
    if (value) {
      newDateRange[type] = parseDateInputValue(value);
    } else {
      newDateRange[type] = null;
    }
    onFiltersChange({ ...filters, dateRange: newDateRange });
  };

  const handleClearAllFilters = () => {
    onFiltersChange(DEFAULT_STATISTICS_FILTERS);
  };

  const handlePresetClick = (preset: FilterPreset) => {
    onFiltersChange({ ...filters, ...preset.filters });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden rounded-2xl border-slate-200/50 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/80">
        <CardHeader className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-linear-to-br rounded-full from-blue-500 to-purple-600 p-2">
                <SlidersHorizontal className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  Advanced Filters
                </CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                  Refine your statistics with powerful filters
                </CardDescription>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-label="Toggle advanced filters"
                className="flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {activeFilterCount > 0 && (
                  <Badge
                    variant="default"
                    className="bg-blue-500 text-white hover:bg-blue-600"
                  >
                    {activeFilterCount} active
                  </Badge>
                )}
                <ChevronRight
                  className={`h-5 w-5 text-slate-500 transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Filter Presets */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Quick Filters
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTER_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <Button
                      key={preset.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetClick(preset)}
                      className="h-auto flex-col items-start gap-1 p-3 text-left"
                      title={preset.description}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{preset.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {preset.description}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Confidence Range */}
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confidence Score
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Filter by match confidence percentage
                </p>
              </div>
              <RangeSlider
                min={0}
                max={100}
                step={5}
                value={filters.confidenceRange}
                onChange={handleConfidenceChange}
              />
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Date Range
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Filter by match date
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="start-date"
                    className="mb-1 block text-xs text-slate-600 dark:text-slate-400"
                  >
                    Start Date
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={
                      filters.dateRange.start
                        ? toDateInputValue(filters.dateRange.start)
                        : ""
                    }
                    onChange={(e) =>
                      handleDateRangeChange("start", e.target.value || null)
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label
                    htmlFor="end-date"
                    className="mb-1 block text-xs text-slate-600 dark:text-slate-400"
                  >
                    End Date
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={
                      filters.dateRange.end
                        ? toDateInputValue(filters.dateRange.end)
                        : ""
                    }
                    onChange={(e) =>
                      handleDateRangeChange("end", e.target.value || null)
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Format Filter */}
            {availableFormats.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Format
                </div>
                <Input
                  type="text"
                  placeholder="Search formats..."
                  value=""
                  onChange={() => {}}
                  aria-label="Search formats"
                />
                <div className="space-y-2">
                  {availableFormats.map((format) => (
                    <div key={format} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`format-${format}`}
                        checked={filters.formats.includes(format)}
                        onChange={() => handleFormatToggle(format)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <label
                        htmlFor={`format-${format}`}
                        className="cursor-pointer text-sm text-slate-700 dark:text-slate-300"
                      >
                        {formatLabel(format)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Genre Filter */}
            {availableGenres.length > 0 && (
              <SearchableFilterList
                items={availableGenres}
                selectedItems={filters.genres}
                onToggle={(genre) => {
                  const newGenres = filters.genres.includes(genre)
                    ? filters.genres.filter((g) => g !== genre)
                    : [...filters.genres, genre];
                  onFiltersChange({ ...filters, genres: newGenres });
                }}
                label={(genre) => genre}
                showSelectClear
                onSelectAll={() =>
                  onFiltersChange({ ...filters, genres: [...availableGenres] })
                }
                onClearAll={() => onFiltersChange({ ...filters, genres: [] })}
                searchPlaceholder="Search genres..."
              />
            )}

            {/* Tags Filter */}
            {availableTags.length > 0 && (
              <SearchableFilterList
                items={availableTags}
                selectedItems={filters.tags}
                onToggle={(tag) => {
                  const newTags = filters.tags.includes(tag)
                    ? filters.tags.filter((t) => t !== tag)
                    : [...filters.tags, tag];
                  onFiltersChange({ ...filters, tags: newTags });
                }}
                label={(tag) => tag}
                showSelectClear
                onSelectAll={() =>
                  onFiltersChange({ ...filters, tags: [...availableTags] })
                }
                onClearAll={() => onFiltersChange({ ...filters, tags: [] })}
                searchPlaceholder="Search tags..."
              />
            )}

            {/* Status Filter */}
            {availableStatuses.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Match Status
                </div>
                <div className="space-y-2">
                  {availableStatuses.map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`status-${status}`}
                        checked={filters.statuses.includes(status)}
                        onChange={() => handleStatusToggle(status)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <label
                        htmlFor={`status-${status}`}
                        className="cursor-pointer text-sm text-slate-700 dark:text-slate-300"
                      >
                        {statusLabel(status)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Showing {matchCount} {matchCount === 1 ? "match" : "matches"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllFilters}
                disabled={activeFilterCount === 0}
              >
                Clear All
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
