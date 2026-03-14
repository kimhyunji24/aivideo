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
public class ProjectResponse {
    private Long id;
    private String idea;
    private String mode;
    private String finalVideoUrl;
    private List<PlotResponse> generatedPlots;
    private List<SceneResponse> scenes;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getIdea() { return idea; }
    public void setIdea(String idea) { this.idea = idea; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getFinalVideoUrl() { return finalVideoUrl; }
    public void setFinalVideoUrl(String finalVideoUrl) { this.finalVideoUrl = finalVideoUrl; }
    public List<PlotResponse> getGeneratedPlots() { return generatedPlots; }
    public void setGeneratedPlots(List<PlotResponse> generatedPlots) { this.generatedPlots = generatedPlots; }
    public List<SceneResponse> getScenes() { return scenes; }
    public void setScenes(List<SceneResponse> scenes) { this.scenes = scenes; }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlotResponse {
        private String id;
        private String title;
        private String summary;
        private String tone;
        private Integer sceneCount;
        private List<SceneResponse> scenes;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getSummary() { return summary; }
        public void setSummary(String summary) { this.summary = summary; }
        public String getTone() { return tone; }
        public void setTone(String tone) { this.tone = tone; }
        public Integer getSceneCount() { return sceneCount; }
        public void setSceneCount(Integer sceneCount) { this.sceneCount = sceneCount; }
        public List<SceneResponse> getScenes() { return scenes; }
        public void setScenes(List<SceneResponse> scenes) { this.scenes = scenes; }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SceneResponse {
        private Long id;
        private String title;
        private String description;
        private String prompt;
        private String imageUrl;
        private String videoUrl;
        private Integer duration;
        private String status;
        private Long seed;
        private ProjectRequest.SceneElementsDto elements;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getPrompt() { return prompt; }
        public void setPrompt(String prompt) { this.prompt = prompt; }
        public String getImageUrl() { return imageUrl; }
        public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
        public String getVideoUrl() { return videoUrl; }
        public void setVideoUrl(String videoUrl) { this.videoUrl = videoUrl; }
        public Integer getDuration() { return duration; }
        public void setDuration(Integer duration) { this.duration = duration; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public Long getSeed() { return seed; }
        public void setSeed(Long seed) { this.seed = seed; }
        public ProjectRequest.SceneElementsDto getElements() { return elements; }
        public void setElements(ProjectRequest.SceneElementsDto elements) { this.elements = elements; }
    }
}
