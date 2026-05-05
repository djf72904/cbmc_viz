import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileCode2,
  Loader2,
  Settings2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
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
        <div className="h-14 w-14 rounded-2xl bg-amber/15 text-amber flex items-center justify-center mb-5">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Running CBMC</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md font-mono">
          {fileName ?? "source.c"}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-4 max-w-md">
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
      <div className="h-14 w-14 rounded-2xl bg-amber/15 text-amber flex items-center justify-center mb-5">
        <FileCode2 className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Upload a C source file</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
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
        <Button onClick={() => inputRef.current?.click()} disabled={!health?.cbmcAvailable}>
          <Upload className="h-4 w-4 mr-2" />
          Upload .c file
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowOptions((s) => !s)}
        >
          <Settings2 className="h-4 w-4 mr-2" />
          {showOptions ? "Hide options" : "Options"}
        </Button>
        {pendingFile && (
          <Button variant="ghost" onClick={handleRerun}>
            Re-run
          </Button>
        )}
      </div>

      {showOptions && (
        <div className="mt-5 w-full max-w-xl rounded-2xl border border-border/50 bg-card p-5 text-left space-y-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              CBMC checks
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
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    flags[f.key]
                      ? "border-amber/40 bg-amber/10 text-amber"
                      : "border-border/50 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-xs font-semibold text-muted-foreground">
                Entry function
              </span>
              <input
                type="text"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="main"
                className="mt-1 w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-xs">
              <span className="text-xs font-semibold text-muted-foreground">
                Unwind bound
              </span>
              <input
                type="number"
                min="1"
                value={unwind}
                onChange={(e) => setUnwind(Number(e.target.value) || 1)}
                className="mt-1 w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground/60 mt-6">
        or drag &amp; drop a .c file anywhere
      </p>

      {limits && (
        <div className="mt-6 max-w-xl w-full">
          <button
            onClick={() => setShowLimits((s) => !s)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            {showLimits ? "Hide complexity limits" : "What's supported?"}
          </button>
          {showLimits && <LimitsCard limits={limits} />}
        </div>
      )}

      {health && !health.cbmcAvailable && (
        <div className="mt-6 max-w-md w-full rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-xs text-amber flex items-start gap-2 text-left">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">CBMC not available on the backend</div>
            <div className="text-amber/80 mt-1">
              {health.error ?? "Run `brew install cbmc` (or set CBMC_BIN) and restart the server."}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 max-w-xl w-full rounded-xl border border-[var(--trace-fail)]/40 bg-[var(--trace-fail-soft)] px-4 py-3 text-xs text-[var(--trace-fail)] text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{error}</div>
              {errorReasons && errorReasons.length > 0 && (
                <ul className="mt-2 space-y-1 list-disc list-inside text-[var(--trace-fail)]/85">
                  {errorReasons.map((r, i) => (
                    <li key={i} className="break-words">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {errorMetrics && (
                <div className="mt-2 font-mono text-[var(--trace-fail)]/70">
                  {errorMetrics.lines} lines · {errorMetrics.nonBlankLines} non-blank · {errorMetrics.functions} fn · depth {errorMetrics.braceDepth} · {errorMetrics.bytes}B
                </div>
              )}
            </div>
            <button
              onClick={onClearError}
              className="shrink-0 text-[var(--trace-fail)]/80 hover:text-[var(--trace-fail)]"
            >
              dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LimitsCard({ limits }) {
  const L = limits.limits;
  return (
    <div className="mt-3 rounded-xl border border-border/50 bg-card p-4 text-left text-xs space-y-3">
      <div>
        <div className="font-semibold text-foreground mb-1.5">Size limits</div>
        <ul className="text-muted-foreground space-y-0.5">
          <li>≤ {L.maxLines} total lines ({L.maxNonBlankLines} non-blank)</li>
          <li>≤ {L.maxBytes.toLocaleString()} bytes</li>
          <li>≤ {L.maxFunctions} functions, ≤ {L.maxBraceDepth} levels of nesting</li>
          <li>≤ {L.maxLineLength} chars per line</li>
        </ul>
      </div>
      <div>
        <div className="font-semibold text-foreground mb-1.5">Allowed includes</div>
        <div className="flex flex-wrap gap-1">
          {limits.allowedIncludes.map((h) => (
            <code
              key={h}
              className="font-mono text-xs px-1.5 py-0.5 rounded bg-accent/40 text-foreground/80"
            >
              &lt;{h}&gt;
            </code>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-foreground mb-1.5">Not supported</div>
        <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
          {limits.blockedFeatures.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="font-semibold text-foreground mb-1.5">Supported CBMC flags</div>
        <div className="flex flex-wrap gap-1">
          {limits.supportedFlags.map((f) => (
            <code
              key={f}
              className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber/10 text-amber"
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
    <div className="text-xs text-muted-foreground italic">
      {message ?? "—"}
    </div>
  );
}
