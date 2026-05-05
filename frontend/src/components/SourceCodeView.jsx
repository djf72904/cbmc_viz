import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileCode2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button.jsx";
import { tokenizeSource } from "@/lib/highlight.js";
import { cn } from "@/lib/utils.js";

/**
 * Renders the C/C++ source with shiki tokens. The line corresponding to the
 * current trace step is highlighted; all visited lines get a soft tint.
 */
export function SourceCodeView({
  source,
  activeLine,
  steps,
  meta,
  onUploadSource,
  className,
  emptyClassName,
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
          "flex flex-col items-center justify-center px-8 py-12 text-center gap-3",
          emptyClassName
        )}
      >
        <div className="h-12 w-12 rounded-2xl bg-accent/40 flex items-center justify-center">
          <FileCode2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No source loaded</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
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

  return (
    <div className={cn("overflow-auto bg-[#0d1117]", className)}>
      <pre className="font-mono text-xs leading-relaxed py-2">
        {lines.map((line, i) => {
          const lineNo = i + 1;
          const isActive = lineNo === activeNum;
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
                isActive
                  ? "bg-amber/20 border-amber"
                  : isTouched
                    ? "bg-amber/5 border-amber/30"
                    : "border-transparent"
              )}
            >
              <span
                className={cn(
                  "text-right pr-3 select-none tabular-nums",
                  isActive
                    ? "text-amber font-semibold"
                    : isTouched
                      ? "text-amber/60"
                      : "text-muted-foreground/40"
                )}
              >
                {lineNo}
              </span>
              <span className="whitespace-pre pr-4">
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
