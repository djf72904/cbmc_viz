/* Generic CBMC --json-ui --trace parser. Makes no assumptions about the
   program's shape (no required loop, no required accumulator, no required
   array). Produces a normalized, JSON-driven model that the views render. */

const INTERNAL_LHS_RE =
  /^(__CPROVER_|goto_symex\$\$|return_value___VERIFIER_|malloc::|malloc_size$|record_malloc$|record_may_leak$|should_malloc_fail$|dynamic_object\d*$|tmp_if_expr\$?\d*)/;

function readValue(v) {
  if (v == null || typeof v !== "object") return { kind: "unknown", text: String(v) };

  if (Array.isArray(v.elements)) {
    const elements = v.elements.map((e) => ({
      index: e.index,
      value: readValue(e.value),
    }));
    return { kind: "array", size: elements.length, elements, label: v.name || "array" };
  }

  if (v.members && Array.isArray(v.members)) {
    return {
      kind: "struct",
      name: v.name || "struct",
      members: v.members.map((m) => ({ name: m.name, value: readValue(m.value) })),
    };
  }

  if (v.name === "pointer") {
    return { kind: "pointer", text: String(v.data ?? "?"), type: v.type || null };
  }

  if (v.name === "boolean") {
    return { kind: "scalar", text: v.data ? "true" : "false", number: v.data ? 1 : 0, type: "boolean" };
  }

  if (v.data !== undefined) {
    const cleaned = typeof v.data === "string" ? v.data.replace(/[uUlL]+$/, "") : v.data;
    const n = Number(cleaned);
    return {
      kind: "scalar",
      text: String(v.data),
      number: Number.isFinite(n) ? n : null,
      type: v.type || v.name || null,
    };
  }

  return { kind: "unknown", text: JSON.stringify(v).slice(0, 80) };
}

export function fmtValue(v) {
  if (!v) return "?";
  if (v.kind === "array") {
    const inner = v.elements.map((e) => fmtValue(e.value)).join(", ");
    return `[${inner}]`;
  }
  if (v.kind === "struct") {
    return `{${v.members.map((m) => `${m.name}: ${fmtValue(m.value)}`).join(", ")}}`;
  }
  if (v.kind === "pointer") return v.text;
  if (v.kind === "scalar") return v.text;
  return v.text || "?";
}

