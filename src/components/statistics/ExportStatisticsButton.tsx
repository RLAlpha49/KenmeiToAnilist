/**
 * @packageDocumentation
 * @module ExportStatisticsButton
 * @description Dropdown button that exports statistics data in JSON, CSV, or Excel formats with selectable sections.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  BarChart3,
  BarChart2,
  Activity,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import type { ImportStats, KenmeiManga } from "@/utils/storage";
import type { MangaMatch, MatchStatus } from "@/api/anilist/types";
import type { SyncStats } from "@/types/sync";
import {
  flattenMatchResult,
  exportToJson,
  exportToCSV,
  exportToExcel,
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

export type StatisticsExportFormat = "json" | "csv" | "excel";

/**
 * Minimal match result shape for export operations.
 */
type MinimalMatchResult = {
  readonly kenmeiManga: KenmeiManga;
  readonly anilistMatches?: MangaMatch[];
  readonly selectedMatch?: {
    readonly format?: string;
    readonly genres?: string[];
  };
  readonly status: MatchStatus;
  readonly matchDate?: Date;
};

interface ExportStatisticsButtonProps {
  /** Import statistics to include in the export payload. */
  readonly importStats: ImportStats | null;
  /** Sync statistics to include in the export payload. */
  readonly syncStats: SyncStats | null;
  /** Match results used for match-focused exports. */
  readonly matchResults: Array<MinimalMatchResult>;
  /** Optional flag to disable the button. */
  readonly disabled?: boolean;
  /** Optional button size override. */
  readonly size?: "default" | "sm" | "lg";
  /** Optional button variant override. */
  readonly variant?: "default" | "outline" | "ghost";
}

type ExportSection = "import" | "sync" | "matches";

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

function buildMatchRows(matches: Array<MinimalMatchResult>): ExportRow[] {
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
    const payload: Record<string, unknown> = {
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
  }, [importStats, syncStats, matchResults, sections]);

  const buildTabularRows = useCallback((): ExportRow[] => {
    const rows = buildSummaryRows(importStats, syncStats, sections);
    if (sections.has("matches") && matchResults.length > 0) {
      rows.push(...buildMatchRows(matchResults));
    }
    return rows;
  }, [importStats, syncStats, sections, matchResults]);

  const handleExport = useCallback(() => {
    if (sections.size === 0) {
      toast.error("Select at least one dataset to export");
      return;
    }

    try {
      if (format === "json") {
        const payload = buildJsonPayload();
        const file = exportToJson(payload, "statistics");
        toast.success(`Statistics exported to ${file}`);
        setOpen(false);
        return;
      }

      const rows = buildTabularRows();

      if (rows.length === 0) {
        toast.error("No data available for the selected export format");
        return;
      }

      const tabularData = rows as unknown as Record<string, unknown>[];
      const file =
        format === "csv"
          ? exportToCSV(tabularData, "statistics")
          : exportToExcel(tabularData, "statistics", "Statistics");

      toast.success(`Statistics exported to ${file}`);
      setOpen(false);
    } catch (error) {
      console.error("[ExportStatistics] ❌ Export failed", error);
      toast.error("Failed to export statistics");
    }
  }, [sections, format, buildJsonPayload, buildTabularRows]);

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
          <span>Export Statistics</span>
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
          <DropdownMenuRadioItem value="excel">
            <FileSpreadsheet
              className="mr-2 h-4 w-4 text-purple-500"
              aria-hidden="true"
            />
            Excel (.xlsx)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

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
