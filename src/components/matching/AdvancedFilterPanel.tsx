import React, { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  Target,
  AlertCircle,
  Book,
  TrendingUp,
  ChevronRight,
  Star,
  Trash2,
  Save,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { RangeSlider } from "@/components/ui/slider";
import type {
  AdvancedMatchFilters,
  FilterPreset,
} from "@/types/matchingFilters";
import { formatLabel, statusLabel } from "./labels";

/**
 * Props for the AdvancedFilterPanel component.
 * @property filters - Current filter state.
 * @property onFiltersChange - Callback when filters are modified.
 * @property availableGenres - List of available genres to filter by.
 * @property availableFormats - List of available formats to filter by.
 * @property availableStatuses - List of available publication statuses to filter by.
 * @property availableTags - List of available tags to filter by.
 * @property yearRange - Min/max years in dataset.
 * @property matchCount - Total number of matches to display.
 * @property userPresets - User-created filter presets.
 * @property onSavePreset - Callback to save current filters as preset.
 * @property onApplyPreset - Callback to apply a preset.
 * @property onDeletePreset - Callback to delete a preset.
 * @source
 */
interface AdvancedFilterPanelProps {
  filters: AdvancedMatchFilters;
  onFiltersChange: (filters: AdvancedMatchFilters) => void;
  availableGenres: string[];
  availableFormats: string[];
  availableStatuses: string[];
  availableTags: string[];
  yearRange: { min: number | null; max: number | null };
  matchCount: number;
  userPresets: FilterPreset[];
  onSavePreset: (name: string, description?: string) => void;
  onApplyPreset: (preset: FilterPreset) => void;
  onDeletePreset: (presetId: string) => void;
}

/**
 * Built-in filter preset configuration for quick-apply filtering.
 * @property id - Unique identifier for the preset.
 * @property name - Display name of the preset.
 * @property description - Tooltip description of what the preset filters for.
 * @property icon - Icon component to display with the preset.
 * @property filters - Filter values to apply when selected.
 * @source
 */
interface BuiltInFilterPreset {
  id: string;
  name: string;
  description: string;
  icon: typeof Target;
  filters: AdvancedMatchFilters;
}

/**
 * Built-in filter presets for quick filtering of manga matches.
 * Includes presets for high confidence, low confidence, specific formats, and statuses.
 * @source
 */
const BUILT_IN_PRESETS: BuiltInFilterPreset[] = [
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
      yearRange: { min: null, max: null },
      tags: [],
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
      yearRange: { min: null, max: null },
      tags: [],
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
      yearRange: { min: null, max: null },
      tags: [],
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
      yearRange: { min: null, max: null },
      tags: [],
    },
  },
];

/**
 * Advanced filter panel for manga matching results.
 * Provides collapsible filtering by confidence score, format, genres, and publication status.
 * Includes preset filters and real-time genre search functionality.
 * @returns React component for advanced filtering UI.
 * @source
 */
