/**
 * @packageDocumentation
 * @module Statistics/ChaptersReadDistributionChart
 * @description Histogram representing the spread of chapters read across matched manga entries.
 */

import React, { useMemo } from "react";
import type { FC } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { BarChart2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";

/**
 * Minimal match result shape containing only kenmeiManga for chapters extraction.
 */
type MinimalMatchResult = {
  readonly kenmeiManga: {
    readonly chapters_read: number;
  };
};

interface ChaptersReadDistributionChartProps {
  /** Match results containing Kenmei manga progress information. */
  readonly matchResults?: Array<MinimalMatchResult> | null;
  /** Optional className override for container styling. */
  readonly className?: string;
}

type BinDefinition = {
  readonly label: string;
  readonly min: number;
  readonly max: number | null;
};

type BinDatum = {
  readonly range: string;
  readonly count: number;
};

type StatsSummary = {
  readonly totalChapters: number;
  readonly averageChapters: number;
  readonly medianChapters: number;
  readonly modeRange: string | null;
};

const BINS: BinDefinition[] = [
  { label: "1-10", min: 1, max: 10 },
  { label: "11-25", min: 11, max: 25 },
  { label: "26-50", min: 26, max: 50 },
  { label: "51-100", min: 51, max: 100 },
  { label: "101-200", min: 101, max: 200 },
  { label: "201-500", min: 201, max: 500 },
  { label: "500+", min: 501, max: null },
];

function computeBinIndex(value: number): number {
  for (let index = 0; index < BINS.length; index++) {
    const bin = BINS[index];
    if (bin.max === null) {
      if (value >= bin.min) return index;
    } else if (value >= bin.min && value <= bin.max) {
      return index;
    }
  }
  return -1;
}

function calculateStatistics(values: number[]): StatsSummary {
  if (values.length === 0) {
    return {
      totalChapters: 0,
      averageChapters: 0,
      medianChapters: 0,
      modeRange: null,
    };
  }

  const totalChapters = values.reduce((sum, value) => sum + value, 0);
  const averageChapters = totalChapters / values.length;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianChapters =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  const binCounts = new Array<number>(BINS.length).fill(0);
  for (const value of values) {
    const index = computeBinIndex(value);
    if (index >= 0) {
      binCounts[index] += 1;
    }
  }
  const maxCount = Math.max(...binCounts);
  const modeIndex = binCounts.findIndex(
    (count) => count === maxCount && count > 0,
  );

  return {
    totalChapters,
    averageChapters,
    medianChapters,
    modeRange: modeIndex >= 0 ? BINS[modeIndex].label : null,
  };
}

/**
 * Aggregates chapters read data into histogram bins and summary statistics.
 * @param matchResults - Match results array.
 * @returns Histogram data and summary stats.
 * @source
 */
function buildHistogram(matchResults?: Array<MinimalMatchResult> | null): {
  bins: BinDatum[];
  stats: StatsSummary;
} {
  if (!matchResults?.length) {
    return {
      bins: [],
      stats: {
        totalChapters: 0,
        averageChapters: 0,
        medianChapters: 0,
        modeRange: null,
      },
    };
  }

  const values: number[] = [];

  for (const result of matchResults) {
    const chapters = result.kenmeiManga?.chapters_read;
    if (
      typeof chapters !== "number" ||
      Number.isNaN(chapters) ||
      chapters <= 0
    ) {
      continue;
    }
    values.push(chapters);
  }

  const stats = calculateStatistics(values);

  if (values.length === 0) {
    return { bins: [], stats };
  }

  const counts = new Array<number>(BINS.length).fill(0);
  for (const value of values) {
    const index = computeBinIndex(value);
    if (index >= 0) {
      counts[index] += 1;
    }
  }

  const bins: BinDatum[] = BINS.map((bin, index) => ({
    range: bin.label,
    count: counts[index],
  })).filter((item) => item.count > 0);

  return { bins, stats };
}

/**
 * Chapters read distribution chart component.
 * @param props - Component props.
 * @returns Rendered chart component.
 * @source
 */
export const ChaptersReadDistributionChart: FC<ChaptersReadDistributionChartProps> =
  React.memo(function ChaptersReadDistributionChartMemo({
    // eslint-disable-next-line react/prop-types
    matchResults,
    // eslint-disable-next-line react/prop-types
    className,
  }) {
    const { bins, stats } = useMemo(
      () => buildHistogram(matchResults),
      [matchResults],
    );

    const hasData = bins.length > 0;

    return (
      <section
        aria-label="Chapters read distribution"
        className={cn(
          "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
          className,
        )}
      >
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-linear-to-r inline-flex h-9 min-h-9 w-9 min-w-9 items-center justify-center rounded-full from-blue-500/20 via-purple-500/20 to-fuchsia-500/20 text-blue-500 dark:text-blue-300">
              <BarChart2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-foreground text-lg font-semibold">
                Reading Progress Distribution
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Chapters read per manga based on your matched Kenmei entries.
              </p>
            </div>
          </div>

          {hasData && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              >
                Total: {stats.totalChapters.toLocaleString()} chapters
              </Badge>
              <Badge
                variant="secondary"
                className="bg-blue-500/15 text-blue-600 dark:text-blue-300"
              >
                Average: {stats.averageChapters.toFixed(1)}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-purple-500/15 text-purple-600 dark:text-purple-300"
              >
                Median: {stats.medianChapters.toFixed(1)}
              </Badge>
              {stats.modeRange && (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/15 text-amber-600 dark:text-amber-300"
                >
                  Mode: {stats.modeRange}
                </Badge>
              )}
            </div>
          )}
        </header>

        {hasData ? (
          <figure className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bins} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="range"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Chapters Read",
                    position: "insideBottom",
                    offset: -6,
                    className: "fill-current text-xs text-muted-foreground",
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Number of Manga",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    className: "fill-current text-xs text-muted-foreground",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--muted))",
                    borderRadius: "calc(var(--radius) - 4px)",
                    padding: "0.5rem 0.75rem",
                    border: "none",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(value: number) =>
                    `${Number(value).toLocaleString()} manga`
                  }
                />
                <Bar
                  dataKey="count"
                  fill="url(#chaptersGradient)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={800}
                />
                <defs>
                  <linearGradient
                    id="chaptersGradient"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                    <stop
                      offset="100%"
                      stopColor="#a855f7"
                      stopOpacity={0.75}
                    />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </figure>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <AlertCircle className="mb-3 h-6 w-6" aria-hidden="true" />
            <p className="font-medium">No reading progress data available</p>
            <p className="mt-1 text-sm">
              Chapters read are calculated from Kenmei data once matches are
              confirmed.
            </p>
          </div>
        )}
      </section>
    );
  });

ChaptersReadDistributionChart.displayName = "ChaptersReadDistributionChart";
