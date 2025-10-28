import React, { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Target,
  AlertCircle,
  Book,
  TrendingUp,
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
import type { AdvancedMatchFilters } from "@/types/matchingFilters";
import { formatLabel, statusLabel } from "./labels";

/**
 * Props for the AdvancedFilterPanel component.
 */
interface AdvancedFilterPanelProps {
  filters: AdvancedMatchFilters;
  onFiltersChange: (filters: AdvancedMatchFilters) => void;
  availableGenres: string[];
  availableFormats: string[];
  availableStatuses: string[];
  matchCount: number;
}

/**
 * Filter preset configuration.
 */
interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: typeof Target;
  filters: AdvancedMatchFilters;
}

/**
 * Built-in filter presets for quick filtering.
 */
const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "high-confidence",
    name: "High Confidence",
    description: "Matches with 80%+ confidence",
    icon: Target,
    filters: {
      confidence: { min: 80, max: 100 },
      formats: [],
      genres: [],
      publicationStatuses: [],
    },
  },
  {
    id: "needs-review",
    name: "Needs Review",
    description: "Low confidence matches",
    icon: AlertCircle,
    filters: {
      confidence: { min: 0, max: 50 },
      formats: [],
      genres: [],
      publicationStatuses: [],
    },
  },
  {
    id: "manga-only",
    name: "Manga Only",
    description: "Exclude one-shots",
    icon: Book,
    filters: {
      confidence: { min: 0, max: 100 },
      formats: ["MANGA"],
      genres: [],
      publicationStatuses: [],
    },
  },
  {
    id: "ongoing",
    name: "Ongoing Series",
    description: "Currently releasing",
    icon: TrendingUp,
    filters: {
      confidence: { min: 0, max: 100 },
      formats: [],
      genres: [],
      publicationStatuses: ["RELEASING"],
    },
  },
];

/**
 * Advanced filter panel for manga matching results.
 * Provides filtering by confidence, format, genres, and publication status.
 */
export function AdvancedFilterPanel({
  filters,
  onFiltersChange,
  availableGenres,
  availableFormats,
  availableStatuses,
  matchCount,
}: Readonly<AdvancedFilterPanelProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");

  // Filter genres by search term
  const filteredGenres = useMemo(() => {
    if (!genreSearch.trim()) return availableGenres;
    const search = genreSearch.toLowerCase();
    return availableGenres.filter((genre) =>
      genre.toLowerCase().includes(search),
    );
  }, [availableGenres, genreSearch]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    const isDefaultConfidence =
      filters.confidence.min === 0 && filters.confidence.max === 100;
    return (
      (isDefaultConfidence ? 0 : 1) +
      filters.formats.length +
      filters.genres.length +
      filters.publicationStatuses.length
    );
  }, [filters]);

  // Handle confidence change
  const handleConfidenceChange = (value: { min: number; max: number }) => {
    onFiltersChange({ ...filters, confidence: value });
  };

  // Handle format toggle
  const handleFormatToggle = (format: string) => {
    const newFormats = filters.formats.includes(format)
      ? filters.formats.filter((f) => f !== format)
      : [...filters.formats, format];
    onFiltersChange({ ...filters, formats: newFormats });
  };

  // Handle genre toggle
  const handleGenreToggle = (genre: string) => {
    const newGenres = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre];
    onFiltersChange({ ...filters, genres: newGenres });
  };

  // Handle status toggle
  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.publicationStatuses.includes(status)
      ? filters.publicationStatuses.filter((s) => s !== status)
      : [...filters.publicationStatuses, status];
    onFiltersChange({ ...filters, publicationStatuses: newStatuses });
  };

  // Handle preset application
  const handlePresetApply = (preset: FilterPreset) => {
    onFiltersChange(preset.filters);
  };

  // Handle clear all filters
  const handleClearAll = () => {
    onFiltersChange({
      confidence: { min: 0, max: 100 },
      formats: [],
      genres: [],
      publicationStatuses: [],
    });
  };

  // Handle select/clear all genres
  const handleSelectAllGenres = () => {
    onFiltersChange({ ...filters, genres: availableGenres });
  };

  const handleClearAllGenres = () => {
    onFiltersChange({ ...filters, genres: [] });
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
                <CardDescription>Fine-tune your match results</CardDescription>
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
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle advanced filters</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Filter presets */}
          <div className="flex flex-wrap gap-2 pt-3">
            {FILTER_PRESETS.map((preset) => {
              const PresetIcon = preset.icon;
              return (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetApply(preset)}
                  className="h-7 gap-1.5 text-xs"
                  title={preset.description}
                >
                  <PresetIcon className="h-3 w-3" />
                  {preset.name}
                </Button>
              );
            })}
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
                value={filters.confidence}
                onChange={handleConfidenceChange}
              />
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

            {/* Publication Status Filter */}
            {availableStatuses.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Publication Status
                </div>
                <div className="space-y-2">
                  {availableStatuses.map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.publicationStatuses.includes(status)}
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
                onClick={handleClearAll}
                disabled={activeFilterCount === 0}
              >
                Clear All Filters
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
