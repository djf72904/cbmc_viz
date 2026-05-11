package stevens.cs810.cbmc_viz_backend;

import stevens.cs810.cbmc_viz_backend.dto.MetricsResponse;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class ComplexityGate {


    //public method to check the source text is valid
    public static void checkSource(String sourceText) throws Exception {
        checkLimits(sourceText);
        checkIncludes(sourceText);

        String cleaned = stripCommentsAndStrings(sourceText);
        checkBlockedFeatures(cleaned);
    }

    public static List<String> validateFlags(String flagsString) throws Exception{

        List<String> goodFlags = new ArrayList<>();

        //spit flags
        String[] parts = flagsString.trim().split("[,\\s]+");

        for(String flag : parts){
            if (flag.isBlank()){
                continue;
            }

            if(!CbmcLimits.SUPPORTED_FLAGS.contains(flag)){
                throw new Exception("Unsupported Flag" + flag);
            }

            if(!goodFlags.contains(flag)){
                goodFlags.add(flag);
            }
        }

        return goodFlags;

    }

    //check entry
    public static String validateEntry(String entryText, String sourceText) throws Exception{

        String entry = entryText.trim();

        // strip trailing ()
        if (entry.endsWith("()")) {
            entry = entry.substring(0, entry.length() - 2).trim();
        }

        // validate identifier
        if (!entry.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new Exception(
                    "Invalid entry function name: " + entryText
            );
        }

        String cleaned = stripCommentsAndStrings(sourceText);

        String functionPattern =
                "(?s).*\\b[A-Za-z_][A-Za-z0-9_\\s\\*]*\\s+"
                        + entry
                        + "\\s*\\([^;]*\\)\\s*\\{.*";

        if (!cleaned.matches(functionPattern)) {
            throw new Exception(
                    "Entry function not found in source: " + entry
            );
        }

        return entry;
    }

    private static void checkLimits(String sourceText) throws Exception{

        int bytes = sourceText.getBytes(StandardCharsets.UTF_8).length;

        //too big
        if (bytes > CbmcLimits.MAX_BYTES) {
            throw new Exception("Source exceeds max byte limit");
        }

        String[] lines = sourceText.split("\\R", -1);

        if (lines.length > CbmcLimits.MAX_LINES) {
            throw new Exception("Source exceeds max line limit:");
        }

        int nonBlankLines = 0;

        for (String line : lines) {

            if (!line.trim().isEmpty()) {
                nonBlankLines++;
            }

            if (line.length() > CbmcLimits.MAX_LINE_LENGTH) {
                throw new Exception("Line '" + line +"' exceeds max length");
            }
        }

        if (nonBlankLines > CbmcLimits.MAX_NON_BLANK_LINES) {
            throw new Exception("Source exceeds max non-blank line limit");
        }

        String cleaned = stripCommentsAndStrings(sourceText);

        int braceDepth = 0;
        int maxBraceDepthFound = 0;

        for (char c : cleaned.toCharArray()) {

            if (c == '{') {
                braceDepth++;

                maxBraceDepthFound =
                        Math.max(maxBraceDepthFound, braceDepth);

            } else if (c == '}') {
                braceDepth--;
            }
        }

        if (maxBraceDepthFound > CbmcLimits.MAX_BRACE_DEPTH) {
            throw new Exception("Source exceeds max brace depth");
        }

        int functionCount = countFunctions(cleaned);

        if (functionCount > CbmcLimits.MAX_FUNCTIONS) {
            throw new Exception("Source exceeds max function count");
        }
    }

    private static void checkIncludes(String sourceText) throws Exception {
        String[] lines = sourceText.split("\\R");

        for (String line : lines) {

            String trimmed = line.trim();

            if (!trimmed.startsWith("#include")) {
                continue;
            }

            // Reject local includes
            if (trimmed.matches("#include\\s+\".*\"")) {
                throw new Exception("Local quoted includes are not allowed");
            }

            java.util.regex.Matcher matcher =
                    java.util.regex.Pattern
                            .compile("#include\\s+<([^>]+)>")
                            .matcher(trimmed);

            if (!matcher.matches()) {
                throw new Exception("Invalid include syntax");
            }

            String header = matcher.group(1);

            if (!CbmcLimits.ALLOWED_INCLUDES.contains(header)) {
                throw new Exception("Include not allowed");
            }
        }
    }

    private static void checkBlockedFeatures(String cleaned) throws Exception {
        for (String keyword : CbmcLimits.BLOCKED_KEYWORDS) {

            String pattern =
                    "(?s).*\\b"
                            + java.util.regex.Pattern.quote(keyword)
                            + "\\b.*";

            if (cleaned.matches(pattern)) {

                throw new Exception("Unsupported C feature used: "+ keyword);
            }
        }
    }

    private static int countFunctions(String cleaned) {
        java.util.regex.Pattern pattern =
                java.util.regex.Pattern.compile(
                        "\\b[A-Za-z_][A-Za-z0-9_\\s\\*]*\\s+"
                                + "[A-Za-z_][A-Za-z0-9_]*"
                                + "\\s*\\([^;]*\\)\\s*\\{"
                );

        java.util.regex.Matcher matcher =
                pattern.matcher(cleaned);

        int count = 0;

        while (matcher.find()) {
            count++;
        }

        return count;
    }

    private static String stripCommentsAndStrings(String source){
        StringBuilder result = new StringBuilder();

        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;

        for (int i = 0; i < source.length(); i++) {

            char c = source.charAt(i);

            char next =
                    i + 1 < source.length()
                            ? source.charAt(i + 1)
                            : '\0';

            if (inLineComment) {

                if (c == '\n') {
                    inLineComment = false;
                    result.append('\n');
                } else {
                    result.append(' ');
                }

            } else if (inBlockComment) {

                if (c == '*' && next == '/') {

                    inBlockComment = false;

                    result.append("  ");

                    i++;

                } else {

                    result.append(
                            c == '\n' ? '\n' : ' '
                    );
                }

            } else if (inString) {

                if (c == '\\') {

                    result.append("  ");

                    i++;

                } else if (c == '"') {

                    inString = false;

                    result.append(' ');

                } else {

                    result.append(
                            c == '\n' ? '\n' : ' '
                    );
                }

            } else if (inChar) {

                if (c == '\\') {

                    result.append("  ");

                    i++;

                } else if (c == '\'') {

                    inChar = false;

                    result.append(' ');

                } else {

                    result.append(
                            c == '\n' ? '\n' : ' '
                    );
                }

            } else {

                if (c == '/' && next == '/') {

                    inLineComment = true;

                    result.append("  ");

                    i++;

                } else if (c == '/' && next == '*') {

                    inBlockComment = true;

                    result.append("  ");

                    i++;

                } else if (c == '"') {

                    inString = true;

                    result.append(' ');

                } else if (c == '\'') {

                    inChar = true;

                    result.append(' ');

                } else {

                    result.append(c);
                }
            }
        }
        return result.toString();
    }

    public static MetricsResponse getMetrics(String sourceText) {

        String cleaned = stripCommentsAndStrings(sourceText);

        int bytes = sourceText.getBytes(StandardCharsets.UTF_8).length;

        String[] lines = sourceText.split("\\R", -1);

        int nonBlankLines = 0;

        int maxLineLengthFound = 0;

        for (String line : lines) {

            if (!line.trim().isEmpty()) {
                nonBlankLines++;
            }

            maxLineLengthFound =
                    Math.max(maxLineLengthFound,line.length());
        }

        int braceDepth = 0;

        int maxBraceDepthFound = 0;

        for (char c : cleaned.toCharArray()) {

            if (c == '{') {

                braceDepth++;

                maxBraceDepthFound = Math.max(maxBraceDepthFound, braceDepth);

            } else if (c == '}') {

                braceDepth--;
            }
        }

        int functionCount = countFunctions(cleaned);

        return new MetricsResponse(
                bytes,
                lines.length,
                nonBlankLines,
                functionCount,
                maxBraceDepthFound,
                maxLineLengthFound
        );
    }

}


