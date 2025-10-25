import React, { lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { DebugLoadingFallback } from "../ui/loading-fallback";

const ConfidenceTestExporterComponent = lazy(() =>
  import("./ConfidenceTestExporter").then((module) => ({
    default: module.ConfidenceTestExporter,
  })),
);

/**
 * Lightweight error boundary for lazy-loaded confidence test exporter.
 * Displays a small error message and retry option on component load failures.
 */
class ConfidenceTestExporterErrorBoundary extends Component<
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
    console.error("[ConfidenceTestExporter] Failed to load:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-muted-foreground bg-muted rounded-md p-3 text-sm">
          <p className="font-medium">Failed to load confidence test exporter</p>
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
 * Lazy-loaded ConfidenceTestExporter wrapper with Suspense boundary and error handling.
 * Only loads when debug mode is active in MatchCard.
 * Falls back gracefully on load errors.
 */
export function ConfidenceTestExporter(
  props: Readonly<
    React.ComponentPropsWithoutRef<typeof ConfidenceTestExporterComponent>
  >,
) {
  return (
    <ConfidenceTestExporterErrorBoundary>
      <Suspense fallback={<DebugLoadingFallback />}>
        <ConfidenceTestExporterComponent {...props} />
      </Suspense>
    </ConfidenceTestExporterErrorBoundary>
  );
}
