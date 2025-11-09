/**
 * @packageDocumentation
 * @module ExportStatisticsButton
 * @description Dropdown button that exports statistics data in JSON, CSV formats with selectable sections.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  BarChart3,
  BarChart2,
  Activity,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import type { ImportStats } from "@/utils/storage";
import type { SyncStats } from "@/types/sync";
import type { MatchForExport } from "@/types/matching";
import {
  flattenMatchResult,
  exportToJson,
  exportToCSV,
  exportToMarkdown,
  buildExportMetadata,
} from "@/utils/exportUtils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export type StatisticsExportFormat = "json" | "csv" | "markdown";

/**
 * Props for the ExportStatisticsButton component.
 * @source
 */
interface ExportStatisticsButtonProps {
  /** Import statistics to include in the export payload. */
  readonly importStats: ImportStats | null;
  /** Sync statistics to include in the export payload. */
  readonly syncStats: SyncStats | null;
  /** Match results used for match-focused exports. */
  readonly matchResults: Array<MatchForExport>;
  /** Optional flag to disable the button. */
  readonly disabled?: boolean;
  /** Optional button size override. */
  readonly size?: "default" | "sm" | "lg";
  /** Optional button variant override. */
  readonly variant?: "default" | "outline" | "ghost";
  /** Applied filters to include in export metadata. */
  readonly appliedFilters?: import("@/types/statistics").StatisticsFilters;
  /** Comparison mode state to include in export metadata. */
  readonly comparisonMode?: import("@/types/statistics").ComparisonMode;
  /** Flag indicating if data is filtered. */
  readonly isFiltered?: boolean;
}

/**
 * Export section identifier for filtering data subsets.
 * @source
 */
type ExportSection = "import" | "sync" | "matches";

/**
 * CSV export row structure combining metadata and data fields.
 * @source
 */
interface ExportRow {
  section: string;
  metric: string;
  value: string | number;
  kenmeiId?: number;
  kenmeiTitle?: string;
  status?: string;
  format?: string;
  genres?: string;
  chaptersRead?: number;
  confidence?: number;
}

/**
 * Builds export rows from import and sync statistics.
 * @param importStats - Import statistics object or null.
 * @param syncStats - Sync statistics object or null.
 * @param sections - Active sections to include in export.
 * @returns Array of export row objects with summary metrics.
 * @source
 */
function buildSummaryRows(
  importStats: ImportStats | null,
  syncStats: SyncStats | null,
  sections: Set<ExportSection>,
): ExportRow[] {
  const rows: ExportRow[] = [];

  if (sections.has("import") && importStats) {
    const statusRows = Object.entries(importStats.statusCounts).map(
      ([status, count]) => ({
        section: "Import Status",
        metric: status,
        value: count,
      }),
    );

    const metaRows: ExportRow[] = [
      {
        section: "Import Status",
        metric: "Total",
        value: importStats.total,
      },
      {
        section: "Import Status",
        metric: "Last Updated",
        value: importStats.timestamp,
      },
    ];

    rows.push(...statusRows, ...metaRows);
  }

  if (sections.has("sync") && syncStats) {
    const syncRows: ExportRow[] = [
      {
        section: "Sync Metrics",
        metric: "Entries Synced",
        value: syncStats.entriesSynced,
      },
      {
        section: "Sync Metrics",
        metric: "Failed Syncs",
        value: syncStats.failedSyncs,
      },
      {
        section: "Sync Metrics",
        metric: "Total Sync Runs",
        value: syncStats.totalSyncs,
      },
      {
        section: "Sync Metrics",
        metric: "Last Sync Time",
        value: syncStats.lastSyncTime ?? "Never",
      },
    ];

    rows.push(...syncRows);
  }

  return rows;
}

/**
 * Converts match results to export rows with flattened structure.
 * @param matches - Array of match result objects.
 * @returns Array of export row objects for each match.
 * @source
 */
function buildMatchRows(matches: Array<MatchForExport>): ExportRow[] {
  return matches.map((match) => {
    const flattened = flattenMatchResult(match);
    return {
      section: "Match Result",
      metric: flattened.kenmeiTitle,
      value: match.status,
      kenmeiId: flattened.kenmeiId,
      kenmeiTitle: flattened.kenmeiTitle,
      status: match.status,
      format: flattened.format,
      genres: flattened.genres,
      chaptersRead: flattened.chaptersRead,
      confidence: flattened.confidence,
    } satisfies ExportRow;
  });
}

/**
 * ExportStatisticsButton provides a dropdown-driven control for exporting statistics data.
 * Users can choose formats and which data sections to include.
 * @param props - Component props including data sources and configuration.
 * @returns Dropdown button element.
 * @source
 */
