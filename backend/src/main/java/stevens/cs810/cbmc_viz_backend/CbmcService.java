package stevens.cs810.cbmc_viz_backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import stevens.cs810.cbmc_viz_backend.dto.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletableFuture;
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
            return ResponseEntity.status(400).body(new GenericErrorResponse("Request is empty", null, null, null));
        }
        if(request.source == null || request.source.trim().isEmpty()){
            return ResponseEntity.status(400).body(new GenericErrorResponse("Missing source code", null, null, null));
        }
        if(request.sourceName == null || request.sourceName.trim().isEmpty()) {
            return ResponseEntity.status(400).body(new GenericErrorResponse("Missing filename for code", null, null, null));
        }

        //Check if base64 is valid
        String sourceText;
        try{
            byte[] decoded = Base64.getDecoder().decode(request.source);
            sourceText = new String(decoded, StandardCharsets.UTF_8);
        }catch(Exception e){
            return ResponseEntity.status(400).body(new GenericErrorResponse("Invalid base64", List.of(e.getMessage()), null, null));
        }

        try{
            ComplexityGate.checkSource(sourceText);
        }catch(Exception e){
            return ResponseEntity.status(422).body(new ComplexityErrorResponse(List.of(e.getMessage()), ComplexityGate.getMetrics(sourceText), (new LimitsResponse()).limits));
        }

        //Check sourceName
        String sourceName;
        if(!request.sourceName.trim().endsWith(".c")){
            return ResponseEntity.status(400).body(new GenericErrorResponse("Source file name must end with '.c'", List.of(request.sourceName), null, null));
        }
        else{
            sourceName = request.sourceName.trim();
        }
        command.add(sourceName);

        //Make tmp directory to paste source text into new file named after sourceName
        Path tempDir, sourceFile;
        try {
            tempDir = Files.createTempDirectory("cbmc-viz");
            sourceFile = tempDir.resolve(sourceName);
            Files.writeString(sourceFile, sourceText, StandardCharsets.UTF_8);
        }catch(Exception e){
            return ResponseEntity.status(500).body(new GenericErrorResponse("CBMC failed to run", List.of(e.getMessage()), null, null));
        }

        //Check flags
        List<String> flags;
        if(request.flags == null){
            flags = new ArrayList<>();
            flags.add("--bounds-check");
        }else{
            try{
                flags = ComplexityGate.validateFlags(request.flags);
            }catch(Exception e){
                return ResponseEntity.status(400).body(new GenericErrorResponse("Flag in request not supported", List.of(e.getMessage()), null, null));
            }
        }
        command.addAll(flags);

        //Check unwind
        Integer unwind;
        if(request.unwind == null){
            unwind = 10;
        }else{
            if(request.unwind < 1){
                return ResponseEntity.status(400).body(new GenericErrorResponse("Unwind cannot be less than 1", null, null, null));
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
            try{
                entry = ComplexityGate.validateEntry(request.entry, sourceText);
            }catch (Exception e){
                return ResponseEntity.status(400).body(new GenericErrorResponse("Issue with entry function", List.of(e.getMessage()), null, null));
            }
            command.add("--function");
            command.add(entry);
        }

        //Run CBMC with given request body params
        String stdout;
        String stderr;
        int exitCode;

        try {
            //first check it runs with no trace and get stderr if it fails

            ProcessBuilder cbmcProcNoTrace = new ProcessBuilder(command);
            cbmcProcNoTrace.directory(tempDir.toFile());
            Process cbmcRunningNoTrace = cbmcProcNoTrace.start();
            boolean finished = cbmcRunningNoTrace.waitFor(timeoutMs, TimeUnit.MILLISECONDS);

            if (!finished) {
                cbmcRunningNoTrace.destroyForcibly();
                return ResponseEntity.status(504).body(new GenericErrorResponse("CBMC exceeded timeout of " + timeoutMs + "ms", null, null, null));
            }
            stderr = new String(cbmcRunningNoTrace.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();

            if(!stderr.isEmpty()){
                return ResponseEntity.status(500).body(new GenericErrorResponse(stderr, null, null, null));
            }

            System.out.println("Passed running with no trace so now run with trace");

            //Now run with trace
            command.add("--trace");
            command.add("--json-ui");
            ProcessBuilder cbmcProcWithTrace = new ProcessBuilder(command);
            cbmcProcWithTrace.directory(tempDir.toFile());
            Process cbmcRunningWithTrace = cbmcProcWithTrace.start();

            CompletableFuture<String> stdoutFuture = CompletableFuture.supplyAsync(() ->{
                try{
                    return new String(cbmcRunningWithTrace.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                } catch (Exception e) {
                    return "";
                }
            });

            finished = cbmcRunningWithTrace.waitFor(timeoutMs, TimeUnit.MILLISECONDS);

            if (!finished) {
                cbmcRunningWithTrace.destroyForcibly();
                return ResponseEntity.status(504).body(new GenericErrorResponse("CBMC exceeded timeout of " + timeoutMs + "ms", null, null, null));
            }

            stdout = stdoutFuture.get();
            exitCode = cbmcRunningWithTrace.exitValue();

            //convert stdout to JSON
            ObjectMapper mapper = new ObjectMapper();
            JsonNode trace = mapper.readTree(stdout);

            //Delete temp file and dir
            Files.deleteIfExists(sourceFile);
            Files.deleteIfExists(tempDir);

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
            return ResponseEntity.status(500).body(new GenericErrorResponse("CBMC failed to run", List.of(e.getMessage()), null, null));
        }

    }

}
