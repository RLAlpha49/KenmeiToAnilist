import { cn } from "@/utils/tailwind";
import React from "react";
import { Card, CardContent, CardHeader } from "./card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

/**
 * Base skeleton component for loading states.
 * Renders an animated pulsing placeholder element.
 *
 * @param props - Standard div element props
 * @returns A pulsing skeleton element
 * @example
 * <Skeleton className="h-12 w-12 rounded-full" />
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

/**
 * Skeleton component for card-shaped content.
 * Displays a Card with skeleton lines for title, description, and content.
 *
 * @returns A skeleton card element
 * @example
 * <SkeletonCard />
 */
function SkeletonCard() {
  return (
    <Card className="space-y-4">
      <CardHeader className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </CardContent>
    </Card>
  );
}

/**
 * Props for the SkeletonTable component.
 *
 * @property rows - Number of skeleton rows to display (default: 5)
 */
interface SkeletonTableProps {
  rows?: number;
}

/**
 * Skeleton component for table-shaped content.
 * Displays a Table with skeleton header and rows.
 *
 * @param props - Component props
 * @returns A skeleton table element
 * @example
 * <SkeletonTable rows={10} />
 */
function SkeletonTable({ rows = 5 }: Readonly<SkeletonTableProps>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/4">
            <Skeleton className="h-4 w-full" />
          </TableHead>
          <TableHead className="w-1/4">
            <Skeleton className="h-4 w-full" />
          </TableHead>
          <TableHead className="w-1/4">
            <Skeleton className="h-4 w-full" />
          </TableHead>
          <TableHead className="w-1/4">
            <Skeleton className="h-4 w-full" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRow key={`skeleton-table-row-${index + 1}`}>
            <TableCell>
              <Skeleton className="h-4 w-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-4/5" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-3/5" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-2/5" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Props for the SkeletonList component.
 *
 * @property items - Number of skeleton items to display (default: 3)
 */
interface SkeletonListProps {
  items?: number;
}

/**
 * Skeleton component for list-shaped content.
 * Displays vertical list of skeleton items with varying widths.
 *
 * @param props - Component props
 * @returns A skeleton list element
 * @example
 * <SkeletonList items={8} />
 */
function SkeletonList({ items = 3 }: Readonly<SkeletonListProps>) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={`skeleton-list-item-${index + 1}`} className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonList };
