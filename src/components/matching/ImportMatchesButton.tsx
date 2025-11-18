/**
 * @packageDocumentation
 * @module ImportMatchesButton
 * @description Import button component for match results.
 */

import React, { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/Button";
import ImportMatchesDialog from "./ImportMatchesDialog";

/**
 * Props for ImportMatchesButton component.
 * @property disabled - Whether the button is disabled.
 * @property variant - Button style variant.
 * @property size - Button size.
 * @property onImportComplete - Callback after successful import with statistics.
 * @source
 */
export interface ImportMatchesButtonProps {
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  onImportComplete: (result: {
    imported: number;
    merged: number;
    skipped: number;
  }) => void;
}

/**
 * Import button component as entry point for importing match results.
 * Opens ImportMatchesDialog when clicked.
 * @param props - Component props.
 * @returns ImportMatchesButton component.
 * @source
 */
const ImportMatchesButtonComponent: React.FC<ImportMatchesButtonProps> = ({
  disabled = false,
  variant = "outline",
  size = "default",
  onImportComplete,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleImportComplete = useCallback(
    (result: { imported: number; merged: number; skipped: number }) => {
      onImportComplete(result);
    },
    [onImportComplete],
  );

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        disabled={disabled}
        variant={variant}
        size={size}
        aria-label="Import match results from file"
      >
        <Upload className="mr-2 h-4 w-4" />
        Import Matches
      </Button>

      <ImportMatchesDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </>
  );
};

export default React.memo(ImportMatchesButtonComponent);
