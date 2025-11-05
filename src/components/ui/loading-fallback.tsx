/**
 * @packageDocumentation
 * @module components/ui/loading-fallback
 * @description Loading fallback components for various loading states.
 * @source
 */
import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Props for the LoadingFallback component.
 * @property message - Loading message text (default: "Loading...").
 * @property className - Optional custom CSS classes.
 * @source
 */
interface LoadingFallbackProps {
  message?: string;
  className?: string;
}

/**
 * Generic loading fallback component with spinner and message.
 * @param props - Loading fallback props.
 * @returns Loading indicator element.
 * @source
 */
export function LoadingFallback({
  message = "Loading...",
  className = "",
}: Readonly<LoadingFallbackProps>) {
  return (
    <output
      className={`flex min-h-[200px] items-center justify-center ${className}`}
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </output>
  );
}

/**
 * Loading fallback for debug tools context.
 * @returns Debug loading indicator element.
 * @source
 */
export function DebugLoadingFallback() {
  return <LoadingFallback message="Loading debug tools..." />;
}

/**
 * Loading fallback for page navigation.
 * @returns Page loading indicator element.
 * @source
 */
export function PageLoadingFallback() {
  return (
    <LoadingFallback message="Loading page..." className="min-h-[400px]" />
  );
}
