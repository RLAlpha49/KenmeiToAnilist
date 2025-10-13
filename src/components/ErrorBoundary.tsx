/**
 * @packageDocumentation
 * @module ErrorBoundary
 * @description Error boundary component to catch and handle React errors gracefully
 */
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches React errors and displays a fallback UI
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details to console
    console.error("🚨 [ErrorBoundary] Caught error:", error);
    console.error("🚨 [ErrorBoundary] Error info:", errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Try to log to debug context if available
    try {
      const debugEvent = new CustomEvent("debug:log", {
        detail: {
          type: "app.error",
          message: `React Error: ${error.message}`,
          level: "error",
          metadata: {
            stack: error.stack,
            componentStack: errorInfo.componentStack,
          },
        },
      });
      window.dispatchEvent(debugEvent);
    } catch (e) {
      console.error("Failed to log error to debug context:", e);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <Card className="border-destructive w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-destructive/10 rounded-full p-2">
                  <AlertTriangle className="text-destructive h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    Something went wrong
                  </CardTitle>
                  <CardDescription>
                    The application encountered an unexpected error
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h4 className="mb-2 text-sm font-semibold">Error Details:</h4>
                <p className="text-destructive font-mono text-sm">
                  {this.state.error?.message || "Unknown error"}
                </p>
              </div>

              {this.state.error?.stack && (
                <details className="cursor-pointer">
                  <summary className="text-sm font-semibold hover:underline">
                    Stack Trace
                  </summary>
                  <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded-lg p-4 font-mono text-xs">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              {this.state.errorInfo?.componentStack && (
                <details className="cursor-pointer">
                  <summary className="text-sm font-semibold hover:underline">
                    Component Stack
                  </summary>
                  <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded-lg p-4 font-mono text-xs">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="border-border bg-card rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">
                  <strong>What you can do:</strong>
                </p>
                <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-sm">
                  <li>Try reloading the page</li>
                  <li>Check the developer console for more details</li>
                  <li>Report this issue if it persists</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button onClick={this.handleReset} variant="default" size="sm">
                <RotateCcw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="outline" size="sm">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reload App
              </Button>
              <Button onClick={this.handleGoHome} variant="ghost" size="sm">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
