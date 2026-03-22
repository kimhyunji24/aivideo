package com.aivideo.studio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectState implements Serializable {
    private Integer id;
    private String idea;
    private String logline;
    private List<String> selectedGenres;
    private List<String> selectedStyles;
    private List<String> selectedWorldviews;
    private String planningPrompt;
    private Boolean charactersConfirmed;
    private List<Character> characters;
    private PlotPlan plotPlan;
    private List<Plot> generatedPlots;
    private Plot selectedPlot;
    private List<Scene> scenes;
    private String mode;
    private String backgroundReferenceImageUrl;
    private String backgroundReferenceDescription;
}
