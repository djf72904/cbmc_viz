package stevens.cs810.cbmc_viz_backend;

import org.springframework.stereotype.Service;

@Service
public class CbmcService {

    public RunResponseDTO run(RunRequestDTO request) {
        return new RunResponseDTO();
    }
}
