/**
 * @packageDocumentation
 * @module ReadingVelocityChart
 * @description Chart component showing average reading velocity metrics.
 */

import React, { type FC, useMemo } from "react";
import {
  Gauge,
  TrendingUp,
  Calendar,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/utils/tailwind";
import type { ReadingHistory } from "@/utils/storage";
import type { TimeRange } from "@/utils/statistics-adapter";
import { computeReadingVelocity } from "@/utils/statistics-adapter";

/**
 * Props for ReadingVelocityChart component.
 * @source
 */
interface ReadingVelocityChartProps {
  readonly history: ReadingHistory;
  readonly timeRange: TimeRange;
  readonly className?: string;
  readonly comparisonData?: ReturnType<typeof computeReadingVelocity>;
  readonly comparisonLabel?: string;
}

/**
 * ReadingVelocityChart - Displays average reading velocity metrics.
 * Shows chapters per day, week, and month across metric cards.
 * @param props - Component props with reading history and time range.
 * @returns Rendered metric cards with velocity values or empty state.
 * @source
 */
export const ReadingVelocityChart: FC<ReadingVelocityChartProps> = ({
  history,
  timeRange,
  className,
  comparisonData,
  comparisonLabel,
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
                {comparisonData && (
                  <div className="mt-3 border-t border-blue-200 pt-2 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      {comparisonLabel}: {comparisonData.perDay}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        {perDay > comparisonData.perDay ? "+" : ""}
                        {(perDay - comparisonData.perDay).toFixed(2)}
                      </div>
                      {comparisonData.perDay > 0 && (
                        <div className="flex items-center gap-1">
                          {perDay > comparisonData.perDay ? (
                            <>
                              <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                {(
                                  ((perDay - comparisonData.perDay) /
                                    comparisonData.perDay) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                {(
                                  ((perDay - comparisonData.perDay) /
                                    comparisonData.perDay) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                {comparisonData && (
                  <div className="mt-3 border-t border-purple-200 pt-2 dark:border-purple-800">
                    <div className="text-xs text-purple-600 dark:text-purple-400">
                      {comparisonLabel}: {comparisonData.perWeek}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        {perWeek > comparisonData.perWeek ? "+" : ""}
                        {(perWeek - comparisonData.perWeek).toFixed(2)}
                      </div>
                      {comparisonData.perWeek > 0 && (
                        <div className="flex items-center gap-1">
                          {perWeek > comparisonData.perWeek ? (
                            <>
                              <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                {(
                                  ((perWeek - comparisonData.perWeek) /
                                    comparisonData.perWeek) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                {(
                                  ((perWeek - comparisonData.perWeek) /
                                    comparisonData.perWeek) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                {comparisonData && (
                  <div className="mt-3 border-t border-emerald-200 pt-2 dark:border-emerald-800">
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      {comparisonLabel}: {comparisonData.perMonth}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {perMonth > comparisonData.perMonth ? "+" : ""}
                        {(perMonth - comparisonData.perMonth).toFixed(2)}
                      </div>
                      {comparisonData.perMonth > 0 && (
                        <div className="flex items-center gap-1">
                          {perMonth > comparisonData.perMonth ? (
                            <>
                              <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                {(
                                  ((perMonth - comparisonData.perMonth) /
                                    comparisonData.perMonth) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                {(
                                  ((perMonth - comparisonData.perMonth) /
                                    comparisonData.perMonth) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
