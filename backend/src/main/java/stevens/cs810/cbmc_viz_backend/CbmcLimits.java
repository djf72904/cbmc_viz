package stevens.cs810.cbmc_viz_backend;

import java.util.Set;

public class CbmcLimits {

    public static final int MAX_BYTES = 16_384;
    public static final int MAX_LINES = 200;
    public static final int MAX_NON_BLANK_LINES = 150;
    public static final int MAX_FUNCTIONS = 6;
    public static final int MAX_BRACE_DEPTH = 5;
    public static final int MAX_LINE_LENGTH = 240;

    //Allowed inculdes
    public static final Set<String> ALLOWED_INCLUDES = Set.of(
            "assert.h",
            "ctype.h",
            "float.h",
            "limits.h",
            "math.h",
            "stdbool.h",
            "stddef.h",
            "stdint.h",
            "stdio.h",
            "stdlib.h",
            "string.h"
    );

    //allowed flags
    public static final Set<String> SUPPORTED_FLAGS = Set.of(
            "--bounds-check",
            "--pointer-check",
            "--memory-leak-check",
            "--div-by-zero-check",
            "--signed-overflow-check"
    );

    //blocked features
    public static final Set<String> BLOCKED_FEATURES = Set.of(
            "struct",
            "union",
            "enum",
            "typedef",
            "goto",
            "switch",
            "function pointer",
            "extern",
            "static",
            "volatile",
            "asm",
            "__asm__",
            "setjmp",
            "longjmp"
    );
}
