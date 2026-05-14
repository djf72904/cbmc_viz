import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet.jsx";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/lib/utils.js";

const pageVariants = {
  enter: (direction) => ({
    opacity: 0,
    x: direction > 0 ? -40 : 40,
    zIndex: 0,
  }),
  center: { opacity: 1, x: 0, zIndex: 1 },
  exit: (direction) => ({
    opacity: 0,
    x: direction > 0 ? 40 : -40,
    zIndex: 0,
  }),
};

const textVariants = {
  initial: { opacity: 0, filter: "blur(4px)", x: -8 },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    filter: "blur(4px)",
    x: 8,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

const buttonVariants = {
  initial: { opacity: 0, x: -8, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.18, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: -8,
    filter: "blur(4px)",
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

export function MultiPageSheet({
  open,
  onOpenChange,
  pages,
  currentPageId,
  onPageChange,
  side = "right",
  className,
  contentClassName,
}) {
  const [direction, setDirection] = useState(0);
  const [previousPageId, setPreviousPageId] = useState(currentPageId);
  const [pageHistory, setPageHistory] = useState([currentPageId]);

  const currentPage = pages.find((p) => p.id === currentPageId);
  const currentPageIndex = pages.findIndex((p) => p.id === currentPageId);
  const previousPageIndex = pages.findIndex((p) => p.id === previousPageId);

  useEffect(() => {
    if (currentPageId === previousPageId) return;
    const newDirection = currentPageIndex > previousPageIndex ? 1 : -1;
    setDirection(newDirection);
    setPreviousPageId(currentPageId);
    setPageHistory((prev) => {
      const idx = prev.indexOf(currentPageId);
      if (idx !== -1) return prev.slice(0, idx + 1);
      return [...prev, currentPageId];
    });
  }, [currentPageId, previousPageId, currentPageIndex, previousPageIndex]);

  useEffect(() => {
    if (!open) {
      setPageHistory([currentPageId]);
      setPreviousPageId(currentPageId);
    }
  }, [open, currentPageId]);

  const canGoBack = pageHistory.indexOf(currentPageId) > 0;
  const showBack = currentPage?.showBackButton ?? canGoBack;

  const handleBack = () => {
    const idx = pageHistory.indexOf(currentPageId);
    if (idx > 0 && onPageChange) {
      onPageChange(pageHistory[idx - 1]);
    }
  };

  if (!currentPage) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn("flex flex-col overflow-hidden p-0", className)}
      >
        <SheetHeader className="px-5 pt-5 pb-3 pr-16">
          <div className="flex items-center gap-2">
            <AnimatePresence initial={false}>
              {showBack && (
                <motion.div
                  key="back-button"
                  variants={buttonVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="h-8 w-8 -ml-2"
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              className="flex-1 min-w-0"
              layout
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentPage.id}
                  variants={textVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <SheetTitle className="truncate">
                    {currentPage.title}
                  </SheetTitle>
                  {currentPage.description && (
                    <SheetDescription className="mt-1 truncate">
                      {currentPage.description}
                    </SheetDescription>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {currentPage.headerRight && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${currentPage.id}-right`}
                  variants={textVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex items-center"
                >
                  {currentPage.headerRight}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </SheetHeader>

        <div
          className={cn(
            "flex-1 relative overflow-hidden min-h-0",
            contentClassName
          )}
        >
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentPage.id}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 overflow-y-auto"
            >
              {currentPage.content}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="border-t border-rule px-5 py-3 bg-background shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentPage.id}
              variants={textVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center justify-end gap-2 min-h-[40px]"
            >
              {currentPage.footer}
            </motion.div>
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function useMultiPageSheet(initialPageId) {
  const [currentPageId, setCurrentPageId] = useState(initialPageId);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((pageId) => {
    if (pageId) setCurrentPageId(pageId);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const goToPage = useCallback((pageId) => setCurrentPageId(pageId), []);

  const reset = useCallback((pageId) => setCurrentPageId(pageId), []);

  return {
    isOpen,
    setIsOpen,
    currentPageId,
    setCurrentPageId,
    open,
    close,
    goToPage,
    reset,
  };
}
