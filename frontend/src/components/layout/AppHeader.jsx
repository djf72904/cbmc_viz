import { Upload, RotateCcw, FileCode2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
import { SamplesMenu } from "@/components/SamplesMenu.jsx";
import { HistoryDropdown } from "@/components/layout/HistoryDropdown.jsx";
import { cn } from "@/lib/utils.js";

const VIEWS = [
  { key: "graph", label: "Graph" },
  { key: "memory", label: "Memory" },
  { key: "trace", label: "Trace" },
  { key: "steps", label: "Steps" },
];

export function AppHeader({
  fileName,
  hasTrace,
  view,
  onChangeView,
  onUpload,
  onReset,
  onOpenSource,
  history,
  activeHistoryId,
  onSelectHistory,
  onRemoveHistory,
  onClearHistory,
  onPickSample,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <span className="inline-flex items-center text-[15px] font-semibold tracking-[-0.02em] text-ink">
            cbmc
            <span className="text-brand">·</span>
            viz
          </span>
          {hasTrace && fileName && (
            <>
              <span className="hidden h-4 w-px bg-rule md:block" />
              <span className="hidden min-w-0 truncate font-mono text-[12.5px] text-ink-muted md:inline">
                {fileName}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          {hasTrace && (
            <nav className="hidden items-center gap-4 md:flex">
              {VIEWS.map((v) => {
                const active = view === v.key;
                return (
                  <button
                    key={v.key}
                    onClick={() => onChangeView?.(v.key)}
                    className={cn(
                      "relative h-14 inline-flex items-center text-[12.5px] transition-colors",
                      active
                        ? "text-ink font-medium"
                        : "text-ink-muted hover:text-ink"
                    )}
                  >
                    {v.label}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand" />
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-1.5">
            <HistoryDropdown
              history={history}
              activeId={activeHistoryId}
              onSelect={onSelectHistory}
              onRemove={onRemoveHistory}
              onClear={onClearHistory}
            />

            <SamplesMenu onPick={onPickSample} />

            <label
              className={cn(
                buttonVariants({ variant: "brand", size: "header" }),
                "cursor-pointer"
              )}
            >
              <Upload className="h-4 w-4 -ml-0.5 mr-1.5 opacity-90" />
              Upload
              <input
                type="file"
                accept=".c,.cpp,.cc,.cxx,.h,.hpp,.i"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload?.(f);
                  e.target.value = "";
                }}
              />
            </label>

            {hasTrace && (
              <Button
                variant="outline"
                size="header"
                onClick={onOpenSource}
                className="hidden md:inline-flex"
              >
                <FileCode2 className="h-4 w-4 -ml-0.5 mr-1.5 opacity-70" />
                Source
              </Button>
            )}

            {hasTrace && (
              <Button
                variant="ghost"
                size="header-icon"
                onClick={onReset}
                aria-label="Reset"
                className="text-ink-muted hover:text-ink"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
