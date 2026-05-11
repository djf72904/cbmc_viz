package stevens.cs810.cbmc_viz_backend.dto;

import stevens.cs810.cbmc_viz_backend.CbmcLimits;

import java.util.Set;

public class LimitsResponse {

    public int maxBytes;
    public int maxLines;
    public int maxNonBlankLines;
    public int maxFunctions;
    public int maxBraceDepth;
    public int maxLineLength;
    public Set<String> allowedIncludes;
    public Set<String> supportedFlags;
    public Set<String> blockedKeywords;

    public LimitsResponse() {

        this.maxBytes = CbmcLimits.MAX_BYTES;
        this.maxLines = CbmcLimits.MAX_LINES;
        this.maxNonBlankLines = CbmcLimits.MAX_NON_BLANK_LINES;
        this.maxFunctions = CbmcLimits.MAX_FUNCTIONS;
        this.maxBraceDepth = CbmcLimits.MAX_BRACE_DEPTH;
        this.maxLineLength = CbmcLimits.MAX_LINE_LENGTH;
        this.allowedIncludes = CbmcLimits.ALLOWED_INCLUDES;
        this.supportedFlags = CbmcLimits.SUPPORTED_FLAGS;
        this.blockedKeywords = CbmcLimits.BLOCKED_KEYWORDS;

    }
}