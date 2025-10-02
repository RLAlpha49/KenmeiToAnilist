import React from "react";
import {
  Search,
  Wand2,
  CheckCircle2,
  Clock3,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { cn } from "../../../utils/tailwind";

export interface MatchStatisticsCardProps {
  matchStats: {
    total: number;
    matched: number;
    pending: number;
    manual: number;
    skipped: number;
  };
  noMatchesCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function MatchStatisticsCard({
  matchStats,
  noMatchesCount,
  searchTerm,
  onSearchTermChange,
  searchInputRef,
}: Readonly<MatchStatisticsCardProps>) {
  const reviewedTotal =
    matchStats.matched + matchStats.manual + matchStats.skipped;

  const statTiles = [
    {
      label: "Reviewed",
      value: reviewedTotal,
      helper: "Accepted or skipped",
      icon: CheckCircle2,
      accent:
        "from-emerald-400/20 via-emerald-500/10 to-transparent text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Manual",
      value: matchStats.manual,
      helper: "Hand-picked matches",
      icon: Wand2,
      accent:
        "from-sky-400/20 via-sky-500/10 to-transparent text-sky-600 dark:text-sky-300",
    },
    {
      label: "Pending",
      value: matchStats.pending,
      helper: "Need your review",
      icon: Clock3,
      accent:
        "from-amber-400/20 via-amber-500/10 to-transparent text-amber-600 dark:text-amber-300",
    },
  ];

  return (
    <Card className="relative mb-4 overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute top-0 -left-10 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
      <CardHeader className="relative z-10 border-b border-white/40 pb-4 dark:border-slate-800/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
              Match Statistics
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {matchStats.total} titles imported · {reviewedTotal} already
              reviewed
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:flex dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
            <Layers className="h-3.5 w-3.5" />
            Overview
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {statTiles.map(({ label, value, helper, icon: Icon, accent }) => (
            <div
              key={label}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/40 bg-white/65 p-4 shadow-md transition-all hover:border-white/60 hover:bg-white/80 dark:border-slate-800/60 dark:bg-slate-900/65 dark:hover:border-slate-700",
                accent,
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-40 transition-opacity duration-300 group-hover:opacity-70" />
              <div className="relative flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  <span>{label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {value}
                  </span>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {helper}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)]">
          <div className="relative">
            <Search
              className={cn("absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2")}
            />
            <Input
              ref={searchInputRef}
              type="text"
              className="h-12 rounded-2xl border border-white/40 bg-white/80 pr-4 pl-11 text-sm shadow-inner shadow-slate-900/5 backdrop-blur placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-300 dark:border-slate-800/60 dark:bg-slate-900/70 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-500"
              placeholder="Search titles instantly… (Ctrl+F)"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              aria-label="Search manga titles"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>No matches</span>
            </div>
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              {noMatchesCount}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
