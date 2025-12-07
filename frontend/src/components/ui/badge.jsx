import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm hover:shadow-md",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:shadow-md",
        outline: "text-foreground border-border",
        success: "border-transparent bg-success text-success-foreground shadow-sm hover:shadow-md",
        warning: "border-transparent bg-warning text-warning-foreground shadow-sm hover:shadow-md",
        info: "border-transparent bg-info text-info-foreground shadow-sm hover:shadow-md",
        active: "border-transparent bg-success text-success-foreground shadow-sm",
        inactive: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
