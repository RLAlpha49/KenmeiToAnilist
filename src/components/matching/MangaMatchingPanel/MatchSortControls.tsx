import React, { Dispatch, SetStateAction } from "react";
import {
  ArrowUpDown,
  Type,
  ListFilter,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { cn } from "../../../utils/tailwind";

export type SortField = "title" | "status" | "confidence" | "chaptersRead";

export interface SortOption {
  field: SortField;
  direction: "asc" | "desc";
}

export interface MatchSortControlsProps {
  sortOption: SortOption;
  setSortOption: Dispatch<SetStateAction<SortOption>>;
}

function MatchSortControlsComponent({
  sortOption,
  setSortOption,
}: Readonly<MatchSortControlsProps>) {
  const handleSortChange = (field: SortField) => {
    setSortOption((prev) => {
      if (prev.field === field) {
        return {
          ...prev,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        field,
        direction: field === "title" ? "asc" : "desc",
      };
    });
  };

  const renderSortIndicator = () => {
    const rotation = sortOption.direction === "asc" ? "rotate-180" : "";
    return (
      <span
        className={cn(
          "inline-block text-[10px] transition-transform duration-150 ease-in-out",
          rotation,
        )}
        aria-label={sortOption.direction === "asc" ? "Ascending" : "Descending"}
      >
        ▼
      </span>
    );
  };

  const sortOptions: Array<{
    field: SortField;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }> = [
    {
      field: "title",
      label: "Title",
      icon: Type,
      accent: "from-slate-400/20 via-slate-500/10 to-transparent",
    },
    {
      field: "status",
      label: "Status",
      icon: ListFilter,
      accent: "from-emerald-400/20 via-emerald-500/10 to-transparent",
    },
    {
      field: "confidence",
      label: "Confidence",
      icon: Sparkles,
      accent: "from-violet-400/20 via-violet-500/10 to-transparent",
    },
    {
      field: "chaptersRead",
      label: "Chapters",
      icon: BookOpen,
      accent: "from-amber-400/20 via-amber-500/10 to-transparent",
    },
  ];

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/75 py-0 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-blue-400/15 blur-3xl" />
      <CardHeader className="relative z-10 flex min-h-[60px] border-b border-white/40 pb-3 pt-4 dark:border-slate-800/60">
        <div className="flex w-full items-center gap-3">
          <div className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
            <ArrowUpDown className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
              Sort Priorities
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex-1 p-4">
        <div className="flex flex-col gap-3">
          {sortOptions.map(({ field, label, icon: Icon, accent }) => {
            const isActive = sortOption.field === field;
            return (
              <button
                key={field}
                type="button"
                onClick={() => handleSortChange(field)}
                className={cn(
                  "group relative flex w-full items-center gap-2 overflow-hidden rounded-xl border border-white/40 bg-white/65 px-3 py-2 text-left shadow-sm transition-all hover:border-white/60 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-slate-800/60 dark:bg-slate-900/65 dark:hover:border-slate-700",
                  accent,
                  isActive
                    ? "ring-offset-background ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white">
                  {label}
                </span>
                {isActive && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 px-1.5 text-[10px]"
                  >
                    {renderSortIndicator()}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const MatchSortControls = React.memo(MatchSortControlsComponent);
MatchSortControls.displayName = "MatchSortControls";

export { MatchSortControls };
