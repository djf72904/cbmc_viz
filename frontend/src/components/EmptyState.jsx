import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Loader2,
  Settings2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet.jsx";
import { CHECK_FLAGS } from "@/theme.js";
import { getHealth, getLimits } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";

export function EmptyState({
  onAnalyze,
  loading,
  error,
  errorReasons,
  errorMetrics,
  onClearError,
  fileName,
}) {
  const inputRef = useRef(null);
  const [showOptions, setShowOptions] = useState(false);
  const [flags, setFlags] = useState(() =>
    Object.fromEntries(CHECK_FLAGS.map((f) => [f.key, true]))
  );
  const [entry, setEntry] = useState("");
  const [unwind, setUnwind] = useState(10);
  const [pendingFile, setPendingFile] = useState(null);
  const [health, setHealth] = useState(null);
  const [limits, setLimits] = useState(null);
  const [showLimits, setShowLimits] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth);
    getLimits().then(setLimits);
  }, []);

  const enabledFlags = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => CHECK_FLAGS.find((f) => f.key === k)?.cbmc)
    .filter(Boolean);

  const selectedCount = Object.values(flags).filter(Boolean).length;

  const handleFile = (file) => {
    if (!file) return;
    setPendingFile(file);
    onAnalyze(file, { flags: enabledFlags, entry, unwind });
  };

  const handleRerun = () => {
    if (pendingFile) {
      onAnalyze(pendingFile, { flags: enabledFlags, entry, unwind });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="h-12 w-12 rounded-full border border-brand/30 bg-brand/10 text-brand flex items-center justify-center mb-5">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <h2 className="text-xl font-medium tracking-[-0.01em] text-ink">
          Running CBMC
        </h2>
        <p className="text-[13px] text-ink-muted mt-2 max-w-md font-mono">
          {fileName ?? "source.c"}
        </p>
        <p className="text-[12px] text-ink-muted/80 mt-4 max-w-md">
          The backend is verifying with{" "}
          <span className="font-mono">{enabledFlags.join(" ") || "--bounds-check"}</span>
          {entry && (
            <>
              {" "}· entry <span className="font-mono">{entry}()</span>
            </>
          )}
          {" "}· unwind {unwind}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <h2 className="text-xl font-medium tracking-[-0.01em] text-ink">
        Upload a C source file
      </h2>
      <p className="text-[13px] text-ink-muted mt-2 max-w-md leading-relaxed">
        We&apos;ll run CBMC against it on the backend and stream back the trace
        for visualization.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".c,.cpp,.cc,.cxx,.h,.hpp,.i"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-2 mt-6">
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={!health?.ok || !health?.cbmcAvailable}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload .c file
        </Button>
        <Button variant="outline" onClick={() => setShowOptions(true)}>
          <Settings2 className="h-4 w-4 mr-2" />
          Options
          {selectedCount < CHECK_FLAGS.length && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-brand/15 text-brand text-[10.5px] font-semibold px-1.5">
              {selectedCount}
            </span>
          )}
        </Button>
        {pendingFile && (
          <Button variant="outline" onClick={handleRerun}>
            Re-run
          </Button>
        )}
      </div>

      <OptionsSheet
        open={showOptions}
        onOpenChange={setShowOptions}
        flags={flags}
        setFlags={setFlags}
        entry={entry}
        setEntry={setEntry}
        unwind={unwind}
        setUnwind={setUnwind}
        onRerun={pendingFile ? handleRerun : null}
      />

      <p className="text-[12px] text-ink-muted/70 mt-6">
        or drag &amp; drop a .c file anywhere
      </p>

      {limits && (
        <div className="mt-6 max-w-xl w-full">
          <button
            onClick={() => setShowLimits((s) => !s)}
            className="text-[12px] text-ink-muted hover:text-ink inline-flex items-center gap-1.5 transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            {showLimits ? "Hide complexity limits" : "What's supported?"}
          </button>
          {showLimits && <LimitsCard limits={limits} />}
        </div>
      )}

      {health && !health.ok && (
        <div className="mt-6 max-w-md w-full rounded-xl border border-[var(--state-failed)]/30 bg-[var(--state-failed)]/10 px-4 py-3 text-[12px] text-[var(--state-failed)] flex items-start gap-2 text-left">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Backend is not running</div>
            <div className="text-[var(--state-failed)]/85 mt-1">
              Start the Spring Boot server (<code className="font-mono">cd backend && ./mvnw spring-boot:run</code>) and reload.
            </div>
          </div>
        </div>
      )}

      {health && health.ok && !health.cbmcAvailable && (
        <div className="mt-6 max-w-md w-full rounded-xl border border-[var(--state-flagged)]/30 bg-[var(--state-flagged)]/10 px-4 py-3 text-[12px] text-[var(--state-flagged)] flex items-start gap-2 text-left">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">CBMC not available on the backend</div>
            <div className="text-[var(--state-flagged)]/85 mt-1">
              {health.error ?? "Run `brew install cbmc` (or set CBMC_BIN) and restart the server."}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 max-w-xl w-full rounded-xl border border-[var(--state-failed)]/30 bg-[var(--state-failed)]/10 px-4 py-3 text-[12px] text-[var(--state-failed)] text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{error}</div>
              {errorReasons && errorReasons.length > 0 && (
                <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--state-failed)]/85">
                  {errorReasons.map((r, i) => (
                    <li key={i} className="break-words">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {errorMetrics && (
                <div className="mt-2 font-mono text-[var(--state-failed)]/70">
                  {errorMetrics.lines} lines · {errorMetrics.nonBlankLines} non-blank · {errorMetrics.functions} fn · depth {errorMetrics.braceDepth} · {errorMetrics.bytes}B
                </div>
              )}
            </div>
            <button
              onClick={onClearError}
              className="shrink-0 text-[var(--state-failed)]/80 hover:text-[var(--state-failed)]"
            >
              dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionsSheet({
  open,
  onOpenChange,
  flags,
  setFlags,
  entry,
  setEntry,
  unwind,
  setUnwind,
  onRerun,
}) {
  const allOn = Object.values(flags).every(Boolean);
  const toggleAll = () => {
    setFlags(
      Object.fromEntries(CHECK_FLAGS.map((f) => [f.key, !allOn]))
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Analysis options</SheetTitle>
          <SheetDescription>
            Configure which CBMC checks run, the entry function, and the loop
            unwind bound. Applies to the next analysis.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-5 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                CBMC checks
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11.5px] text-ink-muted hover:text-ink transition-colors"
              >
                {allOn ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHECK_FLAGS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setFlags((prev) => ({ ...prev, [f.key]: !prev[f.key] }))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                    flags[f.key]
                      ? "border-brand/30 bg-brand/10 text-brand"
                      : "border-rule text-ink-muted hover:bg-ink/[0.03] hover:text-ink"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <label className="block text-left">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Entry function
              </span>
              <input
                type="text"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="main"
                className="mt-1.5 w-full h-10 rounded-lg border border-rule bg-paper px-3 text-[13px] font-mono text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
              />
              <span className="block mt-1.5 text-[11px] text-ink-muted">
                Defaults to <code className="font-mono">main</code>.
              </span>
            </label>
            <label className="block text-left">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Unwind bound
              </span>
              <input
                type="number"
                min="1"
                value={unwind}
                onChange={(e) => setUnwind(Number(e.target.value) || 1)}
                className="mt-1.5 w-full h-10 rounded-lg border border-rule bg-paper px-3 text-[13px] font-mono text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
              />
              <span className="block mt-1.5 text-[11px] text-ink-muted">
                Max loop iterations CBMC explores.
              </span>
            </label>
          </section>
        </SheetBody>

        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          {onRerun && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onRerun();
              }}
            >
              Re-run with these options
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function LimitsCard({ limits }) {
  const L = limits.limits;
  return (
    <div className="mt-3 rounded-xl border border-rule bg-card p-4 text-left text-[12px] space-y-3">
      <div>
        <div className="font-semibold text-ink mb-1.5">Size limits</div>
        <ul className="text-ink-muted space-y-0.5">
          <li>≤ {L.maxLines} total lines ({L.maxNonBlankLines} non-blank)</li>
          <li>≤ {L.maxBytes.toLocaleString()} bytes</li>
          <li>≤ {L.maxFunctions} functions, ≤ {L.maxBraceDepth} levels of nesting</li>
          <li>≤ {L.maxLineLength} chars per line</li>
        </ul>
      </div>
      <div>
        <div className="font-semibold text-ink mb-1.5">Allowed includes</div>
        <div className="flex flex-wrap gap-1">
          {limits.allowedIncludes.map((h) => (
            <code
              key={h}
              className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-ink/[0.04] text-ink/80 border border-rule/60"
            >
              &lt;{h}&gt;
            </code>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-ink mb-1.5">Not supported</div>
        <ul className="text-ink-muted space-y-0.5 list-disc list-inside">
          {limits.blockedFeatures.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="font-semibold text-ink mb-1.5">Supported CBMC flags</div>
        <div className="flex flex-wrap gap-1">
          {limits.supportedFlags.map((f) => (
            <code
              key={f}
              className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/30"
            >
              {f}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PanelEmpty({ message }) {
  return (
    <div className="text-[12px] text-ink-muted italic">
      {message ?? "—"}
    </div>
  );
}
