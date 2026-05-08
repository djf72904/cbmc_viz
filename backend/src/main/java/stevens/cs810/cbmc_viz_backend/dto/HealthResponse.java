package stevens.cs810.cbmc_viz_backend.dto;

public class HealthResponse {

    public boolean ok;              //boolean on if server is live
    public boolean cbmcAvailable;   //true if cbmc --version exits with 0
    public String cbmcVersion;      //current version running of cbmc
    public String error;            //Error message if cbmc not available

    public HealthResponse(
            boolean ok,
            boolean cbmcAvailable,
            String cbmcVersion,
            String error){

        this.ok = ok;
        this.cbmcAvailable = cbmcAvailable;
        this.cbmcVersion = cbmcVersion;
        this.error = error;
    }
}
