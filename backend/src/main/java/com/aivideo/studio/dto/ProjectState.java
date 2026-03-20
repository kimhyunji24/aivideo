package com.aivideo.studio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectState implements Serializable {
    private Integer id;
    private String idea;
    private String logline;
    private List<String> selectedGenres;
    private List<String> selectedWorldviews;
    private String planningPrompt;
    private Boolean charactersConfirmed;
    private List<Character> characters;
    private PlotPlan plotPlan;
    private List<Plot> generatedPlots;
    private Plot selectedPlot;
    private List<Scene> scenes;
    private String mode;
    /**
     * 에셋 라이브러리에서 사용자가 커스터마이즈한 에셋 데이터.
     * Key: 에셋 ID (예: "char-hero"), Value: 커스텀 이미지 URL + 설명
     * Imagen 3 이미지 생성 시 핀 고정 에셋의 description이 프롬프트에 반영됩니다.
     */
    private Map<String, CustomAssetData> customAssets;
}
