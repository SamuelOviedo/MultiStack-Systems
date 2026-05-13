import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-primary/30   bg-primary/12   text-primary   hover:bg-primary/20",
        secondary:   "border-border       bg-muted        text-muted-foreground hover:bg-secondary/80",
        destructive: "border-destructive/30 bg-destructive/12 text-destructive hover:bg-destructive/20",
        success:     "border-success/30   bg-success/12   text-success   hover:bg-success/20",
        warning:     "border-warning/30   bg-warning/12   text-warning   hover:bg-warning/20",
        outline:     "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
