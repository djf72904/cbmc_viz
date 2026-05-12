async function fileToBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

export async function analyzeSource(file, { flags = [], entry = "", unwind = 10 } = {}) {
  const payload = {
    source: await fileToBase64(file),
    sourceName: file.name,
    flags: flags.join(","),
    entry,
    unwind,
  };

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw Object.assign(new Error(`Server returned ${res.status} ${res.statusText}`), {
      status: res.status,
    });
  }
  if (!res.ok) {
    const detail = json?.detail ? `: ${json.detail}` : "";
    const hint = json?.hint ? ` (${json.hint})` : "";
    const err = new Error(
      `${json?.error ?? `HTTP ${res.status}`}${detail}${hint}`
    );
    err.status = res.status;
    err.reasons = json?.reasons ?? null;
    err.metrics = json?.metrics ?? null;
    err.limits = json?.limits ?? null;
    throw err;
  }
  return json;
}

export async function getLimits() {
  try {
    const res = await fetch("/api/limits");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function listSamples() {
  try {
    const res = await fetch("/api/samples");
    if (!res.ok) return [];
    const data = await res.json();
    return data.samples ?? [];
  } catch {
    return [];
  }
}

export async function fetchSample(name) {
  const res = await fetch(`/api/samples/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to fetch sample ${name}`);
  const text = await res.text();
  return new File([text], name, { type: "text/x-c" });
}

export async function getHealth() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false, error: "Backend unreachable" };
  }
}
