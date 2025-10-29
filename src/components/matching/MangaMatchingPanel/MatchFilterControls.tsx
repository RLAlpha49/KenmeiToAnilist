import React, { Dispatch, SetStateAction } from "react";
import { Filter, CheckCircle2, Clock3, Wand2, XOctagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { cn } from "../../../utils/tailwind";

/**
 * State object for match status filters.
 *
 * @property matched - Whether to show matched results.
 * @property pending - Whether to show pending results.
 * @property manual - Whether to show manual search results.
 * @property skipped - Whether to show skipped results.
 * @source
 */
export interface StatusFiltersState {
  matched: boolean;
  pending: boolean;
  manual: boolean;
  skipped: boolean;
}

/**
 * Statistics for different match statuses.
 *
 * @property matched - Count of matched results.
 * @property pending - Count of pending results.
 * @property manual - Count of manual search results.
 * @property skipped - Count of skipped results.
 * @source
 */
export interface MatchFilterStats {
  matched: number;
  pending: number;
  manual: number;
  skipped: number;
}

/**
 * Props for the MatchFilterControls component.
 *
 * @property statusFilters - Current filter state.
 * @property setStatusFilters - Callback to update filter state.
 * @property matchStats - Statistics for filter display.
 * @source
 */
export interface MatchFilterControlsProps {
  statusFilters: StatusFiltersState;
  setStatusFilters: Dispatch<SetStateAction<StatusFiltersState>>;
  matchStats: MatchFilterStats;
}

/**
 * Displays filter control buttons for manga match statuses.
 *
 * Allows users to toggle visibility of matched, pending, manual, and skipped items.
 *
 * @param props - The component props.
 * @returns The rendered filter controls.
 * @source
 */
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

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute -left-12 top-0 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />
      <CardHeader className="relative z-10 flex min-h-[70px] border-b border-white/40 pb-4 dark:border-slate-800/60">
        <div className="flex w-full items-center gap-3">
          <div className="flex min-h-9 min-w-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
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
      </CardHeader>
      <CardContent className="relative z-10 flex-1 p-5">
        <div className="grid h-full grid-cols-2 gap-3">
          {statusOptions.map(
            ({ key, label, count, icon: Icon, accent, badgeClass }) => {
              const isActive = statusFilters[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStatus(key)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-white/40 bg-white/65 p-3 text-left shadow-md transition-all hover:scale-[1.01] hover:border-white/60 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-800/60 dark:bg-slate-900/65 dark:hover:border-slate-700",
                    accent,
                    isActive
                      ? "ring-offset-background ring-2 ring-sky-400 ring-offset-2 dark:ring-offset-slate-900"
                      : "opacity-80",
                  )}
                >
                  <div className="bg-linear-to-br absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-70" />
                  <div className="relative flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70",
                            isActive && "border-sky-400/40 text-sky-500",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {label}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(badgeClass, "flex shrink-0")}
                      >
                        {count}
                      </Badge>
                    </div>
                    <span className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
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

/** Memoized MatchFilterControls component for performance optimization. @source */
const MatchFilterControls = React.memo(MatchFilterControlsComponent);
MatchFilterControls.displayName = "MatchFilterControls";

export { MatchFilterControls };
