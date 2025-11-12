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
  EXPORT_TEMPLATES,
  EXPORTABLE_FIELDS,
  type ExportableFieldId,
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
 * @property matches - Array of match results to export.
 * @property disabled - Whether the button is disabled.
 * @property variant - Button style variant.
 * @property size - Button size.
 * @source
 */
export interface ExportMatchesButtonProps {
  matches: MangaMatchResult[];
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

/**
 * Match status type for filtering export results.
 * @source
 */
type MatchStatusType = "matched" | "manual" | "pending" | "skipped";

/**
 * Determines aria-describedby value for export button based on filter state.
 * @param statusFiltersSize - Number of selected statuses.
 * @param filteredCount - Number of matches after filtering.
 * @returns aria-describedby ID or undefined.
 * @source
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
 * Export button with dropdown menu for format and filter options on match results.
 * Uses matchPassesFilter helper to ensure preview count matches actual export count.
 * @param props - Component props.
 * @returns Dropdown button for exporting match results.
 * @source
 */
const ExportMatchesButtonComponent: React.FC<ExportMatchesButtonProps> = ({
  matches,
  disabled = false,
  variant = "outline",
  size = "default",
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<Set<MatchStatusType>>(
    new Set(["matched", "manual", "pending", "skipped"]),
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState<number | null>(
    null,
  );
  const [includeUnmatched, setIncludeUnmatched] = useState<boolean>(true);
  const [unmatchedOnly, setUnmatchedOnly] = useState<boolean>(false);
  const [selectedFields, setSelectedFields] = useState<Set<ExportableFieldId>>(
    new Set(EXPORTABLE_FIELDS.map((f) => f.id)),
  );
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
        fields:
          selectedFields.size > 0 &&
          selectedFields.size < EXPORTABLE_FIELDS.length
            ? Array.from(selectedFields)
            : undefined,
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
    selectedFields,
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

  const toggleField = useCallback((fieldId: ExportableFieldId) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  const selectAllFields = useCallback(() => {
    setSelectedFields(new Set(EXPORTABLE_FIELDS.map((f) => f.id)));
  }, []);

  const clearAllFields = useCallback(() => {
    setSelectedFields(new Set());
  }, []);

  const applyTemplate = useCallback((templateKey: string) => {
    // Empty string means "Custom" - just clear the template selection
    if (templateKey === "") {
      setSelectedTemplate(null);
      return;
    }

    const template =
      EXPORT_TEMPLATES[templateKey as keyof typeof EXPORT_TEMPLATES];
    if (!template) return;

    setSelectedTemplate(templateKey);

    // Apply template filters
    if (template.filters.statusFilter) {
      setStatusFilters(new Set(template.filters.statusFilter));
    }
    if (
      template.filters.confidenceThreshold !== undefined &&
      template.filters.confidenceThreshold !== null
    ) {
      setConfidenceThreshold(template.filters.confidenceThreshold);
    } else {
      setConfidenceThreshold(null);
    }
    setIncludeUnmatched(template.filters.includeUnmatched ?? true);
    setUnmatchedOnly(template.filters.unmatchedOnly ?? false);
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
      <DropdownMenuContent
        align="end"
        className="max-h-[50vh] w-64 overflow-y-auto"
      >
        {/* Status Filters Help Text */}
        {statusFilters.size === 0 && (
          <>
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              ⚠️ Select at least one status to export
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Quick Templates */}
        <DropdownMenuLabel>Quick Templates</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedTemplate || ""}
          onValueChange={applyTemplate}
        >
          <DropdownMenuRadioItem value="" onSelect={(e) => e.preventDefault()}>
            <div className="mr-2 h-4 w-4" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm">Custom</p>
              <p className="text-muted-foreground text-xs">
                Use current filter settings
              </p>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="ALL"
            onSelect={(e) => e.preventDefault()}
          >
            <Wand2 className="mr-2 h-4 w-4 text-amber-500" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm">All Matches</p>
              <p className="text-muted-foreground text-xs">
                Export all results without filters
              </p>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="MATCHED_ONLY"
            onSelect={(e) => e.preventDefault()}
          >
            <CheckCircle2
              className="mr-2 h-4 w-4 text-emerald-500"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm">Matched Only</p>
              <p className="text-muted-foreground text-xs">
                Only successfully matched entries
              </p>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="PENDING_ONLY"
            onSelect={(e) => e.preventDefault()}
          >
            <Clock3
              className="mr-2 h-4 w-4 text-amber-500"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm">Pending Only</p>
              <p className="text-muted-foreground text-xs">
                Only pending matches for review
              </p>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="UNMATCHED_ONLY"
            onSelect={(e) => e.preventDefault()}
          >
            <XCircle
              className="mr-2 h-4 w-4 text-rose-500"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm">Unmatched Only</p>
              <p className="text-muted-foreground text-xs">
                Only entries without matches
              </p>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="HIGH_CONFIDENCE"
            onSelect={(e) => e.preventDefault()}
          >
            <CheckCircle2
              className="mr-2 h-4 w-4 text-blue-500"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm">High Confidence (&gt;75%)</p>
              <p className="text-muted-foreground text-xs">
                Only high-confidence matches
              </p>
            </div>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

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

        {/* Fields Selection for CSV/Markdown/JSON */}
        {(selectedFormat === "csv" ||
          selectedFormat === "markdown" ||
          selectedFormat === "json") && (
          <>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Export Fields</span>
              <span className="text-muted-foreground text-xs">
                {selectedFields.size}/{EXPORTABLE_FIELDS.length}
              </span>
            </DropdownMenuLabel>

            {/* Fields grouped by category */}
            {Array.from(new Set(EXPORTABLE_FIELDS.map((f) => f.group))).map(
              (group) => (
                <div key={group}>
                  <div className="text-muted-foreground px-2 py-1 text-xs font-semibold">
                    {group}
                  </div>
                  {EXPORTABLE_FIELDS.filter((f) => f.group === group).map(
                    (field) => (
                      <DropdownMenuCheckboxItem
                        key={field.id}
                        checked={selectedFields.has(field.id)}
                        onCheckedChange={() => toggleField(field.id)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <span className="text-sm">{field.label}</span>
                      </DropdownMenuCheckboxItem>
                    ),
                  )}
                </div>
              ),
            )}

            {/* Bulk field actions */}
            <DropdownMenuSeparator />
            <div className="space-x-1 px-2 py-1.5">
              <button
                onClick={selectAllFields}
                className="inline-block rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
              >
                All
              </button>
              <button
                onClick={clearAllFields}
                className="inline-block rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                None
              </button>
            </div>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuSeparator />
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
 * Memoized export button component to prevent unnecessary re-renders.
 * @source
 */
export const ExportMatchesButton = React.memo(ExportMatchesButtonComponent);
