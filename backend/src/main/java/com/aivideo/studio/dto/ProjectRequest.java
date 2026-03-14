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
public class ProjectRequest {
    private String idea;
    private String mode;
    private List<SceneRequest> scenes;

    public String getIdea() { return idea; }
    public void setIdea(String idea) { this.idea = idea; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public List<SceneRequest> getScenes() { return scenes; }
    public void setScenes(List<SceneRequest> scenes) { this.scenes = scenes; }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SceneRequest {
        private String title;
        private String description;
        private String prompt;
        private Integer duration;
        private SceneElementsDto elements;

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getPrompt() { return prompt; }
        public void setPrompt(String prompt) { this.prompt = prompt; }
        public Integer getDuration() { return duration; }
        public void setDuration(Integer duration) { this.duration = duration; }
        public SceneElementsDto getElements() { return elements; }
        public void setElements(SceneElementsDto elements) { this.elements = elements; }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SceneElementsDto {
        private String mainCharacter;
        private String subCharacter;
        private String action;
        private String pose;
        private String background;
        private String time;
        private String composition;
        private String lighting;
        private String mood;
        private String story;

        public String getMainCharacter() { return mainCharacter; }
        public void setMainCharacter(String mainCharacter) { this.mainCharacter = mainCharacter; }
        public String getSubCharacter() { return subCharacter; }
        public void setSubCharacter(String subCharacter) { this.subCharacter = subCharacter; }
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        public String getPose() { return pose; }
        public void setPose(String pose) { this.pose = pose; }
        public String getBackground() { return background; }
        public void setBackground(String background) { this.background = background; }
        public String getTime() { return time; }
        public void setTime(String time) { this.time = time; }
        public String getComposition() { return composition; }
        public void setComposition(String composition) { this.composition = composition; }
        public String getLighting() { return lighting; }
        public void setLighting(String lighting) { this.lighting = lighting; }
        public String getMood() { return mood; }
        public void setMood(String mood) { this.mood = mood; }
        public String getStory() { return story; }
        public void setStory(String story) { this.story = story; }
    }
}
