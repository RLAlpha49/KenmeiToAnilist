/**
 * @packageDocumentation
 * @module Statistics/TopGenresChart
 * @description Horizontal bar chart displaying the most frequent genres across matched manga results.
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
import { Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/utils/tailwind";

/**
 * Minimal match result shape containing only selectedMatch for genre extraction.
 */
type MinimalMatchResult = {
  readonly selectedMatch?: {
    readonly format?: string;
    readonly genres?: string[];
  };
};

interface TopGenresChartProps {
  /** Array of match results used to calculate genre frequencies. */
  readonly matchResults?: Array<MinimalMatchResult> | null;
  /** Optional className override for the container. */
  readonly className?: string;
}

type GenreDatum = {
  readonly genre: string;
  readonly count: number;
};

const MAX_GENRES = 10;

/**
 * TopGenresChart renders a horizontal bar chart summarizing the top manga genres.
 * Genres are derived from selected AniList matches with fallback for missing data.
 * @param props - Component props containing match results and optional className.
 * @returns A bar chart or empty state when insufficient data is available.
 * @source
 */
export const TopGenresChart: FC<TopGenresChartProps> = React.memo(
  function TopGenresChartMemo({
    // eslint-disable-next-line react/prop-types
    matchResults,
    // eslint-disable-next-line react/prop-types
    className,
  }) {
    const { data, uniqueCount } = useMemo(() => {
      // eslint-disable-next-line react/prop-types
      if (!matchResults?.length) {
        return { data: [] as GenreDatum[], uniqueCount: 0 };
      }

      const counts = new Map<string, number>();

      for (const result of matchResults) {
        const genres = result.selectedMatch?.genres ?? [];
        for (const rawGenre of genres) {
          const genre = rawGenre?.trim();
          if (!genre) continue;
          counts.set(genre, (counts.get(genre) ?? 0) + 1);
        }
      }

      const sorted = Array.from(counts.entries())
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count);

      return {
        data: sorted.slice(0, MAX_GENRES),
        uniqueCount: counts.size,
      };
    }, [matchResults]);

    return (
      <section
        aria-label="Top genres chart"
        className={cn(
          "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90",
          className,
        )}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-linear-to-r inline-flex h-9 min-h-9 w-9 min-w-9 items-center justify-center rounded-full from-blue-500/20 via-purple-500/20 to-fuchsia-500/20 text-purple-500 dark:text-purple-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-foreground text-lg font-semibold">
                Top Genres
              </h2>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Most common genres from your matched AniList entries.
            </p>
          </div>
          {uniqueCount > 0 && (
            <span className="text-muted-foreground text-sm">
              {uniqueCount} unique genres
            </span>
          )}
        </header>

        {data.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <AlertCircle className="mb-3 h-6 w-6" aria-hidden="true" />
            <p className="font-medium">Match manga to see genre statistics</p>
            <p className="mt-1 text-sm">
              Review your imported titles and link them to AniList entries
              first.
            </p>
          </div>
        ) : (
          <figure className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" barCategoryGap={12}>
                <defs>
                  <linearGradient
                    id="genreGradient"
                    x1="0"
                    x2="1"
                    y1="0"
                    y2="0"
                  >
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="genre"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--muted))",
                    borderRadius: "calc(var(--radius) - 4px)",
                    padding: "0.5rem 0.75rem",
                    border: "none",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(value: number) =>
                    `${Number(value).toLocaleString()} manga`
                  }
                />
                <Bar
                  dataKey="count"
                  fill="url(#genreGradient)"
                  radius={[8, 8, 8, 8]}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </figure>
        )}
      </section>
    );
  },
);

TopGenresChart.displayName = "TopGenresChart";
