import { Check } from "lucide-react";
import { CHECK_FLAGS } from "@/theme.js";
import { cn } from "@/lib/utils.js";

export function ChecksBar({ checks, onToggle, triggeredFlag, isFail }) {
  const onCount = CHECK_FLAGS.filter((f) => checks[f.key]).length;
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-[11.5px] text-ink-muted">checks</span>
        <span className="text-[11.5px] text-ink-muted/70">
          {onCount} / {CHECK_FLAGS.length} on
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-end flex-1">
        {CHECK_FLAGS.map((f) => (
          <CheckPill
            key={f.key}
            label={f.label}
            checked={!!checks[f.key]}
            triggered={triggeredFlag === f.key}
            isFail={isFail}
            onToggle={() => onToggle(f.key)}
            title={f.cbmc}
          />
        ))}
      </div>
    </div>
  );
}

function CheckPill({ label, checked, triggered, isFail, onToggle, title }) {
  const triggeredFail = triggered && isFail;
  return (
    <button
      onClick={onToggle}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        triggeredFail
          ? "border-[var(--state-failed)]/30 bg-[var(--state-failed)]/10 text-[var(--state-failed)]"
          : checked
            ? "border-brand/30 bg-brand/10 text-brand"
            : "border-rule text-ink-muted hover:bg-ink/[0.03] hover:text-ink"
      )}
    >
      <span
        className={cn(
          "relative inline-flex items-center justify-center h-3 w-3 rounded-[3px] border transition-colors",
          checked && triggeredFail && "border-[var(--state-failed)] bg-[var(--state-failed)]",
          checked && !triggeredFail && "border-brand bg-brand",
          !checked && "border-ink-muted/40"
        )}
      >
        {checked && (
          <Check className="h-2.5 w-2.5 stroke-[3] text-paper" />
        )}
      </span>
      {label}
      {triggered && (
        <span
          className={cn(
            "ml-0.5 text-[11px]",
            triggeredFail ? "text-[var(--state-failed)]" : "text-brand"
          )}
        >
          ↯ trace
        </span>
      )}
    </button>
  );
}
