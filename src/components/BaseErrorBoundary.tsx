/**
 * @packageDocumentation
 * @module BaseErrorBoundary
 * @description Reusable error boundary component with configurable recovery actions
 */
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { AlertTriangle, Home, LucideIcon } from "lucide-react";
import * as Sentry from "@sentry/electron/renderer";

export interface RecoveryAction {
  /** Label for the recovery button */
  label: string;
  /** Icon component to display */
  Icon: LucideIcon;
  /** Callback handler for the action */
  handler: () => void;
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
}

interface BaseErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Custom title for the error card */
  title?: string;
  /** Custom description for the error card */
  description?: string;
  /** Icon component to display in header */
  HeaderIcon?: LucideIcon;
  /** Recovery actions to display as buttons */
  recoveryActions?: RecoveryAction[];
  /** Section tag for Sentry context */
  section?: string;
  /** Optional custom error callback */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface BaseErrorBoundaryState {
  /** Indicates whether an error has been caught */
  hasError: boolean;
  /** The caught error object */
  error: Error | null;
  /** React error info including component stack */
  errorInfo: ErrorInfo | null;
}

/**
 * Base error boundary component with configurable recovery actions.
 * Provides common error handling, logging, and UI rendering logic.
 * @source
 */
export class BaseErrorBoundary extends Component<
  BaseErrorBoundaryProps,
  BaseErrorBoundaryState
> {
  constructor(props: BaseErrorBoundaryProps) {
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
  static getDerivedStateFromError(
    error: Error,
  ): Partial<BaseErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Logs error details and captures to Sentry with optional context.
   * @param error - The thrown error.
   * @param errorInfo - React error info with component stack.
   * @source
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const section = this.props.section || "app";
    console.error(`🚨 [${section}] Caught error:`, error);
    console.error(`🚨 [${section}] Error info:`, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Capture to Sentry with context
    interface SentryContext extends Record<string, unknown> {
      contexts?: {
        react?: {
          componentStack: string;
        };
      };
      fingerprint?: string[];
      tags?: {
        section: string;
      };
    }

    const sentryContext: SentryContext = {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack || "",
        },
      },
      fingerprint: [section, error.message],
    };

    if (section) {
      sentryContext.tags = {
        section,
      };
    }

    Sentry.captureException(error, sentryContext);

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Dispatch error to debug context if available
    try {
      const debugEvent = new CustomEvent("debug:log", {
        detail: {
          type: "app.error",
          message: `Error: ${error.message}`,
          section,
          level: "error",
          metadata: {
            stack: error.stack,
            componentStack: errorInfo.componentStack,
          },
        },
      });
      globalThis.dispatchEvent(debugEvent);
    } catch (e) {
      console.error("Failed to log error to debug context:", e);
    }
  }

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
      const HeaderIcon = this.props.HeaderIcon || AlertTriangle;
      const title = this.props.title || "Something went wrong";
      const description =
        this.props.description || "An unexpected error occurred";

      // Default recovery actions if none provided
      const defaultActions: RecoveryAction[] = [
        {
          label: "Try Again",
          Icon: AlertTriangle,
          handler: () => {
            this.setState({
              hasError: false,
              error: null,
              errorInfo: null,
            });
          },
          variant: "default",
        },
        {
          label: "Go Home",
          Icon: Home,
          handler: this.handleGoHome,
          variant: "ghost",
        },
      ];

      const actions = this.props.recoveryActions || defaultActions;

      return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <Card className="border-destructive w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-destructive/10 rounded-full p-2">
                  <HeaderIcon className="text-destructive h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="font-mono text-sm">
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
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  onClick={action.handler}
                  variant={action.variant || "outline"}
                  className="flex items-center gap-2"
                >
                  <action.Icon className="h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
