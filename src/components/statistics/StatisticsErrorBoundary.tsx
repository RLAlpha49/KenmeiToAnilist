/**
 * @packageDocumentation
 * @module StatisticsErrorBoundary
 * @description Specialized error boundary for the statistics section with recovery actions
 */
import React from "react";
import {
  BaseErrorBoundary,
  RecoveryAction,
} from "@/components/BaseErrorBoundary";
import { RefreshCw, BarChart3 } from "lucide-react";

interface StatisticsErrorBoundaryProps {
  /** Child components to wrap */
  readonly children: React.ReactNode;
  /** Callback to refresh statistics data */
  readonly onRefresh?: () => void;
  /** Callback to clear active filters */
  readonly onClearFilters?: () => void;
}

/**
 * Error boundary for the statistics section with specialized recovery actions.
 * Wraps BaseErrorBoundary with statistics-specific configuration.
 * @source
 */
export function StatisticsErrorBoundary({
  children,
  onRefresh,
  onClearFilters,
}: StatisticsErrorBoundaryProps): React.ReactElement {
  const recoveryActions: RecoveryAction[] = [
    {
      label: "Refresh Data",
      Icon: RefreshCw,
      handler: onRefresh ?? (() => {}),
      variant: "default",
    },
    {
      label: "Clear Filters",
      Icon: BarChart3,
      handler: onClearFilters ?? (() => {}),
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
      {children}
    </BaseErrorBoundary>
  );
}
