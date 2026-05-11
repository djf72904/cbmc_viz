package stevens.cs810.cbmc_viz_backend.dto;

import java.util.List;

public class GenericErrorResponse {

    public String error;            //human-readable error
    public List<String> reasons;    //reasons for error
    public String hint;             //hint to fix error
    public String detail;           //details on hint

    public GenericErrorResponse(
            String error,
            List<String> reasons,
            String hint,
            String detail
    ){
        this.error = error;
        this.reasons = reasons;
        this.hint = hint;
        this.detail = detail;
    }
}
