/**
 * @packageDocumentation
 * @module RematchOptions
 * @description React component for configuring and triggering rematch operations for manga entries by status.
 */
import React from "react";
import { StatusFilterOptions } from "../../types/matching";
import { MangaMatchResult } from "../../api/anilist/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import {
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  X,
  Sparkles,
  Clock3,
  Hand,
  Slash,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";

/**
 * Props for the RematchOptions component.
 *
 * @property selectedStatuses - The current status filter options for rematching.
 * @property onChangeSelectedStatuses - Callback to update the selected statuses.
 * @property matchResults - The list of manga match results.
 * @property rematchWarning - Optional warning message to display.
 * @property onRematchByStatus - Callback to trigger rematching by selected statuses.
 * @property onCloseOptions - Callback to close the rematch options panel.
 * @internal
 * @source
 */
export interface RematchOptionsProps {
  selectedStatuses: StatusFilterOptions;
  onChangeSelectedStatuses: (statuses: StatusFilterOptions) => void;
  matchResults: MangaMatchResult[];
  rematchWarning: string | null;
  onRematchByStatus: () => void;
  onCloseOptions: () => void;
}

/**
 * RematchOptions React component for configuring and triggering rematch operations for manga entries by status.
 *
 * @param props - The props for the RematchOptions component.
 * @returns The rendered rematch options panel React element.
 * @source
 */
