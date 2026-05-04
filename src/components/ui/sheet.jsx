import { useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils.js";

export function Sheet({ open, onOpenChange, children }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          {children}
        </>
      )}
    </AnimatePresence>
  );
}

export function SheetContent({
  className,
  children,
  onClose,
  side = "right",
  width = "max-w-2xl",
}) {
  return (
    <motion.div
      initial={{ x: side === "right" ? "100%" : "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: side === "right" ? "100%" : "-100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 260, mass: 0.8 }}
      className={cn(
        "fixed z-50 flex flex-col bg-background shadow-2xl w-full overflow-hidden",
        side === "right"
          ? "inset-y-0 right-0 sm:inset-y-1.5 sm:right-1.5 sm:rounded-3xl border-l sm:border"
          : "inset-y-0 left-0 sm:inset-y-1.5 sm:left-1.5 sm:rounded-3xl border-r sm:border",
        "border-border/50",
        width,
        className
      )}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-accent/80 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </motion.div>
  );
}

export const SheetHeader = forwardRef(function SheetHeader(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col space-y-1.5 px-6 pt-6 pb-4 border-b border-border/40 shrink-0",
        className
      )}
      {...props}
    />
  );
});

export const SheetTitle = forwardRef(function SheetTitle(
  { className, ...props },
  ref
) {
  return (
    <h3
      ref={ref}
      className={cn("text-lg leading-none tracking-tight pr-10", className)}
      {...props}
    />
  );
});

export const SheetDescription = forwardRef(function SheetDescription(
  { className, ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});

export const SheetBody = forwardRef(function SheetBody(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto", className)}
      {...props}
    />
  );
});

export const SheetFooter = forwardRef(function SheetFooter(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 py-4 border-t border-border/40 shrink-0",
        className
      )}
      {...props}
    />
  );
});
