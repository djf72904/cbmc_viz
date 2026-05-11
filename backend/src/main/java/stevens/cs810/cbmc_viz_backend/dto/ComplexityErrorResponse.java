package stevens.cs810.cbmc_viz_backend.dto;

import java.util.List;

public class ComplexityErrorResponse {

    public String error;                //Sent as message for 422 Error
    public List<String> reasons;        //Reasons for error
    public MetricsResponse metrics; //Metrics of file sent
    public LimitsResponse limits;  //Limits of program

    public ComplexityErrorResponse(
            List<String> reasons,
            MetricsResponse metrics,
            LimitsResponse limits){

        this.error = "Source exceeds the project's complexity limits";
        this.reasons = reasons;
        this.metrics = metrics;
        this.limits = limits;
    }
}
