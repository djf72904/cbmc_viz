import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, Locate } from "lucide-react";

const LIB_FN_RE =
  /^(__CPROVER_|__VERIFIER_|malloc$|calloc$|realloc$|free$|memcpy$|memset$|memmove$|strcpy$|strncpy$|strcat$|strlen$|strcmp$|strncmp$|printf$|fprintf$|sprintf$|fopen$|fclose$|exit$|abort$|assert$)/;

function isLibFrame(fn) {
  return !!fn && LIB_FN_RE.test(fn);
}

function buildGraph(steps) {
  const nodes = [];
  const byKey = new Map();
  const edges = [];
  const seenEdges = new Set();
  let prev = null;

  const keyOf = (loc) => `${loc.function || "·"}:${loc.line || "?"}`;

  for (const s of steps) {
    if (s.kind === "function-return") continue;
    if (!s.loc.line && s.kind !== "failure") continue;
    if (isLibFrame(s.loc.function) && s.kind !== "failure") continue;
    const key = keyOf(s.loc);
    let node = byKey.get(key);
    if (!node) {
      node = {
        key,
        fn: s.loc.function || "·",
        line: s.loc.line || "?",
        kinds: new Set(),
        visits: 0,
        firstStepIdx: s.idx,
        order: nodes.length,
        labelHints: new Set(),
      };
      nodes.push(node);
      byKey.set(key, node);
    }
    node.kinds.add(s.kind);
    node.visits++;
    if (s.kind === "function-call") node.labelHints.add(`→ ${s.functionName}()`);
    if (s.kind === "loop-head") node.labelHints.add("loop head");
    if (s.kind === "failure") node.labelHints.add(s.reason || "violation");
    if (s.kind === "assignment" && s.lhs) node.labelHints.add(`${s.lhs} =`);

    if (prev && prev !== key) {
      const eKey = `${prev}→${key}`;
      if (!seenEdges.has(eKey)) {
        seenEdges.add(eKey);
        edges.push({ key: eKey, from: prev, to: key });
      }
    }
    prev = key;
  }
  return { nodes, edges };
}

const NODE_W = 320;
const NODE_H = 64;
const V_GAP = 36;
const TOP_PAD = 40;
const W = 820;
const ROW_H = NODE_H + V_GAP;
const VIEWPORT_HEIGHT_PX = 600;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