export function ExportStatisticsButton({
  importStats,
  syncStats,
  matchResults,
  disabled = false,
  size = "default",
  variant = "outline",
  appliedFilters,
  comparisonMode,
  isFiltered,
}: Readonly<ExportStatisticsButtonProps>) {
  const [format, setFormat] = useState<StatisticsExportFormat>("json");
  const [sections, setSections] = useState<Set<ExportSection>>(
    () => new Set<ExportSection>(["import", "sync", "matches"]),
  );
  const [open, setOpen] = useState(false);

  const matchCount = useMemo(() => matchResults.length, [matchResults]);

  const toggleSection = useCallback((section: ExportSection) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const buildJsonPayload = useCallback(() => {
    const baseMetadata = buildExportMetadata(
      "json",
      matchResults.length,
      undefined,
      Array.from(sections),
    );

    const enrichedMetadata = {
      ...baseMetadata,
      ...(appliedFilters && { filters: appliedFilters }),
      ...(comparisonMode?.enabled && { comparison: comparisonMode }),
      ...(isFiltered && { isFiltered: true }),
    };

    const payload: Record<string, unknown> = {
      metadata: enrichedMetadata,
      generatedAt: new Date().toISOString(),
    };

    if (sections.has("import") && importStats) {
      payload.importStats = importStats;
    }

    if (sections.has("sync") && syncStats) {
      payload.syncStats = syncStats;
    }

    if (sections.has("matches") && matchResults.length > 0) {
      payload.matchResults = matchResults;
    }

    return payload;
  }, [
    importStats,
    syncStats,
    matchResults,
    sections,
    appliedFilters,
    comparisonMode,
    isFiltered,
  ]);

  const buildTabularRows = useCallback((): ExportRow[] => {
    const rows = buildSummaryRows(importStats, syncStats, sections);
    if (sections.has("matches") && matchResults.length > 0) {
      rows.push(...buildMatchRows(matchResults));
    }
    return rows;
  }, [importStats, syncStats, sections, matchResults]);

  const handleExport = useCallback(async () => {
    if (sections.size === 0) {
      toast.error("Select at least one dataset to export");
      return;
    }

    try {
      const sectionArray = Array.from(sections);
      const totalEntries = matchResults.length;

      if (format === "json") {
        const payload = buildJsonPayload();
        const file = await exportToJson(payload, "statistics");
        toast.success(`Statistics exported to ${file}`);
        setOpen(false);
        return;
      }

      if (format === "markdown") {
        const baseMetadata = buildExportMetadata(
          "markdown",
          totalEntries,
          undefined,
          sectionArray,
        );

        // Build structured data for markdown sections
        const markdownData: Record<string, unknown> = {};

        // Include enriched metadata in the data structure for consumer reference
        if (appliedFilters) {
          markdownData.appliedFilters = appliedFilters;
        }
        if (comparisonMode?.enabled) {
          markdownData.comparisonMode = comparisonMode;
        }
        if (isFiltered) {
          markdownData.isFiltered = true;
        }

        if (sections.has("import") && importStats) {
          markdownData.importStats = importStats;
        }

        if (sections.has("sync") && syncStats) {
          markdownData.syncStats = syncStats;
        }

        if (sections.has("matches") && matchResults.length > 0) {
          const flattened = matchResults.map(flattenMatchResult);
          markdownData.matchResults = flattened;
        }

        const file = exportToMarkdown(markdownData, "statistics", baseMetadata);
        toast.success(`Statistics exported to ${file}`);
        setOpen(false);
        return;
      }

      const rows = buildTabularRows();

      if (rows.length === 0) {
        toast.error("No data available for the selected export format");
        return;
      }

      // Add metadata to CSV
      const baseMetadata = buildExportMetadata(
        "csv",
        totalEntries,
        undefined,
        sectionArray,
      );

      const enrichedMetadata = {
        ...baseMetadata,
        ...(appliedFilters && { filters: appliedFilters }),
        ...(comparisonMode?.enabled && { comparison: comparisonMode }),
        ...(isFiltered && { isFiltered: true }),
      };

      const withMetadata = [
        { comment: `Exported: ${enrichedMetadata.exportedAt}` },
        { comment: `App Version: v${enrichedMetadata.appVersion}` },
        { comment: `Sections: ${sectionArray.join(", ")}` },
        ...(appliedFilters
          ? [
              { comment: "" },
              { comment: "Filters Applied:" },
              {
                comment:
                  appliedFilters.genres.length > 0
                    ? `  Genres: ${appliedFilters.genres.join(", ")}`
                    : "  Genres: None",
              },
              {
                comment:
                  appliedFilters.formats.length > 0
                    ? `  Formats: ${appliedFilters.formats.join(", ")}`
                    : "  Formats: None",
              },
              {
                comment:
                  appliedFilters.statuses.length > 0
                    ? `  Statuses: ${appliedFilters.statuses.join(", ")}`
                    : "  Statuses: None",
              },
              {
                comment:
                  appliedFilters.dateRange.start || appliedFilters.dateRange.end
                    ? `  Date Range: ${appliedFilters.dateRange.start?.toISOString().split("T")[0] ?? "N/A"} to ${appliedFilters.dateRange.end?.toISOString().split("T")[0] ?? "N/A"}`
                    : "  Date Range: None",
              },
              {
                comment: `  Confidence: ${appliedFilters.confidenceRange.min} - ${appliedFilters.confidenceRange.max}`,
              },
            ]
          : []),
        ...(comparisonMode?.enabled
          ? [
              { comment: "" },
              { comment: "Comparison Mode:" },
              { comment: `  Primary Range: ${comparisonMode.primaryRange}` },
              {
                comment: `  Secondary Range: ${comparisonMode.secondaryRange}`,
              },
              { comment: `  Metric: ${comparisonMode.metric}` },
            ]
          : []),
        { comment: "" },
        ...rows,
      ];

      const tabularData = withMetadata as unknown as Record<string, unknown>[];
      const file = await exportToCSV(tabularData, "statistics");

      toast.success(`Statistics exported to ${file}`);
      setOpen(false);
    } catch (error) {
      console.error("[ExportStatistics] ❌ Export failed", error);
      toast.error("Failed to export statistics");
    }
  }, [
    sections,
    format,
    buildJsonPayload,
    buildTabularRows,
    matchResults,
    importStats,
    syncStats,
  ]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          className="gap-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>
            {isFiltered ? "Export Filtered Statistics" : "Export Statistics"}
          </span>
          <span className="text-muted-foreground text-xs font-medium">
            {sections.size} dataset{sections.size === 1 ? "" : "s"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500" aria-hidden="true" />
          Export Options
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={format}
          onValueChange={(value) => setFormat(value as StatisticsExportFormat)}
        >
          <DropdownMenuRadioItem value="json">
            <FileJson
              className="mr-2 h-4 w-4 text-emerald-500"
              aria-hidden="true"
            />
            JSON
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="csv">
            <FileSpreadsheet
              className="mr-2 h-4 w-4 text-blue-500"
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

        {/* Filter Summary Section */}
        {isFiltered && appliedFilters && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs">
              <span className="font-medium">Applied Filters</span>
            </DropdownMenuLabel>
            {appliedFilters.genres.length > 0 && (
              <div className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400">
                Genres: {appliedFilters.genres.join(", ")}
              </div>
            )}
            {appliedFilters.formats.length > 0 && (
              <div className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400">
                Formats: {appliedFilters.formats.join(", ")}
              </div>
            )}
            {appliedFilters.statuses.length > 0 && (
              <div className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400">
                Statuses: {appliedFilters.statuses.join(", ")}
              </div>
            )}
            {(appliedFilters.dateRange.start ||
              appliedFilters.dateRange.end) && (
              <div className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400">
                Date Range:{" "}
                {appliedFilters.dateRange.start?.toISOString().split("T")[0] ??
                  "N/A"}{" "}
                to{" "}
                {appliedFilters.dateRange.end?.toISOString().split("T")[0] ??
                  "N/A"}
              </div>
            )}
            {(appliedFilters.confidenceRange.min > 0 ||
              appliedFilters.confidenceRange.max < 100) && (
              <div className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400">
                Confidence: {appliedFilters.confidenceRange.min} -{" "}
                {appliedFilters.confidenceRange.max}
              </div>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Include Sections
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={sections.has("import")}
          onCheckedChange={() => toggleSection("import")}
        >
          <BarChart2
            className="mr-2 h-4 w-4 text-blue-500"
            aria-hidden="true"
          />
          Import statistics
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={sections.has("sync")}
          onCheckedChange={() => toggleSection("sync")}
        >
          <Activity
            className="mr-2 h-4 w-4 text-emerald-500"
            aria-hidden="true"
          />
          Sync performance
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={sections.has("matches")}
          onCheckedChange={() => toggleSection("matches")}
          disabled={matchCount === 0}
        >
          <BarChart3
            className="mr-2 h-4 w-4 text-purple-500"
            aria-hidden="true"
          />
          Match results
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleExport}
          className="bg-primary/5 text-primary hover:bg-primary/10 cursor-pointer font-medium"
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export now
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