export function parseCbmcTrace(json) {
  if (!Array.isArray(json)) throw new Error("Expected JSON array at root.");
  const resultBlock = json.find((x) => x && x.result);
  if (!resultBlock) {
    const cbmcError = json.find(
      (x) => x && x.messageType === "ERROR" && x.messageText
    );
    if (cbmcError) throw new Error(`CBMC: ${cbmcError.messageText}`);
    throw new Error("No 'result' block in this trace.");
  }
  const result = (resultBlock.result || []).find((r) => r.trace) || resultBlock.result[0];
  if (!result || !Array.isArray(result.trace)) throw new Error("Result has no embedded 'trace'.");

  const meta = {
    property:    result.property                 || "?",
    description: result.description              || "",
    status:      result.status                   || "UNKNOWN",
    fnName:      result.sourceLocation?.function || "?",
    file:        result.sourceLocation?.file     || "?",
    line:        result.sourceLocation?.line     || "?",
    workdir:     result.sourceLocation?.workingDirectory || null,
    rawSteps:    result.trace.length,
  };

  const steps = [];
  const varHistory = new Map();   // name -> [{stepIdx, value}]
  const arrayCellWrites = new Map(); // arrayName -> Map(idx -> [{stepIdx, value}])
  const functionEvents = [];      // {kind:'call'|'return', name, stepIdx}
  const heapEvents = [];          // {kind, name, stepIdx, value}
  let failure = null;

  const recordVar = (name, value, stepIdx) => {
    if (!varHistory.has(name)) varHistory.set(name, []);
    varHistory.get(name).push({ stepIdx, value });
  };

  const recordArrayCell = (arrayName, idx, value, stepIdx) => {
    if (!arrayCellWrites.has(arrayName)) arrayCellWrites.set(arrayName, new Map());
    const cells = arrayCellWrites.get(arrayName);
    if (!cells.has(idx)) cells.set(idx, []);
    cells.get(idx).push({ stepIdx, value });
  };

  for (let i = 0; i < result.trace.length; i++) {
    const s = result.trace[i];
    const loc = s.sourceLocation || {};
    const stepIdx = steps.length;
    const baseLoc = { file: loc.file || null, function: loc.function || null, line: loc.line || null };

    const push = (extra) =>
      steps.push({
        idx: stepIdx,
        kind: s.stepType,
        loc: baseLoc,
        hidden: !!s.hidden,
        rawIdx: i,
        ...extra,
      });

    switch (s.stepType) {
      case "function-call": {
        if (s.hidden) continue;
        const name = s.function?.displayName || s.function?.identifier || "?";
        functionEvents.push({ kind: "call", name, stepIdx });
        push({ functionName: name, note: `→ ${name}() called` });
        break;
      }
      case "function-return": {
        if (s.hidden) continue;
        const name = s.function?.displayName || s.function?.identifier || "?";
        functionEvents.push({ kind: "return", name, stepIdx });
        push({ functionName: name, note: `← ${name}() returns` });
        break;
      }
      case "assignment": {
        if (s.hidden) continue;
        const lhs = String(s.lhs || "");
        if (INTERNAL_LHS_RE.test(lhs)) continue;
        const value = readValue(s.value);

        // arr[N] subscripted assignment → record on the array variable
        const m = lhs.match(/^([A-Za-z_][\w]*)\[(\d+)[lLuU]*\]$/);
        if (m) {
          const arrName = m[1];
          const idx = parseInt(m[2], 10);
          recordArrayCell(arrName, idx, value, stepIdx);
          push({ lhs, value, arrayName: arrName, arrayIndex: idx, note: `${lhs} = ${fmtValue(value)}` });
          break;
        }

        recordVar(lhs, value, stepIdx);

        if (value.kind === "pointer" && /malloc/i.test(lhs)) {
          heapEvents.push({ kind: "alloc-result", name: lhs, stepIdx, value });
        }

        push({ lhs, value, note: `${lhs} = ${fmtValue(value)}` });
        break;
      }
      case "loop-head": {
        push({ note: `loop head @ ${baseLoc.function || "?"}:${baseLoc.line || "?"}` });
        break;
      }
      case "failure": {
        const reason = s.reason || meta.description || "property violated";
        const fstep = { reason, note: `↯ ${reason}` };
        push(fstep);
        failure = steps[steps.length - 1];
        break;
      }
      case "location-only":
      case "location": {
        if (s.hidden) continue;
        push({ note: `at ${baseLoc.function || "?"}:${baseLoc.line || "?"}` });
        break;
      }
      default:
        continue;
    }
  }

  if (steps.length === 0) throw new Error("No usable (non-internal) steps in trace.");

  // Build variable summary list. Variables that look like arrays are merged
  // with their cell-write history, so we can scrub time on them.
  const seenNames = new Set();
  const variables = [];
  for (const [name, history] of varHistory.entries()) {
    seenNames.add(name);
    const last = history[history.length - 1].value;
    if (last?.kind === "array") {
      const cells = (arrayCellWrites.get(name) ? arrayCellWrites.get(name) : new Map());
      // also fold in initial array literal as cell writes
      last.elements.forEach((e, i) => {
        if (!cells.has(i)) cells.set(i, []);
        cells.get(i).unshift({ stepIdx: history[history.length - 1].stepIdx, value: e.value });
      });
      variables.push({
        name,
        kind: "array",
        size: last.size,
        cells, // Map(idx -> [{stepIdx, value}])
        history,
      });
    } else if (last?.kind === "pointer") {
      variables.push({ name, kind: "pointer", history });
    } else {
      variables.push({ name, kind: "scalar", history });
    }
  }
  // arrays only ever written via arr[i] (no whole-array assignment captured)
  for (const [name, cells] of arrayCellWrites.entries()) {
    if (seenNames.has(name)) continue;
    const size = Math.max(0, ...Array.from(cells.keys())) + 1;
    variables.push({ name, kind: "array", size, cells, history: [] });
  }

  return { meta, steps, variables, functionEvents, heapEvents, failure };
}

/* Compute the current state of every variable as of a given step idx. */
export function variablesAt(variables, stepIdx) {
  return variables.map((v) => {
    if (v.kind === "array") {
      const cellsNow = new Array(v.size).fill(null);
      let lastWriteStep = -1;
      let lastWriteIdx = -1;
      v.cells.forEach((writes, cellIdx) => {
        let cur = null;
        for (const w of writes) {
          if (w.stepIdx <= stepIdx) {
            cur = w.value;
            if (w.stepIdx > lastWriteStep) {
              lastWriteStep = w.stepIdx;
              lastWriteIdx = cellIdx;
            }
          } else break;
        }
        cellsNow[cellIdx] = cur;
      });
      return { ...v, cellsNow, lastWriteIdx, lastWriteStep };
    }
    let current = null;
    let stepOfCurrent = -1;
    for (const h of v.history) {
      if (h.stepIdx <= stepIdx) { current = h.value; stepOfCurrent = h.stepIdx; }
      else break;
    }
    return { ...v, current, stepOfCurrent };
  });
}

