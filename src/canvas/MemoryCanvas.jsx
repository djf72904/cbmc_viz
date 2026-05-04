import { useMemo, useRef, useState, useCallback } from "react";
import { variablesAt, fmtValue } from "@/parser.js";
import { cn } from "@/lib/utils.js";

const W = 820;
const X0 = 60;
const X_PAD_RIGHT = 60;
const SCALAR_BOX_W = 150;
const SCALAR_BOX_H = 70;
const SCALAR_GAP = 18;
const SCALAR_ROW_GAP = 14;

// Geometry per array row:
//   y          : section label "X[N] · ARRAY MEMORY"
//   y + 28     : VALID/OOB bracket
//   y + 60     : top of cells, height = cellH
//   y + 60 + cellH + 22 : cell index labels [0]..[N]
const ARRAY_LABEL_TO_CELLS = 60;
const ARRAY_INDEX_PAD = 28;     // space between cell bottom and [n] label
const ARRAY_ROW_TRAILING = 36;  // space below the [n] labels before the next section

function cellGeometry(N) {
  const slotCount = N + 1;
  const usable = W - X0 - X_PAD_RIGHT;
  const cellW = Math.min(100, Math.max(38, Math.floor(usable / slotCount) - 14));
  const gap = Math.min(
    20,
    Math.max(
      8,
      Math.floor((usable - cellW * slotCount) / Math.max(1, slotCount - 1))
    )
  );
  const cellH = Math.min(100, Math.max(60, cellW));
  return { cellW, gap, cellH };
}

export function MemoryCanvas({ parsed, currentStep, isFail }) {
  const stepIdx = currentStep?.idx ?? 0;
  const liveVars = useMemo(
    () => variablesAt(parsed.variables, stepIdx),
    [parsed.variables, stepIdx]
  );

  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);

  const handleHover = useCallback((item, e) => {
    if (!item || !e) {
      setHover(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      item,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      containerWidth: rect.width,
      containerHeight: rect.height,
    });
  }, []);

  const handleLeave = useCallback(() => setHover(null), []);

  const arrays = liveVars.filter((v) => v.kind === "array");
  const ptrs = liveVars.filter((v) => v.kind === "pointer" && v.current);
  const scalars = liveVars.filter((v) => v.kind === "scalar" && v.current !== null);

  let yCursor = 50;
  const arrayBlocks = arrays.map((arr) => {
    const N = Math.max(1, arr.size || 1);
    const { cellH } = cellGeometry(N);
    const rowHeight =
      ARRAY_LABEL_TO_CELLS + cellH + ARRAY_INDEX_PAD + ARRAY_ROW_TRAILING;
    const block = { y: yCursor, arr };
    yCursor += rowHeight;
    return block;
  });

  const scalarItems = [...scalars, ...ptrs];
  const hasScalars = scalarItems.length > 0;
  const usableScalarW = W - X0 - X_PAD_RIGHT;
  const scalarsPerRow = Math.max(
    1,
    Math.floor((usableScalarW + SCALAR_GAP) / (SCALAR_BOX_W + SCALAR_GAP))
  );
  const scalarRowCount = hasScalars
    ? Math.ceil(scalarItems.length / scalarsPerRow)
    : 0;

  const SCALAR_ROW_Y = yCursor + 30;
  if (hasScalars) {
    yCursor =
      SCALAR_ROW_Y +
      scalarRowCount * SCALAR_BOX_H +
      Math.max(0, scalarRowCount - 1) * SCALAR_ROW_GAP +
      40;
  }
  const totalH = Math.max(360, yCursor + 30);

  const justWroteVar = (() => {
    if (!currentStep) return null;
    if (currentStep.kind === "assignment") {
      if (currentStep.arrayName)
        return { name: currentStep.arrayName, idx: currentStep.arrayIndex };
      if (currentStep.lhs) return { name: currentStep.lhs };
    }
    return null;
  })();

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseLeave={handleLeave}
    >
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <defs>
        <pattern
          id="hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            className="stroke-[color:var(--color-border)]"
            strokeWidth="1"
          />
        </pattern>
        <pattern
          id="hatch-red"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            className="stroke-[var(--trace-fail)]"
            strokeWidth="1.4"
          />
        </pattern>
      </defs>

      {arrayBlocks.length === 0 && scalars.length === 0 && ptrs.length === 0 && (
        <text
          x={W / 2}
          y={totalH / 2}
          textAnchor="middle"
          fontSize="13"
          className="fill-[color:var(--color-muted-foreground)]"
        >
          (no variables observed yet — step forward)
        </text>
      )}

      {arrayBlocks.map((b) => (
        <ArrayRow
          key={b.arr.name}
          y={b.y}
          arr={b.arr}
          isFail={
            isFail &&
            (currentStep?.arrayName === b.arr.name ||
              currentStep?.kind === "failure")
          }
          activeIdx={
            justWroteVar?.name === b.arr.name ? justWroteVar.idx : null
          }
        />
      ))}

      {hasScalars && (
        <>
          <line
            x1={X0}
            y1={SCALAR_ROW_Y - 18}
            x2={W - X_PAD_RIGHT}
            y2={SCALAR_ROW_Y - 18}
            className="stroke-[color:var(--color-border)]"
            strokeWidth="1"
          />
          <text
            x={X0}
            y={SCALAR_ROW_Y - 26}
            fontSize="10"
            letterSpacing="3"
            className="fill-[color:var(--color-muted-foreground)]"
          >
            SCALARS &amp; POINTERS
          </text>
          <ScalarGrid
            y={SCALAR_ROW_Y}
            items={scalarItems}
            perRow={scalarsPerRow}
            justWroteName={justWroteVar?.name}
            isFail={isFail}
            hoveredName={hover?.item?.name ?? null}
            onHover={handleHover}
          />
        </>
      )}
    </svg>
    {hover && (
      <ScalarPopover
        item={hover.item}
        x={hover.x}
        y={hover.y}
        containerWidth={hover.containerWidth}
        containerHeight={hover.containerHeight}
        currentStepIdx={currentStep?.idx ?? -1}
        isFail={isFail}
      />
    )}
    </div>
  );
}

