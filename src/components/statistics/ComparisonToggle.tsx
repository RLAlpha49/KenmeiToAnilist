/**
 * @packageDocumentation
 * @module ComparisonToggle
 * @description Toggle component for enabling/disabling comparison mode in statistics.
 */

import React, { type FC } from "react";
import { GitCompare, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/tailwind";
import type { ComparisonMode } from "@/types/statistics";
import type { TimeRange } from "@/utils/statisticsAdapter";
import { TimeRangeSelector } from "@/components/statistics/TimeRangeSelector";

/**
 * Props for ComparisonToggle component.
 * @source
 */
interface ComparisonToggleProps {
  readonly comparisonMode: ComparisonMode;
  readonly onComparisonChange: (mode: ComparisonMode) => void;
  readonly disabled?: boolean;
}

/**
 * Metric options for comparison.
 * @source
 */
const METRIC_OPTIONS = [
  { value: "chapters" as const, label: "Chapters" },
  { value: "velocity" as const, label: "Velocity" },
  { value: "habits" as const, label: "Habits" },
];

/**
 * ComparisonToggle - Toggle component for comparison mode.
 * Allows users to enable comparison mode and select two time ranges to compare.
 * @param props - Component props with comparison state and change handler.
 * @returns Compact comparison mode control.
 * @source
 */
export const ComparisonToggle: FC<ComparisonToggleProps> = ({
  comparisonMode,
  onComparisonChange,
  disabled = false,
}) => {
  const handleToggle = () => {
    onComparisonChange({
      ...comparisonMode,
      enabled: !comparisonMode.enabled,
    });
  };

  const handlePrimaryRangeChange = (range: TimeRange) => {
    onComparisonChange({
      ...comparisonMode,
      primaryRange: range,
    });
  };

  const handleSecondaryRangeChange = (range: TimeRange) => {
    onComparisonChange({
      ...comparisonMode,
      secondaryRange: range,
    });
  };

  const handleMetricChange = (metric: "chapters" | "velocity" | "habits") => {
    onComparisonChange({
      ...comparisonMode,
      metric,
    });
  };

  const rangeLabels: Record<TimeRange, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    all: "All time",
  };

  const isInvalid =
    comparisonMode.enabled &&
    comparisonMode.primaryRange === comparisonMode.secondaryRange;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-lg border-slate-200/50 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/80",
        comparisonMode.enabled && "border-blue-500 dark:border-blue-600",
      )}
    >
      <div className="space-y-3">
        {/* Toggle Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            <GitCompare className="h-4 w-4" />
            <span>Compare Periods</span>
          </div>
          <Button
            variant={comparisonMode.enabled ? "default" : "outline"}
            size="sm"
            onClick={handleToggle}
            disabled={disabled}
            className={cn(
              "ml-auto h-7 px-3 text-xs",
              comparisonMode.enabled &&
                "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
            )}
          >
            {comparisonMode.enabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {/* Time Range Selectors (shown when enabled) */}
        {comparisonMode.enabled && (
          <div className="space-y-3">
            {/* Primary Range */}
            <div>
              <span className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Primary Period
              </span>
              <TimeRangeSelector
                value={comparisonMode.primaryRange}
                onChange={handlePrimaryRangeChange}
              />
            </div>

            {/* Secondary Range */}
            <div>
              <span className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Comparison Period
              </span>
              <TimeRangeSelector
                value={comparisonMode.secondaryRange}
                onChange={handleSecondaryRangeChange}
              />
            </div>

            {/* Metric Selector */}
            <div className="flex items-center gap-2">
              <span className="min-w-20 text-xs font-medium text-slate-600 dark:text-slate-400">
                Metric
              </span>
              <select
                value={comparisonMode.metric}
                onChange={(e) =>
                  handleMetricChange(
                    e.target.value as "chapters" | "velocity" | "habits",
                  )
                }
                className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              >
                {METRIC_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Validation Warning */}
            {isInvalid && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Cannot compare the same time range. Please select different
                  periods.
                </span>
              </div>
            )}

            {/* Active Comparison Summary */}
            {!isInvalid && (
              <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                Comparing{" "}
                <strong>{rangeLabels[comparisonMode.primaryRange]}</strong> vs{" "}
                <strong>{rangeLabels[comparisonMode.secondaryRange]}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
