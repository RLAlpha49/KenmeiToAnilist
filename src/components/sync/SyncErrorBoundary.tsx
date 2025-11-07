/**
 * @packageDocumentation
 * @module SyncErrorBoundary
 * @description Specialized error boundary for the sync section with recovery actions
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
import { RefreshCw, Home, AlertTriangle, XCircle } from "lucide-react";
import * as Sentry from "@sentry/electron/renderer";

interface Props {
  /** Child components to wrap */
  children: ReactNode;
  /** Callback to reset sync state */
  onReset?: () => void;
  /** Callback to retry failed operations */
  onRetryFailed?: () => void;
  /** Callback to cancel active sync */
  onCancelSync?: () => void;
}

interface State {
  /** Indicates whether an error has been caught */
  hasError: boolean;
  /** The caught error object */
  error: Error | null;
  /** React error info including component stack */
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary for the sync section with specialized recovery actions.
 * @source
 */
export class SyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Updates state when an error is caught to trigger fallback UI.
   * @param error - The thrown error.
   * @returns Partial state to set hasError flag.
   * @source
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Logs error details and captures to Sentry with sync context.
   * @param error - The thrown error.
   * @param errorInfo - React error info with component stack.
   * @source
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("🚨 [Sync] Error in sync section:", error);
    console.error("🚨 [Sync] Error info:", errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Capture to Sentry with sync context
    Sentry.captureException(error, {
      tags: {
        section: "sync",
      },
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      fingerprint: ["sync", error.message],
    });
  }

  /**
   * Retries failed operations and resets error state.
   * @source
   */
  handleRetryFailed = (): void => {
    if (this.props.onRetryFailed) {
      this.props.onRetryFailed();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Cancels active sync and resets error state.
   * @source
   */
  handleCancelSync = (): void => {
    if (this.props.onCancelSync) {
      this.props.onCancelSync();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Resets sync state.
   * @source
   */
  handleReset = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Navigates to the home page.
   * @source
   */
  handleGoHome = (): void => {
    globalThis.location.href = "/";
  };

  /**
   * Renders the error boundary UI or children.
   * @returns Error UI or children based on error state.
   * @source
   */
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <Card className="border-destructive w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-destructive/10 rounded-full p-2">
                  <AlertTriangle className="text-destructive h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Sync Error</CardTitle>
                  <CardDescription>
                    An error occurred during synchronization
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="font-mono text-sm">
                  {this.state.error?.message || "Unknown error"}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                The sync process encountered an error. You can retry failed
                operations, cancel the active sync, or reset the sync state.
              </p>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={this.handleRetryFailed}
                variant="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Failed Operations
              </Button>
              <Button
                onClick={this.handleCancelSync}
                variant="outline"
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancel Sync
              </Button>
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset Sync State
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="ghost"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
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
