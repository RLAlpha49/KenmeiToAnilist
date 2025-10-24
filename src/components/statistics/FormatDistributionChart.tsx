/**
 * @packageDocumentation
 * @module Statistics/FormatDistributionChart
 * @description Pie chart visualizing the distribution of manga formats for matched entries.
 */

import React, { useMemo } from "react";
import type { FC } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { BookOpen, AlertCircle } from "lucide-react";
import { cn } from "@/utils/tailwind";

/**
 * Minimal match result shape containing only selectedMatch for format extraction.
 */
type MinimalMatchResult = {
  readonly selectedMatch?: {
    readonly format?: string;
    readonly genres?: string[];
  };
};

interface FormatDistributionChartProps {
  /** Match results providing format information via selected AniList entries. */
  readonly matchResults?: Array<MinimalMatchResult> | null;
  /** Optional className override for layout control. */
  readonly className?: string;
}

type FormatDatum = {
  readonly name: string;
  readonly value: number;
  readonly color: string;
  readonly raw: string;
};

const FORMAT_LABELS: Record<string, string> = {
  manga: "Manga",
  novel: "Light Novel",
  one_shot: "One-Shot",
  "one-shot": "One-Shot",
  manhwa: "Manhwa",
  manhua: "Manhua",
  doujin: "Doujinshi",
};

const FORMAT_COLORS: Record<string, string> = {
  manga: "#3b82f6",
  novel: "#a855f7",
  one_shot: "#10b981",
  "one-shot": "#10b981",
  manhwa: "#f43f5e",
  manhua: "#f59e0b",
  doujin: "#6366f1",
};

/**
 * Generates format chart data from match results.
 * @param matchResults - Match result array.
 * @returns Processed format data.
 * @source
 */
function buildFormatData(
  matchResults?: Array<MinimalMatchResult> | null,
): FormatDatum[] {
  if (!matchResults?.length) return [];

  const counts = new Map<string, number>();

  for (const result of matchResults) {
    const format = result.selectedMatch?.format;
    if (!format) continue;
    const normalized = format.toLowerCase();
    // Skip placeholder "unknown" format values
    if (normalized === "unknown") continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const fallbackPalette = [
    "#3b82f6",
    "#a855f7",
    "#10b981",
    "#f43f5e",
    "#f59e0b",
    "#6366f1",
    "#ec4899",
  ];

  let fallbackIndex = 0;

  return Array.from(counts.entries())
    .map(([raw, value]) => {
      const displayName =
        FORMAT_LABELS[raw] ??
        raw
          .split(/[\s_-]+/)
          .map((segment) =>
            segment.length > 0
              ? segment[0].toUpperCase() + segment.slice(1)
              : segment,
          )
          .join(" ");
      const color =
        FORMAT_COLORS[raw] ??
        fallbackPalette[fallbackIndex++ % fallbackPalette.length];
      return { name: displayName, value, color, raw } satisfies FormatDatum;
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

/**
 * FormatDistributionChart renders a pie chart showing the breakdown of manga formats.
 * @param props - Component props containing match results.
 * @returns Pie chart visualization or empty state placeholder.
 * @source
 */
export const FormatDistributionChart: FC<FormatDistributionChartProps> =
  React.memo(function FormatDistributionChartMemo({ matchResults, className }) {
    const data = useMemo(() => buildFormatData(matchResults), [matchResults]);
    const total = useMemo(
      () => data.reduce((acc, item) => acc + item.value, 0),
      [data],
    );

    return (
      <section
        aria-label="Format distribution"
        className={cn(
          "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
          className,
        )}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-linear-to-r inline-flex h-9 min-h-9 w-9 min-w-9 items-center justify-center rounded-full from-blue-500/15 via-purple-500/15 to-emerald-500/15 text-blue-500 dark:text-blue-300">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-foreground text-lg font-semibold">
                Format Distribution
              </h2>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Breakdown of matched entries across manga formats.
            </p>
          </div>
          {total > 0 && (
            <span className="text-muted-foreground text-sm">
              {total.toLocaleString()} matched entries
            </span>
          )}
        </header>

        {data.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <AlertCircle className="mb-3 h-6 w-6" aria-hidden="true" />
            <p className="font-medium">Match manga to see format breakdown</p>
            <p className="mt-1 text-sm">
              Complete matching to reveal the formats in your AniList
              collection.
            </p>
          </div>
        ) : (
          <figure className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  labelLine={false}
                  label={(entry) => `${entry.value.toLocaleString()}`}
                >
                  {data.map((entry) => (
                    <Cell key={entry.raw} fill={entry.color} />
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
                    const numeric = Number(value ?? 0);
                    const percent = total > 0 ? numeric / total : 0;
                    return [
                      `${numeric.toLocaleString()} (${Math.round(percent * 100)}%)`,
                      name,
                    ];
                  }}
                />
                <Legend iconType="circle" verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </figure>
        )}
      </section>
    );
  });

FormatDistributionChart.displayName = "FormatDistributionChart";
