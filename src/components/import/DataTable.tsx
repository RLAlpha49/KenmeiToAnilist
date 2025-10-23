/**
 * @packageDocumentation
 * @module DataTable
 * @description Displays a paginated, scrollable table of Kenmei manga items with status badges and load more functionality.
 */
import React, { useState, useEffect, useRef } from "react";
import { KenmeiMangaItem } from "../../types/kenmei";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Loader2, ChevronDown } from "lucide-react";

/**
 * Props for the DataTable component.
 *
 * @property data - Array of KenmeiMangaItem objects to display in the table
 * @property itemsPerPage - Optional number of items to show per page (default: 50)
 * @property isLoading - Optional flag to display skeleton rows during initial data load
 *
 * @internal
 * @source
 */
export interface DataTableProps {
  data: KenmeiMangaItem[];
  itemsPerPage?: number;
  isLoading?: boolean;
}

/**
 * Renders a paginated table of manga items with load-more functionality.
 * Displays columns based on available data: title, status, chapters, volumes, score, last read.
 * Shows skeleton rows when loading initial data.
 * @param props - Table configuration including data and items per page.
 * @returns Table component with pagination support.
 * @source
 */
export function DataTable({
  data,
  itemsPerPage = 50,
  isLoading = false,
}: Readonly<DataTableProps>) {
  const [visibleData, setVisibleData] = useState<KenmeiMangaItem[]>([]);
  const [displayCount, setDisplayCount] = useState(itemsPerPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleData(data.slice(0, displayCount));
  }, [data, displayCount]);

  useEffect(() => {
    setDisplayCount(itemsPerPage);
    setVisibleData(data.slice(0, itemsPerPage));
  }, [data, itemsPerPage]);

  /**
   * Loads additional manga items with simulated delay for better UX.
   * Scrolls to the bottom of the scroll area after loading completes.
   * @source
   */
  const handleLoadMore = () => {
    if (displayCount < data.length) {
      setIsLoadingMore(true);

      // Simulate delay for smoother UX
      setTimeout(() => {
        setDisplayCount((prev) => Math.min(prev + itemsPerPage, data.length));
        setIsLoadingMore(false);

        // Scroll to bottom after new items are loaded
        if (scrollAreaRef.current) {
          const scrollViewport = scrollAreaRef.current.querySelector(
            "[data-radix-scroll-area-viewport]",
          );
          if (scrollViewport) {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
          }
        }
      }, 300);
    }
  };

  // Determine which optional columns to display based on data presence
  const hasScore = data.some(
    (item) => item.score !== undefined && item.score > 0,
  );
  const hasChapters = data.some(
    (item) => item.chapters_read !== undefined && item.chapters_read > 0,
  );
  const hasVolumes = data.some(
    (item) => item.volumes_read !== undefined && item.volumes_read > 0,
  );
  const hasLastRead = data.some((item) => item.updated_at || item.created_at);

  /**
   * Formats an ISO date string into a localized date string.
   * @param dateString - ISO date string to format, or undefined.
   * @returns Localized date string, or "-" if dateString is invalid/undefined.
   * @source
   */
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return "-";
    }
  };

  /**
   * Returns a styled Badge component for the given manga status.
   * @param status - The manga status string.
   * @returns Badge component with appropriate styling and label.
   * @source
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reading":
        return (
          <Badge
            variant="outline"
            className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400"
          >
            {status.replaceAll("_", " ")}
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            {status.replaceAll("_", " ")}
          </Badge>
        );
      case "on_hold":
        return (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          >
            {status.replaceAll("_", " ")}
          </Badge>
        );
      case "dropped":
        return (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-100 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
          >
            {status.replaceAll("_", " ")}
          </Badge>
        );
      case "plan_to_read":
        return (
          <Badge
            variant="outline"
            className="border-purple-200 bg-purple-100 text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
          >
            {status.replaceAll("_", " ")}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
          >
            {status.replaceAll("_", " ")}
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-md border" aria-busy={isLoading}>
      <ScrollArea ref={scrollAreaRef} className="h-[500px] rounded-md">
        <Table>
          <TableCaption>
            Showing {visibleData.length} of {data.length} entries
          </TableCaption>

          <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-[45%] min-w-[200px]">Title</TableHead>
              <TableHead>Status</TableHead>

              {hasChapters && <TableHead className="w-20">Ch</TableHead>}
              {hasVolumes && <TableHead className="w-20">Vol</TableHead>}
              {hasScore && <TableHead className="w-20">Score</TableHead>}

              {hasLastRead && (
                <TableHead className="w-[120px]">Last Read</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading || isLoadingMore
              ? // Render skeleton rows during loading, regardless of data presence
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={`skeleton-row-${index + 1}`}>
                    <TableCell className="max-w-[300px] truncate">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    {hasChapters && (
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                    )}
                    {hasVolumes && (
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                    )}
                    {hasScore && (
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                    )}
                    {hasLastRead && (
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              : visibleData.map((item) => (
                  <TableRow
                    key={`${item.title}-${item.status}-${item.updated_at ?? item.created_at}`}
                    className="hover:bg-muted/40"
                  >
                    <TableCell
                      className="max-w-[300px] truncate font-medium"
                      title={item.title}
                    >
                      {item.title}
                    </TableCell>

                    <TableCell>{getStatusBadge(item.status)}</TableCell>

                    {hasChapters && (
                      <TableCell className="text-muted-foreground">
                        {item.chapters_read || "-"}
                      </TableCell>
                    )}

                    {hasVolumes && (
                      <TableCell className="text-muted-foreground">
                        {item.volumes_read || "-"}
                      </TableCell>
                    )}

                    {hasScore && (
                      <TableCell className="text-muted-foreground">
                        {item.score ? item.score.toFixed(1) : "-"}
                      </TableCell>
                    )}

                    {hasLastRead && (
                      <TableCell
                        className="text-muted-foreground"
                        title={item.updated_at || item.created_at}
                      >
                        {formatDate(item.updated_at || item.created_at)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}

            {/* Display empty state when no items are visible and not loading */}
            {visibleData.length === 0 && !isLoading && (
              <TableRow>
                <TableCell
                  colSpan={
                    2 +
                    (hasChapters ? 1 : 0) +
                    (hasVolumes ? 1 : 0) +
                    (hasScore ? 1 : 0) +
                    (hasLastRead ? 1 : 0)
                  }
                  className="h-24 text-center"
                >
                  No manga entries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Load more button */}
      {visibleData.length < data.length && (
        <div className="flex justify-center border-t p-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoading || isLoadingMore}
            aria-disabled={isLoading || isLoadingMore}
            className="w-full max-w-xs"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Load More ({data.length - visibleData.length} remaining)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
