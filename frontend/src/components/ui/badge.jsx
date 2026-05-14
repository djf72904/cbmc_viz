import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight transition-colors",
  {
    variants: {
      variant: {
        default: "border-rule bg-paper text-ink",
        muted: "border-rule/60 bg-ink/[0.03] text-ink-muted",
        brand: "border-brand/30 bg-brand/10 text-brand",
        ok: "border-[oklch(0.66_0.16_152/0.3)] bg-[oklch(0.66_0.16_152/0.12)] text-[oklch(0.42_0.16_152)]",
        passed:
          "border-[oklch(0.66_0.16_152/0.3)] bg-[oklch(0.66_0.16_152/0.12)] text-[oklch(0.42_0.16_152)]",
        fail: "border-[var(--state-failed)]/30 bg-[var(--state-failed)]/10 text-[var(--state-failed)]",
        rejected:
          "border-[var(--state-failed)]/30 bg-[var(--state-failed)]/10 text-[var(--state-failed)]",
        warn: "border-[var(--state-flagged)]/30 bg-[var(--state-flagged)]/12 text-[var(--state-flagged)]",
        flagged:
          "border-[var(--state-flagged)]/30 bg-[var(--state-flagged)]/12 text-[var(--state-flagged)]",
        running:
          "border-[var(--state-running)]/30 bg-[var(--state-running)]/10 text-[var(--state-running)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { badgeVariants };
