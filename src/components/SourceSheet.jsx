import { useState } from "react";
import { Upload, FileX2, FileCode2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui/sheet.jsx";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
import { SourceCodeView } from "@/components/SourceCodeView.jsx";
import { cn } from "@/lib/utils.js";

/**
 * Sliding sheet that displays the source code with the current trace line
 * highlighted. The user can upload the corresponding C/C++ source file.
 */
export function SourceSheet({
  open,
  onOpenChange,
  meta,
  currentStep,
  steps,
  source,
  onSourceLoad,
  onSourceClear,
}) {
  const activeLine = currentStep?.loc?.line ?? meta?.line ?? null;
  const [tab, setTab] = useState("source");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        width="max-w-3xl"
        onClose={() => onOpenChange(false)}
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/15 text-amber">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {source?.name ?? meta?.file ?? "Source"}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs truncate">
                {meta?.fnName}() · line {activeLine ?? "?"}
              </SheetDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-3">
            <Tab active={tab === "source"} onClick={() => setTab("source")}>
              Source
            </Tab>
            <Tab active={tab === "step"} onClick={() => setTab("step")}>
              Step JSON
            </Tab>
            <Tab active={tab === "trace"} onClick={() => setTab("trace")}>
              Trace meta
            </Tab>
            <div className="flex-1" />
            {source && tab === "source" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSourceClear}
                className="text-muted-foreground hover:text-foreground"
              >
                <FileX2 className="h-3.5 w-3.5 mr-1.5" />
                Clear
              </Button>
            )}
            {tab === "source" && (
              <label
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "cursor-pointer"
                )}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {source ? "Replace" : "Upload source"}
                <input
                  type="file"
                  accept=".c,.cpp,.cc,.cxx,.h,.hpp,.txt,text/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSourceLoad(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </SheetHeader>

        <SheetBody className="p-0">
          {tab === "source" && (
            <SourceCodeView
              source={source}
              activeLine={activeLine}
              steps={steps}
              meta={meta}
              className="h-full"
              emptyClassName="h-full"
              onUploadSource={onSourceLoad}
            />
          )}
          {tab === "step" && <StepView step={currentStep} />}
          {tab === "trace" && <TraceView meta={meta} />}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function StepView({ step }) {
  if (!step) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No active step.
      </div>
    );
  }
  return (
    <div className="p-6 space-y-5">
      <KVTable
        rows={[
          ["index", String(step.idx)],
          ["raw idx", String(step.rawIdx)],
          ["kind", step.kind],
          ["function", step.loc?.function ?? "—"],
          ["line", step.loc?.line ?? "—"],
          ["lhs", step.lhs ?? "—"],
          ["rhs", step.rhs ?? "—"],
          ["array", step.arrayName ?? "—"],
          ["index", step.arrayIndex ?? "—"],
          ["note", step.note ?? "—"],
        ]}
      />
      <div>
        <div className="text-xs text-muted-foreground mb-2">
          Raw step
        </div>
        <pre className="font-mono text-xs overflow-x-auto text-foreground/85">
{JSON.stringify(step, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function TraceView({ meta }) {
  if (!meta) return null;
  return (
    <div className="p-6">
      <KVTable
        rows={[
          ["function", `${meta.fnName}()`],
          ["file", meta.file],
          ["line", meta.line],
          ["property", meta.property],
          ["status", meta.status],
          ["description", meta.description || "—"],
          ["workdir", meta.workdir || "—"],
          ["raw steps", String(meta.rawSteps ?? "—")],
        ]}
      />
    </div>
  );
}

function KVTable({ rows }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={k + i} className="border-b border-border/30 last:border-0">
            <td className="py-2 pr-4 text-muted-foreground font-medium text-xs w-32">
              {k}
            </td>
            <td className="py-2 font-mono text-foreground break-all">
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
