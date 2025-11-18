import type {
  PreparedTableRow,
  DataTablePreparationMessage,
} from "../core/types";

export type ColumnVisibility =
  DataTablePreparationMessage["payload"]["columnVisibility"];

/**
 * Format a single manga item into a prepared table row used by the virtualized table.
 * This mirrors the logic used in both the worker and UI fallback to keep output
 * consistent across execution contexts.
 */
export function formatTableRow<T extends { title: string; status: string }>(
  item: T,
  columnVisibility: ColumnVisibility,
): PreparedTableRow<T> {
  // Human-friendly status, e.g. "reading" -> "Reading"
  const statusDisplayValue = String(item.status)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Score
  let scoreDisplayValue = "-";
  if (
    columnVisibility.score &&
    (item as unknown as { score?: number }).score !== undefined
  ) {
    const score = (item as unknown as { score?: number }).score ?? 0;
    scoreDisplayValue = score > 0 ? String(score) : "-";
  }

  // Chapters
  let chaptersDisplayValue = "-";
  if (columnVisibility.chapters) {
    const c = (item as unknown as { chaptersRead?: number }).chaptersRead ?? 0;
    chaptersDisplayValue = c > 0 ? String(c) : "0";
  }

  // Volumes
  let volumesDisplayValue = "-";
  if (columnVisibility.volumes) {
    const v = (item as unknown as { volumesRead?: number }).volumesRead ?? 0;
    volumesDisplayValue = v > 0 ? String(v) : "0";
  }

  // Last read date
  const hasLastRead =
    (item as unknown as { lastReadAt?: string }).lastReadAt ??
    (item as unknown as { updatedAt?: string }).updatedAt;

  const lastReadDisplayValue =
    columnVisibility.lastRead && hasLastRead
      ? (() => {
          try {
            const date = new Date(String(hasLastRead));
            return date.toLocaleDateString();
          } catch {
            return "-";
          }
        })()
      : "-";

  // Row height calculation roughly based on title length and a baseline
  const titleLength = (item as unknown as { title: string }).title.length || 0;
  const titleLines = Math.max(1, Math.ceil(titleLength / 40));
  const baseRowHeight = 40;
  const additionalHeight = (titleLines - 1) * 20;
  const rowHeight = baseRowHeight + additionalHeight;

  return {
    original: item,
    formattedValues: {
      status: statusDisplayValue,
      score: scoreDisplayValue,
      chapters: chaptersDisplayValue,
      volumes: volumesDisplayValue,
      lastRead: lastReadDisplayValue,
    },
    rowHeight,
  };
}

/**
 * Format an entire slice of data for the table viewport.
 */
export function prepareTableSlice<T extends { title: string; status: string }>(
  data: T[],
  startIndex: number,
  endIndex: number,
  columnVisibility: ColumnVisibility,
): PreparedTableRow<T>[] {
  return data
    .slice(startIndex, endIndex)
    .map((item) => formatTableRow(item, columnVisibility));
}