function ArrayRow({ y, arr, isFail, activeIdx }) {
  const N = Math.max(1, arr.size || 1);
  const { cellW, gap, cellH } = cellGeometry(N);
  const cellX = (i) => X0 + i * (cellW + gap);

  const validX1 = cellX(0);
  const validX2 = cellX(N - 1) + cellW;
  const oobX = cellX(N);

  return (
    <g>
      <text
        x={X0}
        y={y}
        fontSize="10"
        letterSpacing="3"
        className="fill-[color:var(--color-muted-foreground)]"
      >
        {`${arr.name.toUpperCase()}[${N}]   ·   ARRAY MEMORY`}
      </text>

      <ValidBracket x1={validX1} x2={validX2} y={y + 28} N={N} />
      <OobZone x={oobX} w={cellW} y={y + 28} active={isFail} />

      {Array.from({ length: N }).map((_, i) => {
        const cellVal = arr.cellsNow[i];
        return (
          <MemCell
            key={i}
            x={cellX(i)}
            y={y + 60}
            w={cellW}
            h={cellH}
            value={cellVal == null ? "—" : fmtValue(cellVal)}
            index={i}
            active={activeIdx === i && !isFail}
            fail={activeIdx === i && isFail}
          />
        );
      })}
      <MemCell
        x={cellX(N)}
        y={y + 60}
        w={cellW}
        h={cellH}
        value="?"
        index={N}
        phantom
        fail={isFail}
      />
    </g>
  );
}

function ScalarGrid({
  y,
  items,
  perRow,
  justWroteName,
  isFail,
  hoveredName,
  onHover,
}) {
  return (
    <g>
      {items.map((v, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const x = X0 + col * (SCALAR_BOX_W + SCALAR_GAP);
        const yy = y + row * (SCALAR_BOX_H + SCALAR_ROW_GAP);
        const active = justWroteName === v.name;
        const fail = active && isFail;
        return (
          <ScalarBox
            key={v.name}
            x={x}
            y={yy}
            w={SCALAR_BOX_W}
            h={SCALAR_BOX_H}
            item={v}
            active={active && !fail}
            fail={fail}
            hovered={hoveredName === v.name}
            onHover={onHover}
          />
        );
      })}
    </g>
  );
}

function clipText(text, maxChars) {
  const s = String(text);
  return s.length > maxChars ? s.slice(0, Math.max(1, maxChars - 1)) + "…" : s;
}

