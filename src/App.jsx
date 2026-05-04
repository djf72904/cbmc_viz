import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { CHECK_FLAGS, DEFAULT_CHECKS } from "@/theme.js";
import { parseCbmcTrace, variablesAt } from "@/parser.js";
import { analyzeSource } from "@/lib/api.js";
import {
  loadHistory,
  saveHistoryItem,
  removeHistoryItem,
  clearHistory,
} from "@/lib/history.js";
import { Sidebar } from "@/components/layout/Sidebar.jsx";
import { TopBar } from "@/components/layout/TopBar.jsx";
import { ChecksBar } from "@/components/ChecksBar.jsx";
import { TraceControls } from "@/components/TraceControls.jsx";
import {
  StatePanel,
  NarrationPanel,
  ActiveStepPanel,
  TraceInfoPanel,
} from "@/components/SidePanels.jsx";
import { StepsList } from "@/components/StepsList.jsx";
import { CFGCanvas } from "@/canvas/CFGCanvas.jsx";
import { MemoryCanvas } from "@/canvas/MemoryCanvas.jsx";
import { SourceSheet } from "@/components/SourceSheet.jsx";
import { SourceCodeView } from "@/components/SourceCodeView.jsx";
import { EmptyState } from "@/components/EmptyState.jsx";
import { cn } from "@/lib/utils.js";

const VIEW_TITLES = {
  graph: "Control Flow",
  memory: "Memory",
  trace: "Trace",
  steps: "Steps",
};

