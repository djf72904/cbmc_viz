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
import { AppHeader } from "@/components/layout/AppHeader.jsx";
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

export default function App() {
  const [traceData, setTraceData] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [analysisInfo, setAnalysisInfo] = useState(null);
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
        setAnalysisInfo({
          flagsUsed: result.flagsUsed ?? [],
          entry: result.entry ?? null,
          unwind: result.unwind ?? null,
          exitCode: result.exitCode ?? null,
          stderr: result.stderr ?? null,
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
          stderr: result.stderr ?? null,
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
      setAnalysisInfo({
        flagsUsed: item.flagsUsed ?? [],
        entry: item.entry ?? null,
        unwind: item.unwind ?? null,
        exitCode: item.exitCode ?? null,
        stderr: item.stderr ?? null,
      });
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
    setAnalysisInfo(null);
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
      className="relative min-h-screen bg-paper text-ink"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <AppHeader
        fileName={fileName}
        hasTrace={hasTrace}
        view={view}
        onChangeView={setView}
        onUpload={(file) =>
          analyze(file, {
            flags: pendingFlags,
            entry: pendingEntry,
            unwind: pendingUnwind,
          })
        }
        onReset={clearTrace}
        onOpenSource={() => setSheetOpen(true)}
        history={history}
        activeHistoryId={activeHistoryId}
        onSelectHistory={loadFromHistory}
        onRemoveHistory={removeHistory}
        onClearHistory={clearAllHistory}
        onPickSample={(file, opts) => analyze(file, opts)}
      />

      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8">
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
            <TraceStatus
              meta={traceData.meta}
              fileName={fileName}
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

              <aside className="divide-y divide-rule [&>section]:py-5 [&>section:first-child]:pt-0 [&>section:last-child]:pb-0">
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
                  analysis={analysisInfo}
                />
              </aside>
            </div>
          </>
        )}
      </main>

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
        <div className="fixed inset-0 z-[100] bg-paper/95 backdrop-blur-sm border-2 border-dashed border-brand flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl font-semibold text-brand">Drop file</div>
            <div className="text-xs text-ink-muted mt-3">
              C / C++ source file
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TraceStatus({ meta, fileName, isFail, error, onClearError }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.08em] text-ink-muted">
              CBMC trace
            </div>
            <div className="mt-0.5 font-mono text-[13px] text-ink truncate">
              {meta?.fnName ? `${meta.fnName}()` : fileName}
              {meta?.file && meta?.line ? (
                <span className="text-ink-muted">
                  {" "}
                  · {meta.file}:{meta.line}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11.5px] font-medium border",
            isFail
              ? "bg-[var(--state-failed)]/10 text-[var(--state-failed)] border-[var(--state-failed)]/30"
              : "bg-brand/10 text-brand border-brand/30"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isFail ? "bg-[var(--state-failed)]" : "bg-brand"
            )}
          />
          {isFail ? "Failure" : "Tracing"}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--state-failed)]/40 bg-[var(--state-failed)]/10 px-4 py-2.5 text-xs text-[var(--state-failed)] flex items-center justify-between">
          <span className="font-mono">{error}</span>
          <button
            onClick={onClearError}
            className="text-[var(--state-failed)]/80 hover:text-[var(--state-failed)]"
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
  const isFlat = view === "steps" || view === "trace";
  const isCanvas = view === "graph" || view === "memory";
  return (
    <div
      className={cn(
        "overflow-hidden",
        isCanvas
          ? ""
          : "rounded-2xl border border-rule bg-paper"
      )}
    >
      <div className={isFlat ? "" : isCanvas ? "" : "p-4"}>
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
