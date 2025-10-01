import React from "react";

export interface ConfidenceBadgeProps {
  confidence?: number | null;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
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
  let colorClass = "";
  let barColorClass = "";
  let label = "";

  if (roundedConfidence >= 90) {
    colorClass =
      "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
    barColorClass = "bg-green-500 dark:bg-green-400";
    label = "High";
  } else if (roundedConfidence >= 75) {
    colorClass =
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
    barColorClass = "bg-blue-500 dark:bg-blue-400";
    label = "Good";
  } else if (roundedConfidence >= 50) {
    colorClass =
      "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800";
    barColorClass = "bg-yellow-500 dark:bg-yellow-400";
    label = "Medium";
  } else {
    colorClass =
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
    barColorClass = "bg-red-500 dark:bg-red-400";
    label = "Low";
  }

  return (
    <div
      className={`relative flex flex-col rounded-md border px-2.5 py-1 text-xs font-medium ${colorClass}`}
      title={`${roundedConfidence}% confidence match`}
      aria-label={`${label} confidence match: ${roundedConfidence}%`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="mr-1 font-semibold">{label}</span>
        <span className="font-mono">{roundedConfidence}%</span>
      </div>

      {/* Progress bar background */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        {/* Progress bar indicator */}
        <div
          className={`h-full rounded-full ${barColorClass}`}
          style={{ width: `${roundedConfidence}%` }}
        ></div>
      </div>
    </div>
  );
}

export default ConfidenceBadge;
