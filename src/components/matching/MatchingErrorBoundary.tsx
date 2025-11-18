/**
 * @packageDocumentation
 * @module MatchingErrorBoundary
 * @description Specialized error boundary for the matching section with recovery actions
 */
import React, { ReactNode } from "react";
import {
  BaseErrorBoundary,
  RecoveryAction,
} from "@/components/BaseErrorBoundary";
import { RefreshCw, Trash2 } from "lucide-react";

interface MatchingErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Callback to reset matching state */
  onReset?: () => void;
  /** Callback to clear matching cache */
  onClearCache?: () => void;
}

/**
 * Error boundary for the matching section with specialized recovery actions.
 * Wraps BaseErrorBoundary with matching-specific configuration.
 * @source
 */
export const MatchingErrorBoundary = (
  props: MatchingErrorBoundaryProps,
): ReactNode => {
  const recoveryActions: RecoveryAction[] = [
    {
      label: "Clear Cache & Retry",
      Icon: Trash2,
      handler: () => {
        props.onClearCache?.();
        props.onReset?.();
      },
      variant: "default",
    },
    {
      label: "Reset Matching",
      Icon: RefreshCw,
      handler: props.onReset || (() => {}),
      variant: "outline",
    },
  ];

  return (
    <BaseErrorBoundary
      title="Matching Error"
      description="An error occurred in the matching section"
      HeaderIcon={RefreshCw}
      recoveryActions={recoveryActions}
      section="matching"
    >
      {props.children}
    </BaseErrorBoundary>
  );
};
