package stevens.cs810.cbmc_viz_backend;

import org.apache.coyote.Response;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import stevens.cs810.cbmc_viz_backend.dto.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class Controller {

    private final CbmcService cbmcService;

    public Controller(CbmcService cbmcService){
        this.cbmcService = cbmcService;
    }

    @GetMapping("/health")
    public HealthResponse health(){
       return cbmcService.health();
    }

    @GetMapping("/limits")
    public LimitsResponse limits(){
        return new LimitsResponse();
    }

    @GetMapping("/samples")
    public ResponseEntity<?> samples(){
        return this.cbmcService.samples();
    }

    @GetMapping(value="/samples/{name:.+}")
    public ResponseEntity<?> sample(@PathVariable String name){
        return this.cbmcService.singleSample(name);
    }

    @PostMapping("/analyze")
    public ResponseEntity<?> analyze(@RequestBody AnalyzeRequest request){
        return this.cbmcService.analyze(request);
    }



}