export const RematchOptions: React.FC<RematchOptionsProps> = ({
  selectedStatuses,
  onChangeSelectedStatuses,
  matchResults,
  rematchWarning,
  onRematchByStatus,
  onCloseOptions,
}) => {
  const toggleStatus = (status: keyof StatusFilterOptions) => {
    onChangeSelectedStatuses({
      ...selectedStatuses,
      [status]: !selectedStatuses[status],
    });
  };

  const resetToDefault = () => {
    onChangeSelectedStatuses({
      ...selectedStatuses,
      pending: true,
      skipped: true,
      matched: false,
      manual: false,
    });
  };

  // Calculate the total count of manga to be rematched
  const calculateTotalCount = () => {
    return Object.entries(selectedStatuses)
      .filter(([, selected]) => selected)
      .reduce((count, [status]) => {
        return count + matchResults.filter((m) => m.status === status).length;
      }, 0);
  };

  // Calculate individual counts for status badges
  const statusCounts = {
    pending: matchResults.filter((m) => m.status === "pending").length,
    skipped: matchResults.filter((m) => m.status === "skipped").length,
    matched: matchResults.filter((m) => m.status === "matched").length,
    manual: matchResults.filter((m) => m.status === "manual").length,
  };

  type RematchStatusKey = Extract<
    keyof StatusFilterOptions,
    "pending" | "matched" | "manual" | "skipped"
  >;

  const statusOptions: Array<{
    key: RematchStatusKey;
    label: string;
    description: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    accentClass: string;
    badgeClass: string;
  }> = [
    {
      key: "pending",
      label: "Pending",
      description: "Queued for a fresh AniList lookup",
      icon: Clock3,
      accentClass:
        "bg-gradient-to-br from-blue-500/20 via-blue-400/15 to-cyan-400/10 text-blue-600 dark:from-blue-500/25 dark:via-blue-500/15 dark:to-cyan-500/10 dark:text-blue-200",
      badgeClass:
        "bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    },
    {
      key: "matched",
      label: "Matched",
      description: "Already aligned titles you may want to re-evaluate",
      icon: Sparkles,
      accentClass:
        "bg-gradient-to-br from-emerald-500/20 via-emerald-400/15 to-teal-400/10 text-emerald-600 dark:from-emerald-500/25 dark:via-emerald-500/15 dark:to-teal-500/10 dark:text-emerald-200",
      badgeClass:
        "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
    },
    {
      key: "manual",
      label: "Manual",
      description: "Titles waiting for your curated matches",
      icon: Hand,
      accentClass:
        "bg-gradient-to-br from-purple-500/20 via-indigo-400/15 to-blue-400/10 text-purple-600 dark:from-purple-500/25 dark:via-indigo-500/15 dark:to-blue-500/10 dark:text-purple-200",
      badgeClass:
        "bg-purple-100/80 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200",
    },
    {
      key: "skipped",
      label: "Skipped",
      description: "Entries previously skipped during matching",
      icon: Slash,
      accentClass:
        "bg-gradient-to-br from-rose-500/20 via-orange-400/15 to-amber-400/10 text-rose-600 dark:from-rose-500/25 dark:via-orange-500/15 dark:to-amber-500/10 dark:text-rose-200",
      badgeClass:
        "bg-rose-100/80 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="relative mb-6 flex flex-col overflow-hidden border border-blue-200/70 bg-gradient-to-br from-white/92 via-white/85 to-blue-50/75 py-0 shadow-xl shadow-blue-500/10 supports-[backdrop-filter]:backdrop-blur-md dark:border-blue-900/60 dark:from-slate-950/70 dark:via-slate-950/55 dark:to-blue-950/45">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-200/18 via-indigo-200/12 to-transparent dark:from-blue-900/25 dark:via-indigo-900/15 dark:to-transparent" />
        <CardHeader className="relative border-b border-blue-100/60 bg-gradient-to-r from-blue-50/80 via-indigo-50/70 to-purple-50/65 py-3 dark:border-blue-900/50 dark:from-blue-950/40 dark:via-indigo-950/35 dark:to-purple-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 shadow-sm shadow-blue-500/25 dark:bg-blue-500/12 dark:text-blue-200">
                <RefreshCw className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Rematch Options
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose which states should get a fresh search run
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseOptions}
              className="h-8 w-8 rounded-full border border-transparent bg-white/70 text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-slate-900/80"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-5 p-6 pb-4">
          {rematchWarning && (
            <Alert
              variant="default"
              className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/20"
            >
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-400">
                Warning
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                {rematchWarning}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                Status Filters
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefault}
                className="h-8 gap-1 rounded-full border border-blue-100/60 bg-white/70 px-3 text-xs font-semibold tracking-[0.18em] text-blue-600 uppercase shadow-sm hover:border-blue-200 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-slate-950/60 dark:text-blue-200 dark:hover:border-blue-800"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {statusOptions.map(
                ({
                  key,
                  label,
                  description,
                  icon: Icon,
                  accentClass,
                  badgeClass,
                }) => {
                  const checkboxId = `status-${key}`;
                  const isSelected = selectedStatuses[key];

                  return (
                    <label
                      key={key}
                      htmlFor={checkboxId}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm shadow-blue-500/10 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl dark:border-slate-800/60 dark:bg-slate-950/65"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent opacity-70 dark:from-slate-900/50" />
                      <div className="relative flex items-start gap-3">
                        <Checkbox
                          id={checkboxId}
                          checked={isSelected}
                          onCheckedChange={() => toggleStatus(key)}
                          className="mt-1 border-blue-300 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white dark:border-blue-800 dark:data-[state=checked]:text-slate-900"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-inner ${accentClass}`}
                              >
                                <Icon className="h-5 w-5" />
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {label}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className={`px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
                                  >
                                    {statusCounts[key]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {description}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs font-medium tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">
                            <span>{isSelected ? "Included" : "Excluded"}</span>
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                              <Layers className="h-3.5 w-3.5" /> Queue position
                            </span>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                },
              )}
            </div>
          </div>

          <div className="relative flex flex-col gap-3 rounded-2xl border border-blue-200/60 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-cyan-500/10 p-5 shadow-inner sm:flex-row sm:items-center sm:justify-between dark:border-blue-500/25 dark:from-blue-500/12 dark:via-indigo-500/12 dark:to-cyan-500/12">
            <div className="flex items-center gap-3 text-sm font-medium text-blue-700 dark:text-blue-200">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 shadow-sm shadow-blue-500/20 dark:bg-blue-500/12 dark:text-blue-200">
                <RefreshCw className="h-5 w-5" />
              </span>
              <div>
                <span className="block text-xs tracking-[0.24em] text-blue-500/80 uppercase dark:text-blue-300/80">
                  Queue Summary
                </span>
                <span className="text-base font-semibold text-blue-700 dark:text-blue-100">
                  {calculateTotalCount()} manga selected for rematch
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefault}
              className="hidden h-9 gap-1 rounded-full border border-blue-200/70 bg-white/70 px-3 text-xs font-semibold tracking-[0.18em] text-blue-600 uppercase shadow-sm hover:border-blue-300 hover:bg-blue-50 sm:flex dark:border-blue-800/60 dark:bg-slate-950/70 dark:text-blue-200 dark:hover:border-blue-700"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset filters
            </Button>
          </div>
        </CardContent>

        <CardFooter className="relative flex flex-col gap-3 border-t border-blue-100/70 bg-gradient-to-r from-blue-50/80 via-indigo-50/70 to-purple-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/50 dark:from-blue-950/45 dark:via-indigo-950/35 dark:to-purple-950/30">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {calculateTotalCount() === 0
              ? "Select at least one status to enable rematching."
              : "We'll run a fresh search for every selected status group."}
          </div>
          <Button
            variant="default"
            onClick={onRematchByStatus}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-base font-semibold shadow-lg shadow-blue-500/25 transition hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 focus-visible:ring-blue-400 sm:w-auto"
            disabled={calculateTotalCount() === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Fresh Search Selected ({calculateTotalCount()})
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};
