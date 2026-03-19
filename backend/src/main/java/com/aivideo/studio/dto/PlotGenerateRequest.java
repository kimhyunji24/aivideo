package com.aivideo.studio.dto;

import lombok.Data;

@Data
public class PlotGenerateRequest {
    private int stageCount;
    private String userPrompt;
}
