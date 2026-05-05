import { Check } from "lucide-react";
import { CHECK_FLAGS } from "@/theme.js";
import { cn } from "@/lib/utils.js";

export function ChecksBar({ checks, onToggle, triggeredFlag, isFail }) {
  const onCount = CHECK_FLAGS.filter((f) => checks[f.key]).length;
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          checks
        </span>
        <span className="text-xs text-muted-foreground/70">
          {onCount} / {CHECK_FLAGS.length} on
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-end flex-1">
        {CHECK_FLAGS.map((f) => (
          <Checkbox
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

function Checkbox({ label, checked, triggered, isFail, onToggle, title }) {
  const accent = triggered && isFail ? "fail" : "amber";
  return (
    <button
      onClick={onToggle}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium transition-colors group",
        triggered
          ? accent === "fail"
            ? "text-[var(--trace-fail)]"
            : "text-amber"
          : checked
            ? "text-amber"
            : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "relative inline-flex items-center justify-center h-3 w-3 rounded-[3px] border transition-colors",
          checked && triggered && accent === "fail" &&
            "border-[var(--trace-fail)] bg-[var(--trace-fail)]",
          checked &&
            !(triggered && accent === "fail") &&
            "border-amber bg-amber",
          !checked && "border-muted-foreground/40 group-hover:border-foreground/60"
        )}
      >
        {checked && (
          <Check className="h-2.5 w-2.5 stroke-[3] text-background" />
        )}
      </span>
      {label}
      {triggered && (
        <span
          className={cn(
            "text-xs ml-1",
            accent === "fail" ? "text-[var(--trace-fail)]" : "text-amber"
          )}
        >
          ↯ trace
        </span>
      )}
    </button>
  );
}
