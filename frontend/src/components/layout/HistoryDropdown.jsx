import { useState } from "react";
import { Trash2, X, History } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui/sheet.jsx";
import { cn } from "@/lib/utils.js";

export function HistoryDropdown({
  history = [],
  activeId = null,
  onSelect,
  onRemove,
  onClear,
}) {
  const [open, setOpen] = useState(false);
  const count = history.length;

  return (
    <>
      <Button variant="outline" size="header" onClick={() => setOpen(true)}>
        <History className="h-3.5 w-3.5 -ml-0.5 mr-1 opacity-70" />
        History
        <span className="ml-1.5 text-ink-muted">{count}</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          {count > 0 && (
            <button
              onClick={onClear}
              className="absolute right-14 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-rule bg-paper text-ink-muted hover:text-ink hover:bg-ink/[0.05] transition-colors"
              title="Clear history"
              aria-label="Clear history"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <SheetHeader>
            <SheetTitle>History</SheetTitle>
            <SheetDescription>
              {count === 0
                ? "Nothing analyzed yet"
                : `${count} ${count === 1 ? "analysis" : "analyses"} saved locally`}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="px-3 py-2">
            {count === 0 ? (
              <div className="px-3 py-12 text-center">
                <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper text-ink-muted mb-3">
                  <History className="h-4 w-4" />
                </div>
                <div className="text-[13px] text-ink">No analyses yet</div>
                <div className="text-[12px] text-ink-muted mt-1">
                  Upload a C source file to start tracing.
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {history.map((it) => (
                  <li key={it.id}>
                    <HistoryRow
                      item={it}
                      active={it.id === activeId}
                      onSelect={() => {
                        onSelect?.(it);
                        setOpen(false);
                      }}
                      onRemove={() => onRemove?.(it.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

function HistoryRow({ item, active, onSelect, onRemove }) {
  const status = item.meta?.status ?? null;
  const dot =
    status === "SUCCESS"
      ? "bg-[var(--state-passed)]"
      : status === "FAILURE"
        ? "bg-[var(--state-failed)]"
        : "bg-ink-muted/40";
  const time = formatTime(item.createdAt);
  const property = item.meta?.property ?? null;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group/h relative flex items-center gap-3 rounded-lg pl-3 pr-1.5 py-2.5 cursor-pointer transition-colors",
        active
          ? "bg-brand/[0.08] text-ink"
          : "text-ink-muted hover:bg-ink/[0.04] hover:text-ink"
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)}
        title={status ?? "unknown"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-[12.5px] truncate text-ink">
            {item.fileName}
          </div>
          <div className="text-[11px] text-ink-muted shrink-0">{time}</div>
        </div>
        <div className="text-[11.5px] text-ink-muted truncate mt-0.5 font-mono">
          {item.meta?.fnName ? `${item.meta.fnName}()` : ""}
          {item.meta?.fnName && property ? " · " : ""}
          {property ?? ""}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.();
        }}
        className="opacity-0 group-hover/h:opacity-100 transition-opacity h-7 w-7 shrink-0 rounded-md inline-flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/[0.05]"
        aria-label="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return "";
  const ms = Date.now() - ts;
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
