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
public class PlanningSeedResponse {
    private String source; // "mock" | "gemini"
    private List<CharacterSeed> characters;
    private PlotPlanSeed plotPlan;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CharacterSeed {
        private String id;
        private String name;
        private String gender; // "male" | "female"
        private String appearance;
        private String personality;
        private String values;
        private String trauma;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlotPlanSeed {
        private Integer stageCount;
        private List<PlotStageSeed> stages;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlotStageSeed {
        private String id;
        private String label;
        private String content;
    }
}

