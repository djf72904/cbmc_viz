import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-foreground text-background",
        secondary:
          "border-transparent bg-accent text-foreground",
        outline: "text-foreground border-border/60",
        amber:
          "border-amber/40 bg-amber/15 text-amber",
        fail:
          "border-[var(--trace-fail)]/40 bg-[var(--trace-fail-soft)] text-[var(--trace-fail)]",
        ok: "border-[var(--trace-ok)]/40 bg-[var(--trace-ok)]/15 text-[var(--trace-ok)]",
        muted:
          "border-border/40 bg-surface text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { badgeVariants };
