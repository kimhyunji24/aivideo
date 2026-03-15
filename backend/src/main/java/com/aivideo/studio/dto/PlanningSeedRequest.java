package com.aivideo.studio.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanningSeedRequest {
    private String idea;
    private String logline;
    private List<String> selectedGenres;
    private List<String> selectedWorldviews;
    private String userPrompt;
    private Integer stageCount;
}
