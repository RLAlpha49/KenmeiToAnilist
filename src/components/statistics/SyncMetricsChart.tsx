/**
 * @packageDocumentation
 * @module Statistics/SyncMetricsChart
 * @description Composed chart summarizing sync outcomes and success rate metrics.
 */

import React, { useMemo } from "react";
import type { FC } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { SyncStats } from "@/types/sync";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";
import { formatRelativeTime } from "@/utils/timeUtils";

interface SyncMetricsChartProps {
  /** Sync statistics object representing aggregate results. */
  readonly syncStats?: SyncStats | null;
  /** Optional className for layout adjustments. */
  readonly className?: string;
}

type ChartDatum = {
  readonly name: string;
  readonly successful: number;
  readonly failed: number;
  readonly successRate: number;
};
/**
 * Determines badge tone based on success rate.
 * @param successRate - Success percentage.
 * @returns Tailwind class name for badge styling.
 * @source
 */
function getSuccessRateTone(successRate: number): string {
  if (successRate >= 90)
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (successRate >= 70)
    return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-600 dark:text-rose-300";
}

/**
 * Composed chart visualizing sync performance.
 * @param props - Component props containing sync statistics.
 * @returns Composed chart with badges or empty placeholder.
 * @source
 */
export const SyncMetricsChart: FC<SyncMetricsChartProps> = React.memo(
  function SyncMetricsChartMemo({
    // eslint-disable-next-line react/prop-types
    syncStats,
    // eslint-disable-next-line react/prop-types
    className,
  }) {
    const { chartData, successRate, successfulCount, failedCount, totalSyncs } =
      useMemo(() => {
        if (!syncStats) {
          return {
            chartData: [] as ChartDatum[],
            successRate: 0,
            successfulCount: 0,
            failedCount: 0,
            totalSyncs: 0,
          };
        }

        const successful = Math.max(
          0,
          // eslint-disable-next-line react/prop-types
          (syncStats.entriesSynced ?? 0) - (syncStats.failedSyncs ?? 0),
        );
        // eslint-disable-next-line react/prop-types
        const failed = Math.max(syncStats.failedSyncs ?? 0, 0);
        // eslint-disable-next-line react/prop-types
        const attempts = Math.max(syncStats.entriesSynced ?? 0, 0);
        const rate = attempts > 0 ? (successful / attempts) * 100 : 0;

        return {
          chartData: [
            {
              name: "Sync Stats",
              successful,
              failed,
              successRate: Number(rate.toFixed(1)),
            },
          ],
          successRate: Number(rate.toFixed(1)),
          successfulCount: successful,
          failedCount: failed,
          // eslint-disable-next-line react/prop-types
          totalSyncs: Math.max(syncStats.totalSyncs ?? 0, 0),
        };
      }, [syncStats]);

    return (
      <section
        aria-label="Sync performance"
        className={cn(
          "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
          className,
        )}
      >
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-linear-to-r inline-flex h-9 min-h-9 w-9 min-w-9 items-center justify-center rounded-full from-blue-500/15 via-emerald-500/15 to-purple-500/15 text-blue-500 dark:text-blue-300">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-foreground text-lg font-semibold">
                Sync Performance
              </h2>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Overview of successful and failed sync attempts with success rate.
            </p>
          </div>
          {syncStats && (
            <div className="text-muted-foreground flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" aria-hidden="true" />
                <span>{totalSyncs.toLocaleString()} total syncs</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>
                  {/* eslint-disable-next-line react/prop-types */}
                  Last sync: {formatRelativeTime(syncStats.lastSyncTime)}
                </span>
              </div>
            </div>
          )}
        </header>

        {!syncStats || chartData.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <AlertCircle className="mb-3 h-6 w-6" aria-hidden="true" />
            <p className="font-medium">No sync operations performed yet</p>
            <p className="mt-1 text-sm">
              Run a sync to view success metrics and failure trends.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge
                className="bg-blue-500/15 text-blue-600 dark:text-blue-300"
                variant="secondary"
              >
                Successful: {successfulCount.toLocaleString()}
              </Badge>
              <Badge
                className="bg-rose-500/15 text-rose-600 dark:text-rose-300"
                variant="secondary"
              >
                Failed: {failedCount.toLocaleString()}
              </Badge>
              <Badge className={cn(getSuccessRateTone(successRate))}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Success Rate: {successRate.toFixed(1)}%
              </Badge>
            </div>
            <figure className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 16, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" hide />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--muted))",
                      borderRadius: "calc(var(--radius) - 4px)",
                      padding: "0.5rem 0.75rem",
                      border: "none",
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(value: number, name: string) => {
                      if (name === "Success Rate") {
                        return [`${Number(value).toFixed(1)}%`, name];
                      }
                      return [`${Number(value).toLocaleString()}`, name];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="successful"
                    name="Successful"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="failed"
                    name="Failed"
                    fill="#ef4444"
                    radius={[8, 8, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="successRate"
                    name="Success Rate"
                    type="monotone"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{
                      r: 6,
                      strokeWidth: 2,
                      stroke: "#ede9fe",
                      fill: "#8b5cf6",
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </figure>
          </>
        )}
      </section>
    );
  },
);

SyncMetricsChart.displayName = "SyncMetricsChart";
