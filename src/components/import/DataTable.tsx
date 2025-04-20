import React, { useState, useEffect } from "react";
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
import { Loader2, ChevronDown } from "lucide-react";

interface DataTableProps {
  data: KenmeiMangaItem[];
  itemsPerPage?: number;
}

export function DataTable({ data, itemsPerPage = 50 }: DataTableProps) {
  const [visibleData, setVisibleData] = useState<KenmeiMangaItem[]>([]);
  const [displayCount, setDisplayCount] = useState(itemsPerPage);
  const [isLoading, setIsLoading] = useState(false);

  // Update visible data when display count changes
  useEffect(() => {
    setVisibleData(data.slice(0, displayCount));
  }, [data, displayCount]);

  // Reset when data changes
  useEffect(() => {
    setDisplayCount(itemsPerPage);
    setVisibleData(data.slice(0, itemsPerPage));
  }, [data, itemsPerPage]);

  // Load more items
  const handleLoadMore = () => {
    if (displayCount < data.length) {
      setIsLoading(true);

      // Use setTimeout to give a small delay for better UX
      setTimeout(() => {
        // Don't exceed the original data length
        setDisplayCount((prev) => Math.min(prev + itemsPerPage, data.length));
        setIsLoading(false);
      }, 300);
    }
  };

  // Determine which columns to show based on data
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

  // Format date to a readable format
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return "-";
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reading":
        return (
          <Badge
            variant="outline"
            className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400"
          >
            {status.replace(/_/g, " ")}
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            {status.replace(/_/g, " ")}
          </Badge>
        );
      case "on_hold":
        return (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          >
            {status.replace(/_/g, " ")}
          </Badge>
        );
      case "dropped":
        return (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-100 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
          >
            {status.replace(/_/g, " ")}
          </Badge>
        );
      case "plan_to_read":
        return (
          <Badge
            variant="outline"
            className="border-purple-200 bg-purple-100 text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
          >
            {status.replace(/_/g, " ")}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
          >
            {status.replace(/_/g, " ")}
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-md border">
      <ScrollArea className="h-[500px] rounded-md">
        <Table>
          <TableCaption>
            Showing {visibleData.length} of {data.length} entries
          </TableCaption>

          <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-[45%] min-w-[200px]">Title</TableHead>
              <TableHead>Status</TableHead>

              {hasChapters && <TableHead className="w-[80px]">Ch</TableHead>}
              {hasVolumes && <TableHead className="w-[80px]">Vol</TableHead>}
              {hasScore && <TableHead className="w-[80px]">Score</TableHead>}

              {hasLastRead && (
                <TableHead className="w-[120px]">Last Read</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleData.map((item, index) => (
              <TableRow key={index} className="hover:bg-muted/40">
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

            {/* Empty state if no items */}
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
            disabled={isLoading}
            className="w-full max-w-xs"
          >
            {isLoading ? (
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
