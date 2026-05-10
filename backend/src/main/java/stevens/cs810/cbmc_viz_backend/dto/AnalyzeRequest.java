package stevens.cs810.cbmc_viz_backend.dto;

public class AnalyzeRequest {

    public String source;       //c source code in base64
    public String sourceName;   //name of file
    public String flags;        //comma separated flags for cbmc
    public String entry;        //entry function name
    public Integer unwind;          //loop unwind bound

    //empty constructor for Spring JSON deserialization to use
    public AnalyzeRequest(){};

}
