package com.aivideo.studio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SceneElements implements Serializable {
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
}
