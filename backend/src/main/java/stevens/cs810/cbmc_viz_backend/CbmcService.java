package stevens.cs810.cbmc_viz_backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import stevens.cs810.cbmc_viz_backend.dto.AnalyzeRequest;
import stevens.cs810.cbmc_viz_backend.dto.AnalyzeResponse;
import stevens.cs810.cbmc_viz_backend.dto.HealthResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class CbmcService {

    //Location of cbmc binary
    @Value("${cbmcviz.cbmc-bin}")
    private String cbmcBin;

    //Timeout for cbmc process
    @Value("${cbmcviz.timeout-ms}")
    private int timeoutMs;

    //Directory containing samples
    @Value("${cbmcviz.samples-dir}")
    private String samplesDir;


    //Run cbmc for health check
    public HealthResponse health(){

        String version;
        String error;
        int exitValue;

        HealthResponse response;

        try{

            Process cbmcProc = new ProcessBuilder(cbmcBin, "--version").start();
            boolean finished = cbmcProc.waitFor(5, TimeUnit.SECONDS);

            if(!finished){
                cbmcProc.destroyForcibly();

                return new HealthResponse(true, false, null, "CBMC version check timed out");
            }

            version = new String(cbmcProc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            error = new String(cbmcProc.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            exitValue = cbmcProc.exitValue();

            if (exitValue == 0){
                response = new HealthResponse(
                        true,
                        true,
                        version,
                        null
                );
            }
            else{
                response = new HealthResponse(
                        true,
                        false,
                        null,
                        error
                );
            }

            return response;

        } catch (Exception e) {
            response = new HealthResponse(
                    true,
                    false,
                    null,
                    "CBMC failed to run: " + e.getMessage()
            );

            return response;
        }
    }

    public ResponseEntity<?> analyze(AnalyzeRequest request){

        List<String> command = new ArrayList<>();
        command.add(cbmcBin);

        //Check request has necessary fields

        if(request == null){
            return ResponseEntity.status(400).body("Request Body missing");
        }
        if(request.source == null || request.source.trim().isEmpty()){
            return ResponseEntity.status(400).body("Missing source code");
        }
        if(request.sourceName == null || request.sourceName.trim().isEmpty()) {
            return ResponseEntity.status(400).body("Missing filename for code");
        }

        //Check if base64 is valid
        String sourceText;
        try{
            byte[] decoded = Base64.getDecoder().decode(request.source);
            sourceText = new String(decoded, StandardCharsets.UTF_8);
        }catch(Exception e){
            return ResponseEntity.status(400).body("Invalid base64: " + e.getMessage());
        }

        //sourceText = complexityCheck

        //Check sourceName
        String sourceName;
        if(!request.sourceName.trim().endsWith(".c")){
            return ResponseEntity.status(400).body("Source file name must end with '.c'");
        }
        else{
            sourceName = request.sourceName.trim();
        }
        command.add(sourceName);

        //Make tmp directory to paste source text into new file named after sourceName
        Path tempDir;
        try {
            tempDir = Files.createTempDirectory("cbmc-viz");
            Path sourceFile = tempDir.resolve(sourceName);
            Files.writeString(sourceFile, sourceText, StandardCharsets.UTF_8);
        }catch(Exception e){
            return ResponseEntity.status(500).body("CBMC failed to run: " + e.getMessage());
        }


        //Check flags
        List<String> flags = new ArrayList<>();
        if(request.flags == null){
            flags.add("--bounds-check");
        }else{
            //flags = complexityCheck
        }
        command.addAll(flags);

        //Check unwind
        Integer unwind;
        if(request.unwind == null){
            unwind = 10;
        }else{
            if(request.unwind < 1){
                return ResponseEntity.status(400).body("Unwind cannot be less than 1");
            }
            else{
                unwind = request.unwind;
            }
        }
        command.add("--unwind");
        command.add(String.valueOf(unwind));

        //Check entry
        String entry;
        if (request.entry == null || request.entry.trim().isEmpty()){
            entry = null;
        }
        else{
            //entry == complexitycheck
            command.add(entry);
        }

        //Run CBMC with given request body params
        String stdout;
        String stderr;
        int exitCode;

        try {
            //first check it runs with no trace

            ProcessBuilder cbmcProcNoTrace = new ProcessBuilder(command);
            cbmcProcNoTrace.directory(tempDir.toFile());
            cbmcProcNoTrace(tempDir.toFile());
            cbmcProcNoTrace.start();
            boolean finished = cbmcProcNoTrace.waitFor(timeoutMs, TimeUnit.MILLISECONDS);

            if (!finished) {
                cbmcProcNoTrace.destroyForcibly();
                return ResponseEntity.status(504).body("CBMC exceeded timeout of " + timeoutMs + "ms");
            }
            stderr = new String(cbmcProcNoTrace.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();

            if(!stderr.isEmpty()){
                return ResponseEntity.status(500).body(stderr);
            }

            //Now run with trace
            command.add("--trace");
            command.add("--json-ui");
            Process cbmcProcWithTrace = new ProcessBuilder(command).start();
            finished = cbmcProcWithTrace.waitFor(timeoutMs, TimeUnit.MILLISECONDS);

            if (!finished) {
                cbmcProcWithTrace.destroyForcibly();
                return ResponseEntity.status(504).body("CBMC exceeded timeout of " + timeoutMs + "ms");
            }

            stdout = new String(cbmcProcWithTrace.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            exitCode = cbmcProcWithTrace.exitValue();

            //convert stdout to JSON
            ObjectMapper mapper = new ObjectMapper();
            JsonNode trace = mapper.readTree(stdout);

            return ResponseEntity.status(200).body(
                    new AnalyzeResponse(
                            trace,
                            sourceText,
                            sourceName,
                            null,
                            exitCode,
                            flags,
                            entry,
                            unwind
                    ));

        }
        catch (Exception e){
            return ResponseEntity.status(500).body("CBMC failed to run: " + e.getMessage());
        }

    }

}