function ScalarBox({ x, y, w, h, item, active, fail, hovered, onHover }) {
  const name = item.name;
  const kind = item.kind;
  const value = item.current ? fmtValue(item.current) : "—";

  let strokeClass = "stroke-[color:var(--color-border)]";
  let fillClass = "fill-transparent";
  let textClass = "fill-[color:var(--color-foreground)]";
  let lblClass = "fill-[color:var(--color-muted-foreground)]";

  if (fail) {
    strokeClass = "stroke-[var(--trace-fail)]";
    fillClass = "fill-[var(--trace-fail-soft)]";
    textClass = "fill-[var(--trace-fail)]";
    lblClass = "fill-[var(--trace-fail)]";
  } else if (active) {
    strokeClass = "stroke-amber";
    fillClass = "fill-amber-soft";
    textClass = "fill-amber";
    lblClass = "fill-amber";
  } else if (hovered) {
    strokeClass = "stroke-foreground/60";
  }

  const valueChars = Math.max(3, Math.floor((w - 32) / 13));
  const nameChars = Math.max(4, Math.floor((w - 50) / 7));
  const valueClipped = clipText(value, valueChars);
  const nameClipped = clipText(name, nameChars);
  const valueFontSize = valueClipped.length > 8 ? 16 : valueClipped.length > 5 ? 19 : 22;

  const clipId = `clip-${name.replace(/[^A-Za-z0-9]/g, "_")}-${x}-${y}`;

  return (
    <g
      style={{ transition: "all 220ms ease", cursor: "default" }}
      onMouseEnter={(e) => onHover?.(item, e)}
      onMouseMove={(e) => onHover?.(item, e)}
      onMouseLeave={() => onHover?.(null)}
    >
      {active && (
        <rect
          x={x + 4}
          y={y + 4}
          width={w}
          height={h}
          rx="8"
          className={fail ? "fill-[var(--trace-fail)]" : "fill-amber"}
          opacity="0.18"
        />
      )}
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx="8" />
        </clipPath>
      </defs>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="8"
        className={`${fillClass} ${strokeClass}`}
        strokeWidth={active ? 2 : 1.3}
        style={{ transition: "all 220ms ease" }}
      />
      <g clipPath={`url(#${clipId})`}>
        <text x={x + 12} y={y + 18} fontSize="10" letterSpacing="2" className={lblClass}>
          {kind === "pointer" ? "PTR" : "INT"}
        </text>
        <text
          x={x + w - 12}
          y={y + 18}
          textAnchor="end"
          fontSize="11"
          className={lblClass}
          fontFamily="var(--font-mono)"
        >
          {nameClipped}
        </text>
        <text
          x={x + w / 2}
          y={y + h - 14}
          textAnchor="middle"
          fontSize={valueFontSize}
          fontFamily="var(--font-mono)"
          fontWeight="500"
          className={textClass}
        >
          {valueClipped}
        </text>
      </g>
    </g>
  );
}

function ValidBracket({ x1, x2, y, N }) {
  const tick = 8;
  return (
    <g>
      <path
        d={`M ${x1} ${y + tick} L ${x1} ${y} L ${x2} ${y} L ${x2} ${y + tick}`}
        fill="none"
        className="stroke-amber"
        strokeWidth="1.4"
      />
      <text
        x={(x1 + x2) / 2}
        y={y - 10}
        textAnchor="middle"
        fontSize="11"
        letterSpacing="2"
        className="fill-amber"
      >
        {`VALID  ·  0 ≤ idx < ${N}`}
      </text>
    </g>
  );
}

function OobZone({ x, w, y, active }) {
  const tick = 8;
  return (
    <g style={{ transition: "all 220ms ease" }}>
      <path
        d={`M ${x} ${y + tick} L ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + tick}`}
        fill="none"
        className={
          active
            ? "stroke-[var(--trace-fail)]"
            : "stroke-[color:color-mix(in_oklch,var(--trace-fail)_45%,transparent)]"
        }
        strokeWidth="1.4"
        style={{ transition: "stroke 220ms ease" }}
      />
      <text
        x={x + w / 2}
        y={y - 10}
        textAnchor="middle"
        fontSize="10"
        letterSpacing="2"
        className={
          active
            ? "fill-[var(--trace-fail)]"
            : "fill-[color:color-mix(in_oklch,var(--trace-fail)_55%,transparent)]"
        }
        style={{ transition: "fill 220ms ease" }}
      >
        OUT OF BOUNDS
      </text>
    </g>
  );
}

