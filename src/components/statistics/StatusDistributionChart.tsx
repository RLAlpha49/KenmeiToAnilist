/**
 * @packageDocumentation
 * @module Statistics/StatusDistributionChart
 * @description Doughnut chart visualizing the distribution of manga statuses across the imported library.
 */

import React, { useMemo } from "react";
import type { FC } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";
import { PieChart as PieChartIcon, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/utils/tailwind";

/**
 * Supported manga status labels mapped to human friendly display text.
 * Maps status keys to localized display names for UI presentation.
 * @source
 */
const STATUS_LABELS: Record<string, string> = {
  reading: "Reading",
  completed: "Completed",
  "on-hold": "On Hold",
  dropped: "Dropped",
  "plan-to-read": "Plan to Read",
  planned: "Plan to Read",
  unknown: "Unknown",
};

/**
 * Color palette for each status segment.
 * Ensures consistent visual identification across the application.
 * @source
 */
const STATUS_COLORS: Record<string, string> = {
  reading: "#3b82f6",
  completed: "#10b981",
  "on-hold": "#f59e0b",
  dropped: "#ef4444",
  "plan-to-read": "#a855f7",
  planned: "#a855f7",
  unknown: "#64748b",
};

/**
 * Props for the StatusDistributionChart component.
 * @source
 */
export interface StatusDistributionChartProps {
  /** Status counts keyed by status identifier. */
  readonly data?: Record<string, number> | null;
  /** Optional className override for the container. */
  readonly className?: string;
  /** Callback for drill-down clicks on status slices. */
  readonly onDrillDown?: (
    data: import("@/types/statistics").DrillDownData,
  ) => void;
  /** Full match results for drill-down data building. */
  readonly matchResults?: import("@/utils/statistics-adapter").NormalizedMatchForStats[];
}

/**
 * Chart data point with status name, count, color, and raw key.
 * @source
 */
type ChartDatum = {
  readonly name: string;
  readonly value: number;
  readonly color: string;
  readonly rawKey: string;
};

/**
 * Strongly typed Recharts label payload for the pie chart label renderer.
 * Ensures the `percent` and `value` fields are available with correct types.
 */
type PieLabelPayload = {
  readonly value?: number;
  readonly percent?: number;
  readonly name?: string;
  readonly index?: number;
};

/**
 * StatusDistributionChart renders a donut chart summarizing library status counts.
 * Filters out zero-value categories and presents totals with accessible labels.
 * @param props - Component props including raw status counts and optional className.
 * @returns A rendered chart or an empty state if no data is available.
 * @source
 */
export const StatusDistributionChart: FC<StatusDistributionChartProps> =
  React.memo(function StatusDistributionChartMemo({
    // eslint-disable-next-line react/prop-types
    data,
    // eslint-disable-next-line react/prop-types
    className,
    // eslint-disable-next-line react/prop-types
    onDrillDown,
    // eslint-disable-next-line react/prop-types
    matchResults,
  }) {
    const chartData = useMemo<ChartDatum[]>(() => {
      if (!data) return [];

      const fallbackColors = [
        "#3b82f6",
        "#10b981",
        "#f59e0b",
        "#ef4444",
        "#a855f7",
        "#6366f1",
      ];

      let fallbackIndex = 0;
      return Object.entries(data)
        .map(([statusKey, count]) => {
          const normalizedKey = statusKey.toLowerCase();
          const label =
            STATUS_LABELS[normalizedKey] ??
            STATUS_LABELS[normalizedKey.replace("_", "-")] ??
            normalizedKey
              .split(" ")
              .map((segment) =>
                segment.length > 0
                  ? segment[0].toUpperCase() + segment.slice(1)
                  : segment,
              )
              .join(" ");

          const color =
            STATUS_COLORS[normalizedKey] ??
            STATUS_COLORS[normalizedKey.replace("_", "-")] ??
            fallbackColors[fallbackIndex++ % fallbackColors.length];

          return {
            name: label,
            value: count,
            color,
            rawKey: normalizedKey,
          } satisfies ChartDatum;
        })
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);
    }, [data]);

    const totalCount = useMemo(
      () => chartData.reduce((acc, item) => acc + item.value, 0),
      [chartData],
    );

    return (
      <section
        aria-label="Library status distribution"
        className={cn(
          "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
          className,
        )}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-linear-to-r inline-flex h-9 min-h-9 w-9 min-w-9 items-center justify-center rounded-full from-blue-500/20 via-purple-500/20 to-fuchsia-500/20 text-blue-500 dark:text-blue-300">
                <PieChartIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-foreground text-lg font-semibold">
                Library Status Distribution
              </h2>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Percentage of manga entries by reading status.
            </p>
          </div>
          {totalCount > 0 && (
            <Badge variant="secondary" className="whitespace-nowrap">
              {totalCount.toLocaleString()} titles
            </Badge>
          )}
        </header>

        {chartData.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <AlertCircle className="mb-3 h-6 w-6" aria-hidden="true" />
            <p className="font-medium">No manga imported yet</p>
            <p className="mt-1 text-sm">
              Import your Kenmei library to unlock status analytics.
            </p>
          </div>
        ) : (
          <>
            {/* Chart with accessible label summarizing key values */}
            {(() => {
              const chartSummary = chartData
                .map(
                  (item) =>
                    `${item.name} ${item.value} ${item.value === 1 ? "title" : "titles"}`,
                )
                .join(", ");
              return (
                <figure
                  className="h-[300px] w-full"
                  aria-label={`Library status distribution: ${chartSummary}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        labelLine={false}
                        cursor={onDrillDown ? "pointer" : "default"}
                        onClick={(entry) => {
                          if (onDrillDown && matchResults && entry) {
                            // Filter by kenmeiManga.status (reading status: reading, completed, etc)
                            // This differs from computeDrillDownData which filters by match status (pending/matched/manual)
                            const payload = entry as {
                              payload?: { rawKey?: string };
                              rawKey?: string;
                            };
                            const rawKey =
                              payload.payload?.rawKey ?? payload.rawKey;
                            if (!rawKey) return;
                            // eslint-disable-next-line react/prop-types
                            const filtered = matchResults.filter(
                              (match) => match.kenmeiManga.status === rawKey,
                            );
                            onDrillDown({
                              type: "status",
                              value: rawKey,
                              data: filtered
                                .map((match) => ({
                                  title: match.kenmeiManga.title,
                                  chapters: match.kenmeiManga.chaptersRead,
                                  status: match.kenmeiManga.status,
                                  confidence:
                                    match.anilistMatches?.[0]?.confidence,
                                  format: match.selectedMatch?.format,
                                }))
                                .sort((a, b) => b.chapters - a.chapters)
                                .slice(0, 100),
                            });
                          }
                        }}
                        label={(props: PieLabelPayload) =>
                          // eslint-disable-next-line react/prop-types
                          `${Math.round((props.percent ?? 0) * 100)}%`
                        }
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.rawKey} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--muted))",
                          borderRadius: "calc(var(--radius) - 4px)",
                          padding: "0.5rem 0.75rem",
                          border: "none",
                        }}
                        itemStyle={{ color: "white" }}
                        formatter={(value: number, name: string) => {
                          // Recharts payload.percent can be inconsistent across versions/contexts.
                          // Use the computed totalCount to derive a reliable percentage.
                          const numeric = Number(value ?? 0);
                          const percent =
                            totalCount > 0 ? numeric / totalCount : 0;
                          return [
                            `${numeric.toLocaleString()} (${Math.round(percent * 100)}%)`,
                            name,
                          ];
                        }}
                      />
                      <Legend
                        iconType="circle"
                        verticalAlign="bottom"
                        height={36}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </figure>
              );
            })()}

            {/* Visually hidden data table for screen readers */}
            <div className="sr-only">
              <table>
                <caption>Library status distribution data</caption>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((item) => (
                    <tr key={item.rawKey}>
                      <td>{item.name}</td>
                      <td>{item.value.toLocaleString()}</td>
                      <td>
                        {totalCount > 0
                          ? Math.round((item.value / totalCount) * 100)
                          : 0}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    );
  });

StatusDistributionChart.displayName = "StatusDistributionChart";
