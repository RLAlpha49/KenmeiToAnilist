import type React from "react";
import { lazy } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const LazyConfidenceTestModal = lazy(() =>
  import("./ConfidenceTestModal").then((module) => ({
    default: module.ConfidenceTestModal,
  })),
);

interface ConfidenceTestModalLazyProps {
  readonly match: React.ComponentProps<typeof LazyConfidenceTestModal>["match"];
}

export function ConfidenceTestModalLazy({
  match,
}: Readonly<ConfidenceTestModalLazyProps>): React.ReactNode {
  return (
    <ErrorBoundary fallback={<div>Failed to load confidence test modal</div>}>
      <LazyConfidenceTestModal match={match} />
    </ErrorBoundary>
  );
}
