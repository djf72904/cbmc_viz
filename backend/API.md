# cbmc-viz backend API

Spring Boot backend for the cbmc-viz frontend. Spawns CBMC as a subprocess
and returns its `--json-ui --trace` output to the browser.

Base URL in dev: `http://localhost:8080` (Vite proxies `/api/*` from `:5181`).

All responses are `application/json` unless noted. Errors use this shape:

```json
{ "error": "<human readable>", "reasons": [...], "hint": "...", "detail": "..." }
```

`reasons`, `hint`, `detail` are optional; surface them in the UI when present.

---

## `GET /api/health`

Liveness + CBMC availability check.

**200 OK**
```json
{
  "ok": true,
  "cbmcAvailable": true,
  "cbmcVersion": "6.9.0 (cbmc-6.9.0)",
  "error": null
}
```

`cbmcAvailable` is `true` iff `cbmc --version` exits 0. When the binary is
missing, return `ok: true, cbmcAvailable: false, error: "CBMC not found..."`.

---

## `GET /api/limits`

Static metadata describing what the backend will accept.

**200 OK**
```json
{
  "limits": {
    "maxBytes": 16384,
    "maxLines": 200,
    "maxNonBlankLines": 150,
    "maxFunctions": 6,
    "maxBraceDepth": 5,
    "maxLineLength": 240
  },
  "allowedIncludes": ["assert.h", "limits.h", "math.h", "stdarg.h",
                       "stdbool.h", "stddef.h", "stdint.h", "stdio.h",
                       "stdlib.h", "string.h"],
  "blockedFeatures": [
    "struct definitions are not supported",
    "union definitions are not supported",
    "...",
    "variadic functions are not supported"
  ],
  "supportedFlags": [
    "--bounds-check", "--conversion-check", "--div-by-zero-check",
    "--float-overflow-check", "--memory-leak-check", "--nan-check",
    "--pointer-check", "--pointer-overflow-check",
    "--signed-overflow-check", "--undefined-shift-check",
    "--unsigned-overflow-check"
  ]
}
```

---

## `GET /api/samples`

Lists the sample C programs that ship with the project (read from
`cbmcviz.samples-dir`, default `../samples`).

**200 OK**
```json
{
  "samples": [
    {
      "name": "array_oob.c",
      "title": "Array out-of-bounds",
      "description": "Off-by-one in a `for (i = 0; i <= N; i++)` loop.",
      "flags": ["--bounds-check"]
    }
  ]
}
```

Sorted by `title`.

---

## `GET /api/samples/{name}`

Serves a single sample file. `{name}` must end in `.c` and must be a basename
(no path traversal).

| status | when |
| ------ | ---- |
| `200`  | sample exists; body is the source as `text/x-c;charset=UTF-8` |
| `400`  | `{name}` does not end in `.c` |
| `404`  | sample not found |

---

## `POST /api/analyze`

Verifies a C source file with CBMC. **Request and response are JSON;
the source is base64-encoded.**

### Request

`Content-Type: application/json`

```json
{
  "source":     "<base64-encoded C source bytes>",
  "sourceName": "myfile.c",
  "flags":      "--bounds-check,--signed-overflow-check",
  "entry":      "main",
  "unwind":     10
}
```

| field        | type     | required | notes                                                                  |
| ------------ | -------- | -------- | ---------------------------------------------------------------------- |
| `source`     | string   | yes      | Base64-encoded UTF-8 bytes of the `.c` file.                           |
| `sourceName` | string   | yes      | Original filename (used in CBMC's diagnostics + the response echo).    |
| `flags`      | string   | no       | Comma-separated CBMC check flags. Empty string = use `--bounds-check`. |
| `entry`      | string   | no       | Entry function name. Trailing `()` is stripped server-side.            |
| `unwind`     | int      | no       | Loop unwind bound, default `10`.                                       |

### Pipeline

1. **Decode** `source` from base64 → UTF-8 string.
2. **Complexity gate** — reject the source (422) if it violates any of:
   - `bytes`, `lines`, `nonBlankLines`, `lineLength` over their limit
   - `functions` count or `braceDepth` over their limit
   - any blocked C feature (struct, union, enum, typedef, goto, switch,
     function pointers, extern, static, volatile, asm, varargs,
     setjmp/longjmp) — checked after stripping comments and string/char
     literals so commented-out or in-string occurrences pass
   - `#include <foo.h>` outside the allow-list
   - any quoted `#include "..."` (local headers not allowed)
3. **Flag whitelist** — reject (400) any flag not in `supportedFlags`.
4. **Spawn CBMC** in a temp dir:
   ```
   cbmc <file> --json-ui --trace --unwind <N>
        [--bounds-check or supplied flags...]
        [--function <entry>]
   ```
   - default to `--bounds-check` when no flags supplied
   - timeout = `cbmcviz.timeout-ms` (default 60s); if killed → 504
   - read stdout + stderr concurrently to avoid pipe back-pressure
5. **Parse** stdout as JSON. CBMC may exit non-zero for FAILUREs; that
   is **not** an error — forward the trace.
6. **Cleanup** — remove temp dir.

### Success — `200 OK`
```json
{
  "trace":      <CBMC --json-ui output, JSON array>,
  "sourceText": "<decoded source as a UTF-8 string>",
  "sourceName": "myfile.c",
  "stderr":     null,
  "exitCode":   10,
  "flagsUsed":  ["--bounds-check"],
  "entry":      "sum",
  "unwind":     10
}
```

`stderr` is `null` if empty, otherwise a string. `entry` is `null` if not
supplied. `exitCode` is CBMC's exit code (10 = property failed, 0 = passed).

### Error responses

| status | meaning                                                              |
| ------ | -------------------------------------------------------------------- |
| `400`  | missing/invalid `source`, malformed base64, unsupported flag         |
| `422`  | complexity gate rejected the source; body has `reasons` and `metrics` |
| `500`  | CBMC binary missing, or non-JSON stdout                              |
| `504`  | CBMC exceeded `cbmcviz.timeout-ms`                                   |

`422` body shape:
```json
{
  "error":   "Source exceeds the project's complexity limits.",
  "reasons": ["struct definitions are not supported"],
  "metrics": {"bytes":49,"lines":3,"nonBlankLines":2,"functions":1,"braceDepth":1},
  "limits":  { ... same as /api/limits ... }
}
```

---

## Configuration

`backend/src/main/resources/application.properties`:

| property                          | default        | meaning                                  |
| --------------------------------- | -------------- | ---------------------------------------- |
| `server.port`                     | `8080`         | HTTP port                                |
| `cbmcviz.cbmc-bin`                | `cbmc`         | path to the CBMC binary                  |
| `cbmcviz.timeout-ms`              | `60000`        | CBMC kill threshold                      |
| `cbmcviz.samples-dir`             | `../samples`   | where `/api/samples*` reads from         |
| `server.max-http-request-header-size` | `64KB`     | needed for browsers with large cookies  |

Each `cbmcviz.*` property also reads from an env var of the same name in
upper-snake-case (`CBMC_BIN`, `CBMC_TIMEOUT_MS`, `CBMC_SAMPLES_DIR`).

---

## Reference

- Test suite: `tests/run_api_tests.sh` — 40 cases covering happy paths,
  every blocked feature, every CBMC bug class, and input validation.
- Reference implementation in JS: `server/index.js` (the original Node
  server that the Spring Boot backend replaces).
