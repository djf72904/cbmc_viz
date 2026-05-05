import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge.jsx";
import { cn } from "@/lib/utils.js";
import { fmtValue } from "@/parser.js";

function Section({ title, children, className }) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <h3 className="text-xs font-semibold text-muted-foreground/80">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px bg-border/40" />;
}

export function StatePanel({ vars, isFail }) {
  return (
    <Section title="State">
      <div className="space-y-1.5">
        {!vars || vars.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            (none yet — step forward)
          </div>
        ) : (
          vars.map((v) => <VarRow key={v.name} v={v} isFail={isFail} />)
        )}
      </div>
    </Section>
  );
}

function VarRow({ v, isFail }) {
  if (v.kind === "array") {
    const cellsStr = (v.cellsNow || [])
      .map((c) => (c == null ? "—" : fmtValue(c)))
      .join(", ");
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground font-mono">
          {v.name}
          <span className="text-foreground/30">[{v.size}]</span>
        </span>
        <span
          className={cn(
            "text-xs font-mono truncate max-w-[200px]",
            isFail ? "text-[var(--trace-fail)]" : "text-foreground"
          )}
        >
          [{cellsStr}]
        </span>
      </div>
    );
  }
  const valStr = v.current ? fmtValue(v.current) : "—";
  const tag = v.kind === "pointer" ? "ptr" : "int";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground font-mono inline-flex items-baseline gap-2">
        <Badge variant="muted" className="text-xs px-1 py-0">
          {tag}
        </Badge>
        {v.name}
      </span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums truncate max-w-[180px]",
          isFail ? "text-[var(--trace-fail)]" : "text-foreground"
        )}
      >
        {valStr}
      </span>
    </div>
  );
}

export function NarrationPanel({ note, isFail }) {
  return (
    <Section title="Narration">
      <div
        className={cn(
          "text-sm leading-relaxed min-h-[40px]",
          isFail ? "text-[var(--trace-fail)]" : "text-foreground/85"
        )}
      >
        {note || "—"}
      </div>
    </Section>
  );
}

const STEP_KIND_LABEL = {
  "function-call": "function",
  "function-return": "return",
  assignment: "assign",
  "loop-head": "loop head",
  "location-only": "location",
  location: "location",
  failure: "violation",
};

export function ActiveStepPanel({ step, total, isFail }) {
  const kind = step?.kind ?? "?";
  const label = STEP_KIND_LABEL[kind] ?? kind;
  return (
    <Section title="Active Step">
      <div className="space-y-2">
        <Badge variant={isFail ? "fail" : "amber"} className="text-xs">
          {label}
        </Badge>
        {step && (
          <div className="text-xs text-muted-foreground font-mono">
            step {step.idx + 1} / {total} · raw idx {step.rawIdx}
          </div>
        )}
        {step?.loc && (
          <div className="text-xs font-mono text-foreground/80 truncate">
            {step.loc.function ?? "·"}:{step.loc.line ?? "?"}
          </div>
        )}
      </div>
    </Section>
  );
}

export function TraceInfoPanel({ meta, stepCount, varCount, source }) {
  return (
    <Section title="Trace Info">
      <div className="space-y-1.5 text-xs">
        {source && (
          <Row
            k="source"
            v={source.label}
            accent={source.uploaded ? "ok" : "muted"}
          />
        )}
        <Row k="file" v={meta.file} />
        <Row k="function" v={`${meta.fnName}()`} />
        <Row k="property" v={meta.property} />
        <Row k="line" v={String(meta.line)} />
        <Row k="status" v={meta.status} />
        <Row k="vars" v={String(varCount)} />
        <Row
          k="steps"
          v={
            meta.rawSteps
              ? `${stepCount} viz · ${meta.rawSteps} raw`
              : String(stepCount)
          }
        />
        {meta.description && (
          <Row k="desc" v={meta.description} />
        )}
      </div>
    </Section>
  );
}

function Row({ k, v, accent }) {
  const ref = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const handleEnter = () => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 1);
    setHovering(true);
  };

  return (
    <div
      className="relative flex items-baseline gap-2.5"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovering(false)}
    >
      <span className="text-xs text-muted-foreground/70 w-16 shrink-0">
        {k}
      </span>
      <span
        ref={ref}
        className={cn(
          "font-mono flex-1 truncate",
          overflowing && hovering && "cursor-help",
          accent === "ok" && "text-[var(--trace-ok)]",
          accent === "muted" && "text-muted-foreground",
          !accent && "text-foreground"
        )}
      >
        {v}
      </span>
      {overflowing && hovering && (
        <FieldPopover anchor={ref.current} k={k} v={v} />
      )}
    </div>
  );
}

function FieldPopover({ anchor, k, v }) {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(380, window.innerWidth - 32);
  let left = rect.right - width;
  if (left < 12) left = 12;
  if (left + width > window.innerWidth - 12) left = window.innerWidth - 12 - width;
  const top = rect.bottom + 6;

  return createPortal(
    <div
      className="fixed z-50 pointer-events-none rounded-xl border border-border/60 bg-popover shadow-xl animate-fade-in-fast"
      style={{ left, top, width }}
    >
      <div className="px-3.5 py-2 border-b border-border/40 text-xs text-muted-foreground">
        {k}
      </div>
      <div className="px-3.5 py-2.5 font-mono text-xs text-foreground break-all whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto">
        {v}
      </div>
    </div>,
    document.body
  );
}

export { Divider };
