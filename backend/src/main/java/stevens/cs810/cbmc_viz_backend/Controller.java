package stevens.cs810.cbmc_viz_backend;

import org.springframework.web.bind.annotation.*;
import stevens.cs810.cbmc_viz_backend.dto.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5181")
public class Controller {

    @GetMapping("/health")
    public HealthResponse health(){
        return new HealthResponse(
                true,
                false,
                null,
                "STILL NEED IMPLEMENTATION"
        );
    }

    @GetMapping("/limits")
    public Map<String, Object> limits(){
        return Map.of("limits", Map.of(
                        "maxBytes", 16384,
                        "maxLines", 200
                ),

                "allowedIncludes", List.of(
                        "stdio.h",
                        "stdlib.h"
                ),

                "blockedFeatures", List.of(
                        "goto is not supported"
                ),

                "supportedFlags", List.of(
                        "--bounds-check"
                ));
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
    public AnalyzeResponse analyze(@RequestBody AnalyzeRequest request){
        return new AnalyzeResponse(
                null,
                "fake source",
                request.sourceName,
                null,
                0,
                List.of("--bounds-check"),
                request.entry,
                request.unwind);
    }



}
