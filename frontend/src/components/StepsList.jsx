import { Badge } from "@/components/ui/badge.jsx";
import { cn } from "@/lib/utils.js";

const KIND_VARIANT = {
  failure: "fail",
  "function-call": "amber",
  "loop-head": "amber",
  assignment: "muted",
  "function-return": "muted",
  "location-only": "muted",
  location: "muted",
};

export function StepsList({ steps, currentIdx, onSelect }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground">
          Trace Steps
        </h3>
        <span className="text-xs text-muted-foreground/70">
          {steps.length} steps
        </span>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {steps.map((s) => {
          const active = s.idx === currentIdx;
          const isFail = s.kind === "failure";
          return (
            <button
              key={s.idx}
              onClick={() => onSelect(s.idx)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-2.5 border-b border-border/30 last:border-0 transition-colors text-left",
                active && "bg-amber/10",
                !active && "hover:bg-accent/40",
                isFail && active && "bg-[var(--trace-fail-soft)]"
              )}
            >
              <span
                className={cn(
                  "font-mono text-xs tabular-nums w-8 shrink-0 pt-0.5",
                  active ? "text-amber" : "text-muted-foreground/60"
                )}
              >
                {String(s.idx + 1).padStart(3, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge
                    variant={KIND_VARIANT[s.kind] || "muted"}
                    className="text-xs"
                  >
                    {s.kind}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    {s.loc?.function ?? "·"}:{s.loc?.line ?? "?"}
                  </span>
                </div>
                {s.note && (
                  <p
                    className={cn(
                      "text-xs truncate",
                      isFail
                        ? "text-[var(--trace-fail)]"
                        : "text-foreground/80"
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
