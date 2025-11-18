/**
 * @packageDocumentation
 * @module SyncErrorBoundary
 * @description Specialized error boundary for the sync section with recovery actions
 */
import React, { ReactNode } from "react";
import {
  BaseErrorBoundary,
  RecoveryAction,
} from "@/components/BaseErrorBoundary";
import { RefreshCw, AlertTriangle, XCircle } from "lucide-react";

interface SyncErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Callback to reset sync state */
  onReset?: () => void;
  /** Callback to retry failed operations */
  onRetryFailed?: () => void;
  /** Callback to cancel active sync */
  onCancelSync?: () => void;
}

/**
 * Error boundary for the sync section with specialized recovery actions.
 * Wraps BaseErrorBoundary with sync-specific configuration.
 * @source
 */
export const SyncErrorBoundary: React.FC<SyncErrorBoundaryProps> = ({
  children,
  onReset,
  onRetryFailed,
  onCancelSync,
}) => {
  const recoveryActions: RecoveryAction[] = [
    {
      label: "Retry Failed Operations",
      Icon: RefreshCw,
      handler: onRetryFailed ?? (() => {}),
      variant: "default",
    },
    {
      label: "Cancel Sync",
      Icon: XCircle,
      handler: onCancelSync ?? (() => {}),
      variant: "outline",
    },
    {
      label: "Reset Sync State",
      Icon: RefreshCw,
      handler: onReset ?? (() => {}),
      variant: "outline",
    },
  ];

  return (
    <BaseErrorBoundary
      title="Sync Error"
      description="An error occurred during synchronization"
      HeaderIcon={AlertTriangle}
      recoveryActions={recoveryActions}
      section="sync"
    >
      {children}
    </BaseErrorBoundary>
  );
};
