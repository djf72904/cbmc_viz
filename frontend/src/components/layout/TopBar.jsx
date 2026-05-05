import { Upload, RotateCcw, FileCode2, PanelLeftClose } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { SamplesMenu } from "@/components/SamplesMenu.jsx";
import { cn } from "@/lib/utils.js";

export function TopBar({
  fileName,
  uploaded,
  isFail,
  onUpload,
  onPickSample,
  onReset,
  onOpenSource,
  pageTitle,
  collapsed,
  onToggleSidebar,
  showSourceButton = true,
  showResetButton = true,
}) {
  return (
    <header
      className="fixed top-0 right-0 z-30 h-14 border-b border-border/50 transition-[width] duration-150"
      style={{
        width: `calc(100% - ${collapsed ? "64px" : "240px"})`,
      }}
    >
      <div className="h-full w-full mx-auto flex items-center gap-2 bg-background/90 backdrop-blur-[8px] px-3">
        <Button
          variant="ghost"
          size="header-icon"
          className="shrink-0 rounded-[10px] text-muted-foreground hover:text-foreground"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeftClose className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 min-w-0 overflow-hidden flex-1 px-1">
          <p className="text-sm text-foreground font-medium truncate">
            {pageTitle}
          </p>
          {fileName && (
            <>
              <span className="text-muted-foreground/60 text-xs">/</span>
              <p className="font-mono text-xs text-muted-foreground truncate">
                {fileName}
              </p>
            </>
          )}
          {isFail && (
            <Badge variant="fail" className="ml-1">
              violation
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {showSourceButton && (
            <Button
              variant="outline"
              size="header"
              className="hidden md:inline-flex"
              onClick={onOpenSource}
            >
              <FileCode2 className="h-4 w-4 -ml-0.5 mr-1.5 opacity-70" />
              View Source
            </Button>
          )}

          <SamplesMenu onPick={onPickSample} />

          <label
            className={cn(
              buttonVariants({ variant: "outline", size: "header" }),
              "cursor-pointer"
            )}
          >
            <Upload className="h-4 w-4 -ml-0.5 mr-1.5 opacity-70" />
            New analysis
            <input
              type="file"
              accept=".c,.cpp,.cc,.cxx,.h,.hpp,.i"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>

          {showResetButton && uploaded && (
            <Button
              variant="ghost"
              size="header-icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={onReset}
              aria-label="Clear trace"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
