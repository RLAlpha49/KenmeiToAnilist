/**
 * Component for selecting metadata fields for custom matching rules.
 *
 * Provides organized categories of metadata fields that users can select
 * to determine which fields a custom rule pattern should check.
 *
 * @module MetadataFieldSelector
 */

import React, { memo, useCallback } from "react";
import type { CustomRuleTarget } from "@/utils/storage";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface MetadataFieldSelectorProps {
  selectedFields: CustomRuleTarget[];
  onChange: (fields: CustomRuleTarget[]) => void;
  disabled?: boolean;
}

/**
 * Metadata for each available target field.
 */
const METADATA_FIELDS: Record<
  CustomRuleTarget,
  { label: string; description: string; category: string }
> = {
  titles: {
    label: "Titles",
    description:
      "All title variants (romaji, english, native, synonyms, alternative titles)",
    category: "Text Fields",
  },
  author: {
    label: "Author/Staff",
    description:
      "Author names and staff credits (Story, Art, Original Creator)",
    category: "Text Fields",
  },
  description: {
    label: "Description/Notes",
    description: "Manga description text and your personal notes",
    category: "Text Fields",
  },
  genres: {
    label: "Genres",
    description: "Genre tags (Action, Romance, Fantasy, etc.)",
    category: "Metadata",
  },
  tags: {
    label: "Tags",
    description: "Detailed content tags and categories",
    category: "Metadata",
  },
  format: {
    label: "Format",
    description:
      "Publication format (Manga, Novel, One-Shot, etc. - matches AniList enum values)",
    category: "Metadata",
  },
  country: {
    label: "Country of Origin",
    description:
      "Country code (JP, KR, CN, etc. - matches ISO 3166-1 alpha-2 codes)",
    category: "Content Info",
  },
  source: {
    label: "Source Material",
    description:
      "Original source (Original, Manga, Light Novel, etc. - matches AniList enum values)",
    category: "Content Info",
  },
  status: {
    label: "Publishing Status",
    description:
      "Current publishing status (Finished, Publishing, etc. - matches AniList enum values)",
    category: "Content Info",
  },
};

/**
 * Group fields by category for organized display.
 */
const FIELD_CATEGORIES = {
  "Text Fields": ["titles", "author", "description"] as CustomRuleTarget[],
  Metadata: ["genres", "tags", "format"] as CustomRuleTarget[],
  "Content Info": ["country", "source", "status"] as CustomRuleTarget[],
};

/**
 * Component for selecting which metadata fields to check in a custom rule.
 *
 * @param props - Component props
 * @returns Rendered metadata field selector
 */
function MetadataFieldSelectorComponent({
  selectedFields,
  onChange,
  disabled = false,
}: Readonly<MetadataFieldSelectorProps>) {
  const allFields = Object.keys(METADATA_FIELDS) as CustomRuleTarget[];
  const selectedCount = selectedFields.length;
  const hasError = selectedCount === 0;

  const handleFieldToggle = useCallback(
    (field: CustomRuleTarget, checked: boolean) => {
      if (checked) {
        onChange([...selectedFields, field]);
      } else {
        onChange(selectedFields.filter((f) => f !== field));
      }
    },
    [selectedFields, onChange],
  );

  const handleSelectAll = useCallback(() => {
    onChange(allFields);
  }, [onChange, allFields]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleResetToDefault = useCallback(() => {
    onChange(["titles"]);
  }, [onChange]);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Header with count and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">Target Fields</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground h-4 w-4 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                Select which metadata fields the pattern should check. Pattern
                matches if it matches ANY of the selected fields.
              </p>
            </TooltipContent>
          </Tooltip>
          <Badge variant={hasError ? "destructive" : "default"}>
            {selectedCount} of {allFields.length} selected
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            disabled={disabled}
            type="button"
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            disabled={disabled}
            type="button"
          >
            Clear All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            disabled={disabled}
            type="button"
          >
            Reset to Default
          </Button>
        </div>
      </div>

      {/* Error message */}
      {hasError && (
        <p className="text-destructive text-sm">
          At least one field must be selected
        </p>
      )}

      {/* Fields by category */}
      <div className="space-y-4">
        {Object.entries(FIELD_CATEGORIES).map(([category, fields]) => (
          <fieldset key={category} className="space-y-3">
            <legend className="text-muted-foreground text-sm font-semibold">
              {category}
            </legend>
            <fieldset
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
              aria-label={`${category} fields`}
            >
              {fields.map((field) => {
                const fieldMeta = METADATA_FIELDS[field];
                const isChecked = selectedFields.includes(field);
                const descriptionId = `desc-field-${field}`;
                return (
                  <div key={field} className="flex items-start gap-2">
                    <Checkbox
                      id={`field-${field}`}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleFieldToggle(field, checked as boolean)
                      }
                      disabled={disabled}
                      aria-describedby={descriptionId}
                    />
                    <div className="min-w-0 flex-1">
                      <Label
                        htmlFor={`field-${field}`}
                        className="cursor-pointer text-sm"
                      >
                        {fieldMeta.label}
                      </Label>
                      <p
                        id={descriptionId}
                        className="text-muted-foreground mt-0.5 text-xs"
                      >
                        {fieldMeta.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </fieldset>
          </fieldset>
        ))}
      </div>

      {/* Screen reader announcement for selection count */}
      <output className="sr-only" aria-live="polite">
        {selectedCount} fields selected
      </output>
    </div>
  );
}

/**
 * Memoized metadata field selector component for performance.
 */
export const MetadataFieldSelector = memo(MetadataFieldSelectorComponent);
