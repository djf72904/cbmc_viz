import { forwardRef } from "react";
import { cn } from "@/lib/utils.js";

export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-rule bg-card text-ink shadow-[0_1px_0_0_rgba(0,0,0,0.02)]",
        className
      )}
      {...props}
    />
  );
});

export const CardHeader = forwardRef(function CardHeader(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1 p-4", className)}
      {...props}
    />
  );
});

export const CardTitle = forwardRef(function CardTitle(
  { className, ...props },
  ref
) {
  return (
    <h3
      ref={ref}
      className={cn(
        "text-xs font-semibold tracking-[-0.01em] text-ink-muted",
        className
      )}
      {...props}
    />
  );
});

export const CardContent = forwardRef(function CardContent(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />;
});

export const CardFooter = forwardRef(function CardFooter(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-4 pt-0", className)}
      {...props}
    />
  );
});
