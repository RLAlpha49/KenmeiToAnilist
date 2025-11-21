/**
 * @packageDocumentation
 * @module components/ui/button
 * @description Reusable button component with variant and size support using class-variance-authority.
 * @source
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/utils/tailwind";

/** Button style variants and sizes using CVA. */
const buttonVariants = cva(
  "ring-offset-background focus-visible:ring-ring focus-visible:outline-hidden inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-input bg-background hover:bg-accent hover:text-accent-foreground border",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-10 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Accessible label for icon-only buttons or additional context. @source */
  ariaLabel?: string;
  /** ID of element providing additional description. @source */
  ariaDescribedBy?: string;
}

/**
 * Reusable button component with polymorphic rendering via asChild prop.
 * Supports variant and size customization through CVA.
 * @param props - Standard button props plus component extensions.
 * @returns Rendered button or polymorphic element.
 * @source
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      ariaLabel,
      ariaDescribedBy,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const componentProps = {
      className: cn(buttonVariants({ variant, size, className })),
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      disabled: disabled || loading,
      ...props,
    };
    const loader = (
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      </div>
    );

    if (asChild) {
      const slotChild = React.Children.only(children);
      if (!React.isValidElement(slotChild)) {
        return (
          <Comp ref={ref} {...componentProps}>
            {slotChild}
          </Comp>
        );
      }
      const slotChildElement = slotChild as React.ReactElement<
        React.PropsWithChildren<unknown>
      >;
      const childWithLoader = loading
        ? React.cloneElement(slotChildElement, {
            children: (
              <>
                {loader}
                <span className="invisible">
                  {slotChildElement.props.children}
                </span>
              </>
            ),
          })
        : slotChildElement;

      return (
        <Comp ref={ref} {...componentProps}>
          {childWithLoader}
        </Comp>
      );
    }

    return (
      <Comp ref={ref} {...componentProps}>
        {loading && loader}
        {loading ? <span className="invisible">{children}</span> : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
