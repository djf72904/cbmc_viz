package stevens.cs810.cbmc_viz_backend;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {

    @Value("${cbmcviz.cbmc-bin:cbmc}")
    private String cbmcBin;

    @Value("${cbmcviz.timeout-ms:60000}")
    private long timeoutMs;

    @Value("${cbmcviz.samples-dir:../samples}")
    private String samplesDir;

    private final ObjectMapper mapper = new ObjectMapper();

    private static final Map<String, Integer> LIMITS = Map.of(
            "maxBytes", 16 * 1024,
            "maxLines", 200,
            "maxNonBlankLines", 150,
            "maxFunctions", 6,
            "maxBraceDepth", 5,
            "maxLineLength", 240
    );

    private static final Set<String> ALLOWED_INCLUDES = Set.of(
            "stdlib.h", "stdio.h", "string.h", "limits.h", "assert.h",
            "stdint.h", "stdbool.h", "stddef.h", "stdarg.h", "math.h"
    );

    private record BlockedFeature(Pattern re, String msg) {}

    private static final List<BlockedFeature> FEATURE_BLOCKLIST = List.of(
            new BlockedFeature(Pattern.compile("\\bstruct\\s+\\w+\\s*\\{"), "struct definitions are not supported"),
            new BlockedFeature(Pattern.compile("\\bunion\\s+\\w+\\s*\\{"), "union definitions are not supported"),
            new BlockedFeature(Pattern.compile("\\benum\\s+\\w+\\s*\\{"), "enum definitions are not supported"),
            new BlockedFeature(Pattern.compile("\\btypedef\\b"), "typedef is not supported"),
            new BlockedFeature(Pattern.compile("\\bgoto\\b"), "goto is not supported"),
            new BlockedFeature(Pattern.compile("\\bsetjmp\\b|\\blongjmp\\b"), "setjmp/longjmp are not supported"),
            new BlockedFeature(Pattern.compile("\\bswitch\\s*\\("), "switch statements are not supported (use if/else)"),
            new BlockedFeature(Pattern.compile("\\(\\s*\\*\\s*\\w+\\s*\\)\\s*\\("), "function pointers are not supported"),
            new BlockedFeature(Pattern.compile("\\bextern\\b"), "extern declarations are not supported"),
            new BlockedFeature(Pattern.compile("\\bstatic\\b"), "static storage duration is not supported"),
            new BlockedFeature(Pattern.compile("\\bvolatile\\b"), "volatile is not supported"),
            new BlockedFeature(Pattern.compile("\\b__asm__\\b|\\basm\\b"), "inline assembly is not supported"),
            new BlockedFeature(Pattern.compile("\\bvarargs\\b|\\.\\.\\."), "variadic functions are not supported")
    );

    private static final Set<String> VALID_FLAGS = Set.of(
            "--bounds-check", "--pointer-check", "--memory-leak-check",
            "--div-by-zero-check", "--signed-overflow-check",
            "--unsigned-overflow-check", "--pointer-overflow-check",
            "--conversion-check", "--undefined-shift-check",
            "--float-overflow-check", "--nan-check"
    );

    private record SampleMeta(String title, String description, List<String> flags) {}

    private static final Map<String, SampleMeta> SAMPLE_META = Map.of(
            "array_oob.c", new SampleMeta(
                    "Array out-of-bounds",
                    "Off-by-one in a `for (i = 0; i <= N; i++)` loop.",
                    List.of("--bounds-check")),
            "divide_by_zero.c", new SampleMeta(
                    "Divide by zero",
                    "`x / n` with no precondition on `n`.",
                    List.of("--div-by-zero-check")),
            "signed_overflow.c", new SampleMeta(
                    "Signed overflow",
                    "Doubling a value near `INT_MAX` wraps.",
                    List.of("--signed-overflow-check")),
            "use_after_free.c", new SampleMeta(
                    "Use after free",
                    "Dereference of a pointer after `free`.",
                    List.of("--pointer-check")),
            "memory_leak.c", new SampleMeta(
                    "Memory leak",
                    "`malloc` without a matching `free`.",
                    List.of("--memory-leak-check")),
            "safe_sum.c", new SampleMeta(
                    "Safe baseline",
                    "Bounded loop, no UB. Should report SUCCESS.",
                    List.of("--bounds-check", "--signed-overflow-check"))
    );

    @GetMapping("/samples")
    public Map<String, Object> listSamples() throws IOException {
        Path dir = Paths.get(samplesDir);
        if (!Files.isDirectory(dir)) {
            return Map.of("samples", List.of());
        }
        List<Map<String, Object>> samples = new ArrayList<>();
        try (var stream = Files.list(dir)) {
            stream.filter(p -> p.getFileName().toString().toLowerCase().endsWith(".c"))
                    .forEach(p -> {
                        String name = p.getFileName().toString();
                        SampleMeta meta = SAMPLE_META.get(name);
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("name", name);
                        entry.put("title", meta != null ? meta.title() : name);
                        entry.put("description", meta != null ? meta.description() : null);
                        entry.put("flags", meta != null ? meta.flags() : List.of("--bounds-check"));
                        samples.add(entry);
                    });
        }
        samples.sort(Comparator.comparing(s -> ((String) s.get("title"))));
        return Map.of("samples", samples);
    }

    @GetMapping("/samples/{name}")
    public ResponseEntity<?> getSample(@PathVariable String name) throws IOException {
        String safe = Paths.get(name).getFileName().toString();
        if (!safe.toLowerCase().endsWith(".c")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Not a .c file."));
        }
        Path p = Paths.get(samplesDir, safe);
        if (!Files.exists(p)) {
            return ResponseEntity.status(404).body(Map.of("error", "Sample not found: " + safe));
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/x-c;charset=UTF-8"))
                .body(Files.readString(p, StandardCharsets.UTF_8));
    }

    @GetMapping("/limits")
    public Map<String, Object> getLimitsResp() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("limits", LIMITS);
        resp.put("allowedIncludes", new TreeSet<>(ALLOWED_INCLUDES));
        resp.put("blockedFeatures", FEATURE_BLOCKLIST.stream().map(BlockedFeature::msg).toList());
        resp.put("supportedFlags", new TreeSet<>(VALID_FLAGS));
        return resp;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        CbmcResult v = runCbmc(List.of("--version"), 5000);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", v.spawnError() == null);
        resp.put("cbmcAvailable", v.spawnError() == null && v.exitCode() == 0);
        resp.put("cbmcVersion", v.stdout().isBlank() ? null : v.stdout().trim());
        resp.put("error", v.spawnError());
        return resp;
    }

    @PostMapping(value = "/analyze", consumes = "multipart/form-data")
    public ResponseEntity<?> analyze(
            @RequestParam("source") MultipartFile source,
            @RequestParam(value = "flags", required = false, defaultValue = "") String flagsParam,
            @RequestParam(value = "entry", required = false, defaultValue = "") String entry,
            @RequestParam(value = "unwind", required = false, defaultValue = "10") int unwind
    ) throws IOException {

        if (source == null || source.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No source file provided."));
        }

        byte[] sourceBytes = source.getBytes();
        String sourceText = new String(sourceBytes, StandardCharsets.UTF_8);
        ComplexityResult complexity = checkComplexity(sourceText);
        if (!complexity.ok()) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("error", "Source exceeds the project's complexity limits.");
            body.put("reasons", complexity.errors());
            body.put("metrics", complexity.metrics());
            body.put("limits", LIMITS);
            return ResponseEntity.status(422).body(body);
        }

        List<String> requested = Arrays.stream(flagsParam.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
        List<String> rejected = requested.stream().filter(f -> !VALID_FLAGS.contains(f)).toList();
        List<String> flags = requested.stream().filter(VALID_FLAGS::contains).toList();
        if (!rejected.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Unsupported CBMC flags.",
                    "reasons", rejected.stream().map(f -> f + " is not in the supported flag set.").toList(),
                    "supportedFlags", new TreeSet<>(VALID_FLAGS)
            ));
        }

        Path dir = Files.createTempDirectory("cbmc-viz-");
        try {
            String origName = source.getOriginalFilename();
            if (origName == null || origName.isBlank()) origName = "source.c";
            String fileName = Paths.get(origName).getFileName().toString().replaceAll("[^\\w.\\-]", "_");
            Path filePath = dir.resolve(fileName);
            Files.write(filePath, sourceBytes);

            List<String> args = new ArrayList<>();
            args.add(filePath.toString());
            args.add("--json-ui");
            args.add("--trace");
            args.add("--unwind");
            args.add(String.valueOf(unwind));
            if (flags.isEmpty()) args.add("--bounds-check");
            else args.addAll(flags);
            String entryName = entry.trim().replaceAll("\\(\\s*\\)\\s*$", "");
            if (!entryName.isBlank()) {
                args.add("--function");
                args.add(entryName);
            }

            CbmcResult r = runCbmc(args, timeoutMs);

            if (r.spawnError() != null) {
                return ResponseEntity.status(500).body(Map.of(
                        "error", r.spawnError(),
                        "hint", "Install CBMC (e.g. `brew install cbmc`) or set the cbmcviz.cbmc-bin property to its full path."
                ));
            }
            if (r.killed()) {
                return ResponseEntity.status(504).body(Map.of(
                        "error", "CBMC timed out after " + (timeoutMs / 1000) + "s.",
                        "stderr", r.stderr()
                ));
            }

            JsonNode trace;
            try {
                trace = mapper.readTree(r.stdout());
            } catch (Exception e) {
                return ResponseEntity.status(500).body(Map.of(
                        "error", "CBMC produced non-JSON output.",
                        "detail", e.getMessage(),
                        "stdoutHead", r.stdout().substring(0, Math.min(4000, r.stdout().length())),
                        "stderrHead", r.stderr().substring(0, Math.min(4000, r.stderr().length()))
                ));
            }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("trace", trace);
            resp.put("sourceText", sourceText);
            resp.put("sourceName", fileName);
            resp.put("stderr", r.stderr().isBlank() ? null : r.stderr().trim());
            resp.put("exitCode", r.exitCode());
            resp.put("flagsUsed", flags);
            resp.put("entry", entryName.isBlank() ? null : entryName);
            resp.put("unwind", unwind);
            return ResponseEntity.ok(resp);
        } finally {
            deleteRecursive(dir);
        }
    }

    private record CbmcResult(String stdout, String stderr, int exitCode, boolean killed, String spawnError) {}

    private CbmcResult runCbmc(List<String> args, long timeoutMs) {
        List<String> cmd = new ArrayList<>();
        cmd.add(cbmcBin);
        cmd.addAll(args);
        try {
            Process p = new ProcessBuilder(cmd).redirectErrorStream(false).start();
            CompletableFuture<String> outF = readStreamAsync(p.getInputStream());
            CompletableFuture<String> errF = readStreamAsync(p.getErrorStream());
            boolean finished = p.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            if (!finished) {
                p.destroyForcibly();
                return new CbmcResult(outF.join(), errF.join(), -1, true, null);
            }
            return new CbmcResult(outF.join(), errF.join(), p.exitValue(), false, null);
        } catch (IOException e) {
            String msg = e.getMessage() != null && e.getMessage().toLowerCase().contains("no such file")
                    ? "CBMC not found (looked for \"" + cbmcBin + "\")"
                    : "CBMC not found (looked for \"" + cbmcBin + "\"): " + e.getMessage();
            return new CbmcResult("", "", -1, false, msg);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new CbmcResult("", "", -1, false, e.getMessage());
        }
    }

    private static CompletableFuture<String> readStreamAsync(InputStream in) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                return "";
            }
        });
    }

    private static void deleteRecursive(Path dir) {
        try {
            if (!Files.exists(dir)) return;
            try (var stream = Files.walk(dir)) {
                stream.sorted(Comparator.reverseOrder()).forEach(p -> {
                    try { Files.deleteIfExists(p); } catch (IOException ignored) {}
                });
            }
        } catch (IOException ignored) {}
    }

    private record ComplexityResult(boolean ok, List<String> errors, List<String> warnings, Map<String, Object> metrics) {}

    private static ComplexityResult checkComplexity(String src) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int bytes = src.getBytes(StandardCharsets.UTF_8).length;
        int limMaxBytes = LIMITS.get("maxBytes");
        int limMaxLines = LIMITS.get("maxLines");
        int limMaxNonBlank = LIMITS.get("maxNonBlankLines");
        int limMaxFns = LIMITS.get("maxFunctions");
        int limMaxDepth = LIMITS.get("maxBraceDepth");
        int limMaxLineLen = LIMITS.get("maxLineLength");

        if (bytes > limMaxBytes) errors.add("File is " + bytes + " bytes; limit is " + limMaxBytes + ".");

        String[] lines = src.split("\\r?\\n", -1);
        if (lines.length > limMaxLines) errors.add("File has " + lines.length + " lines; limit is " + limMaxLines + ".");

        for (int i = 0; i < lines.length; i++) {
            if (lines[i].length() > limMaxLineLen) {
                errors.add("Line " + (i + 1) + " is " + lines[i].length() + " chars long (limit " + limMaxLineLen + ").");
                break;
            }
        }

        long nonBlank = Arrays.stream(lines).filter(l -> !l.trim().isEmpty()).count();
        if (nonBlank > limMaxNonBlank) errors.add("File has " + nonBlank + " non-blank lines; limit is " + limMaxNonBlank + ".");

        Matcher inc = Pattern.compile("(?m)^\\s*#\\s*include\\s*<([^>]+)>").matcher(src);
        while (inc.find()) {
            String h = inc.group(1).trim();
            if (!ALLOWED_INCLUDES.contains(h)) {
                errors.add("#include <" + h + "> is not allowed (allowed: "
                        + String.join(", ", new TreeSet<>(ALLOWED_INCLUDES)) + ").");
            }
        }
        if (Pattern.compile("(?m)^\\s*#\\s*include\\s*\"[^\"]+\"").matcher(src).find()) {
            errors.add("Quoted #include \"...\" (local headers) are not allowed.");
        }

        String cleaned = stripCommentsAndStrings(src);
        for (BlockedFeature bf : FEATURE_BLOCKLIST) {
            if (bf.re().matcher(cleaned).find()) errors.add(bf.msg());
        }

        int fnCount = countFunctions(cleaned);
        if (fnCount > limMaxFns) errors.add("Found " + fnCount + " functions; limit is " + limMaxFns + ".");

        int depth = computeMaxBraceDepth(cleaned);
        if (depth > limMaxDepth) errors.add("Maximum nesting depth is " + depth + "; limit is " + limMaxDepth + ".");

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("bytes", bytes);
        metrics.put("lines", lines.length);
        metrics.put("nonBlankLines", nonBlank);
        metrics.put("functions", fnCount);
        metrics.put("braceDepth", depth);

        return new ComplexityResult(errors.isEmpty(), errors, warnings, metrics);
    }

    private static String stripCommentsAndStrings(String src) {
        return src
                .replaceAll("(?s)/\\*.*?\\*/", " ")
                .replaceAll("//[^\\n]*", " ")
                .replaceAll("\"(?:\\\\.|[^\"\\\\])*\"", "\"\"")
                .replaceAll("'(?:\\\\.|[^'\\\\])*'", "''");
    }

    private static int countFunctions(String src) {
        Set<String> skip = Set.of("if", "else", "for", "while", "do", "switch", "return",
                "sizeof", "typeof", "case", "default");
        Pattern re = Pattern.compile("\\b([A-Za-z_]\\w*)\\s*\\([^;{}]*\\)\\s*\\{");
        Matcher m = re.matcher(src);
        int n = 0;
        while (m.find()) {
            if (!skip.contains(m.group(1))) n++;
        }
        return n;
    }

    private static int computeMaxBraceDepth(String src) {
        int depth = 0, max = 0;
        for (int i = 0; i < src.length(); i++) {
            char ch = src.charAt(i);
            if (ch == '{') {
                depth++;
                if (depth > max) max = depth;
            } else if (ch == '}') {
                depth = Math.max(0, depth - 1);
            }
        }
        return max;
    }
}
