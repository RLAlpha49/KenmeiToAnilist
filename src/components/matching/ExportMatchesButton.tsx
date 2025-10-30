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
  FileText,
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
  matchPassesFilter,
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
 * Get aria-describedby value for export button based on filter state.
 * @param statusFiltersSize Number of selected statuses
 * @param filteredCount Number of matches after filtering
 * @returns aria-describedby ID or undefined
 */
function getExportDescription(
  statusFiltersSize: number,
  filteredCount: number,
): string | undefined {
  if (statusFiltersSize === 0) return "export-no-status-description";
  if (filteredCount === 0) return "export-no-results-description";
  return undefined;
}

/**
 * Export button component with format and filter options for match results.
 *
 * Uses the shared matchPassesFilter helper from exportUtils to ensure
 * the preview count always matches the actual export count.
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

  // Calculate filtered count using the shared helper
  // This ensures the preview count matches the actual export count
  const filteredCount = useMemo(() => {
    return matches.filter((match) =>
      matchPassesFilter(
        match,
        statusFilters,
        confidenceThreshold,
        includeUnmatched,
        unmatchedOnly,
      ),
    ).length;
  }, [
    matches,
    statusFilters,
    confidenceThreshold,
    includeUnmatched,
    unmatchedOnly,
  ]);

  const handleExport = useCallback(async () => {
    try {
      const filters: ExportFilterOptions = {
        statusFilter:
          statusFilters.size > 0 ? Array.from(statusFilters) : undefined,
        confidenceThreshold: confidenceThreshold ?? undefined,
        includeUnmatched: unmatchedOnly ? undefined : includeUnmatched,
        unmatchedOnly: unmatchedOnly || undefined,
      };

      const filename = await exportMatchResults(
        matches,
        selectedFormat,
        filters,
      );
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

  const toggleStatusFilter = useCallback((status: MatchStatusType) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

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
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>Export Matches</span>
          {matches.length > 0 && (
            <span className="bg-primary/10 ml-1 rounded px-1.5 py-0.5 text-xs font-medium">
              {matches.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Status Filters Help Text */}
        {statusFilters.size === 0 && (
          <>
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              ⚠️ Select at least one status to export
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Format Selection */}
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedFormat}
          onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
        >
          <DropdownMenuRadioItem value="json">
            <FileJson
              className="mr-2 h-4 w-4 text-blue-500"
              aria-hidden="true"
            />
            JSON
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="csv">
            <FileSpreadsheet
              className="mr-2 h-4 w-4 text-emerald-500"
              aria-hidden="true"
            />
            CSV
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="markdown">
            <FileText
              className="mr-2 h-4 w-4 text-purple-500"
              aria-hidden="true"
            />
            Markdown
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
          <CheckCircle2
            className="mr-2 h-4 w-4 text-emerald-500"
            aria-hidden="true"
          />
          Matched
          <span className="text-muted-foreground ml-auto text-xs">
            {statusCounts.matched}
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilters.has("manual")}
          onCheckedChange={() => toggleStatusFilter("manual")}
          onSelect={(e) => e.preventDefault()}
        >
          <Wand2 className="mr-2 h-4 w-4 text-sky-500" aria-hidden="true" />
          Manual
          <span className="text-muted-foreground ml-auto text-xs">
            {statusCounts.manual}
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilters.has("pending")}
          onCheckedChange={() => toggleStatusFilter("pending")}
          onSelect={(e) => e.preventDefault()}
        >
          <Clock3 className="mr-2 h-4 w-4 text-amber-500" aria-hidden="true" />
          Pending
          <span className="text-muted-foreground ml-auto text-xs">
            {statusCounts.pending}
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilters.has("skipped")}
          onCheckedChange={() => toggleStatusFilter("skipped")}
          onSelect={(e) => e.preventDefault()}
        >
          <XCircle className="mr-2 h-4 w-4 text-rose-500" aria-hidden="true" />
          Skipped
          <span className="text-muted-foreground ml-auto text-xs">
            {statusCounts.skipped}
          </span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Confidence Filter */}
        {selectedFormat === "csv" && (
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
              <DropdownMenuRadioItem
                value="0"
                onSelect={(e) => e.preventDefault()}
              >
                All
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="50"
                onSelect={(e) => e.preventDefault()}
              >
                &gt;50%
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="75"
                onSelect={(e) => e.preventDefault()}
              >
                &gt;75%
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="90"
                onSelect={(e) => e.preventDefault()}
              >
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
            // When unmatchedOnly is enabled, includeUnmatched is forced to true and its control is disabled
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
        {statusFilters.size === 0 && (
          <output
            id="export-no-status-description"
            className="block px-2 py-1.5 text-xs text-amber-600 dark:text-amber-500"
            aria-live="polite"
          >
            Select at least one status to enable export
          </output>
        )}

        {filteredCount === 0 && statusFilters.size > 0 && (
          <output
            id="export-no-results-description"
            className="block px-2 py-1.5 text-xs text-amber-600 dark:text-amber-500"
            aria-live="polite"
          >
            No matches match the current filters
          </output>
        )}

        <DropdownMenuItem
          onClick={handleExport}
          disabled={statusFilters.size === 0 || filteredCount === 0}
          className="bg-primary/5 text-primary hover:bg-primary/10 cursor-pointer font-medium"
          aria-describedby={getExportDescription(
            statusFilters.size,
            filteredCount,
          )}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
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
