import React from "react";
import { cn } from "@/utils/tailwind";

export interface ConfidenceBadgeProps {
  confidence?: number | null;
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  className,
}: Readonly<ConfidenceBadgeProps>) {
  // If confidence is undefined, null, or NaN, return null (don't render anything)
  if (
    confidence === undefined ||
    confidence === null ||
    Number.isNaN(confidence)
  ) {
    return null;
  }

  // Round the confidence value for display and comparison
  const roundedConfidence = Math.min(99, Math.round(confidence)); // Cap at 99%

  // Determine color scheme and label based on confidence level
  let containerClass = "";
  let chipClass = "";
  let trackClass = "";
  let barClass = "";
  let label = "";

  if (roundedConfidence >= 90) {
    containerClass =
      "border-emerald-200/70 bg-gradient-to-r from-emerald-100/85 via-emerald-50/70 to-emerald-100/80 text-emerald-900 shadow-[0_14px_40px_-18px_rgba(22,101,52,0.45)] dark:border-emerald-500/40 dark:from-emerald-900/40 dark:via-emerald-900/25 dark:to-emerald-800/35 dark:text-emerald-100";
    chipClass =
      "bg-white/85 text-emerald-600 shadow-inner dark:bg-emerald-950/70 dark:text-emerald-100";
    trackClass = "bg-emerald-200/70 dark:bg-emerald-900/40";
    barClass = "bg-emerald-500 dark:bg-emerald-400";
    label = "High";
  } else if (roundedConfidence >= 75) {
    containerClass =
      "border-blue-200/70 bg-gradient-to-r from-blue-100/80 via-blue-50/65 to-blue-100/75 text-blue-900 shadow-[0_14px_38px_-18px_rgba(37,99,235,0.35)] dark:border-blue-500/35 dark:from-blue-950/40 dark:via-blue-900/25 dark:to-blue-800/35 dark:text-blue-100";
    chipClass =
      "bg-white/85 text-blue-600 shadow-inner dark:bg-blue-950/70 dark:text-blue-100";
    trackClass = "bg-blue-200/70 dark:bg-blue-900/40";
    barClass = "bg-blue-500 dark:bg-blue-400";
    label = "Good";
  } else if (roundedConfidence >= 50) {
    containerClass =
      "border-amber-200/70 bg-gradient-to-r from-amber-50/80 via-amber-100/65 to-amber-50/75 text-amber-900 shadow-[0_14px_32px_-18px_rgba(217,119,6,0.35)] dark:border-amber-500/30 dark:from-amber-950/50 dark:via-amber-900/30 dark:to-amber-800/35 dark:text-amber-100";
    chipClass =
      "bg-white/85 text-amber-600 shadow-inner dark:bg-amber-950/70 dark:text-amber-100";
    trackClass = "bg-amber-200/70 dark:bg-amber-900/40";
    barClass = "bg-amber-500 dark:bg-amber-400";
    label = "Medium";
  } else {
    containerClass =
      "border-rose-200/70 bg-gradient-to-r from-rose-100/80 via-rose-50/65 to-rose-100/75 text-rose-900 shadow-[0_14px_32px_-18px_rgba(225,29,72,0.35)] dark:border-rose-500/35 dark:from-rose-950/40 dark:via-rose-900/25 dark:to-rose-800/35 dark:text-rose-100";
    chipClass =
      "bg-white/85 text-rose-600 shadow-inner dark:bg-rose-950/70 dark:text-rose-100";
    trackClass = "bg-rose-200/60 dark:bg-rose-900/40";
    barClass = "bg-rose-500 dark:bg-rose-400";
    label = "Low";
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-2xl border px-3 py-2 text-xs font-semibold tracking-[0.18em] uppercase",
        containerClass,
        className,
      )}
      title={`${roundedConfidence}% confidence match`}
      aria-label={`${label} confidence match: ${roundedConfidence}%`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold ${chipClass}`}
      >
        {roundedConfidence}%
      </div>
      <div className="flex flex-col gap-1 text-left">
        <span className="text-[10px] font-semibold tracking-[0.28em] text-current opacity-80">
          Confidence
        </span>
        <span className="text-xs font-bold tracking-normal text-current">
          {label}
        </span>
        <div
          className={`h-1.5 w-28 overflow-hidden rounded-full ${trackClass}`}
        >
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${roundedConfidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default ConfidenceBadge;
