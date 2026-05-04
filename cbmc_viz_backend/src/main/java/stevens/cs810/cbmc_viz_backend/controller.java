package stevens.cs810.cbmc_viz_backend;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class controller {

    @GetMapping("/test")
    public String test(){
        return "Backend is working";
    }

}