export function CFGCanvas({ parsed, currentStep, isFail, onNodeClick }) {
  const { nodes, edges } = useMemo(() => buildGraph(parsed.steps), [parsed]);
  const accentClass = isFail
    ? "stroke-[var(--state-failed)]"
    : "stroke-[var(--brand)]";

  const layout = useMemo(() => {
    const cx = W / 2;
    return nodes.map((n, i) => ({
      ...n,
      cx,
      cy: TOP_PAD + i * ROW_H + NODE_H / 2,
      w: NODE_W,
      h: NODE_H,
    }));
  }, [nodes]);

  const posByKey = useMemo(
    () => new Map(layout.map((p) => [p.key, p])),
    [layout]
  );
  const activeKey = currentStep
    ? `${currentStep.loc.function || "·"}:${currentStep.loc.line || "?"}`
    : null;

  const totalH = TOP_PAD * 2 + Math.max(1, nodes.length) * ROW_H;

  const containerRef = useRef(null);
  const [viewBox, setViewBoxState] = useState({ x: 0, y: 0, w: W, h: totalH });
  const [containerWidth, setContainerWidth] = useState(W);
  const [followActive, setFollowActive] = useState(true);
  const dragRef = useRef(null);

  const setViewBox = useCallback((next) => {
    setViewBoxState(() => {
      const w = Math.min(W * (1 / ZOOM_MIN), Math.max(W * (1 / ZOOM_MAX), next.w));
      const h = w * (VIEWPORT_HEIGHT_PX / Math.max(1, containerWidth));
      return { x: next.x, y: next.y, w, h };
    });
  }, [containerWidth]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth || W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setViewBoxState((prev) => {
      const w = prev.w;
      const h = w * (VIEWPORT_HEIGHT_PX / Math.max(1, containerWidth));
      return { ...prev, h };
    });
  }, [containerWidth]);

  const lastFitKey = useRef("");
  useEffect(() => {
    const key = `${nodes.length}:${containerWidth}`;
    if (lastFitKey.current === key) return;
    lastFitKey.current = key;
    setViewBoxState({
      x: 0,
      y: 0,
      w: W,
      h: W * (VIEWPORT_HEIGHT_PX / Math.max(1, containerWidth)),
    });
  }, [nodes.length, containerWidth]);

  useEffect(() => {
    const active = posByKey.get(activeKey);
    if (!active) return;
    setViewBoxState((prev) => {
      const margin = 24;
      const nodeLeft = active.cx - active.w / 2 - margin;
      const nodeRight = active.cx + active.w / 2 + margin;
      const nodeTop = active.cy - active.h / 2 - margin;
      const nodeBottom = active.cy + active.h / 2 + margin;
      const inView =
        nodeLeft >= prev.x &&
        nodeRight <= prev.x + prev.w &&
        nodeTop >= prev.y &&
        nodeBottom <= prev.y + prev.h;
      if (inView) return prev;
      return {
        ...prev,
        x: active.cx - prev.w / 2,
        y: active.cy - prev.h / 2,
      };
    });
  }, [activeKey, posByKey]);

  const screenToWorld = (clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return {
      x: viewBox.x + px * viewBox.w,
      y: viewBox.y + py * viewBox.h,
    };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setFollowActive(false);
    const factor = e.deltaY < 0 ? 0.85 : 1.18;
    const focus = screenToWorld(e.clientX, e.clientY);
    setViewBox({
      w: viewBox.w * factor,
      h: viewBox.h,
      x: focus.x - (focus.x - viewBox.x) * factor,
      y: focus.y - (focus.y - viewBox.y) * factor,
    });
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setFollowActive(false);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      vx: viewBox.x,
      vy: viewBox.y,
    };
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * viewBox.w;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * viewBox.h;
    setViewBox({
      x: dragRef.current.vx - dx,
      y: dragRef.current.vy - dy,
      w: viewBox.w,
    });
  };
  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const zoomBy = (factor) => {
    setFollowActive(false);
    const focus = { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 };
    setViewBox({
      w: viewBox.w * factor,
      x: focus.x - (focus.x - viewBox.x) * factor,
      y: focus.y - (focus.y - viewBox.y) * factor,
    });
  };

  const fitAll = () => {
    setFollowActive(false);
    const aspect = VIEWPORT_HEIGHT_PX / Math.max(1, containerWidth);
    const w = Math.max(W, totalH / aspect);
    setViewBoxState({
      x: 0,
      y: 0,
      w,
      h: w * aspect,
    });
  };

  const recenterActive = () => {
    setFollowActive(true);
    const active = posByKey.get(activeKey);
    if (!active) return;
    setViewBoxState((prev) => ({
      ...prev,
      x: active.cx - prev.w / 2,
      y: active.cy - prev.h / 2,
    }));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-card rounded-lg border border-[var(--rule)] overflow-hidden select-none"
      style={{ height: VIEWPORT_HEIGHT_PX }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMin meet"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        cursor: dragRef.current ? "grabbing" : "grab",
        transition: dragRef.current ? "none" : "viewBox 0.18s ease-out",
      }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-[var(--ink-muted)]" />
        </marker>
        <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            className={isFail ? "fill-[var(--state-failed)]" : "fill-[var(--brand)]"}
          />
        </marker>
      </defs>

      {edges.map((e) => {
        const a = posByKey.get(e.from);
        const b = posByKey.get(e.to);
        if (!a || !b) return null;
        const isBack = b.order < a.order && a.fn === b.fn;
        const onPath = activeKey === a.key;
        let d;
        if (isBack) {
          const xL = 60;
          d = `M ${a.cx - a.w / 2} ${a.cy} C ${xL} ${a.cy}, ${xL} ${b.cy}, ${b.cx - b.w / 2} ${b.cy}`;
        } else if (b.order === a.order + 1) {
          d = `M ${a.cx} ${a.cy + a.h / 2} L ${b.cx} ${b.cy - b.h / 2}`;
        } else {
          const xR = W - 60;
          d = `M ${a.cx + a.w / 2} ${a.cy} C ${xR} ${a.cy}, ${xR} ${b.cy}, ${b.cx + b.w / 2} ${b.cy}`;
        }
        return (
          <g key={e.key}>
            <path
              d={d}
              fill="none"
              className={onPath ? accentClass : "stroke-[var(--rule)]"}
              strokeWidth={onPath ? 2.2 : 1.3}
              markerEnd={onPath ? "url(#arrow-on)" : "url(#arrow)"}
              style={{ transition: "stroke 220ms ease, stroke-width 220ms ease" }}
            />
            {isBack && (
              <text
                x={66}
                y={(a.cy + b.cy) / 2}
                fontSize="10"
                letterSpacing="2"
                className={
                  onPath
                    ? isFail
                      ? "fill-[var(--state-failed)]"
                      : "fill-[var(--brand)]"
                    : "fill-[var(--ink-muted)]"
                }
              >
                LOOP
              </text>
            )}
          </g>
        );
      })}

      {layout.map((n) => (
        <CFGNode
          key={n.key}
          node={n}
          active={n.key === activeKey}
          isViolation={n.kinds.has("failure")}
          isFail={isFail}
          onClick={() => onNodeClick?.(n)}
        />
      ))}

      {layout.length === 0 && (
        <text
          x={W / 2}
          y={totalH / 2}
          textAnchor="middle"
          fontSize="14"
          className="fill-[var(--ink-muted)]"
        >
          (empty trace)
        </text>
      )}
    </svg>

    <CanvasToolbar
      onZoomIn={() => zoomBy(0.85)}
      onZoomOut={() => zoomBy(1.18)}
      onFit={fitAll}
      onRecenter={recenterActive}
      followActive={followActive}
      hasActive={!!posByKey.get(activeKey)}
    />
    </div>
  );
}