function MemCell({ x, y, w, h, value, index, active, fail, phantom }) {
  let strokeClass = "stroke-[color:var(--color-border)]";
  let fillClass = "fill-transparent";
  let textClass = "fill-[color:var(--color-foreground)]";
  const dasharray = phantom ? "5 4" : null;

  if (phantom && fail) {
    strokeClass = "stroke-[var(--trace-fail)]";
    fillClass = "fill-[url(#hatch-red)]";
    textClass = "fill-[var(--trace-fail)]";
  } else if (phantom) {
    strokeClass = "stroke-[color:color-mix(in_oklch,var(--trace-fail)_45%,transparent)]";
    fillClass = "fill-[url(#hatch)]";
    textClass = "fill-[color:var(--color-muted-foreground)]";
  } else if (fail) {
    strokeClass = "stroke-[var(--trace-fail)]";
    fillClass = "fill-[var(--trace-fail-soft)]";
    textClass = "fill-[var(--trace-fail)]";
  } else if (active) {
    strokeClass = "stroke-amber";
    fillClass = "fill-amber-soft";
    textClass = "fill-amber";
  }

  const valStr = String(value);
  const valFontSize = Math.min(28, Math.max(14, Math.floor(w * 0.32)));

  return (
    <g style={{ transition: "all 220ms ease" }}>
      {active && (
        <rect
          x={x + 4}
          y={y + 4}
          width={w}
          height={h}
          rx="6"
          className={fail ? "fill-[var(--trace-fail)]" : "fill-amber"}
          opacity="0.18"
        />
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        className={`${fillClass} ${strokeClass}`}
        strokeWidth={active || (phantom && fail) ? 2 : 1.3}
        strokeDasharray={dasharray}
        style={{ transition: "all 220ms ease" }}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + valFontSize / 3}
        textAnchor="middle"
        fontSize={valFontSize}
        fontFamily="var(--font-mono)"
        fontWeight="500"
        className={textClass}
      >
        {valStr.length > 8 ? valStr.slice(0, 7) + "…" : valStr}
      </text>
      <text
        x={x + w / 2}
        y={y + h + 22}
        textAnchor="middle"
        fontSize="11"
        letterSpacing="1"
        className={textClass}
        fontFamily="var(--font-mono)"
      >
        [{index}]
      </text>
    </g>
  );
}

const POPOVER_W = 280;
const POPOVER_OFFSET_X = 14;
const POPOVER_OFFSET_Y = 14;

function ScalarPopover({ item, x, y, containerWidth, containerHeight, currentStepIdx, isFail }) {
  const value = item.current ? fmtValue(item.current) : "—";
  const type = item.current?.type ?? null;
  const writes = Array.isArray(item.history) ? item.history.length : 0;
  const stepOfCurrent = item.stepOfCurrent ?? null;

  // Position so the popover stays inside the container.
  let left = x + POPOVER_OFFSET_X;
  let top = y + POPOVER_OFFSET_Y;
  if (left + POPOVER_W > containerWidth) {
    left = Math.max(8, x - POPOVER_W - POPOVER_OFFSET_X);
  }
  // Cap to container; clamp top to leave room for ~200px of content.
  top = Math.min(Math.max(8, top), Math.max(8, containerHeight - 220));

  const accent = isFail ? "var(--trace-fail)" : "var(--amber)";

  return (
    <div
      className={cn(
        "absolute z-30 pointer-events-none",
        "rounded-xl border border-border/60 bg-popover shadow-xl",
        "animate-fade-in-fast"
      )}
      style={{ left, top, width: POPOVER_W }}
    >
      <div className="px-3.5 py-2.5 border-b border-border/40 flex items-center gap-2">
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            color: accent,
            background: `color-mix(in oklch, ${accent} 18%, transparent)`,
          }}
        >
          {item.kind === "pointer" ? "ptr" : "int"}
        </span>
        <span className="font-mono text-xs text-foreground truncate flex-1">
          {item.name}
        </span>
      </div>

      <div className="px-3.5 py-3 space-y-2">
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Value
          </div>
          <div
            className="font-mono text-sm break-all"
            style={{ color: isFail ? "var(--trace-fail)" : "var(--color-foreground)" }}
          >
            {value}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t border-border/30">
          {type && <PopoverRow k="type" v={type} mono />}
          <PopoverRow
            k="last write"
            v={
              stepOfCurrent != null && stepOfCurrent >= 0
                ? `step ${stepOfCurrent + 1}`
                : "—"
            }
          />
          <PopoverRow
            k="writes"
            v={writes ? String(writes) : "—"}
          />
          <PopoverRow
            k="current"
            v={
              currentStepIdx >= 0
                ? `step ${currentStepIdx + 1}`
                : "—"
            }
          />
        </div>
      </div>
    </div>
  );
}

function PopoverRow({ k, v, mono }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-xs text-muted-foreground/70 shrink-0">
        {k}
      </span>
      <span
        className={cn(
          "text-xs text-foreground truncate",
          mono && "font-mono"
        )}
      >
        {v}
      </span>
    </div>
  );
}
