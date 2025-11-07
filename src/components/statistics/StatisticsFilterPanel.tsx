import React, { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { RangeSlider } from "@/components/ui/slider";
import type { StatisticsFilters } from "@/types/statistics";
import type { MatchStatus } from "@/api/anilist/types";
import { DEFAULT_STATISTICS_FILTERS } from "@/types/statistics";

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
  matchCount,
}: Readonly<StatisticsFilterPanelProps>): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.genres.length > 0) count++;
    if (filters.formats.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.confidenceRange.min > 0 || filters.confidenceRange.max < 100)
      count++;
    return count;
  }, [filters]);

  // Filter genres by search
  const filteredGenres = useMemo(() => {
    if (!genreSearch) return availableGenres;
    return availableGenres.filter((genre) =>
      genre.toLowerCase().includes(genreSearch.toLowerCase()),
    );
  }, [availableGenres, genreSearch]);

  // Handle filter changes
  const handleConfidenceChange = (value: { min: number; max: number }) => {
    onFiltersChange({ ...filters, confidenceRange: value });
  };

  const handleGenreToggle = (genre: string) => {
    const newGenres = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre];
    onFiltersChange({ ...filters, genres: newGenres });
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
    newDateRange[type] = value ? new Date(value) : null;
    onFiltersChange({ ...filters, dateRange: newDateRange });
  };

  const handleSelectAllGenres = () => {
    onFiltersChange({ ...filters, genres: [...availableGenres] });
  };

  const handleClearAllGenres = () => {
    onFiltersChange({ ...filters, genres: [] });
  };

  const handleClearAllFilters = () => {
    onFiltersChange(DEFAULT_STATISTICS_FILTERS);
    setGenreSearch("");
  };

  const handlePresetClick = (preset: FilterPreset) => {
    onFiltersChange({ ...filters, ...preset.filters });
  };

  // Format status label
  const statusLabel = (status: MatchStatus): string => {
    const labels: Record<MatchStatus, string> = {
      matched: "Matched",
      pending: "Pending",
      manual: "Manual",
      skipped: "Skipped",
    };
    return labels[status] || status;
  };

  // Format format label
  const formatLabel = (format: string): string => {
    return format.charAt(0) + format.slice(1).toLowerCase();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden rounded-2xl border-slate-200/50 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/80">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

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
                        ? filters.dateRange.start.toISOString().split("T")[0]
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
                        ? filters.dateRange.end.toISOString().split("T")[0]
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
                <div className="space-y-2">
                  {availableFormats.map((format) => (
                    <div key={format} className="flex items-center gap-2">
                      <Checkbox
                        id={`format-${format}`}
                        checked={filters.formats.includes(format)}
                        onCheckedChange={() => handleFormatToggle(format)}
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Genres
                    </div>
                    {filters.genres.length > 0 && (
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        ({filters.genres.length} selected)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllGenres}
                      className="h-6 text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllGenres}
                      className="h-6 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Genre search */}
                <input
                  type="text"
                  placeholder="Search genres..."
                  value={genreSearch}
                  onChange={(e) => setGenreSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500"
                />

                {/* Genre list */}
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  {filteredGenres.length > 0 ? (
                    filteredGenres.map((genre) => (
                      <div key={genre} className="flex items-center gap-2">
                        <Checkbox
                          id={`genre-${genre}`}
                          checked={filters.genres.includes(genre)}
                          onCheckedChange={() => handleGenreToggle(genre)}
                        />
                        <label
                          htmlFor={`genre-${genre}`}
                          className="cursor-pointer text-sm text-slate-700 dark:text-slate-300"
                        >
                          {genre}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                      No genres found
                    </p>
                  )}
                </div>
              </div>
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
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.statuses.includes(status)}
                        onCheckedChange={() => handleStatusToggle(status)}
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
