import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-paper hover:bg-ink/90 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_1px_2px_0_rgba(0,0,0,0.08)]",
        brand:
          "bg-brand transform hover:-translate-y-0.5  text-brand-foreground hover:opacity-95 shadow-[0_1px_0_0_rgba(255,255,255,0.10)_inset,0_4px_14px_-4px_oklch(0.52_0.18_268_/_0.45)]",
        outline:
          "border border-rule bg-transparent text-ink hover:bg-ink/[0.03]",
        ghost: "text-ink hover:bg-ink/[0.05]",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 rounded-md text-[12px]",
        default: "h-10 px-4 rounded-lg",
        lg: "h-11 px-5 rounded-xl text-[14px]",
        pill: "h-11 px-6 rounded-full text-[13px]",
        icon: "h-9 w-9 rounded-md",
        header: "h-8 px-2.5 rounded-md text-[12px]",
        "header-icon": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export const Button = forwardRef(function Button(
  { className, variant, size, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { buttonVariants };