function CanvasToolbar({ onZoomIn, onZoomOut, onFit, onRecenter, followActive, hasActive }) {
  return (
    <div className="absolute top-2 right-2 flex flex-col gap-1 rounded-lg border border-[var(--rule)] bg-card/90 backdrop-blur-sm p-1 shadow-sm">
      <ToolbarButton title="Zoom in" onClick={onZoomIn}>
        <ZoomIn className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Zoom out" onClick={onZoomOut}>
        <ZoomOut className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Fit graph" onClick={onFit}>
        <Maximize2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title={followActive ? "Following active step" : "Recenter on active"}
        onClick={onRecenter}
        active={followActive}
        disabled={!hasActive}
      >
        <Locate className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({ title, onClick, children, active, disabled }) {
  return (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      disabled={disabled}
      className={
        "h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:bg-[var(--rule)]/60 hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
        (active ? "bg-brand/15 text-brand hover:text-brand" : "")
      }
    >
      {children}
    </button>
  );
}

function clipText(text, maxChars) {
  const s = String(text);
  return s.length > maxChars
    ? s.slice(0, Math.max(1, maxChars - 1)) + "…"
    : s;
}

const TAG_CHAR_PX = 8.5;
const SUB_CHAR_PX = 7.5;
const HINT_CHAR_PX = 7.2;

function CFGNode({ node, active, isViolation, isFail, onClick }) {
  const { cx, cy, w, h, fn, line, visits, labelHints } = node;
  const x = cx - w / 2;
  const y = cy - h / 2;

  let strokeClass = "stroke-[var(--rule)]";
  let fillClass = "fill-[var(--paper)]";
  let textClass = "fill-[var(--ink-muted)]";
  let subClass = "fill-[var(--ink-muted)]";

  if (isViolation) {
    strokeClass = active
      ? "stroke-[var(--state-failed)]"
      : "stroke-[color:color-mix(in_oklch,var(--state-failed)_45%,transparent)]";
    fillClass = active
      ? "fill-[color:color-mix(in_oklch,var(--state-failed)_10%,var(--paper))]"
      : "fill-[var(--paper)]";
    textClass = "fill-[var(--state-failed)]";
    subClass = "fill-[var(--state-failed)]";
  } else if (active) {
    strokeClass = "stroke-[var(--brand)]";
    fillClass = "fill-[color:color-mix(in_oklch,var(--brand)_10%,var(--paper))]";
    textClass = "fill-[var(--brand)]";
    subClass = "fill-[var(--ink)]";
  }

  const tag = isViolation
    ? "VIOLATION"
    : node.kinds.has("loop-head")
      ? "LOOP HEAD"
      : node.kinds.has("function-call")
        ? "ENTRY"
        : "STEP";

  const tagW = tag.length * TAG_CHAR_PX;
  const subAvailable = w - 28 - tagW - 16;
  const subText = `${fn}:${line}${visits > 1 ? `  ×${visits}` : ""}`;
  const subMaxChars = Math.max(4, Math.floor(subAvailable / SUB_CHAR_PX));
  const subClipped = clipText(subText, subMaxChars);

  const hintRaw = Array.from(labelHints).slice(0, 2).join("   ·   ") || "—";
  const hintMaxChars = Math.max(8, Math.floor((w - 28) / HINT_CHAR_PX));
  const hintClipped = clipText(hintRaw, hintMaxChars);

  const clipId = `cfg-${node.key.replace(/[^A-Za-z0-9]/g, "_")}`;

  return (
    <g
      style={{ transition: "all 220ms ease", cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      <title>{`${fn}:${line}${visits > 1 ? `  ×${visits}` : ""}\n${hintRaw}`}</title>
      {active && (
        <rect
          x={x + 4}
          y={y + 4}
          width={w}
          height={h}
          className={isFail ? "fill-[var(--state-failed)]" : "fill-[var(--brand)]"}
          opacity="0.12"
          rx="10"
        />
      )}
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx="10" />
        </clipPath>
      </defs>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="10"
        className={`${fillClass} ${strokeClass}`}
        strokeWidth={active ? 2 : 1.2}
        style={{ transition: "all 220ms ease" }}
      />
      <g clipPath={`url(#${clipId})`}>
        <text
          x={x + 14}
          y={y + 22}
          fontSize="10"
          fontWeight="700"
          letterSpacing="2.2"
          className={textClass}
        >
          {tag}
        </text>
        <text
          x={x + w - 14}
          y={y + 22}
          textAnchor="end"
          fontSize="10"
          letterSpacing="2"
          className={subClass}
          fontFamily="var(--font-mono)"
        >
          {subClipped}
        </text>
        <text
          x={cx}
          y={y + h - 16}
          textAnchor="middle"
          fontSize="12"
          className={subClass}
          fontFamily="var(--font-mono)"
        >
          {hintClipped}
        </text>
      </g>
    </g>
  );
}
