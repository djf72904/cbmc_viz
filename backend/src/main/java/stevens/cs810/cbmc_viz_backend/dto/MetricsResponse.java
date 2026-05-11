package stevens.cs810.cbmc_viz_backend.dto;

public class MetricsResponse {

    public int maxBytes;

    public int maxLines;

    public int maxNonBlankLines;

    public int maxFunctions;

    public int maxBraceDepth;

    public int maxLineLength;


    public MetricsResponse(
            int maxBytes,
            int maxLines,
            int maxNonBlankLines,
            int maxFunctions,
            int maxBraceDepth,
            int maxLineLength
    ) {

        this.maxBytes = maxBytes;

        this.maxLines = maxLines;

        this.maxNonBlankLines = maxNonBlankLines;

        this.maxFunctions = maxFunctions;

        this.maxBraceDepth = maxBraceDepth;

        this.maxLineLength = maxLineLength;
    }
}