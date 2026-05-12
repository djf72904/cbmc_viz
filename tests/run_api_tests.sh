#!/usr/bin/env bash
# Extensive backend API test suite for cbmc-viz.
# Hits the Spring Boot backend directly on :8080.
#
# This file doubles as the API contract spec for the backend implementer.
# Endpoints expected:
#
#   GET  /api/health
#        -> 200 {ok:bool, cbmcAvailable:bool, cbmcVersion:string|null, error:string|null}
#
#   GET  /api/limits
#        -> 200 {limits:{maxBytes,maxLines,maxNonBlankLines,maxFunctions,maxBraceDepth,maxLineLength},
#                allowedIncludes:[..], blockedFeatures:[..], supportedFlags:[..]}
#
#   GET  /api/samples
#        -> 200 {samples:[{name,title,description,flags}]}
#
#   GET  /api/samples/{name}
#        -> 200 text/x-c (file body)
#        -> 400 if not *.c
#        -> 404 if missing
#
#   POST /api/analyze   (Content-Type: application/json)
#        body: {source: <base64>, sourceName: "foo.c",
#               flags: "--bounds-check,--pointer-check",
#               entry: "main", unwind: 10}
#        -> 200 {trace, sourceText, sourceName, stderr, exitCode,
#                flagsUsed, entry, unwind}
#        -> 400 missing/invalid source, unsupported flag
#        -> 422 source rejected by complexity gate (with reasons[])
#        -> 504 cbmc timeout

set -uo pipefail

BASE="${BASE:-http://localhost:8080}"
TMPDIR_T=$(mktemp -d)
trap 'rm -rf "$TMPDIR_T"' EXIT

PASS=0
FAIL=0
FAILED_NAMES=()

bold()  { printf "\033[1m%s\033[0m" "$*"; }
green() { printf "\033[32m%s\033[0m" "$*"; }
red()   { printf "\033[31m%s\033[0m" "$*"; }
gray()  { printf "\033[90m%s\033[0m" "$*"; }

check() {
  # check <name> <test-cmd...>
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    PASS=$((PASS+1))
    printf "  %s %s\n" "$(green ✓)" "$name"
  else
    FAIL=$((FAIL+1))
    FAILED_NAMES+=("$name")
    printf "  %s %s\n" "$(red ✗)" "$name"
  fi
}

# Helper: write a temp .c file and echo path
write_c() {
  local f="$TMPDIR_T/$1"; shift
  printf '%s\n' "$@" > "$f"
  echo "$f"
}

# Run /api/analyze with a base64-encoded JSON body.
# Args after the file are key=value pairs: flags=..., entry=..., unwind=...
analyze() {
  local file="$1"; shift
  local flags="" entry="" unwind=10
  for a in "$@"; do
    case "$a" in
      flags=*)  flags="${a#flags=}"  ;;
      entry=*)  entry="${a#entry=}"  ;;
      unwind=*) unwind="${a#unwind=}" ;;
    esac
  done
  local src
  src=$(base64 < "$file" | tr -d '\n')
  local payload
  payload=$(jq -n \
    --arg src "$src" \
    --arg name "$(basename "$file")" \
    --arg flags "$flags" \
    --arg entry "$entry" \
    --argjson unwind "$unwind" \
    '{source:$src, sourceName:$name, flags:$flags, entry:$entry, unwind:$unwind}')
  curl -sS -o "$TMPDIR_T/body" -w "%{http_code}" -X POST \
       -H "Content-Type: application/json" \
       --data-binary "$payload" \
       "$BASE/api/analyze"
}
export -f analyze
export TMPDIR_T BASE

section() { printf "\n%s\n" "$(bold "$*")"; }

#
section "1. GET endpoints"

check "/api/health 200 + cbmcAvailable" \
  bash -c '[[ $(curl -sS -o /dev/null -w "%{http_code}" '"$BASE"'/api/health) == 200 ]] &&
           [[ $(curl -sS '"$BASE"'/api/health | jq -r .cbmcAvailable) == true ]]'

check "/api/limits has limits & supportedFlags" \
  bash -c 'curl -sS '"$BASE"'/api/limits | jq -e ".limits.maxBytes and (.supportedFlags|length>=5)"'

check "/api/samples returns >= 6 samples" \
  bash -c 'n=$(curl -sS '"$BASE"'/api/samples | jq ".samples|length"); [[ $n -ge 6 ]]'

check "/api/samples/safe_sum.c content" \
  bash -c 'curl -sS '"$BASE"'/api/samples/safe_sum.c | grep -q "main"'

check "/api/samples/no_such.c -> 404" \
  bash -c '[[ $(curl -sS -o /dev/null -w "%{http_code}" '"$BASE"'/api/samples/no_such.c) == 404 ]]'

check "/api/samples/foo.txt -> 400 (not .c)" \
  bash -c '[[ $(curl -sS -o /dev/null -w "%{http_code}" '"$BASE"'/api/samples/foo.txt) == 400 ]]'

