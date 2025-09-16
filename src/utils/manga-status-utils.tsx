/**
 * @packageDocumentation
 * @module MangaStatusUtils
 * @description Utility functions for handling manga status display, colors, and icons.
 */

import React from "react";
import { KenmeiMangaItem } from "../types/kenmei";
import {
  Clock,
  CheckCircle2,
  X,
  ChevronRight,
  AlertTriangle,
  Info,
} from "lucide-react";

/**
 * Status count mapping
 */
export type StatusCounts = Record<string, number>;

/**
 * Get counts for each status from manga data
 */
export function getStatusCounts(manga: KenmeiMangaItem[]): StatusCounts {
  return manga.reduce((acc: StatusCounts, mangaItem: KenmeiMangaItem) => {
    const status = mangaItem.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Get CSS classes for status styling
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "reading":
      return "bg-green-500/10 text-green-700 border-green-200 dark:border-green-800 dark:text-green-400";
    case "completed":
      return "bg-purple-500/10 text-purple-700 border-purple-200 dark:border-purple-800 dark:text-purple-400";
    case "dropped":
      return "bg-red-500/10 text-red-700 border-red-200 dark:border-red-800 dark:text-red-400";
    case "plan_to_read":
      return "bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800 dark:text-blue-400";
    case "on_hold":
      return "bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800 dark:text-amber-400";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-200 dark:border-gray-700 dark:text-gray-400";
  }
}

/**
 * Get React icon element for status
 */
export function getStatusIcon(status: string): React.ReactElement {
  switch (status) {
    case "reading":
      return (
        <div className="rounded-full bg-green-100 p-2 dark:bg-green-800/30">
          <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
      );
    case "completed":
      return (
        <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-800/30">
          <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
      );
    case "dropped":
      return (
        <div className="rounded-full bg-red-100 p-2 dark:bg-red-800/30">
          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
      );
    case "plan_to_read":
      return (
        <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-800/30">
          <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      );
    case "on_hold":
      return (
        <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-800/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
      );
    default:
      return (
        <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800">
          <Info className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </div>
      );
  }
}

/**
 * Format status label for display
 */
export function formatStatusLabel(status: string): string {
  if (status === "plan_to_read") {
    return "Plan to Read";
  }
  if (status === "on_hold") {
    return "On Hold";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}
