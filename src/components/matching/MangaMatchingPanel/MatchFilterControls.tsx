import React, { Dispatch, SetStateAction } from "react";
import {
  Filter,
  Sparkles,
  CheckCircle2,
  Clock3,
  Wand2,
  XOctagon,
  Target,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { cn } from "../../../utils/tailwind";

export interface StatusFiltersState {
  matched: boolean;
  pending: boolean;
  manual: boolean;
  skipped: boolean;
}

export interface MatchFilterStats {
  matched: number;
  pending: number;
  manual: number;
  skipped: number;
}

export interface MatchFilterControlsProps {
  statusFilters: StatusFiltersState;
  setStatusFilters: Dispatch<SetStateAction<StatusFiltersState>>;
  matchStats: MatchFilterStats;
}

function MatchFilterControlsComponent({
  statusFilters,
  setStatusFilters,
  matchStats,
}: Readonly<MatchFilterControlsProps>) {
  const statusOptions: Array<{
    key: keyof StatusFiltersState;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    badgeClass: string;
  }> = [
    {
      key: "matched",
      label: "Matched",
      count: matchStats.matched,
      icon: CheckCircle2,
      accent:
        "from-emerald-400/20 via-emerald-500/10 to-transparent text-emerald-600 dark:text-emerald-300",
      badgeClass:
        "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200",
    },
    {
      key: "pending",
      label: "Pending",
      count: matchStats.pending,
      icon: Clock3,
      accent:
        "from-amber-400/20 via-amber-500/10 to-transparent text-amber-600 dark:text-amber-300",
      badgeClass:
        "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200",
    },
    {
      key: "manual",
      label: "Manual",
      count: matchStats.manual,
      icon: Wand2,
      accent:
        "from-sky-400/20 via-sky-500/10 to-transparent text-sky-600 dark:text-sky-300",
      badgeClass:
        "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200",
    },
    {
      key: "skipped",
      label: "Skipped",
      count: matchStats.skipped,
      icon: XOctagon,
      accent:
        "from-rose-400/20 via-rose-500/10 to-transparent text-rose-600 dark:text-rose-300",
      badgeClass:
        "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200",
    },
  ];

  const toggleStatus = (key: keyof StatusFiltersState) => {
    setStatusFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setStatuses = (value: boolean) => {
    setStatusFilters({
      matched: value,
      pending: value,
      manual: value,
      skipped: value,
    });
  };

  const focusPending = () => {
    setStatusFilters({
      matched: false,
      pending: true,
      manual: false,
      skipped: false,
    });
  };

  const reviewedOnly = () => {
    setStatusFilters({
      matched: true,
      pending: false,
      manual: true,
      skipped: true,
    });
  };

  return (
    <Card className="relative mb-4 overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute top-0 -left-12 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />
      <CardHeader className="relative z-10 flex flex-col gap-2 border-b border-white/40 pb-4 md:flex-row md:items-center md:justify-between dark:border-slate-800/60">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
              Status Filters
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Highlight exactly the matches you want to focus on.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatuses(true)}
            className="h-8 gap-2 rounded-full border border-white/40 bg-white/40 px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase hover:bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300"
          >
            <Layers className="h-3.5 w-3.5" />
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatuses(false)}
            className="h-8 gap-2 rounded-full border border-white/40 bg-white/40 px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase hover:bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Clear All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={focusPending}
            className="h-8 gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 text-xs font-semibold tracking-wide text-amber-600 uppercase hover:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-200"
          >
            <Target className="h-3.5 w-3.5" />
            Focus Pending
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={reviewedOnly}
            className="h-8 gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 text-xs font-semibold tracking-wide text-emerald-600 uppercase hover:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reviewed Only
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statusOptions.map(
            ({ key, label, count, icon: Icon, accent, badgeClass }) => {
              const isActive = statusFilters[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStatus(key)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-white/40 bg-white/65 p-4 text-left shadow-md transition-all hover:scale-[1.01] hover:border-white/60 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-800/60 dark:bg-slate-900/65 dark:hover:border-slate-700",
                    accent,
                    isActive
                      ? "ring-offset-background ring-2 ring-sky-400 ring-offset-2 dark:ring-offset-slate-900"
                      : "opacity-80",
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br opacity-40 transition-opacity duration-300 group-hover:opacity-70" />
                  <div className="relative flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70",
                            isActive && "border-sky-400/40 text-sky-500",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {label}
                        </span>
                      </div>
                      <Badge variant="secondary" className={badgeClass}>
                        {count}
                      </Badge>
                    </div>
                    <span className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      {isActive ? "Visible" : "Hidden"}
                    </span>
                  </div>
                </button>
              );
            },
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const MatchFilterControls = React.memo(MatchFilterControlsComponent);
MatchFilterControls.displayName = "MatchFilterControls";

export { MatchFilterControls };
