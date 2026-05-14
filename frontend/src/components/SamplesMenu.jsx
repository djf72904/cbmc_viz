import { useEffect, useState } from "react";
import { BookOpen, Eye, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import {
  MultiPageSheet,
  useMultiPageSheet,
} from "@/components/ui/multi-page-sheet.jsx";
import { SourceCodeView } from "@/components/SourceCodeView.jsx";
import { listSamples, fetchSample } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";

export function SamplesMenu({ onPick }) {
  const sheet = useMultiPageSheet("list");
  const [samples, setSamples] = useState([]);
  const [selected, setSelected] = useState(null);
  const [source, setSource] = useState(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    listSamples().then(setSamples);
  }, []);

  const handleView = async (s) => {
    setSelected(s);
    setSource(null);
    sheet.goToPage("viewer");
    setLoadingSource(true);
    try {
      const file = await fetchSample(s.name);
      const text = await file.text();
      setSource({ name: s.name, text, file });
    } finally {
      setLoadingSource(false);
    }
  };

  const handleRun = async (s) => {
    setRunning(true);
    try {
      const file = source?.file ?? (await fetchSample(s.name));
      sheet.close();
      onPick?.(file, { flags: s.flags ?? [] });
    } finally {
      setRunning(false);
    }
  };

  const pages = [
    {
      id: "list",
      title: "Sample programs",
      description:
        samples.length === 0
          ? "Loading…"
          : `${samples.length} programs that demonstrate CBMC checks`,
      content: (
        <SamplesList samples={samples} onView={handleView} onRun={handleRun} />
      ),
      footer: (
        <Button variant="ghost" onClick={sheet.close}>
          Close
        </Button>
      ),
    },
    {
      id: "viewer",
      title: selected?.title ?? selected?.name ?? "Sample",
      description: selected?.description ?? selected?.name ?? "",
      showBackButton: true,
      headerRight: selected?.flags?.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-end">
          {selected.flags.map((f) => (
            <span
              key={f}
              className="font-mono text-[10.5px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/30"
            >
              {f}
            </span>
          ))}
        </div>
      ),
      content: (
        <SampleViewer source={source} loading={loadingSource} sample={selected} />
      ),
      footer: selected && (
        <Button
          onClick={() => handleRun(selected)}
          disabled={running || loadingSource}
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 mr-1.5" />
          )}
          Run analysis
        </Button>
      ),
    },
  ];

  return (
    <>
      <Button
        variant="outline"
        size="header"
        onClick={() => {
          sheet.reset("list");
          sheet.open();
        }}
        disabled={samples.length === 0}
      >
        <BookOpen className="h-4 w-4 -ml-0.5 mr-1.5 opacity-70" />
        Samples
      </Button>

      <MultiPageSheet
        open={sheet.isOpen}
        onOpenChange={sheet.setIsOpen}
        pages={pages}
        currentPageId={sheet.currentPageId}
        onPageChange={sheet.goToPage}
        className="sm:max-w-2xl"
      />
    </>
  );
}

function SamplesList({ samples, onView, onRun }) {
  if (samples.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-[13px] text-ink-muted">
        Loading samples…
      </div>
    );
  }
  return (
    <ul className="px-3 py-2">
      {samples.map((s) => (
        <li key={s.name}>
          <SampleRow sample={s} onView={onView} onRun={onRun} />
        </li>
      ))}
    </ul>
  );
}

function SampleRow({ sample, onView, onRun }) {
  return (
    <div className="group/row flex items-center gap-2 rounded-lg p-3 hover:bg-ink/[0.03] transition-colors">
      <button
        onClick={() => onRun(sample)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink truncate">
            {sample.title}
          </span>
          <span className="font-mono text-[11px] text-ink-muted shrink-0">
            {sample.name}
          </span>
        </div>
        {sample.description && (
          <p className="text-[12px] text-ink-muted mt-0.5 line-clamp-2">
            {sample.description}
          </p>
        )}
        {sample.flags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {sample.flags.map((f) => (
              <span
                key={f}
                className="font-mono text-[10.5px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/30"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onView(sample);
        }}
        className={cn(
          "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full border border-rule text-ink-muted",
          "hover:text-ink hover:bg-paper transition-colors",
          "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
        )}
        aria-label={`Preview ${sample.name}`}
        title="Preview source"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SampleViewer({ source, loading, sample }) {
  if (loading || !source) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center gap-3">
        <Loader2 className="h-5 w-5 text-ink-muted animate-spin" />
        <p className="text-[12.5px] text-ink-muted">Loading {sample?.name}…</p>
      </div>
    );
  }
  return (
    <SourceCodeView
      source={source}
      activeLine={null}
      steps={[]}
      meta={null}
      className="h-full"
    />
  );
}
