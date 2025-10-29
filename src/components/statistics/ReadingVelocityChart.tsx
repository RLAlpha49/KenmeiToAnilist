/**
 * @packageDocumentation
 * @module ReadingVelocityChart
 * @description Chart component showing average reading velocity metrics.
 */

import React, { type FC, useMemo } from "react";
import { Gauge, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";
import type { ReadingHistory } from "@/utils/storage";
import type { TimeRange } from "@/utils/statisticsAdapter";
import { computeReadingVelocity } from "@/utils/statisticsAdapter";

/**
 * Props for ReadingVelocityChart component.
 */
interface ReadingVelocityChartProps {
  readonly history: ReadingHistory;
  readonly timeRange: TimeRange;
  readonly className?: string;
}

/**
 * ReadingVelocityChart - Displays average reading velocity metrics.
 */
export const ReadingVelocityChart: FC<ReadingVelocityChartProps> = ({
  history,
  timeRange,
  className,
}) => {
  // Compute velocity data with memoization
  const velocityData = useMemo(() => {
    return computeReadingVelocity(history, timeRange);
  }, [history, timeRange]);

  const { perDay, perWeek, perMonth, totalChapters, activeDays } = velocityData;

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

  const hasData = totalChapters > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
        className,
      )}
      aria-label="Reading velocity metrics"
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-linear-to-br rounded-xl from-purple-500/20 via-fuchsia-500/20 to-pink-500/20 p-3">
            <Gauge className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Reading Velocity
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Average chapters per time period ({timeRangeLabel})
            </p>
          </div>
        </div>
      </div>

      {hasData ? (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Per Day */}
            <div className="bg-linear-to-br relative overflow-hidden rounded-xl border border-blue-200 from-blue-50 to-blue-100/50 p-5 dark:border-blue-900 dark:from-blue-950 dark:to-blue-900/50">
              <div className="absolute right-4 top-4 opacity-20">
                <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="relative">
                <div className="text-4xl font-bold text-blue-700 dark:text-blue-300">
                  {perDay}
                </div>
                <div className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                  chapters/day
                </div>
              </div>
            </div>

            {/* Per Week */}
            <div className="bg-linear-to-br relative overflow-hidden rounded-xl border border-purple-200 from-purple-50 to-purple-100/50 p-5 dark:border-purple-900 dark:from-purple-950 dark:to-purple-900/50">
              <div className="absolute right-4 top-4 opacity-20">
                <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="relative">
                <div className="text-4xl font-bold text-purple-700 dark:text-purple-300">
                  {perWeek}
                </div>
                <div className="mt-2 text-sm font-medium text-purple-600 dark:text-purple-400">
                  chapters/week
                </div>
              </div>
            </div>

            {/* Per Month */}
            <div className="bg-linear-to-br relative overflow-hidden rounded-xl border border-emerald-200 from-emerald-50 to-emerald-100/50 p-5 dark:border-emerald-900 dark:from-emerald-950 dark:to-emerald-900/50">
              <div className="absolute right-4 top-4 opacity-20">
                <Calendar className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="relative">
                <div className="text-4xl font-bold text-emerald-700 dark:text-emerald-300">
                  {perMonth}
                </div>
                <div className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  chapters/month
                </div>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="text-sm">
              {totalChapters} total chapters
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {activeDays} active {activeDays === 1 ? "day" : "days"}
            </Badge>
            <Badge variant="outline" className="text-sm">
              Based on days with reading activity
            </Badge>
          </div>
        </div>
      ) : (
        <div className="bg-linear-to-br flex h-[250px] flex-col items-center justify-center gap-4 rounded-xl from-slate-50/80 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50">
          {/* Placeholder Metric Cards */}
          <div className="grid w-full gap-4 px-6 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-2xl font-bold text-slate-300 dark:text-slate-600">
                —
              </div>
              <div className="mt-2 text-xs text-slate-500">chapters/day</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-2xl font-bold text-slate-300 dark:text-slate-600">
                —
              </div>
              <div className="mt-2 text-xs text-slate-500">chapters/week</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-2xl font-bold text-slate-300 dark:text-slate-600">
                —
              </div>
              <div className="mt-2 text-xs text-slate-500">chapters/month</div>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No reading activity to calculate velocity
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Velocity metrics will appear once you start reading
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

ReadingVelocityChart.displayName = "ReadingVelocityChart";
