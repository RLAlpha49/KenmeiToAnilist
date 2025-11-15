/**
 * @packageDocumentation
 * @module components/ui/slider
 * @description Dual-handle range slider component for min/max value selection.
 * @source
 */
import React, { useCallback } from "react";
import { cn } from "@/utils/tailwind";

/**
 * Props for the RangeSlider component.
 * @property min - Minimum allowed value.
 * @property max - Maximum allowed value.
 * @property step - Step size for slider increments (default: 1).
 * @property value - Current min/max values.
 * @property onChange - Callback when values change.
 * @property label - Optional label for the slider.
 * @property className - Optional custom CSS classes.
 * @source
 */
interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: { min: number; max: number };
  onChange: (value: { min: number; max: number }) => void;
  label?: string;
  className?: string;
}

/**
 * Dual-handle range slider component for selecting min/max values.
 * Used for confidence range filtering in advanced filters.
 * @param props - Range slider props.
 * @returns Styled range slider element.
 * @source
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  className,
}: Readonly<RangeSliderProps>) {
  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMin = Number(e.target.value);
      if (newMin <= value.max) {
        onChange({ min: newMin, max: value.max });
      }
    },
    [value.max, onChange],
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMax = Number(e.target.value);
      if (newMax >= value.min) {
        onChange({ min: value.min, max: newMax });
      }
    },
    [value.min, onChange],
  );

  const minPercent = ((value.min - min) / (max - min)) * 100;
  const maxPercent = ((value.max - min) / (max - min)) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative h-8">
        {/* Track background */}
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />

        {/* Active range */}
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-blue-500"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
          }}
        />

        {/* Min handle */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.min}
          onChange={handleMinChange}
          className="pointer-events-none absolute top-1/2 h-2 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          aria-label="Minimum value"
        />

        {/* Max handle */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.max}
          onChange={handleMaxChange}
          className="pointer-events-none absolute top-1/2 h-2 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          aria-label="Maximum value"
        />
      </div>

      {/* Value display */}
      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
        <span>{value.min}%</span>
        <span>{value.max}%</span>
      </div>
    </div>
  );
}