check "/api/samples path traversal blocked" \
  bash -c '[[ $(curl -sS -o /dev/null -w "%{http_code}" "'"$BASE"'/api/samples/..%2F..%2Fetc%2Fpasswd") -ne 200 ]]'

#
section "2. CBMC verification: SUCCESS path"

SAFE=$(write_c safe.c \
  '#include <assert.h>' \
  'int main(void) { int a[4] = {1,2,3,4}; int s = 0;' \
  '  for (int i = 0; i < 4; i++) s += a[i];' \
  '  assert(s == 10); return 0; }')

check "safe sum verifies (exit 0, no FAILURE)" \
  bash -c '
    code=$(analyze '"$SAFE"' flags=--bounds-check)
    [[ $code == 200 ]] || exit 1
    jq -e ".exitCode == 0 and (.trace|tostring|test(\"FAILURE\")|not)" '"$TMPDIR_T"'/body'

#
section "3. CBMC verification: FAILURE path (each bug type)"

OOB=$(write_c oob.c \
  '#define N 4' \
  'int main(void) { int a[N] = {0};' \
  '  for (int i = 0; i <= N; i++) a[i] = i;' \
  '  return 0; }')
check "array OOB caught with --bounds-check" \
  bash -c '
    analyze '"$OOB"' flags=--bounds-check >/dev/null
    jq -e "tostring|test(\"FAILURE\")" '"$TMPDIR_T"'/body'

DBZ=$(write_c dbz.c \
  'int main(void) { int x = 10, n; n = n;' \
  '  int y = x / n; return y; }')
check "div-by-zero caught" \
  bash -c '
    analyze '"$DBZ"' flags=--div-by-zero-check >/dev/null
    jq -e "tostring|test(\"FAILURE\")" '"$TMPDIR_T"'/body'

OVF=$(write_c ovf.c \
  '#include <limits.h>' \
  'int main(void) { int x = INT_MAX;' \
  '  int y = x + 1; return y; }')
check "signed overflow caught" \
  bash -c '
    analyze '"$OVF"' flags=--signed-overflow-check >/dev/null
    jq -e "tostring|test(\"FAILURE\")" '"$TMPDIR_T"'/body'

UAF=$(write_c uaf.c \
  '#include <stdlib.h>' \
  'int main(void) { int *p = (int*)malloc(sizeof(int));' \
  '  *p = 1; free(p); return *p; }')
check "use-after-free caught with --pointer-check" \
  bash -c '
    analyze '"$UAF"' flags=--pointer-check >/dev/null
    jq -e "tostring|test(\"FAILURE\")" '"$TMPDIR_T"'/body'

LEAK=$(write_c leak.c \
  '#include <stdlib.h>' \
  'int main(void) { int *p = (int*)malloc(sizeof(int));' \
  '  *p = 1; return *p; }')
check "memory leak caught" \
  bash -c '
    analyze '"$LEAK"' flags=--memory-leak-check >/dev/null
    jq -e "tostring|test(\"FAILURE\")" '"$TMPDIR_T"'/body'

#
section "4. Multi-flag + entry + unwind"

MULTI=$(write_c multi.c \
  '#include <limits.h>' \
  'int compute(int x) { return x + 1; }' \
  'int main(void) { int a[2] = {0}; a[1] = compute(INT_MAX); return 0; }')

check "two flags combined" \
  bash -c '
    code=$(analyze '"$MULTI"' "flags=--bounds-check,--signed-overflow-check")
    [[ $code == 200 ]] && jq -e ".flagsUsed|length==2" '"$TMPDIR_T"'/body'

check "entry= overrides function" \
  bash -c '
    code=$(analyze '"$MULTI"' flags=--signed-overflow-check entry=compute)
    [[ $code == 200 ]] && jq -e ".entry==\"compute\"" '"$TMPDIR_T"'/body'

check "unwind=3 honored" \
  bash -c '
    code=$(analyze '"$MULTI"' flags=--bounds-check unwind=3)
    [[ $code == 200 ]] && jq -e ".unwind==3" '"$TMPDIR_T"'/body'

#
section "5. Complexity gate: blocked features return 422"

expect_422_with_reason() {
  # expect_422_with_reason <name> <reason-substring> <C-source-as-args...>
  local name="$1"; local needle="$2"; shift 2
  local f="$TMPDIR_T/blocked.c"
  printf '%s\n' "$@" > "$f"
  check "$name" \
    bash -c "
      code=\$(analyze '$f' flags=--bounds-check)
      [[ \$code == 422 ]] || exit 1
      jq -e --arg n '$needle' '.reasons|tostring|contains(\$n)' '$TMPDIR_T/body'"
}

expect_422_with_reason "blocks struct"       "struct" \
  'struct s { int x; };' 'int main(void){ return 0; }'

expect_422_with_reason "blocks union"        "union" \
  'union u { int x; char c; };' 'int main(void){ return 0; }'

expect_422_with_reason "blocks enum"         "enum" \
  'enum e { A, B };' 'int main(void){ return 0; }'

expect_422_with_reason "blocks typedef"      "typedef" \
  'typedef int myint;' 'int main(void){ return 0; }'

expect_422_with_reason "blocks goto"         "goto" \
  'int main(void){ goto end; end: return 0; }'

