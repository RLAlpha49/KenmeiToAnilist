/**
 * @packageDocumentation
 * @module ConfidenceTestExporter
 * @description Component for exporting confidence test commands from match cards (debug feature)
 */

import React, { Suspense } from "react";
import type { MangaMatchResult } from "@/api/anilist/types";
import { ConfidenceTestModalLazy } from "./ConfidenceTestModal.lazy";

/**
 * Props for the ConfidenceTestExporter component.
 * @source
 */
export interface ConfidenceTestExporterProps {
  /** The manga match result to generate a test command for. */
  match: MangaMatchResult;
}

/**
 * Component that provides a button to view and copy a confidence test command
 * for debugging and bug reporting purposes.
 *
 * The test command allows users to reproduce the confidence calculation locally
 * using the npm test:confidence script.
 *
 * @param match - The manga match result to generate a test command for
 * @returns Button component with export functionality
 * @source
 */
export function ConfidenceTestExporter({
  match,
}: Readonly<ConfidenceTestExporterProps>): React.ReactNode {
  return (
    <div className="flex gap-1">
      <Suspense fallback={null}>
        <ConfidenceTestModalLazy match={match} />
      </Suspense>
    </div>
  );
}

export default ConfidenceTestExporter;
