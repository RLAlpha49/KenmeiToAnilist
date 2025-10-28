import React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdvancedMatchFilters } from "@/types/matchingFilters";
import { formatLabel, statusLabel } from "./labels";

/**
 * Props for the FilterChips component.
 */
interface FilterChipsProps {
  filters: AdvancedMatchFilters;
  onRemoveFilter: (
    filterType: "confidence" | "format" | "genre" | "status",
    value?: string,
  ) => void;
  onClearAll: () => void;
}

/**
 * Display active filters as removable chips/badges.
 * Shows confidence range, formats, genres, and publication statuses.
 */
export function FilterChips({
  filters,
  onRemoveFilter,
  onClearAll,
}: Readonly<FilterChipsProps>) {
  // Check if confidence is at defaultReadonly<FilterChipsProps>
  const isDefaultConfidence =
    filters.confidence.min === 0 && filters.confidence.max === 100;

  // Calculate total active filter count
  const activeFilterCount =
    (isDefaultConfidence ? 0 : 1) +
    filters.formats.length +
    filters.genres.length +
    filters.publicationStatuses.length;

  // Don't render if no active filters
  if (activeFilterCount === 0) {
    return null;
  }

  // Limit displayed genres to first 5
  const displayedGenres = filters.genres.slice(0, 5);
  const remainingGenresCount = filters.genres.length - displayedGenres.length;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/30">
      <div className="flex flex-wrap items-center gap-2">
        {/* Confidence Chip */}
        {!isDefaultConfidence && (
          <Badge
            variant="secondary"
            className="gap-1.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
          >
            <span>
              Confidence: {filters.confidence.min}%-{filters.confidence.max}%
            </span>
            <button
              type="button"
              onClick={() => onRemoveFilter("confidence")}
              aria-label="Remove confidence filter"
              className="rounded-full p-0.5 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800/60"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        {/* Format Chips */}
        {filters.formats.map((format) => (
          <Badge
            key={format}
            variant="secondary"
            className="gap-1.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
          >
            <span>{formatLabel(format)}</span>
            <button
              type="button"
              onClick={() => onRemoveFilter("format", format)}
              aria-label={`Remove ${formatLabel(format)} format filter`}
              className="rounded-full p-0.5 transition-colors hover:bg-green-200 dark:hover:bg-green-800/60"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Genre Chips */}
        {displayedGenres.map((genre) => (
          <Badge
            key={genre}
            variant="secondary"
            className="gap-1.5 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
          >
            <span>{genre}</span>
            <button
              type="button"
              onClick={() => onRemoveFilter("genre", genre)}
              aria-label={`Remove ${genre} genre filter`}
              className="rounded-full p-0.5 transition-colors hover:bg-purple-200 dark:hover:bg-purple-800/60"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Remaining genres badge */}
        {remainingGenresCount > 0 && (
          <Badge
            variant="secondary"
            className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
          >
            +{remainingGenresCount} more
          </Badge>
        )}

        {/* Status Chips */}
        {filters.publicationStatuses.map((status) => (
          <Badge
            key={status}
            variant="secondary"
            className="gap-1.5 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60"
          >
            <span>{statusLabel(status)}</span>
            <button
              type="button"
              onClick={() => onRemoveFilter("status", status)}
              aria-label={`Remove ${statusLabel(status)} status filter`}
              className="rounded-full p-0.5 transition-colors hover:bg-orange-200 dark:hover:bg-orange-800/60"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Clear All Button */}
        {activeFilterCount >= 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="ml-auto h-7 text-xs"
          >
            Clear All Filters
          </Button>
        )}
      </div>
    </div>
  );
}
