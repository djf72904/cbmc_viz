package stevens.cs810.cbmc_viz_backend.dto;

import java.util.List;

public class SampleInfo {

    public String name;         //name of sample c file
    public String title;        //title of sample
    public String description;  //description of error
    public List<String> flags;      //list of flags used in sample

    public SampleInfo(
            String name,
            String title,
            String description,
            List<String> flags){

        this.name = name;
        this.title = title;
        this.description = description;
        this.flags = flags;
    }
}
