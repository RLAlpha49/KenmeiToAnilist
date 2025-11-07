/**
 * @packageDocumentation
 * @module ReadingTrendsChart
 * @description Chart component showing chapters read over time with line chart and area fill.
 */

import React, { type FC, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Brush,
} from "recharts";
import { TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";
import type { ReadingHistory } from "@/utils/storage";
import type { TimeRange } from "@/utils/statisticsAdapter";
import {
  computeReadingTrends,
  computeDailyDeltasByManga,
} from "@/utils/statisticsAdapter";

/**
 * Props for ReadingTrendsChart component.
 * @source
 */
interface ReadingTrendsChartProps {
  readonly history: ReadingHistory;
  readonly timeRange: TimeRange;
  readonly className?: string;
  readonly onDrillDown?: (
    data: import("@/types/statistics").DrillDownData,
  ) => void;
  readonly matchResults?: import("@/utils/statisticsAdapter").NormalizedMatchForStats[];
  readonly comparisonData?: Array<{
    date: string;
    chapters: number;
    count: number;
  }>;
  readonly comparisonLabel?: string;
  readonly enableZoom?: boolean;
}

/**
 * ReadingTrendsChart - Displays chapters read over time as a line chart with gradient fill.
 * Visualizes reading volume trends with optional peak day annotation.
 * @param props - Component props with reading history and time range.
 * @returns Rendered line chart with trend visualization or empty state.
 * @source
 */
export const ReadingTrendsChart: FC<ReadingTrendsChartProps> = ({
  history,
  timeRange,
  className,
  onDrillDown,
  matchResults,
  comparisonData,
  comparisonLabel,
  enableZoom,
}) => {
  // Compute trend data with memoization
  const trendData = useMemo(() => {
    const trends = computeReadingTrends(history, timeRange);

    // Determine if dataset spans more than 365 days for year inclusion
    const shouldIncludeYear =
      trends.length > 1
        ? (new Date(trends.at(-1)!.date).getTime() -
            new Date(trends[0].date).getTime()) /
            (1000 * 60 * 60 * 24) >
          365
        : false;

    // Format dates for display
    return trends.map(({ date, chapters, count }) => {
      const dateObj = new Date(date);
      const formatted = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(shouldIncludeYear && { year: "2-digit" }),
      });

      return {
        date: formatted,
        fullDate: date,
        chapters,
        count,
      };
    });
  }, [history, timeRange]);

  // Calculate summary stats
  const totalChapters = useMemo(() => {
    return trendData.reduce((sum, item) => sum + item.chapters, 0);
  }, [trendData]);

  const averagePerDay = useMemo(() => {
    if (trendData.length === 0) return 0;
    return Math.round((totalChapters / trendData.length) * 10) / 10;
  }, [totalChapters, trendData.length]);

  const peakDay = useMemo(() => {
    if (trendData.length === 0) return null;
    return trendData.reduce(
      (max, item) => (item.chapters > max.chapters ? item : max),
      trendData[0],
    );
  }, [trendData]);

  const timeRangeLabel = useMemo(() => {
    switch (timeRange) {
      case "7d":
        return "7 days";
      case "30d":
        return "30 days";
      case "90d":
        return "90 days";
      default:
        return "all time";
    }
  }, [timeRange]);

  const hasData = trendData.length > 0;

  // Merge comparison data with primary trend data by fullDate
  const mergedTrendData = useMemo(() => {
    if (!comparisonData) return trendData;

    const comparisonMap = new Map<
      string,
      { chapters: number; count: number }
    >();
    for (const item of comparisonData) {
      comparisonMap.set(item.date, {
        chapters: item.chapters,
        count: item.count,
      });
    }

    return trendData.map((primary) => ({
      ...primary,
      comparisonChapters: comparisonMap.get(primary.fullDate)?.chapters ?? 0,
    }));
  }, [trendData, comparisonData]);

  // Pre-compute daily deltas (chapters read per manga per day)
  const dailyDeltaMap = useMemo(
    () => computeDailyDeltasByManga(history),
    [history],
  );

  const handleLineClick =
    onDrillDown && matchResults
      ? (fullDate: string) => {
          const deltasForDate = dailyDeltaMap.get(fullDate);
          const filtered = matchResults
            .filter((match) => {
              const delta = deltasForDate?.get(match.kenmeiManga.id);
              return delta !== undefined && delta > 0;
            })
            .map((match) => {
              const delta = deltasForDate?.get(match.kenmeiManga.id) ?? 0;
              return {
                title: match.kenmeiManga.title,
                chapters: delta,
                status: match.status,
                confidence: match.anilistMatches?.[0]?.confidence,
                format: match.selectedMatch?.format,
              };
            })
            .sort((a, b) => b.chapters - a.chapters)
            .slice(0, 100);

          onDrillDown({
            type: "date",
            value: fullDate,
            data: filtered,
          });
        }
      : undefined;

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
        className,
      )}
      aria-label="Reading trends over time"
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-linear-to-br rounded-xl from-blue-500/20 via-purple-500/20 to-fuchsia-500/20 p-3">
            <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Reading Trends
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Chapters read over time ({timeRangeLabel})
            </p>
          </div>
        </div>
        {hasData && (
          <Badge variant="secondary" className="text-sm">
            {totalChapters} chapters
          </Badge>
        )}
      </div>

      {/* Summary Stats */}
      {hasData && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-slate-600 dark:text-slate-400">
              Average:{" "}
            </span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {averagePerDay} ch/day
            </span>
          </div>
          {peakDay && (
            <div>
              <span className="text-slate-600 dark:text-slate-400">Peak: </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {peakDay.chapters} chapters on {peakDay.date}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {hasData ? (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={mergedTrendData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            onClick={(state) => {
              if (onDrillDown && matchResults && state) {
                const payload = (
                  state as {
                    activePayload?: Array<{
                      payload?: Record<string, unknown>;
                    }>;
                  }
                ).activePayload?.[0]?.payload;
                const fullDate = payload?.fullDate as string | undefined;
                if (fullDate && handleLineClick) {
                  handleLineClick(fullDate);
                }
              }
            }}
          >
            <defs>
              <linearGradient id="trendsGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-slate-200 dark:stroke-slate-700"
            />
            <XAxis
              dataKey="date"
              className="text-xs text-slate-600 dark:text-slate-400"
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis
              className="text-xs text-slate-600 dark:text-slate-400"
              label={{
                value: "Chapters",
                angle: -90,
                position: "insideLeft",
                className: "text-xs text-slate-600 dark:text-slate-400",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelClassName="font-semibold text-slate-900"
              formatter={(value: number, name: string) => {
                if (name === "Chapters Read")
                  return [`${value} chapters`, name];
                if (name === (comparisonLabel || "Comparison"))
                  return [`${value} chapters`, name];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />
            <Area
              type="monotone"
              dataKey="chapters"
              stroke="none"
              fill="url(#trendsGradient)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="chapters"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{
                fill: "#3b82f6",
                r: 4,
                cursor: handleLineClick ? "pointer" : "default",
              }}
              activeDot={{ r: 6 }}
              name="Chapters Read"
              isAnimationActive={false}
            />
            {comparisonData && (
              <Line
                type="monotone"
                dataKey="comparisonChapters"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ fill: "#f59e0b", r: 4 }}
                activeDot={{ r: 6 }}
                name={comparisonLabel || "Comparison"}
                isAnimationActive={false}
              />
            )}
            {enableZoom && trendData.length > 10 && (
              <Brush dataKey="date" height={30} stroke="#3b82f6" />
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="bg-linear-to-br flex h-[350px] flex-col items-center justify-center gap-4 rounded-xl from-slate-50/80 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50">
          {/* Placeholder Chart Visualization */}
          <div className="w-full px-6 py-4">
            <div className="space-y-2">
              {/* Placeholder bars showing expected chart shape */}
              <div className="flex items-end justify-between gap-1 px-2">
                {[40, 55, 45, 70, 50, 65, 60].map((height, idx) => (
                  <div
                    key={`trends-placeholder-${height}-${idx}`}
                    className="bg-linear-to-t flex-1 rounded-t from-blue-300 to-blue-200 opacity-40 dark:from-blue-800/40 dark:to-blue-700/40"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No reading activity in this period
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Trends will appear here as you read and sync manga
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

ReadingTrendsChart.displayName = "ReadingTrendsChart";
