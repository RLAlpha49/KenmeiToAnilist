/**
 * @packageDocumentation
 * @module components/ui/collapsible
 * @description Collapsible section component with Radix UI.
 * @source
 */
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import React from "react";

/**
 * Collapsible root component.
 * @param props - Standard collapsible props from Radix UI.
 * @returns Collapsible root element.
 * @source
 */
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

/**
 * Collapsible trigger button component.
 * @param props - Standard collapsible trigger props from Radix UI.
 * @returns Collapsible trigger element.
 * @source
 */
function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

/**
 * Collapsible content section component.
 * @param props - Standard collapsible content props from Radix UI.
 * @returns Collapsible content element.
 * @source
 */
function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
