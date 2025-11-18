/**
 * @packageDocumentation
 * @module DrillDownModal
 * @description Modal component for displaying detailed drill-down information when chart elements are clicked.
 */

import React, { useState, useMemo } from "react";
import { Download, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Label } from "@/components/ui/Label";
import type { DrillDownData } from "@/types/statistics";
import type { ExportFormat } from "@/utils/export-utils";

/**
 * Props for DrillDownModal component.
 * @source
 */
interface DrillDownModalProps {
  /** Controls whether the modal is visible. */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  drillDownData: DrillDownData | null;
  onExport?: (format: ExportFormat, rows: Record<string, unknown>[]) => void;
}

/**
 * Sort direction for table columns.
 * @source
 */
type SortDirection = "asc" | "desc" | null;

/**
 * Sortable column keys.
 * @source
 */
type SortableColumn = "title" | "chapters" | "status" | "confidence";

/**
 * DrillDownModal - Modal for displaying detailed breakdown of chart data.
 * Shows a sortable, searchable table with pagination.
 * @param props - Component props with modal state and drill-down data.
 * @returns Modal dialog with detailed data table.
 * @source
 */
export function DrillDownModal({
  isOpen,
  onOpenChange,
  drillDownData,
  onExport,
}: Readonly<DrillDownModalProps>): React.ReactElement {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
  const ITEMS_PER_PAGE = 50;

  // Filter and sort data
  const filteredDrillDownData = useMemo(() => {
    if (!drillDownData) return [];

    let filtered = drillDownData.data;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === undefined || bValue === undefined) return 0;

        let comparison = 0;
        if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [drillDownData, searchTerm, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredDrillDownData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredDrillDownData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Derive export rows from processed data (filtered and sorted)
  const drillDownExportRows = useMemo(() => {
    return filteredDrillDownData.map((item) => ({
      title: item.title,
      chapters: item.chapters,
      status: item.status,
      confidence: item.confidence ?? null,
      format: item.format ?? null,
    }));
  }, [filteredDrillDownData]);

  // Handle sort toggle
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchTerm("");
      setSortColumn(null);
      setSortDirection(null);
      setCurrentPage(1);
      setSelectedFormat("json");
    }
    onOpenChange(newOpen);
  };

  // Calculate summary stats
  const drillDownSummaryStats = useMemo(() => {
    if (!drillDownData) return null;

    const totalChapters = drillDownData.data.reduce(
      (sum, item) => sum + item.chapters,
      0,
    );
    const averageConfidence =
      drillDownData.data.reduce(
        (sum, item) => sum + (item.confidence ?? 0),
        0,
      ) / drillDownData.data.length;
    const statusBreakdown = drillDownData.data.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalChapters,
      averageConfidence: averageConfidence.toFixed(1),
      statusBreakdown,
    };
  }, [drillDownData]);

  if (!drillDownData) {
    return <></>;
  }

  const typeLabels: Record<DrillDownData["type"], string> = {
    genre: "Genre",
    format: "Format",
    status: "Status",
    date: "Date",
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {typeLabels[drillDownData.type]}: {drillDownData.value}
            </span>
            <Badge variant="secondary" className="ml-2">
              {drillDownData.data.length} manga
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Detailed breakdown of manga matching this filter
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        {drillDownSummaryStats && (
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Total Chapters
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                {drillDownSummaryStats.totalChapters.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Average Confidence
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                {drillDownSummaryStats.averageConfidence}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Status Breakdown
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(drillDownSummaryStats.statusBreakdown).map(
                  ([status, count]) => (
                    <Badge key={status} variant="outline" className="text-xs">
                      {status}: {count}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search and Export */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search manga titles..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport(selectedFormat, drillDownExportRows)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export as {selectedFormat.toUpperCase()}
              </Button>
            )}
          </div>

          {/* Format Selector */}
          {onExport && (
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">Export Format:</Label>
              <RadioGroup
                value={selectedFormat}
                onValueChange={(value) =>
                  setSelectedFormat(value as ExportFormat)
                }
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="json" id="format-json" />
                    <Label
                      htmlFor="format-json"
                      className="cursor-pointer text-sm font-normal"
                    >
                      JSON
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="csv" id="format-csv" />
                    <Label
                      htmlFor="format-csv"
                      className="cursor-pointer text-sm font-normal"
                    >
                      CSV
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="markdown" id="format-markdown" />
                    <Label
                      htmlFor="format-markdown"
                      className="cursor-pointer text-sm font-normal"
                    >
                      Markdown
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800">
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("title")}
                >
                  <div className="flex items-center gap-1">
                    Title
                    {sortColumn === "title" && (
                      <span className="text-xs">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("chapters")}
                >
                  <div className="flex items-center gap-1">
                    Chapters
                    {sortColumn === "chapters" && (
                      <span className="text-xs">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortColumn === "status" && (
                      <span className="text-xs">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("confidence")}
                >
                  <div className="flex items-center gap-1">
                    Confidence
                    {sortColumn === "confidence" && (
                      <span className="text-xs">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </TableHead>
                <TableHead>Format</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, index) => (
                  <TableRow key={`${item.title}-${index}`}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.chapters.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.confidence === undefined
                        ? "N/A"
                        : `${item.confidence.toFixed(0)}%`}
                    </TableCell>
                    <TableCell>{item.format || "N/A"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No manga found matching &quot;{searchTerm}&quot;
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Page {currentPage} of {totalPages} ({filteredDrillDownData.length}{" "}
              entries)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
