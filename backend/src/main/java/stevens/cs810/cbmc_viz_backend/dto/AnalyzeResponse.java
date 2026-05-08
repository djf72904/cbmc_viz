package stevens.cs810.cbmc_viz_backend.dto;

import tools.jackson.databind.JsonNode;

import java.util.List;

public class AnalyzeResponse {

    public JsonNode trace;      //output trace of cbmc
    public String sourceText;   //decoded source as string
    public String sourceName;   //name of file
    public String stderr;       //null if empty, result is string of error
    public int exitCode;        //exitCode of result
    public List<String> flagsUsed;  //array of strings that tell which flags were used
    public String entry;        //entry function
    public int unwind;          //upper bound for unwind when using CBMC

    //Constructor to build object
    public AnalyzeResponse(
            JsonNode trace,
            String sourceText,
            String sourceName,
            String stderr,
            int exitCode,
            List<String> flagsUsed,
            String entry,
            int unwind ){

        this.trace = trace;
        this.sourceText = sourceText;
        this.sourceName = sourceName;
        this.stderr = stderr;
        this.exitCode = exitCode;
        this.flagsUsed = flagsUsed;
        this.entry = entry;
        this.unwind = unwind;
    }

}
