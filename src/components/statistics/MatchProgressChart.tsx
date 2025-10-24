/**
 * @packageDocumentation
 * @module Statistics/MatchProgressChart
 * @description Stacked area chart illustrating cumulative match progress over time.
 */

import React, { useMemo } from "react";
import type { FC } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, Calendar, AlertCircle } from "lucide-react";
import type { MatchStatus } from "@/api/anilist/types";
import { cn } from "@/utils/tailwind";

/**
 * Minimal match result shape containing only matchDate and status for timeline.
 */
type MinimalMatchResult = {
  readonly matchDate?: Date;
  readonly status: MatchStatus;
};

interface MatchProgressChartProps {
  /** Match results containing timestamps for progress timeline. */
  readonly matchResults?: Array<MinimalMatchResult> | null;
  /** Optional className override for layout adjustments. */
  readonly className?: string;
}

type TimelineDatum = {
  readonly isoDate: string;
  readonly label: string;
  readonly matched: number;
  readonly manual: number;
  readonly pending: number;
  readonly skipped: number;
  readonly total: number;
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/**
 * Safely converts incoming match date values (Date or ISO string) to Date instances.
 * @param value - Date value from storage or runtime.
 * @returns Parsed Date or null if invalid.
 * @source
 */
function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Aggregates match results into cumulative timeline data.
 * @param matchResults - Match results array.
 * @returns Sorted timeline data and derived metadata.
 * @source
 */
function buildTimeline(matchResults?: Array<MinimalMatchResult> | null): {
  data: TimelineDatum[];
  totalMatches: number;
  startLabel: string | null;
  endLabel: string | null;
} {
  if (!matchResults?.length) {
    return {
      data: [],
      totalMatches: 0,
      startLabel: null,
      endLabel: null,
    };
  }

  const perDay = new Map<
    string,
    {
      date: Date;
      matched: number;
      manual: number;
      pending: number;
      skipped: number;
    }
  >();

  for (const result of matchResults) {
    const date = toDate(result.matchDate);
    if (!date) continue;

    const dayKey = date.toISOString().split("T")[0];
    let entry = perDay.get(dayKey);
    if (!entry) {
      entry = { date, matched: 0, manual: 0, pending: 0, skipped: 0 };
      perDay.set(dayKey, entry);
    }

    switch (result.status) {
      case "matched":
        entry.matched += 1;
        break;
      case "manual":
        entry.manual += 1;
        break;
      case "skipped":
        entry.skipped += 1;
        break;
      default:
        entry.pending += 1;
        break;
    }
  }

  const sorted = Array.from(perDay.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  let runningMatched = 0;
  let runningManual = 0;
  let runningPending = 0;
  let runningSkipped = 0;

  const data = sorted.map((entry) => {
    runningMatched += entry.matched;
    runningManual += entry.manual;
    runningPending += entry.pending;
    runningSkipped += entry.skipped;

    const total =
      runningMatched + runningManual + runningPending + runningSkipped;

    return {
      isoDate: entry.date.toISOString(),
      label: DATE_FORMATTER.format(entry.date),
      matched: runningMatched,
      manual: runningManual,
      pending: runningPending,
      skipped: runningSkipped,
      total,
    } satisfies TimelineDatum;
  });

  return {
    data,
    totalMatches: data.at(-1)?.total ?? 0,
    startLabel: data[0]
      ? FULL_DATE_FORMATTER.format(new Date(data[0].isoDate))
      : null,
    endLabel: data.at(-1)
      ? FULL_DATE_FORMATTER.format(new Date(data.at(-1)!.isoDate))
      : null,
  };
}

/**
 * MatchProgressChart component showing cumulative match status counts over time.
 * @param props - Component props with match results data.
 * @returns Rendered stacked area chart or empty state placeholder.
 * @source
 */
export const MatchProgressChart: FC<MatchProgressChartProps> = React.memo(
  function MatchProgressChartMemo({ matchResults, className }) {
    const { data, totalMatches, startLabel, endLabel } = useMemo(
      () => buildTimeline(matchResults),
      [matchResults],
    );

    const subtitle = useMemo(() => {
      if (!data.length || !startLabel || !endLabel) {
        return "Historical view of match completion by status.";
      }
      if (startLabel === endLabel) {
        return `Activity recorded on ${startLabel}.`;
      }
      return `Activity from ${startLabel} to ${endLabel}.`;
    }, [data.length, startLabel, endLabel]);

    return (
      <section
        aria-label="Match progress timeline"
        className={cn(
          "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
          className,
        )}
      >
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-linear-to-r inline-flex h-9 min-h-9 w-9 min-w-9 items-center justify-center rounded-full from-emerald-500/15 via-blue-500/15 to-purple-500/15 text-emerald-500 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-foreground text-lg font-semibold">
                Match Progress Timeline
              </h2>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
          </div>
          {totalMatches > 0 && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>{totalMatches.toLocaleString()} total matches</span>
            </div>
          )}
        </header>

        {data.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <AlertCircle className="mb-3 h-6 w-6" aria-hidden="true" />
            <p className="font-medium">No match history available</p>
            <p className="mt-1 text-sm">
              Once you review matches, your progress timeline will appear here.
            </p>
          </div>
        ) : (
          <figure className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="isoDate"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return Number.isNaN(date.getTime())
                      ? value
                      : DATE_FORMATTER.format(date);
                  }}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--muted))",
                    borderRadius: "calc(var(--radius) - 4px)",
                    padding: "0.5rem 0.75rem",
                    border: "none",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return Number.isNaN(date.getTime())
                      ? value
                      : FULL_DATE_FORMATTER.format(date);
                  }}
                />
                <Legend iconType="circle" verticalAlign="top" height={32} />
                <Area
                  type="monotone"
                  dataKey="matched"
                  stackId="1"
                  stroke="#059669"
                  fill="#10b981"
                  fillOpacity={0.4}
                  name="Matched"
                />
                <Area
                  type="monotone"
                  dataKey="manual"
                  stackId="1"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.35}
                  name="Manual"
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  stackId="1"
                  stroke="#d97706"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  name="Pending"
                />
                <Area
                  type="monotone"
                  dataKey="skipped"
                  stackId="1"
                  stroke="#dc2626"
                  fill="#ef4444"
                  fillOpacity={0.25}
                  name="Skipped"
                />
              </AreaChart>
            </ResponsiveContainer>
          </figure>
        )}
      </section>
    );
  },
);

MatchProgressChart.displayName = "MatchProgressChart";
