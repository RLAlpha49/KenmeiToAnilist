import React, { useState, useMemo } from "react";
import {
  formatLabel,
  formatPublicationStatusLabel,
} from "@/components/matching/labels";
import {
  SlidersHorizontal,
  Target,
  Calendar,
  BookOpen,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { CollapsibleChevron } from "@/components/ui/CollapsibleChevron";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/Collapsible";
import { RangeSlider } from "@/components/ui/Slider";
import type { StatisticsFilters } from "@/types/statistics";
import type { MatchStatus } from "@/api/anilist/types";
import { defaultStatisticsFilters } from "@/types/statistics";
import { SearchableFilterList } from "@/components/matching/SearchableFilterList";
import {
  toDateInputValue,
  parseDateInputValue,
} from "@/components/matching/filter-utils";

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
    onFiltersChange(defaultStatisticsFilters);
  };

  const handlePresetClick = (preset: FilterPreset) => {
    onFiltersChange({ ...filters, ...preset.filters });
  };

  return (
    <Card className="bg-linear-to-br from-slate-50 to-slate-100/50 backdrop-blur-sm dark:from-slate-800/50 dark:to-slate-900/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <div>
                <CardTitle className="text-lg">Advanced Filters</CardTitle>
                <CardDescription>Fine-tune your statistics</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Active filter count badge */}
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                >
                  {activeFilterCount} active
                </Badge>
              )}

              {/* Collapse toggle */}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <CollapsibleChevron isExpanded={isOpen} />
                  <span className="sr-only">Toggle advanced filters</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Filter presets */}
          <div className="space-y-3 pt-3">
            <div className="flex flex-wrap gap-2">
              {FILTER_PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className="h-7 gap-1.5 text-xs"
                    title={preset.description}
                  >
                    <Icon className="h-3 w-3" />
                    {preset.name}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
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
                    onChange={(event) =>
                      handleDateRangeChange("start", event.target.value || null)
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
                    onChange={(event) =>
                      handleDateRangeChange("end", event.target.value || null)
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
                shouldShowSelectClear
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
                shouldShowSelectClear
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
                        {formatPublicationStatusLabel(status)}
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
      </Collapsible>
    </Card>
  );
}
