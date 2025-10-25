import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingFallbackProps {
  message?: string;
  className?: string;
}

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

// Specific fallbacks for different contexts
export function DebugLoadingFallback() {
  return <LoadingFallback message="Loading debug tools..." />;
}

export function PageLoadingFallback() {
  return (
    <LoadingFallback message="Loading page..." className="min-h-[400px]" />
  );
}
