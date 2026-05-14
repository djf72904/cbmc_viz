import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge.jsx";
import { cn } from "@/lib/utils.js";

const KIND_VARIANT = {
  failure: "fail",
  "function-call": "brand",
  "loop-head": "brand",
  assignment: "muted",
  "function-return": "muted",
  "location-only": "muted",
  location: "muted",
};

export function StepsList({ steps, currentIdx, onSelect }) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    const container = scrollRef.current;
    const node = activeRef.current;
    if (!container || !node) return;
    const cTop = container.scrollTop;
    const cBottom = cTop + container.clientHeight;
    const nTop = node.offsetTop;
    const nBottom = nTop + node.offsetHeight;
    if (nTop < cTop + 32 || nBottom > cBottom - 32) {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentIdx]);

  return (
    <div className="rounded-xl border border-rule bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Trace Steps
        </h3>
        <span className="text-[11.5px] text-ink-muted/70">
          {steps.length} steps
        </span>
      </div>
      <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
        {steps.map((s) => {
          const active = s.idx === currentIdx;
          const isFail = s.kind === "failure";
          return (
            <button
              key={s.idx}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(s.idx)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-2.5 border-b border-rule/60 last:border-0 transition-colors text-left border-l-2",
                isFail && active
                  ? "bg-[var(--state-failed)]/10 border-l-[var(--state-failed)]"
                  : active
                    ? "bg-brand/[0.06] border-l-brand"
                    : "border-l-transparent hover:bg-ink/[0.03]"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[11.5px] tabular-nums w-8 shrink-0 pt-0.5 transition transform duration-300",
                  isFail && active
                    ? "text-[var(--state-failed)] translate-x-2 duration-300 "
                    : active
                      ? "text-brand translate-x-1 "
                      : "text-ink-muted/60"
                )}
              >
                {String(s.idx + 1).padStart(3, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={KIND_VARIANT[s.kind] || "muted"}>
                    {s.kind}
                  </Badge>
                  <span className="font-mono text-[11.5px] text-ink-muted truncate">
                    {s.loc?.function ?? "·"}:{s.loc?.line ?? "?"}
                  </span>
                </div>
                {s.note && (
                  <p
                    className={cn(
                      "text-[12px] truncate",
                      isFail ? "text-[var(--state-failed)]" : "text-ink/80"
                    )}
                  >
                    {s.note}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
