import React, { lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { DebugLoadingFallback } from "../ui/loading-fallback";
import type { DebugMenuProps } from "./DebugMenu";

// Lazy load DebugMenu and all its sub-components
const DebugMenuComponent = lazy(() =>
  import("./DebugMenu").then((module) => ({ default: module.DebugMenu })),
);

/**
 * Lightweight error boundary for lazy-loaded debug components.
 * Displays a small error message and retry option on component load failures.
 */
class DebugMenuErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[DebugMenu] Failed to load:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-muted-foreground bg-muted rounded-md p-3 text-sm">
          <p className="font-medium">Failed to load debug menu</p>
          <button
            onClick={this.handleRetry}
            className="mt-1 text-xs underline hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lazy-loaded DebugMenu wrapper with Suspense boundary and error handling.
 * Only loads debug components when debug menu is opened.
 * Falls back gracefully on load errors.
 *
 * @param props - DebugMenu props
 * @returns Lazy-loaded DebugMenu with loading fallback and error boundary
 */
export function DebugMenu(props: Readonly<DebugMenuProps>) {
  return (
    <DebugMenuErrorBoundary>
      <Suspense fallback={<DebugLoadingFallback />}>
        <DebugMenuComponent {...props} />
      </Suspense>
    </DebugMenuErrorBoundary>
  );
}