export default function App() {
  const [traceData, setTraceData] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [pendingFileName, setPendingFileName] = useState(null);
  const [pendingFlags, setPendingFlags] = useState([]);
  const [pendingEntry, setPendingEntry] = useState("");
  const [pendingUnwind, setPendingUnwind] = useState(10);
  const [error, setError] = useState(null);
  const [errorReasons, setErrorReasons] = useState(null);
  const [errorMetrics, setErrorMetrics] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [view, setView] = useState("graph");
  const [checks, setChecks] = useState(DEFAULT_CHECKS);
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [source, setSource] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  const timer = useRef(null);

  const hasTrace = !!traceData;

  const toggleCheck = (key) => setChecks((c) => ({ ...c, [key]: !c[key] }));
  const triggeredFlag = useMemo(
    () =>
      hasTrace
        ? CHECK_FLAGS.find((f) => f.match(traceData.meta.property || ""))
            ?.key || null
        : null,
    [hasTrace, traceData?.meta.property]
  );

  const STEPS = traceData?.steps ?? [];
  const cur = STEPS[Math.min(step, STEPS.length - 1)];
  const isFail = cur?.kind === "failure";
  const atEnd = STEPS.length === 0 || step >= STEPS.length - 1;

  const liveVars = useMemo(
    () => (hasTrace ? variablesAt(traceData.variables, cur?.idx ?? 0) : []),
    [hasTrace, traceData?.variables, cur?.idx]
  );

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setStep((s) => s + 1), speed);
    return () => clearTimeout(timer.current);
  }, [playing, step, speed, atEnd]);

  const next = () =>
    setStep((s) => Math.min(s + 1, Math.max(0, STEPS.length - 1)));
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const reset = () => {
    setPlaying(false);
    setStep(0);
  };

  const analyze = useCallback(
    async (file, opts = {}) => {
      if (!file) return;
      setError(null);
      setErrorReasons(null);
      setErrorMetrics(null);
      setAnalyzing(true);
      setPendingFileName(file.name);
      setPendingFlags(opts.flags ?? []);
      setPendingEntry(opts.entry ?? "");
      setPendingUnwind(opts.unwind ?? 10);
      try {
        const result = await analyzeSource(file, opts);
        const parsed = parseCbmcTrace(result.trace);
        setTraceData(parsed);
        setFileName(result.sourceName ?? file.name);
        setSource({
          name: result.sourceName ?? file.name,
          text: result.sourceText ?? "",
        });
        setStep(0);
        setPlaying(false);

        const saved = saveHistoryItem({
          fileName: result.sourceName ?? file.name,
          sourceText: result.sourceText ?? "",
          trace: result.trace,
          meta: parsed.meta,
          flagsUsed: result.flagsUsed ?? opts.flags ?? [],
          entry: result.entry ?? opts.entry ?? null,
          unwind: result.unwind ?? opts.unwind ?? null,
          exitCode: result.exitCode,
        });
        setHistory(loadHistory());
        setActiveHistoryId(saved.id);
      } catch (err) {
        setError(err.message);
        setErrorReasons(err.reasons ?? null);
        setErrorMetrics(err.metrics ?? null);
      } finally {
        setAnalyzing(false);
      }
    },
    []
  );

  const loadFromHistory = useCallback((item) => {
    try {
      const parsed = parseCbmcTrace(item.trace);
      setTraceData(parsed);
      setFileName(item.fileName);
      setSource({ name: item.fileName, text: item.sourceText ?? "" });
      setStep(0);
      setPlaying(false);
      setError(null);
      setActiveHistoryId(item.id);
      setPendingFileName(item.fileName);
      setPendingFlags(item.flagsUsed ?? []);
      setPendingEntry(item.entry ?? "");
      setPendingUnwind(item.unwind ?? 10);
    } catch (err) {
      setError(`failed to load history item: ${err.message}`);
    }
  }, []);

  const removeHistory = useCallback(
    (id) => {
      const next = removeHistoryItem(id);
      setHistory(next);
      if (activeHistoryId === id) setActiveHistoryId(null);
    },
    [activeHistoryId]
  );

  const clearAllHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    setActiveHistoryId(null);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (/\.(c|cpp|cc|cxx|h|hpp|i)$/i.test(file.name)) {
      analyze(file, {
        flags: pendingFlags,
        entry: pendingEntry,
        unwind: pendingUnwind,
      });
    } else {
      setError(`Unsupported file: ${file.name}. Drop a C/C++ source file.`);
    }
  };
  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const clearTrace = () => {
    setTraceData(null);
    setFileName(null);
    setSource(null);
    setStep(0);
    setPlaying(false);
    setError(null);
    setActiveHistoryId(null);
  };

  const traceSource = hasTrace
    ? { uploaded: true, label: `${fileName} · CBMC analysis` }
    : null;

  return (
    <div
      className="relative min-h-screen bg-background text-foreground"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        meta={traceData?.meta}
        history={history}
        activeHistoryId={activeHistoryId}
        onSelectHistory={loadFromHistory}
        onRemoveHistory={removeHistory}
        onClearHistory={clearAllHistory}
      />

      <div
        className="transition-[margin] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: collapsed ? 64 : 240 }}
      >
        <TopBar
          fileName={fileName}
          uploaded={hasTrace}
          isFail={isFail}
          onUpload={(file) =>
            analyze(file, {
              flags: pendingFlags,
              entry: pendingEntry,
              unwind: pendingUnwind,
            })
          }
          onPickSample={(file, opts) => analyze(file, opts)}
          onReset={clearTrace}
          onOpenSource={() => setSheetOpen(true)}
          pageTitle={hasTrace ? (VIEW_TITLES[view] ?? "CBMC Viz") : "CBMC Viz"}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          showSourceButton={hasTrace}
          showResetButton={hasTrace}
        />

        <main className="px-8 pb-10 pt-20 max-w-[1400px] mx-auto">
          {!hasTrace ? (
            <EmptyState
              onAnalyze={analyze}
              loading={analyzing}
              error={error}
              errorReasons={errorReasons}
              errorMetrics={errorMetrics}
              onClearError={() => {
                setError(null);
                setErrorReasons(null);
                setErrorMetrics(null);
              }}
              fileName={pendingFileName}
            />
          ) : (
            <>
              <TraceHeader
                meta={traceData.meta}
                isFail={isFail}
                error={error}
                onClearError={() => setError(null)}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-6">
                <div className="space-y-4 min-w-0">
                  <ChecksBar
                    checks={checks}
                    onToggle={toggleCheck}
                    triggeredFlag={triggeredFlag}
                    isFail={isFail}
                  />

                  <TraceControls
                    step={step}
                    total={STEPS.length}
                    playing={playing}
                    speed={speed}
                    isFail={isFail}
                    onPrev={prev}
                    onNext={next}
                    onPlayToggle={() => setPlaying((p) => !p)}
                    onReset={reset}
                    onSpeedChange={setSpeed}
                  />

                  <CanvasCard
                    view={view}
                    onChangeView={setView}
                    parsed={traceData}
                    cur={cur}
                    isFail={isFail}
                    steps={STEPS}
                    currentIdx={cur?.idx ?? 0}
                    onSelectStep={setStep}
                    source={source}
                    onSourceLoad={(file) => {
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        setSource({
                          name: file.name,
                          text: String(ev.target.result ?? ""),
                        });
                      reader.readAsText(file);
                    }}
                    meta={traceData.meta}
                    onOpenSource={() => setSheetOpen(true)}
                  />
                </div>

                <aside className="divide-y divide-border/40 [&>section]:py-5 [&>section:first-child]:pt-0 [&>section:last-child]:pb-0">
                  <StatePanel vars={liveVars} isFail={isFail} />
                  <NarrationPanel note={cur?.note} isFail={isFail} />
                  <ActiveStepPanel
                    step={cur}
                    total={STEPS.length}
                    isFail={isFail}
                  />
                  <TraceInfoPanel
                    meta={traceData.meta}
                    stepCount={STEPS.length}
                    varCount={traceData.variables.length}
                    source={traceSource}
                  />
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {hasTrace && (
        <SourceSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          meta={traceData.meta}
          currentStep={cur}
          steps={STEPS}
          source={source}
          onSourceLoad={(file) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
              setSource({
                name: file.name,
                text: String(ev.target.result ?? ""),
              });
            reader.readAsText(file);
          }}
          onSourceClear={() => setSource(null)}
        />
      )}

      {dragOver && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm border-2 border-dashed border-amber flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl font-semibold text-amber">Drop file</div>
            <div className="text-xs text-muted-foreground mt-3">
              C / C++ source file
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TraceHeader({ meta, isFail, error, onClearError }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-6 pb-5 border-b border-border/50">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            CBMC · trace visualizer
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border",
            isFail
              ? "bg-[var(--trace-fail)] text-background border-transparent"
              : "border-amber/60 text-amber"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isFail ? "bg-background" : "bg-amber"
            )}
          />
          {isFail ? "Failure" : "Tracing"}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--trace-fail)]/40 bg-[var(--trace-fail-soft)] px-4 py-2.5 text-xs text-[var(--trace-fail)] flex items-center justify-between">
          <span className="font-mono">{error}</span>
          <button
            onClick={onClearError}
            className="text-[var(--trace-fail)]/80 hover:text-[var(--trace-fail)]"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function CanvasCard({
  view,
  onChangeView,
  parsed,
  cur,
  isFail,
  steps,
  currentIdx,
  onSelectStep,
  source,
  onSourceLoad,
  meta,
  onOpenSource,
}) {
  const stepLocLabel = cur
    ? `${cur.loc.function || "·"}:${cur.loc.line || "?"}`
    : "—";
  const isFlat = view === "steps" || view === "trace";
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center px-3 pt-3 gap-1 border-b border-border/40">
        <CanvasTab active={view === "graph"} onClick={() => onChangeView("graph")}>
          Graph
        </CanvasTab>
        <CanvasTab active={view === "memory"} onClick={() => onChangeView("memory")}>
          Memory
        </CanvasTab>
        <CanvasTab active={view === "trace"} onClick={() => onChangeView("trace")}>
          Trace
        </CanvasTab>
        <CanvasTab active={view === "steps"} onClick={() => onChangeView("steps")}>
          Steps
        </CanvasTab>
        <div className="flex-1" />
        <button
          onClick={onOpenSource}
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent/40 mb-1"
        >
          @ {stepLocLabel}
        </button>
      </div>
      <div className={isFlat ? "" : "p-4"}>
        {view === "graph" && (
          <CFGCanvas
            parsed={parsed}
            currentStep={cur}
            isFail={isFail}
            onNodeClick={onOpenSource}
          />
        )}
        {view === "memory" && (
          <MemoryCanvas parsed={parsed} currentStep={cur} isFail={isFail} />
        )}
        {view === "trace" && (
          <SourceCodeView
            source={source}
            activeLine={cur?.loc?.line}
            steps={steps}
            meta={meta}
            onUploadSource={onSourceLoad}
            className="max-h-[70vh]"
          />
        )}
        {view === "steps" && (
          <StepsList steps={steps} currentIdx={currentIdx} onSelect={onSelectStep} />
        )}
      </div>
    </div>
  );
}

function CanvasTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 px-3 -mb-px text-xs font-medium border-b-2 transition-colors",
        active
          ? "border-amber text-amber"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
