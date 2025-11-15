/**
 * @packageDocumentation
 * @module components/ui/collapsible-chevron
 * @description Standardized collapsible chevron indicator component for consistent expand/collapse arrow rotation.
 */
import { ChevronDown } from "lucide-react";
import React from "react";
import { cn } from "@/utils/tailwind";

interface CollapsibleChevronProps {
  /** Whether the section is expanded */
  isExpanded: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standardized collapsible chevron component.
 *
 * Points right when collapsed (-90°), down when expanded (0°).
 * Uses ChevronDown icon with rotation for consistent UX.
 *
 * @param props - Component props
 * @returns Collapsible chevron element
 * @example
 * ```tsx
 * <CollapsibleChevron isExpanded={isOpen} className="text-gray-500" />
 * ```
 */
function CollapsibleChevron({
  isExpanded,
  className,
}: Readonly<CollapsibleChevronProps>) {
  return (
    <ChevronDown
      size={16}
      className={cn(
        "h-4 w-4 transition-transform duration-300",
        isExpanded ? "rotate-0" : "-rotate-90",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export { CollapsibleChevron, type CollapsibleChevronProps };
