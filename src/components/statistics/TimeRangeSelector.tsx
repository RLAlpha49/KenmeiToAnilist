/**
 * @packageDocumentation
 * @module TimeRangeSelector
 * @description Button group component for selecting time ranges.
 */

import React, { type FC } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import type { TimeRange } from "@/utils/statisticsAdapter";

/**
 * Props for TimeRangeSelector component.
 * @source
 */
interface TimeRangeSelectorProps {
  readonly value: TimeRange;
  readonly onChange: (range: TimeRange) => void;
  readonly className?: string;
}

/**
 * Time range options configuration with display labels.
 * Provides 7 days, 30 days, 90 days, and all-time selection options.
 * @source
 */
const TIME_RANGE_OPTIONS = [
  { value: "7d" as const, label: "7 Days", shortLabel: "7D" },
  { value: "30d" as const, label: "30 Days", shortLabel: "30D" },
  { value: "90d" as const, label: "90 Days", shortLabel: "90D" },
  { value: "all" as const, label: "All Time", shortLabel: "All" },
];

/**
 * TimeRangeSelector - Button group for selecting time ranges.
 * Provides quick switching between predefined time periods for chart analysis.
 * @param props - Component props with current value and change handler.
 * @returns Button group control with active state indication.
 * @source
 */
export const TimeRangeSelector: FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Label */}
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline">Time Range:</span>
      </div>

      {/* Button Group */}
      <fieldset
        aria-label="Time range selector"
        className="inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-800"
      >
        <legend className="sr-only">Time Range</legend>
        {TIME_RANGE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              value === option.value
                ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                : "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            <span className="hidden sm:inline">{option.label}</span>
            <span className="inline sm:hidden">{option.shortLabel}</span>
          </Button>
        ))}
      </fieldset>
    </div>
  );
};

TimeRangeSelector.displayName = "TimeRangeSelector";
