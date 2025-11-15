/**
 * @packageDocumentation
 * @module components/ui/separator
 * @description Separator component for dividing content sections.
 * @source
 */
"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/utils/tailwind";

/**
 * Separator component wrapping Radix UI separator primitive.
 * Supports horizontal and vertical orientations.
 * @param props - Standard separator props from Radix UI.
 * @returns Styled separator element.
 * @source
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator-root"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
