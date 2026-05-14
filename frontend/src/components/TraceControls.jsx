import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/lib/utils.js";

export function TraceControls({
  step,
  total,
  playing,
  speed,
  isFail,
  onPrev,
  onNext,
  onPlayToggle,
  onReset,
  onSpeedChange,
}) {
  const atStart = step === 0;
  const atEnd = step >= total - 1;
  const pct = total > 0 ? ((step + 1) / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4 px-1 py-2">
      <div className="flex items-center gap-3 min-w-[180px]">
        <div className="text-[11.5px] text-ink-muted">step</div>
        <div className="font-mono text-[13px] tabular-nums">
          <span className="text-ink">
            {String(step + 1).padStart(2, "0")}
          </span>
          <span className="text-ink-muted">
            {" "}
            / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="flex-1 h-1.5 rounded-full bg-ink/[0.06] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isFail ? "bg-[var(--state-failed)]" : "bg-brand"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="header-icon"
          onClick={onPrev}
          disabled={atStart}
          aria-label="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={atEnd ? "outline" : "brand"}
          size="header"
          onClick={onPlayToggle}
          disabled={atEnd}
        >
          {playing ? (
            <>
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Play
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="header-icon"
          onClick={onNext}
          disabled={atEnd}
          aria-label="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="header-icon"
          onClick={onReset}
          aria-label="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="h-8 rounded-md border border-rule bg-paper px-2 text-[12px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
        >
          <option value={1100}>0.5×</option>
          <option value={700}>1×</option>
          <option value={400}>2×</option>
          <option value={200}>4×</option>
        </select>
      </div>
    </div>
  );
}
