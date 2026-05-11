package stevens.cs810.cbmc_viz_backend;

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
    public Map<String, List<SampleInfo>> samples(){
        return Map.of("samples",
                List.of(
                        new SampleInfo(
                                "array_oob.c",
                                "Array OOB",
                                "Off-by-one bug",
                                List.of("--bounds-check")
                        )
                ));
    }

    @GetMapping(value="/samples/{name}", produces="text/x-c;charset=UTF-8")
    public String sample(@PathVariable String name){
        return "int main(void){" +
                "   return 0;" +
                "}";
    }

    @PostMapping("/analyze")
    public ResponseEntity<?> analyze(@RequestBody AnalyzeRequest request){
        return cbmcService.analyze(request);
    }



}