export function AdvancedFilterPanel({
  filters,
  onFiltersChange,
  availableGenres,
  availableFormats,
  availableStatuses,
  availableTags,
  yearRange,
  matchCount,
  userPresets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: Readonly<AdvancedFilterPanelProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");

  // Memoize filtered genres to avoid recomputation on every render
  const filteredGenres = useMemo(() => {
    if (!genreSearch.trim()) return availableGenres;
    const search = genreSearch.toLowerCase();
    return availableGenres.filter((genre) =>
      genre.toLowerCase().includes(search),
    );
  }, [availableGenres, genreSearch]);

  // Memoize filtered tags to avoid recomputation on every render
  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return availableTags;
    const search = tagSearch.toLowerCase();
    return availableTags.filter((tag) => tag.toLowerCase().includes(search));
  }, [availableTags, tagSearch]);

  // Memoize active filter count for badge display
  const activeFilterCount = useMemo(() => {
    const isDefaultConfidence =
      filters.confidence.min === 0 && filters.confidence.max === 100;
    const hasYearRange =
      filters.yearRange &&
      (filters.yearRange.min !== null || filters.yearRange.max !== null);
    return (
      (isDefaultConfidence ? 0 : 1) +
      filters.formats.length +
      filters.genres.length +
      filters.publicationStatuses.length +
      (hasYearRange ? 1 : 0) +
      (filters.tags?.length || 0)
    );
  }, [filters]);

  // Handle confidence range change
  const handleConfidenceChange = (value: { min: number; max: number }) => {
    onFiltersChange({ ...filters, confidence: value });
  };

  // Add or remove format filter
  const handleFormatToggle = (format: string) => {
    const newFormats = filters.formats.includes(format)
      ? filters.formats.filter((f) => f !== format)
      : [...filters.formats, format];
    onFiltersChange({ ...filters, formats: newFormats });
  };

  // Add or remove genre filter
  const handleGenreToggle = (genre: string) => {
    const newGenres = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre];
    onFiltersChange({ ...filters, genres: newGenres });
  };

  // Add or remove publication status filter
  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.publicationStatuses.includes(status)
      ? filters.publicationStatuses.filter((s) => s !== status)
      : [...filters.publicationStatuses, status];
    onFiltersChange({ ...filters, publicationStatuses: newStatuses });
  };

  // Add or remove tag filter
  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  // Handle year range change
  const handleYearRangeChange = (min: number | null, max: number | null) => {
    onFiltersChange({ ...filters, yearRange: { min, max } });
  };

  // Apply built-in preset filter configuration
  const handleBuiltInPresetApply = (preset: BuiltInFilterPreset) => {
    onFiltersChange(preset.filters);
  };

  // Apply user preset
  const handleUserPresetApply = (preset: FilterPreset) => {
    onApplyPreset(preset);
  };

  // Save current filters as preset
  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset(presetName.trim(), presetDescription.trim() || undefined);
      setPresetName("");
      setPresetDescription("");
      setShowPresetDialog(false);
    }
  };

  // Delete preset with confirmation
  const handleDeletePreset = (presetId: string, presetName: string) => {
    if (globalThis.confirm(`Delete preset "${presetName}"?`)) {
      onDeletePreset(presetId);
    }
  };

  // Reset all filters to default state
  const handleClearAll = () => {
    onFiltersChange({
      confidence: { min: 0, max: 100 },
      formats: [],
      genres: [],
      publicationStatuses: [],
      yearRange: { min: null, max: null },
      tags: [],
    });
  };

  // Select all genres at once
  const handleSelectAllGenres = () => {
    onFiltersChange({ ...filters, genres: availableGenres });
  };

  // Deselect all genres
  const handleClearAllGenres = () => {
    onFiltersChange({ ...filters, genres: [] });
  };

  // Select all tags at once
  const handleSelectAllTags = () => {
    onFiltersChange({ ...filters, tags: availableTags });
  };

  // Deselect all tags
  const handleClearAllTags = () => {
    onFiltersChange({ ...filters, tags: [] });
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
                  <ChevronRight
                    className={`h-4 w-4 transform transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="sr-only">Toggle advanced filters</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Filter presets */}
          <div className="space-y-3 pt-3">
            {/* Built-in presets */}
            <div className="flex flex-wrap gap-2">
              {BUILT_IN_PRESETS.map((preset) => {
                const PresetIcon = preset.icon;
                return (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleBuiltInPresetApply(preset)}
                    className="h-7 gap-1.5 text-xs"
                    title={preset.description}
                  >
                    <PresetIcon className="h-3 w-3" />
                    {preset.name}
                  </Button>
                );
              })}
            </div>

            {/* User presets */}
            {userPresets.length > 0 && (
              <>
                <div className="border-t border-slate-200 dark:border-slate-700" />
                <div className="flex flex-wrap gap-2">
                  {userPresets.map((preset) => (
                    <div key={preset.id} className="group relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUserPresetApply(preset)}
                        className="h-7 gap-1.5 pr-8 text-xs"
                        title={preset.description || preset.name}
                      >
                        <Star className="h-3 w-3" />
                        {preset.name}
                      </Button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePreset(preset.id, preset.name);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200 group-hover:opacity-100 dark:hover:bg-slate-700"
                        aria-label={`Delete ${preset.name}`}
                      >
                        <Trash2 className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Save preset button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPresetDialog(true)}
              className="h-7 gap-1.5 text-xs"
            >
              <Save className="h-3 w-3" />
              Save Current Filters
            </Button>
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

            {/* Year Range Filter */}
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Publication Year
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Filter by year of publication
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="year-min"
                    className="mb-1 block text-xs text-slate-500 dark:text-slate-400"
                  >
                    From
                  </label>
                  <Input
                    id="year-min"
                    type="number"
                    min={yearRange.min || 1900}
                    max={yearRange.max || new Date().getFullYear()}
                    value={filters.yearRange?.min ?? ""}
                    onChange={(e) =>
                      handleYearRangeChange(
                        e.target.value
                          ? Number.parseInt(e.target.value, 10)
                          : null,
                        filters.yearRange?.max ?? null,
                      )
                    }
                    placeholder="Min"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="year-max"
                    className="mb-1 block text-xs text-slate-500 dark:text-slate-400"
                  >
                    To
                  </label>
                  <Input
                    id="year-max"
                    type="number"
                    min={yearRange.min || 1900}
                    max={yearRange.max || new Date().getFullYear()}
                    value={filters.yearRange?.max ?? ""}
                    onChange={(e) =>
                      handleYearRangeChange(
                        filters.yearRange?.min ?? null,
                        e.target.value
                          ? Number.parseInt(e.target.value, 10)
                          : null,
                      )
                    }
                    placeholder="Max"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              {(filters.yearRange?.min !== null ||
                filters.yearRange?.max !== null) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Showing: {filters.yearRange?.min || "Any"} -{" "}
                    {filters.yearRange?.max || "Any"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleYearRangeChange(null, null)}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              )}
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

            {/* Tags Filter */}
            {availableTags.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Tags
                    </div>
                    {(filters.tags?.length || 0) > 0 && (
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        ({filters.tags?.length || 0} selected)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllTags}
                      className="h-6 text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllTags}
                      className="h-6 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Tag search */}
                <Input
                  type="text"
                  placeholder="Search tags..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  className="h-8 text-sm"
                />

                {/* Tag list */}
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  {filteredTags.length > 0 ? (
                    filteredTags.map((tag) => (
                      <div key={tag} className="flex items-center gap-2">
                        <Checkbox
                          id={`tag-${tag}`}
                          checked={filters.tags?.includes(tag) || false}
                          onCheckedChange={() => handleTagToggle(tag)}
                        />
                        <label
                          htmlFor={`tag-${tag}`}
                          className="cursor-pointer text-sm text-slate-700 dark:text-slate-300"
                        >
                          {tag}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                      No tags found
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

      {/* Preset Save Dialog */}
      <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Save your current filter configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="preset-name"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Preset Name *
              </label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., High Quality Action"
                className="w-full"
              />
            </div>
            <div>
              <label
                htmlFor="preset-description"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Description (optional)
              </label>
              <Textarea
                id="preset-description"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                placeholder="Describe what this preset filters for..."
                rows={3}
                className="w-full resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPresetDialog(false);
                setPresetName("");
                setPresetDescription("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={!presetName.trim()}>
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