expect_422_with_reason "blocks switch"       "switch" \
  'int main(void){ int x=0; switch(x){case 0: break;} return 0; }'

expect_422_with_reason "blocks function ptr" "function pointer" \
  'int f(int x){return x;}' 'int main(void){ int (*p)(int) = f; return (*p)(0); }'

expect_422_with_reason "blocks extern"       "extern" \
  'extern int x;' 'int main(void){ return x; }'

expect_422_with_reason "blocks static"       "static" \
  'static int g = 0;' 'int main(void){ return g; }'

expect_422_with_reason "blocks volatile"     "volatile" \
  'int main(void){ volatile int x = 0; return x; }'

expect_422_with_reason "blocks varargs"      "variadic" \
  '#include <stdarg.h>' 'int sum(int n, ...){ return n; }' 'int main(void){ return sum(0); }'

expect_422_with_reason "blocks setjmp"       "setjmp" \
  'int setjmp(int x); int main(void){ return setjmp(0); }'

expect_422_with_reason "blocks asm"          "assembly" \
  'int main(void){ __asm__("nop"); return 0; }'

#
section "6. Complexity gate: limits"

# Too many lines
many=$(printf 'int main(void){\n'; for i in $(seq 1 250); do printf '  int v%d=0;\n' $i; done; printf '  return 0; }\n')
echo "$many" > "$TMPDIR_T/many.c"
check "too many lines -> 422" \
  bash -c '
    code=$(analyze '"$TMPDIR_T"'/many.c flags=--bounds-check)
    [[ $code == 422 ]]'

# Disallowed include
echo '#include <pthread.h>
int main(void){ return 0; }' > "$TMPDIR_T/badinc.c"
check "disallowed include -> 422" \
  bash -c '
    code=$(analyze '"$TMPDIR_T"'/badinc.c flags=--bounds-check)
    [[ $code == 422 ]] && jq -e ".reasons|tostring|test(\"pthread\")" '"$TMPDIR_T"'/body'

# Quoted include
echo '#include "local.h"
int main(void){ return 0; }' > "$TMPDIR_T/quoteinc.c"
check "quoted #include -> 422" \
  bash -c '
    code=$(analyze '"$TMPDIR_T"'/quoteinc.c flags=--bounds-check)
    [[ $code == 422 ]]'

# Allowed include should NOT trigger 422 from include check
echo '#include <stdio.h>
int main(void){ return 0; }' > "$TMPDIR_T/okinc.c"
check "allowed include passes" \
  bash -c '
    code=$(analyze '"$TMPDIR_T"'/okinc.c flags=--bounds-check)
    [[ $code == 200 ]]'

# Comment-stripped: typedef inside comment should NOT trip the gate
echo '/* typedef int x; */
// goto not_a_label;
int main(void){ return 0; }' > "$TMPDIR_T/incomment.c"
check "blocked keyword inside comment passes" \
  bash -c '
    code=$(analyze '"$TMPDIR_T"'/incomment.c flags=--bounds-check)
    [[ $code == 200 ]]'

# String containing "goto" should NOT trigger
echo 'int main(void){ char *s = "go to or goto?"; (void)s; return 0; }' > "$TMPDIR_T/instring.c"
check "blocked keyword inside string passes" \
  bash -c '
    code=$(analyze '"$TMPDIR_T"'/instring.c flags=--bounds-check)
    [[ $code == 200 ]]'

#
section "7. Input validation"

check "no body -> 4xx" \
  bash -c 'code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" '"$BASE"'/api/analyze); [[ ${code:0:1} == 4 ]]'

check "JSON without source field -> 400" \
  bash -c 'code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"flags\":\"--bounds-check\"}" '"$BASE"'/api/analyze); [[ $code == 400 ]]'

check "non-base64 source -> 400" \
  bash -c 'code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"source\":\"!!! not base64 !!!\",\"sourceName\":\"x.c\"}" '"$BASE"'/api/analyze); [[ $code == 400 ]]'

check "unsupported flag -> 400" \
  bash -c '
    code=$(analyze '"$SAFE"' "flags=--evil-flag")
    [[ $code == 400 ]] && jq -e ".reasons|tostring|test(\"evil-flag\")" '"$TMPDIR_T"'/body'

check "empty flag string falls back to default --bounds-check" \
  bash -c '
    code=$(analyze '"$SAFE"' "flags=")
    [[ $code == 200 ]]'

check "GET on /api/analyze rejected" \
  bash -c '[[ $(curl -sS -o /dev/null -w "%{http_code}" '"$BASE"'/api/analyze) -ne 200 ]]'

#
section "Summary"
TOTAL=$((PASS+FAIL))
if (( FAIL == 0 )); then
  printf "%s %d/%d passed\n" "$(green ✓)" "$PASS" "$TOTAL"
else
  printf "%s %d/%d passed; %d failed:\n" "$(red ✗)" "$PASS" "$TOTAL" "$FAIL"
  for n in "${FAILED_NAMES[@]}"; do printf "    - %s\n" "$n"; done
  exit 1
fi
