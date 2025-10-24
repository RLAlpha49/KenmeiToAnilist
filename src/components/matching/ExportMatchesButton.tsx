/**
 * @packageDocumentation
 * @module ExportMatchesButton
 * @description Export button component for match results with format and filter options.
 */

import React, { useMemo, useCallback, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  Wand2,
  Clock3,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { MangaMatchResult } from "../../api/anilist/types";
import {
  exportMatchResults,
  ExportFormat,
  ExportFilterOptions,
} from "../../utils/exportUtils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "../ui/dropdown-menu";

/**
 * Props for ExportMatchesButton component.
 * @source
 */
export interface ExportMatchesButtonProps {
  /** Array of match results to export */
  matches: MangaMatchResult[];
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg";
}

/**
 * Match status type for filtering.
 * @source
 */
type MatchStatusType = "matched" | "manual" | "pending" | "skipped";

/**
 * Checks if a match passes all filter criteria.
 *
 * @param match - The match result to check.
 * @param statusFilters - Selected status filters.
 * @param confidenceThreshold - Minimum confidence threshold.
 * @param includeUnmatched - Whether to include unmatched entries.
 * @param unmatchedOnly - Whether to export only unmatched entries.
 * @returns True if the match passes all filters.
 */
function matchPassesFilters(
  match: MangaMatchResult,
  statusFilters: Set<MatchStatusType>,
  confidenceThreshold: number | null,
  includeUnmatched: boolean,
  unmatchedOnly: boolean,
): boolean {
  // Check status filter
  if (!statusFilters.has(match.status as MatchStatusType)) {
    return false;
  }

  // Check confidence threshold
  if (confidenceThreshold !== null) {
    const highestConfidence =
      match.anilistMatches && match.anilistMatches.length > 0
        ? Math.max(...match.anilistMatches.map((m) => m.confidence))
        : 0;
    if (highestConfidence < confidenceThreshold) {
      return false;
    }
  }

  // Check unmatchedOnly filter (takes precedence over includeUnmatched)
  if (unmatchedOnly) {
    const isUnmatched =
      !match.selectedMatch &&
      (!match.anilistMatches || match.anilistMatches.length === 0);
    return isUnmatched;
  }

  // Check includeUnmatched filter
  if (!includeUnmatched) {
    const isMatched = !!(
      match.selectedMatch ||
      (match.anilistMatches && match.anilistMatches.length > 0)
    );
    return isMatched;
  }

  return true;
}

/**
 * Export button component with format and filter options for match results.
 * @source
 */
const ExportMatchesButtonComponent: React.FC<ExportMatchesButtonProps> = ({
  matches,
  disabled = false,
  variant = "outline",
  size = "default",
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");
  const [statusFilters, setStatusFilters] = useState<Set<MatchStatusType>>(
    new Set(["matched", "manual", "pending", "skipped"]),
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState<number | null>(
    null,
  );
  const [includeUnmatched, setIncludeUnmatched] = useState<boolean>(true);
  const [unmatchedOnly, setUnmatchedOnly] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts = {
      matched: 0,
      manual: 0,
      pending: 0,
      skipped: 0,
    };
    for (const match of matches) {
      if (match.status in counts) {
        counts[match.status as keyof typeof counts]++;
      }
    }
    return counts;
  }, [matches]);

  // Calculate filtered count
  const filteredCount = useMemo(() => {
    return matches.filter((match) =>
      matchPassesFilters(
        match,
        statusFilters,
        confidenceThreshold,
        includeUnmatched,
        unmatchedOnly,
      ),
    ).length;
  }, [matches, statusFilters, confidenceThreshold, includeUnmatched, unmatchedOnly]);

  const handleExport = useCallback(() => {
    try {
      const filters: ExportFilterOptions = {
        statusFilter:
          statusFilters.size > 0 ? Array.from(statusFilters) : undefined,
        confidenceThreshold: confidenceThreshold ?? undefined,
        includeUnmatched: unmatchedOnly ? undefined : includeUnmatched,
        unmatchedOnly: unmatchedOnly || undefined,
      };

      const filename = exportMatchResults(matches, selectedFormat, filters);
      toast.success(`Exported ${filteredCount} matches to ${filename}`);
      setDropdownOpen(false);
    } catch (error) {
      console.error("[ExportMatchesButton] Export failed:", error);
      toast.error("Failed to export match results");
    }
  }, [
    matches,
    selectedFormat,
    statusFilters,
    confidenceThreshold,
    includeUnmatched,
    unmatchedOnly,
    filteredCount,
  ]);

  const toggleStatusFilter = useCallback(
    (status: MatchStatusType) => {
      setStatusFilters((prev) => {
        const next = new Set(prev);
        if (next.has(status)) {
          next.delete(status);
        } else {
          next.add(status);
        }
        return next;
      });
    },
    [],
  );

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || matches.length === 0}
          aria-label="Export match results with filters"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          <span>Export Matches</span>
          {matches.length > 0 && (
            <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium">
              {matches.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Format Selection */}
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedFormat}
          onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
        >
          <DropdownMenuRadioItem value="json">
            <FileJson className="mr-2 h-4 w-4 text-blue-500" />
            JSON
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="csv">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" />
            CSV
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="excel">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
            Excel (.xlsx)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Status Filters */}
        <DropdownMenuLabel>Include Status</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={statusFilters.has("matched")}
          onCheckedChange={() => toggleStatusFilter("matched")}
          onSelect={(e) => e.preventDefault()}
        >
          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
          Matched
          <span className="ml-auto text-xs text-muted-foreground">
            {statusCounts.matched}
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilters.has("manual")}
          onCheckedChange={() => toggleStatusFilter("manual")}
          onSelect={(e) => e.preventDefault()}
        >
          <Wand2 className="mr-2 h-4 w-4 text-sky-500" />
          Manual
          <span className="ml-auto text-xs text-muted-foreground">
            {statusCounts.manual}
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilters.has("pending")}
          onCheckedChange={() => toggleStatusFilter("pending")}
          onSelect={(e) => e.preventDefault()}
        >
          <Clock3 className="mr-2 h-4 w-4 text-amber-500" />
          Pending
          <span className="ml-auto text-xs text-muted-foreground">
            {statusCounts.pending}
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilters.has("skipped")}
          onCheckedChange={() => toggleStatusFilter("skipped")}
          onSelect={(e) => e.preventDefault()}
        >
          <XCircle className="mr-2 h-4 w-4 text-rose-500" />
          Skipped
          <span className="ml-auto text-xs text-muted-foreground">
            {statusCounts.skipped}
          </span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Confidence Filter */}
        {(selectedFormat === "csv" || selectedFormat === "excel") && (
          <>
            <DropdownMenuLabel>Confidence Level</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={confidenceThreshold?.toString() ?? "0"}
              onValueChange={(value) =>
                setConfidenceThreshold(
                  value === "0" ? null : Number.parseInt(value, 10),
                )
              }
            >
              <DropdownMenuRadioItem value="0" onSelect={(e) => e.preventDefault()}>
                All
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="50" onSelect={(e) => e.preventDefault()}>
                &gt;50%
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="75" onSelect={(e) => e.preventDefault()}>
                &gt;75%
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="90" onSelect={(e) => e.preventDefault()}>
                &gt;90%
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Unmatched Filters */}
        <DropdownMenuCheckboxItem
          checked={unmatchedOnly}
          onCheckedChange={(checked) => {
            setUnmatchedOnly(checked);
            // When unmatchedOnly is enabled, disable includeUnmatched to avoid conflicts
            if (checked) {
              setIncludeUnmatched(true);
            }
          }}
          onSelect={(e) => e.preventDefault()}
        >
          Only unmatched entries
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={includeUnmatched}
          onCheckedChange={setIncludeUnmatched}
          onSelect={(e) => e.preventDefault()}
          disabled={unmatchedOnly}
        >
          Include unmatched entries
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Export Action */}
        <DropdownMenuItem
          onClick={handleExport}
          disabled={statusFilters.size === 0 || filteredCount === 0}
          className="cursor-pointer bg-primary/5 font-medium text-primary hover:bg-primary/10"
        >
          <Download className="mr-2 h-4 w-4" />
          Export {filteredCount} matches
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Memoized export button component for match results.
 * @source
 */
export const ExportMatchesButton = React.memo(ExportMatchesButtonComponent);
