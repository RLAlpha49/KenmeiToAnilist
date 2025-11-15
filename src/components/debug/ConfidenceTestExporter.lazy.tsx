import React, { lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { DebugLoadingFallback } from "../ui/LoadingFallback";

// Lazy-load the actual component to reduce initial bundle size
const ConfidenceTestExporterComponent = lazy(() =>
  import("./ConfidenceTestExporter").then((module) => ({
    default: module.ConfidenceTestExporter,
  })),
);

/**
 * Error boundary for lazy-loaded confidence test exporter.
 * Catches and handles component load failures gracefully with retry option.
 * @source
 */
class ConfidenceTestExporterErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Update state so the next render shows the error UI.
   * @source
   */
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  /**
   * Log error details for debugging purposes.
   * @source
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ConfidenceTestExporter] Failed to load:", error, errorInfo);
  }

  /**
   * Clear error state and retry loading the component.
   * @source
   */
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
 * Lazy-loaded ConfidenceTestExporter with Suspense and error handling.
 * Loads only when debug mode is active, falling back gracefully on errors.
 * @param props - Component props forwarded to lazy-loaded component
 * @returns Wrapped component with loading and error boundaries
 * @source
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
