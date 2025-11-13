/**
 * @packageDocumentation
 * @module StatisticsErrorBoundary
 * @description Specialized error boundary for the statistics section with recovery actions
 */
import React, { ReactNode } from "react";
import {
  BaseErrorBoundary,
  RecoveryAction,
} from "@/components/BaseErrorBoundary";
import { RefreshCw, BarChart3 } from "lucide-react";

interface Props {
  /** Child components to wrap */
  children: ReactNode;
  /** Callback to refresh statistics data */
  onRefresh?: () => void;
  /** Callback to clear active filters */
  onClearFilters?: () => void;
}

/**
 * Error boundary for the statistics section with specialized recovery actions.
 * Wraps BaseErrorBoundary with statistics-specific configuration.
 * @source
 */
export const StatisticsErrorBoundary = (props: Props): ReactNode => {
  const recoveryActions: RecoveryAction[] = [
    {
      label: "Refresh Data",
      Icon: RefreshCw,
      handler: props.onRefresh || (() => {}),
      variant: "default",
    },
    {
      label: "Clear Filters",
      Icon: BarChart3,
      handler: props.onClearFilters || (() => {}),
      variant: "outline",
    },
  ];

  return (
    <BaseErrorBoundary
      title="Statistics Error"
      description="An error occurred while loading statistics"
      HeaderIcon={BarChart3}
      recoveryActions={recoveryActions}
      section="statistics"
    >
      {props.children}
    </BaseErrorBoundary>
  );
};
