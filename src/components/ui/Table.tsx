/**
 * @packageDocumentation
 * @module components/ui/table
 * @description Table components for displaying tabular data.
 * @source
 */
import * as React from "react";

import { cn } from "@/utils/tailwind";

/**
 * Table container component with horizontal scroll support.
 * @param props - Standard table element props.
 * @returns Table element wrapped in scroll container.
 * @source
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

/**
 * Table header section (thead).
 * @param props - Standard thead element props.
 * @returns Table header element.
 * @source
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

/**
 * Table body section (tbody).
 * @param props - Standard tbody element props.
 * @returns Table body element.
 * @source
 */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

/**
 * Table footer section (tfoot).
 * @param props - Standard tfoot element props.
 * @returns Table footer element.
 * @source
 */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Table row element (tr).
 * @param props - Standard tr element props.
 * @returns Table row element.
 * @source
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Table header cell element (th).
 * @param props - Standard th element props.
 * @returns Table header cell element.
 * @source
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground *:[[role=checkbox]]:translate-y-0.5 h-10 whitespace-nowrap px-2 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Table data cell element (td).
 * @param props - Standard td element props.
 * @returns Table data cell element.
 * @source
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "*:[[role=checkbox]]:translate-y-0.5 whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Table caption element for accessible table titles.
 * @param props - Standard caption element props.
 * @returns Table caption element.
 * @source
 */
function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
