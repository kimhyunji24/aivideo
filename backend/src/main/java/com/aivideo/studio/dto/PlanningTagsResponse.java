package com.aivideo.studio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanningTagsResponse {
    private List<String> genreOptions;
    private List<String> styleOptions;
    private List<String> worldviewOptions;
    private List<String> selectedGenres;
    private List<String> selectedStyles;
    private List<String> selectedWorldviews;
}

