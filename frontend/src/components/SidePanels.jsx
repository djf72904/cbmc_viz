import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge.jsx";
import { cn } from "@/lib/utils.js";
import { fmtValue } from "@/parser.js";

function Section({ title, children, className }) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px bg-rule" />;
}

export function StatePanel({ vars, isFail }) {
  return (
    <Section title="State">
      <div className="space-y-1.5">
        {!vars || vars.length === 0 ? (
          <div className="text-[12px] text-ink-muted italic">
            (none yet, step forward)
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
        <span className="text-[12px] text-ink-muted font-mono">
          {v.name}
          <span className="text-ink/30">[{v.size}]</span>
        </span>
        <span
          className={cn(
            "text-[12px] font-mono truncate max-w-[200px]",
            isFail ? "text-[var(--state-failed)]" : "text-ink"
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
      <span className="text-[12px] text-ink-muted font-mono inline-flex items-baseline gap-2">
        <Badge variant="muted" className="text-[10px] px-1.5 py-0">
          {tag}
        </Badge>
        {v.name}
      </span>
      <span
        className={cn(
          "font-mono text-[13px] tabular-nums truncate max-w-[180px]",
          isFail ? "text-[var(--state-failed)]" : "text-ink"
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
          "text-[13px] leading-relaxed min-h-[40px]",
          isFail ? "text-[var(--state-failed)]" : "text-ink/85"
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
        <Badge variant={isFail ? "fail" : "brand"}>
          {label}
        </Badge>
        {step && (
          <div className="text-[12px] text-ink-muted font-mono">
            step {step.idx + 1} / {total} · raw idx {step.rawIdx}
          </div>
        )}
        {step?.loc && (
          <div className="text-[12px] font-mono text-ink/80 truncate">
            {step.loc.function ?? "·"}:{step.loc.line ?? "?"}
          </div>
        )}
      </div>
    </Section>
  );
}

export function TraceInfoPanel({ meta, stepCount, varCount, source, analysis }) {
  const flagsUsed = analysis?.flagsUsed?.length ? analysis.flagsUsed.join(" ") : null;
  const entry = analysis?.entry || null;
  const unwind = analysis?.unwind ?? null;
  const exitCode = analysis?.exitCode ?? null;
  const stderr = analysis?.stderr || null;

  return (
    <Section title="Trace Info">
      <div className="space-y-1.5 text-[12px]">
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
        {flagsUsed && <Row k="flags" v={flagsUsed} />}
        {entry && <Row k="entry" v={`${entry}()`} />}
        {unwind != null && <Row k="unwind" v={String(unwind)} />}
        {exitCode != null && (
          <Row
            k="exit"
            v={String(exitCode)}
            accent={exitCode === 0 ? "ok" : exitCode === 10 ? "fail" : "muted"}
          />
        )}
        {meta.description && <Row k="desc" v={meta.description} />}
        {stderr && <StderrRow stderr={stderr} />}
      </div>
    </Section>
  );
}

function StderrRow({ stderr }) {
  const [open, setOpen] = useState(false);
  const oneLine = stderr.split("\n").find((l) => l.trim()) ?? stderr;
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-baseline gap-2.5 hover:opacity-80"
      >
        <span className="text-[12px] text-ink-muted/70 w-16 shrink-0">stderr</span>
        <span className="font-mono flex-1 truncate text-[var(--state-failed)]">
          {oneLine}
        </span>
      </button>
      {open && (
        <pre className="ml-[4.5rem] rounded-md border border-rule bg-paper/60 p-2 font-mono text-[11.5px] text-ink/80 whitespace-pre-wrap break-words max-h-[40vh] overflow-y-auto">
          {stderr}
        </pre>
      )}
    </div>
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
      <span className="text-[12px] text-ink-muted/70 w-16 shrink-0">{k}</span>
      <span
        ref={ref}
        className={cn(
          "font-mono flex-1 truncate",
          overflowing && hovering && "cursor-help",
          accent === "ok" && "text-[var(--state-passed)]",
          accent === "fail" && "text-[var(--state-failed)]",
          accent === "muted" && "text-ink-muted",
          !accent && "text-ink"
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
      className="fixed z-50 pointer-events-none rounded-xl border border-rule bg-popover shadow-xl animate-fade-in-fast"
      style={{ left, top, width }}
    >
      <div className="px-3.5 py-2 border-b border-rule text-[11.5px] text-ink-muted">
        {k}
      </div>
      <div className="px-3.5 py-2.5 font-mono text-[12px] text-ink break-all whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto">
        {v}
      </div>
    </div>,
    document.body
  );
}

export { Divider };
