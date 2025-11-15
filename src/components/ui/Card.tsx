/**
 * @packageDocumentation
 * @module components/ui/card
 * @description Card layout components for structuring content with header, body, and footer sections.
 * @source
 */
import * as React from "react";

import { cn } from "@/utils/tailwind";

/**
 * Container component for card layout with rounded borders and shadow.
 * @param props - Standard div element props.
 * @returns Card container element.
 * @source
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Card header section for title, description, and actions.
 * @param props - Standard div element props.
 * @returns Card header element.
 * @source
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6 grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Card title for semantic heading content.
 * @param props - Standard div element props.
 * @returns Card title element.
 * @source
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-semibold leading-none", className)}
      {...props}
    />
  );
}

/**
 * Card description for secondary text content.
 * @param props - Standard div element props.
 * @returns Card description element.
 * @source
 */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/**
 * Card action section for positioning action elements (buttons, etc.) in the header.
 * @param props - Standard div element props.
 * @returns Card action element.
 * @source
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Card content section for main body content.
 * @param props - Standard div element props.
 * @returns Card content element.
 * @source
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

/**
 * Card footer section for bottom actions or supplementary content.
 * @param props - Standard div element props.
 * @returns Card footer element.
 * @source
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("[.border-t]:pt-6 flex items-center px-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
