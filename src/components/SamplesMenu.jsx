import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { listSamples, fetchSample } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";

export function SamplesMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    listSamples().then(setSamples);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handlePick = async (s) => {
    setLoading(true);
    setOpen(false);
    try {
      const file = await fetchSample(s.name);
      onPick?.(file, { flags: s.flags ?? [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="header"
        onClick={() => setOpen((o) => !o)}
        disabled={loading || samples.length === 0}
      >
        <BookOpen className="h-4 w-4 -ml-0.5 mr-1.5 opacity-70" />
        Samples
        <ChevronDown
          className={cn(
            "h-3 w-3 ml-1 opacity-60 transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 rounded-xl border border-border/50 bg-popover shadow-xl z-50 animate-fade-in-fast overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
            <p className="text-sm font-medium">Sample programs</p>
            <span className="text-xs text-muted-foreground/70">
              {samples.length}
            </span>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {samples.map((s) => (
              <li key={s.name}>
                <button
                  onClick={() => handlePick(s)}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors border-b border-border/20 last:border-0 focus:outline-none focus:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium truncate">
                      {s.title}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground truncate shrink-0">
                      {s.name}
                    </span>
                  </div>
                  {s.description && (
                    <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                      {s.description}
                    </p>
                  )}
                  {s.flags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.flags.map((f) => (
                        <span
                          key={f}
                          className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber/10 text-amber"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
