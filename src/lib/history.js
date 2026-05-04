const KEY = "cbmc-viz:history:v1";
const MAX_ITEMS = 25;
const MAX_BYTES = 4 * 1024 * 1024; // ~4MB cap on stored payload

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function approxBytes(s) {
  return typeof s === "string" ? s.length : 0;
}

export function loadHistory() {
  return safeRead();
}

export function saveHistoryItem({
  fileName,
  sourceText,
  trace,
  meta,
  flagsUsed,
  entry,
  unwind,
  exitCode,
}) {
  const items = safeRead();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceStr = JSON.stringify(trace);
  const item = {
    id,
    createdAt: Date.now(),
    fileName: fileName ?? "source.c",
    sourceText: sourceText ?? "",
    trace,
    meta: {
      fnName: meta?.fnName ?? "?",
      file: meta?.file ?? null,
      line: meta?.line ?? null,
      property: meta?.property ?? null,
      status: meta?.status ?? null,
    },
    flagsUsed: flagsUsed ?? [],
    entry: entry ?? null,
    unwind: unwind ?? null,
    exitCode: exitCode ?? null,
    sizeHint: approxBytes(traceStr) + approxBytes(sourceText ?? ""),
  };

  let next = [item, ...items.filter((x) => x.id !== id)];
  if (next.length > MAX_ITEMS) next = next.slice(0, MAX_ITEMS);

  // Evict oldest until under the byte cap
  let total = next.reduce((acc, x) => acc + (x.sizeHint ?? 0), 0);
  while (total > MAX_BYTES && next.length > 1) {
    const dropped = next.pop();
    total -= dropped.sizeHint ?? 0;
  }

  if (!safeWrite(next)) {
    // Quota exceeded: keep just the new item.
    safeWrite([item]);
  }
  return item;
}

export function removeHistoryItem(id) {
  const items = safeRead().filter((x) => x.id !== id);
  safeWrite(items);
  return items;
}

export function clearHistory() {
  safeWrite([]);
}

export function getHistoryItem(id) {
  return safeRead().find((x) => x.id === id) ?? null;
}
