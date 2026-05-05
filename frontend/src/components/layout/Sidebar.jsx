import { ChevronRight, History, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils.js";

export function Sidebar({
  collapsed,
  onToggle,
  meta,
  history = [],
  activeHistoryId = null,
  onSelectHistory,
  onRemoveHistory,
  onClearHistory,
}) {
  const expanded = !collapsed;

  return (
    <div
      aria-expanded={expanded}
      className={cn(
        "fixed h-full left-0 z-40 bg-background/90 backdrop-blur-md border-r border-border/50 transition-[width] duration-150 group/sidebar",
        expanded ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-collapsed)]"
      )}
      style={{
        "--sidebar-width": "240px",
        "--sidebar-collapsed": "64px",
      }}
    >
      <div className="flex w-full h-full flex-col overflow-hidden">
        <div className="px-4 h-14 shrink-0 flex items-center">
          {expanded && (
            <span className="text-md font-semibold tracking-tight whitespace-nowrap">
              CBMC Viz
            </span>
          )}
        </div>

        <nav
          className="flex h-full flex-1 flex-col grow min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar"
          style={{
            mask: "linear-gradient(rgba(255,255,255,0), #fff 8px, #fff 100%)",
            WebkitMask:
              "linear-gradient(rgba(255,255,255,0), #fff 8px, #fff 100%)",
          }}
        >
          {expanded && (
            <HistoryList
              items={history}
              activeId={activeHistoryId}
              onSelect={onSelectHistory}
              onRemove={onRemoveHistory}
              onClear={onClearHistory}
            />
          )}

          {expanded && meta && (
            <div className="px-4 mt-4">
              <div className="rounded-xl border border-border/50 bg-surface/60 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Subject
                  </span>
                </div>
                <div className="font-mono text-xs text-foreground truncate">
                  {meta.fnName}()
                </div>
                <div className="font-mono text-xs text-muted-foreground truncate mt-0.5">
                  {meta.file}:{meta.line}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1" />
        </nav>

        <button
          onClick={onToggle}
          className="absolute top-1/2 -translate-y-1/2 -right-3 z-50 h-6 w-6 rounded-full border border-border/50 bg-background shadow-sm flex items-center justify-center opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 hover:bg-accent"
          aria-label="Toggle sidebar"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform duration-150",
              expanded && "rotate-180"
            )}
          />
        </button>
      </div>
    </div>
  );
}

function HistoryList({ items, activeId, onSelect, onRemove, onClear }) {
  return (
    <div className="mt-3">
      <div className="px-4 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <History className="h-3 w-3" />
          History
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity h-5 w-5 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50"
            title="Clear history"
            aria-label="Clear history"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-2 text-xs text-muted-foreground/60 italic">
          No analyses yet
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2">
          {items.map((it) => (
            <li key={it.id}>
              <HistoryItem
                item={it}
                active={it.id === activeId}
                onSelect={() => onSelect?.(it)}
                onRemove={() => onRemove?.(it.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryItem({ item, active, onSelect, onRemove }) {
  const status = item.meta?.status ?? null;
  const statusColor =
    status === "FAILURE"
      ? "bg-[var(--trace-fail)]"
      : status === "SUCCESS"
        ? "bg-[var(--trace-ok)]"
        : "bg-amber";
  const time = formatTime(item.createdAt);
  return (
    <div
      className={cn(
        "group/h relative flex items-center gap-2 rounded-[8px] pl-2 pr-1 py-1.5 cursor-pointer transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      )}
      onClick={onSelect}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusColor)}
        title={status ?? "unknown"}
      />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs truncate text-foreground">
          {item.fileName}
        </div>
        <div className="text-xs text-muted-foreground/70 truncate">
          {item.meta?.fnName ? `${item.meta.fnName}()` : ""}
          {item.meta?.fnName && time ? " · " : ""}
          {time}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.();
        }}
        className="opacity-0 group-hover/h:opacity-100 transition-opacity h-5 w-5 shrink-0 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Remove"
      >
        <X className="h-3 w-3" />
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

function SidebarLink({ item, active, expanded, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center gap-2 px-2 min-w-[2.25rem] rounded-[10px] transition-colors duration-75",
        expanded ? "w-full" : "w-fit justify-center",
        disabled
          ? "text-muted-foreground/40 cursor-not-allowed"
          : active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <div className="flex items-center justify-center h-8">
        <item.icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
      </div>
      {expanded && (
        <div className="flex items-center justify-between flex-1 h-8">
          <p className="text-sm font-medium whitespace-nowrap truncate max-w-[168px] text-left">
            {item.label}
          </p>
        </div>
      )}
    </button>
  );
}
