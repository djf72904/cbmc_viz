import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/75",
        destructive:
          "bg-destructive text-white hover:bg-destructive/85 active:bg-destructive/75",
        outline:
          "border border-border/60 bg-background text-foreground hover:bg-accent/50 hover:border-border active:bg-accent/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/60",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        link: "text-foreground underline-offset-4 hover:underline",
        amber:
          "bg-amber text-background hover:bg-amber/85 active:bg-amber/75",
      },
      size: {
        default: "h-10 px-4 rounded-xl",
        sm: "h-8 px-3 rounded-lg text-xs",
        lg: "h-11 px-8 rounded-xl",
        icon: "h-10 w-10 rounded-xl",
        header: "h-8 px-2.5 rounded-[0.6rem] text-xs",
        "header-icon": "h-8 w-8 rounded-[0.6rem]",
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
