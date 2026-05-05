package stevens.cs810.cbmc_viz_backend;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class Controller {

    private final CbmcService cbmcService;

    public Controller(CbmcService cbmcService){
        this.cbmcService = cbmcService;
    }

    @PostMapping("/run")
    public RunResponseDTO runCbmc(@RequestBody RunRequestDTO request){
        return this.cbmcService.run(request);
    }

}
