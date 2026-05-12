import express from "express";
import cors from "cors";
import multer from "multer";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, "..", "samples");

// School-project complexity limits. Conservative on purpose; bump if needed.
const LIMITS = {
  maxBytes: 16 * 1024,      // 16 KB
  maxLines: 200,            // including blanks/comments
  maxNonBlankLines: 150,
  maxFunctions: 6,
  maxBraceDepth: 5,
  maxLineLength: 240,
};

const ALLOWED_INCLUDES = new Set([
  "stdlib.h",
  "stdio.h",
  "string.h",
  "limits.h",
  "assert.h",
  "stdint.h",
  "stdbool.h",
  "stddef.h",
  "stdarg.h",
  "math.h",
]);

const FEATURE_BLOCKLIST = [
  { re: /\bstruct\s+\w+\s*\{/, msg: "struct definitions are not supported" },
  { re: /\bunion\s+\w+\s*\{/, msg: "union definitions are not supported" },
  { re: /\benum\s+\w+\s*\{/, msg: "enum definitions are not supported" },
  { re: /\btypedef\b/, msg: "typedef is not supported" },
  { re: /\bgoto\b/, msg: "goto is not supported" },
  { re: /\bsetjmp\b|\blongjmp\b/, msg: "setjmp/longjmp are not supported" },
  { re: /\bswitch\s*\(/, msg: "switch statements are not supported (use if/else)" },
  { re: /\(\s*\*\s*\w+\s*\)\s*\(/, msg: "function pointers are not supported" },
  { re: /\bextern\b/, msg: "extern declarations are not supported" },
  { re: /\bstatic\b/, msg: "static storage duration is not supported" },
  { re: /\bvolatile\b/, msg: "volatile is not supported" },
  { re: /\b__asm__\b|\basm\b/, msg: "inline assembly is not supported" },
  { re: /\bvarargs\b|\.\.\./, msg: "variadic functions are not supported" },
];

// Strip block comments, line comments, and string/char literals before pattern
// matching so we don't trigger on commented-out or in-string occurrences.
function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function countFunctions(src) {
  // Heuristic: top-level identifier followed by parameter list and `{`.
  // Skips control keywords and common helpers.
  const skip = new Set([
    "if", "else", "for", "while", "do", "switch", "return", "sizeof", "typeof",
    "case", "default",
  ]);
  const re = /\b([A-Za-z_][\w]*)\s*\([^;{}]*\)\s*\{/g;
  let m;
  let n = 0;
  while ((m = re.exec(src)) !== null) {
    if (!skip.has(m[1])) n++;
  }
  return n;
}

function maxBraceDepth(src) {
  let depth = 0;
  let max = 0;
  for (const ch of src) {
    if (ch === "{") {
      depth++;
      if (depth > max) max = depth;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

function checkComplexity(rawSrc) {
  const errors = [];
  const warnings = [];
  const bytes = Buffer.byteLength(rawSrc, "utf8");
  if (bytes > LIMITS.maxBytes) {
    errors.push(`File is ${bytes} bytes; limit is ${LIMITS.maxBytes}.`);
  }

  const allLines = rawSrc.split(/\r?\n/);
  if (allLines.length > LIMITS.maxLines) {
    errors.push(
      `File has ${allLines.length} lines; limit is ${LIMITS.maxLines}.`
    );
  }
  const tooLong = allLines.findIndex((l) => l.length > LIMITS.maxLineLength);
  if (tooLong >= 0) {
    errors.push(
      `Line ${tooLong + 1} is ${allLines[tooLong].length} chars long (limit ${LIMITS.maxLineLength}).`
    );
  }

  const nonBlank = allLines.filter((l) => l.trim().length > 0).length;
  if (nonBlank > LIMITS.maxNonBlankLines) {
    errors.push(
      `File has ${nonBlank} non-blank lines; limit is ${LIMITS.maxNonBlankLines}.`
    );
  }

  // Includes: check against the allow-list.
  for (const m of rawSrc.matchAll(/^\s*#\s*include\s*<([^>]+)>/gm)) {
    if (!ALLOWED_INCLUDES.has(m[1].trim())) {
      errors.push(
        `#include <${m[1]}> is not allowed (allowed: ${[...ALLOWED_INCLUDES].sort().join(", ")}).`
      );
    }
  }
  if (/^\s*#\s*include\s*"[^"]+"/m.test(rawSrc)) {
    errors.push(`Quoted #include "..." (local headers) are not allowed.`);
  }

  // Strip comments + literals before doing keyword-level pattern checks.
  const cleaned = stripCommentsAndStrings(rawSrc);

  for (const { re, msg } of FEATURE_BLOCKLIST) {
    if (re.test(cleaned)) errors.push(msg);
  }

  const fnCount = countFunctions(cleaned);
  if (fnCount > LIMITS.maxFunctions) {
    errors.push(
      `Found ${fnCount} functions; limit is ${LIMITS.maxFunctions}.`
    );
  }

  const depth = maxBraceDepth(cleaned);
  if (depth > LIMITS.maxBraceDepth) {
    errors.push(
      `Maximum nesting depth is ${depth}; limit is ${LIMITS.maxBraceDepth}.`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      bytes,
      lines: allLines.length,
      nonBlankLines: nonBlank,
      functions: fnCount,
      braceDepth: depth,
    },
  };
}

const SAMPLE_META = {
  "array_oob.c": {
    title: "Array out-of-bounds",
    description: "Off-by-one in a `for (i = 0; i <= N; i++)` loop.",
    flags: ["--bounds-check"],
  },
  "divide_by_zero.c": {
    title: "Divide by zero",
    description: "`x / n` with no precondition on `n`.",
    flags: ["--div-by-zero-check"],
  },
  "signed_overflow.c": {
    title: "Signed overflow",
    description: "Doubling a value near `INT_MAX` wraps.",
    flags: ["--signed-overflow-check"],
  },
  "use_after_free.c": {
    title: "Use after free",
    description: "Dereference of a pointer after `free`.",
    flags: ["--pointer-check"],
  },
  "memory_leak.c": {
    title: "Memory leak",
    description: "`malloc` without a matching `free`.",
    flags: ["--memory-leak-check"],
  },
  "safe_sum.c": {
    title: "Safe baseline",
    description: "Bounded loop, no UB. Should report SUCCESS.",
    flags: ["--bounds-check", "--signed-overflow-check"],
  },
};

const PORT = process.env.PORT || 3017;
const CBMC_BIN = process.env.CBMC_BIN || "cbmc";
const TIMEOUT_MS = Number(process.env.CBMC_TIMEOUT_MS) || 60_000;

const VALID_FLAGS = new Set([
  "--bounds-check",
  "--pointer-check",
  "--memory-leak-check",
  "--div-by-zero-check",
  "--signed-overflow-check",
  "--unsigned-overflow-check",
  "--pointer-overflow-check",
  "--conversion-check",
  "--undefined-shift-check",
  "--float-overflow-check",
  "--nan-check",
]);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  limits: { fileSize: 1024 * 1024 }, // 1 MB
  fileFilter(_req, file, cb) {
    if (/\.(c|cpp|cc|cxx|h|hpp|i)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only C/C++ source files are accepted."));
  },
});

function runCbmc(args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      CBMC_BIN,
      args,
      { timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, ...opts },
      (err, stdout, stderr) => {
        // CBMC exits non-zero when verification fails; that's a useful result, not an error.
        const exitCode = err?.code ?? 0;
        const killed = err?.killed === true || err?.signal != null;
        resolve({
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
          exitCode,
          killed,
          spawnError:
            err && err.code === "ENOENT"
              ? `CBMC not found (looked for "${CBMC_BIN}")`
              : null,
        });
      }
    );
  });
}

app.get("/api/samples", async (_req, res) => {
  try {
    const entries = await readdir(SAMPLES_DIR);
    const samples = entries
      .filter((n) => /\.c$/i.test(n))
      .map((name) => ({
        name,
        title: SAMPLE_META[name]?.title ?? name,
        description: SAMPLE_META[name]?.description ?? null,
        flags: SAMPLE_META[name]?.flags ?? ["--bounds-check"],
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    res.json({ samples });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/samples/:name", async (req, res) => {
  const safe = path.basename(req.params.name);
  if (!/\.c$/i.test(safe)) {
    return res.status(400).json({ error: "Not a .c file." });
  }
  try {
    const text = await readFile(path.join(SAMPLES_DIR, safe), "utf8");
    res.type("text/x-c").send(text);
  } catch (err) {
    res.status(404).json({ error: `Sample not found: ${safe}` });
  }
});

app.get("/api/limits", (_req, res) => {
  res.json({
    limits: LIMITS,
    allowedIncludes: [...ALLOWED_INCLUDES].sort(),
    blockedFeatures: FEATURE_BLOCKLIST.map((f) => f.msg),
    supportedFlags: [...VALID_FLAGS].sort(),
  });
});

app.get("/api/health", async (_req, res) => {
  const v = await runCbmc(["--version"], { timeout: 5000 });
  res.json({
    ok: !v.spawnError,
    cbmcAvailable: !v.spawnError && v.exitCode === 0,
    cbmcVersion: v.stdout.trim() || null,
    error: v.spawnError ?? null,
  });
});

app.post("/api/analyze", upload.single("source"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No source file provided." });
  }

  const sourceText = req.file.buffer.toString("utf8");
  const complexity = checkComplexity(sourceText);
  if (!complexity.ok) {
    return res.status(422).json({
      error: "Source exceeds the project's complexity limits.",
      reasons: complexity.errors,
      metrics: complexity.metrics,
      limits: LIMITS,
    });
  }

  const requestedFlags = String(req.body.flags || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const rejectedFlags = requestedFlags.filter((f) => !VALID_FLAGS.has(f));
  const flags = requestedFlags.filter((f) => VALID_FLAGS.has(f));
  if (rejectedFlags.length > 0) {
    return res.status(400).json({
      error: "Unsupported CBMC flags.",
      reasons: rejectedFlags.map(
        (f) => `${f} is not in the supported flag set.`
      ),
      supportedFlags: [...VALID_FLAGS].sort(),
    });
  }
  const entryFn = String(req.body.entry || "").trim();
  const unwind = Number(req.body.unwind) || 10;

  let dir;
  try {
    dir = await mkdtemp(path.join(tmpdir(), "cbmc-viz-"));
    const fileName = path.basename(req.file.originalname).replace(/[^\w.\-]/g, "_");
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, req.file.buffer);

    const args = [filePath, "--json-ui", "--trace", "--unwind", String(unwind)];
    if (flags.length === 0) args.push("--bounds-check"); // sensible default
    args.push(...flags);
    if (entryFn) args.push("--function", entryFn);

    const { stdout, stderr, exitCode, killed, spawnError } = await runCbmc(args);

    if (spawnError) {
      return res.status(500).json({
        error: spawnError,
        hint:
          "Install CBMC (e.g. `brew install cbmc`) or set the CBMC_BIN env var to its full path.",
      });
    }
    if (killed) {
      return res
        .status(504)
        .json({ error: `CBMC timed out after ${TIMEOUT_MS / 1000}s.`, stderr });
    }

    let trace;
    try {
      trace = JSON.parse(stdout);
    } catch (parseErr) {
      return res.status(500).json({
        error: "CBMC produced non-JSON output.",
        detail: parseErr.message,
        stdoutHead: stdout.slice(0, 4000),
        stderrHead: stderr.slice(0, 4000),
      });
    }

    res.json({
      trace,
      sourceText: req.file.buffer.toString("utf8"),
      sourceName: fileName,
      stderr: stderr.trim() || null,
      exitCode,
      flagsUsed: flags,
      entry: entryFn || null,
      unwind,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (dir) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`CBMC Viz server on http://localhost:${PORT}`);
});
