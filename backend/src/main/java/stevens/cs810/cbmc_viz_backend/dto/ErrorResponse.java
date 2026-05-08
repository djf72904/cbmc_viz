package stevens.cs810.cbmc_viz_backend.dto;

import java.util.List;
import java.util.Map;

public class ErrorResponse {

    public String error;                //Sent as message for 422 Error
    public List<String> reasons;        //Reasons for error
    public Map<String, Object> metrics; //Metrics of file sent
    public Map<String, Object> limits;  //Limits of program

    public ErrorResponse(
            List<String> reasons,
            Map<String, Object> metrics,
            Map<String, Object> limits){

        this.error = "Source exceeds the project's complexity limits";
        this.reasons = reasons;
        this.metrics = metrics;
        this.limits = limits;
    }
}
