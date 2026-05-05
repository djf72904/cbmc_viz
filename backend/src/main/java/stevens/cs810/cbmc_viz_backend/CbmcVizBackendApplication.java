package stevens.cs810.cbmc_viz_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CbmcVizBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(CbmcVizBackendApplication.class, args);
        System.out.println("Server running on http://localhost:8080/home");
    }

}
