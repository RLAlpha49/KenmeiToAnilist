/**
 * @packageDocumentation
 * @module ReadingHabitsChart
 * @description Chart component showing reading patterns by day of week and time of day.
 */

import React, { type FC, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";
import type { ReadingHistory } from "@/utils/storage";
import type { TimeRange } from "@/utils/statisticsAdapter";
import { computeReadingHabits } from "@/utils/statisticsAdapter";

/**
 * Props for ReadingHabitsChart component.
 */
interface ReadingHabitsChartProps {
  readonly history: ReadingHistory;
  readonly timeRange: TimeRange;
  readonly className?: string;
}

/**
 * ReadingHabitsChart - Displays reading patterns by day of week and time of day.
 */
export const ReadingHabitsChart: FC<ReadingHabitsChartProps> = ({
  history,
  timeRange,
  className,
}) => {
  // Compute habit data with memoization
  const habitData = useMemo(() => {
    return computeReadingHabits(history, timeRange);
  }, [history, timeRange]);

  const { byDayOfWeek, byTimeOfDay, peakDay, peakHour } = habitData;

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

  // Filter time of day to show only hours with activity
  const activeHours = useMemo(() => {
    return byTimeOfDay.filter((item) => item.chapters > 0);
  }, [byTimeOfDay]);

  const hasData =
    byDayOfWeek.some((d) => d.chapters > 0) || activeHours.length > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
        className,
      )}
      aria-label="Reading habits by day and time"
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-linear-to-br rounded-xl from-emerald-500/20 via-teal-500/20 to-cyan-500/20 p-3">
            <Clock className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Reading Habits
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              When you read most based on recorded snapshot times (
              {timeRangeLabel})
            </p>
          </div>
        </div>
        {hasData && (
          <div className="flex gap-2">
            {peakDay && (
              <Badge variant="secondary" className="text-sm">
                Peak day: {peakDay}
              </Badge>
            )}
            {peakHour && (
              <Badge variant="secondary" className="text-sm">
                Peak hour: {peakHour}
              </Badge>
            )}
          </div>
        )}
      </div>

      {hasData ? (
        <div className="space-y-6">
          {/* By Day of Week */}
          {byDayOfWeek.some((d) => d.chapters > 0) && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                By Day of Week
              </h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={byDayOfWeek}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-slate-200 dark:stroke-slate-700"
                  />
                  <XAxis
                    type="number"
                    className="text-xs text-slate-600 dark:text-slate-400"
                  />
                  <YAxis
                    type="category"
                    dataKey="day"
                    className="text-xs text-slate-600 dark:text-slate-400"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelClassName="font-semibold text-slate-900"
                    formatter={(value: number) => [`${value} chapters`, "Read"]}
                  />
                  <Bar
                    dataKey="chapters"
                    fill="#10b981"
                    radius={[0, 8, 8, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By Time of Day */}
          {activeHours.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                By Time of Day
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={activeHours}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-slate-200 dark:stroke-slate-700"
                  />
                  <XAxis
                    type="number"
                    className="text-xs text-slate-600 dark:text-slate-400"
                  />
                  <YAxis
                    type="category"
                    dataKey="hour"
                    className="text-xs text-slate-600 dark:text-slate-400"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelClassName="font-semibold text-slate-900"
                    formatter={(value: number) => [`${value} chapters`, "Read"]}
                  />
                  <Bar
                    dataKey="chapters"
                    fill="#3b82f6"
                    radius={[0, 8, 8, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-linear-to-br flex h-[350px] flex-col items-center justify-center gap-4 rounded-xl from-slate-50/80 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50">
          {/* Placeholder Visualization */}
          <div className="w-full space-y-4 px-6 py-4">
            {/* Day of Week placeholder */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-500">
                By Day of Week
              </div>
              <div className="space-y-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day, idx) => {
                    const placeholderHeight =
                      [30, 45, 50, 48, 55, 40, 35][idx] || 40;
                    return (
                      <div
                        key={`habits-day-${day}`}
                        className="flex items-center gap-2"
                      >
                        <div className="w-8 text-xs text-slate-500">{day}</div>
                        <div
                          className="bg-linear-to-r rounded from-emerald-300/40 to-emerald-200/40 dark:from-emerald-800/40 dark:to-emerald-700/40"
                          style={{
                            width: `${placeholderHeight}px`,
                            height: "20px",
                          }}
                        />
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Not enough reading activity to show patterns
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Habits will appear here once you read across multiple days
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

ReadingHabitsChart.displayName = "ReadingHabitsChart";
