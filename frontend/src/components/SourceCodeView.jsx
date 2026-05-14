import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileCode2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button.jsx";
import { tokenizeSource } from "@/lib/highlight.js";
import { cn } from "@/lib/utils.js";

export function SourceCodeView({
  source,
  activeLine,
  steps,
  meta,
  onUploadSource,
  className,
  emptyClassName,
  failureLine,
}) {
  const plainLines = useMemo(() => {
    if (!source?.text) return null;
    return source.text.split(/\r?\n/);
  }, [source?.text]);

  const [tokens, setTokens] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!source?.text) {
      setTokens(null);
      return;
    }
    tokenizeSource(source.text, source.name)
      .then((t) => {
        if (!cancelled) setTokens(t);
      })
      .catch(() => {
        if (!cancelled) setTokens(null);
      });
    return () => {
      cancelled = true;
    };
  }, [source?.text, source?.name]);

  const linesTouched = useMemo(() => {
    if (!steps) return new Set();
    const s = new Set();
    for (const step of steps) {
      if (step.loc?.line) s.add(Number(step.loc.line));
    }
    return s;
  }, [steps]);

  const activeRef = useRef(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine, source?.name]);

  if (!plainLines) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center px-8 py-12 text-center gap-3 bg-card",
          emptyClassName
        )}
      >
        <div className="h-12 w-12 rounded-full border border-rule bg-paper flex items-center justify-center">
          <FileCode2 className="h-5 w-5 text-ink-muted" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-ink">No source loaded</p>
          <p className="text-[12px] text-ink-muted mt-1 max-w-sm leading-relaxed">
            Upload the C/C++ file
            {meta?.file ? ` (${meta.file})` : ""} to view it inline with the
            current trace line highlighted.
          </p>
        </div>
        {onUploadSource && (
          <label
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "cursor-pointer mt-2"
            )}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload source file
            <input
              type="file"
              accept=".c,.cpp,.cc,.cxx,.h,.hpp,.txt,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadSource(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    );
  }

  const lines = tokens ?? plainLines.map((line) => [{ text: line, color: null }]);
  const activeNum = activeLine == null ? null : Number(activeLine);
  const failureNum = failureLine == null ? null : Number(failureLine);

  return (
    <div className={cn("overflow-auto bg-card", className)}>
      <pre className="font-mono text-[12.5px] leading-relaxed py-2">
        {lines.map((line, i) => {
          const lineNo = i + 1;
          const isActive = lineNo === activeNum;
          const isFailure = failureNum != null && lineNo === failureNum;
          const isTouched = linesTouched.has(lineNo);
          const tokensForLine = Array.isArray(line)
            ? line
            : [{ text: line, color: null }];
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={cn(
                "grid grid-cols-[3.5rem_1fr] items-baseline border-l-2 transition-colors",
                isFailure
                  ? "bg-[var(--state-failed)]/10 border-[var(--state-failed)]"
                  : isActive
                    ? "bg-brand/[0.08] border-brand"
                    : isTouched
                      ? "bg-brand/[0.04] border-brand/20"
                      : "border-transparent"
              )}
            >
              <span
                className={cn(
                  "text-right pr-3 select-none tabular-nums",
                  isFailure
                    ? "text-[var(--state-failed)] font-semibold"
                    : isActive
                      ? "text-brand font-semibold"
                      : isTouched
                        ? "text-brand/60"
                        : "text-ink-muted/40"
                )}
              >
                {lineNo}
              </span>
              <span className="whitespace-pre pr-4 text-ink">
                {tokensForLine.length === 0 ? (
                  <span> </span>
                ) : (
                  tokensForLine.map((tok, j) => (
                    <span
                      key={j}
                      style={tok.color ? { color: tok.color } : undefined}
                    >
                      {tok.text || ""}
                    </span>
                  ))
                )}
              </span>
            </div>
          );
        })}
        <div className="h-32" />
      </pre>
    </div>
  );
}
