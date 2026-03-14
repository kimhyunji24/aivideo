package com.aivideo.studio.domain;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SceneElements {
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
