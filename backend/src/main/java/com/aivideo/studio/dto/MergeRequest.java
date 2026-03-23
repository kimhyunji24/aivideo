package com.aivideo.studio.dto;

import lombok.Data;
import java.util.List;

@Data
public class MergeRequest {
    private List<String> sceneIds;
    /** crossfade | fadeblack | slideleft | cut | none */
    private String transitionType = "crossfade";
    private double transitionDuration = 1.0;
}
