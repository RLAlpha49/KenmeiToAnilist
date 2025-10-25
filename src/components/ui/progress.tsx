import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/utils/tailwind";

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
  /** Accessible label describing what the progress bar represents */
  "aria-label"?: string;
  /** Custom text for screen reader announcements (e.g., "5 of 10 files") */
  "aria-valuetext"?: string;
};

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const ariaValuenow = typeof value === "number" ? value : undefined;

  return (
    <ProgressPrimitive.Progress
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...(ariaValuenow !== undefined && { "aria-valuenow": ariaValuenow })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={props["aria-label"] || "Progress"}
      aria-valuetext={props["aria-valuetext"]}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "bg-primary h-full w-full flex-1 transition-all",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Progress>
  );
}

export { Progress };
