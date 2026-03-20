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
public class Plot implements Serializable {
    private String id;
    private String title;
    private String summary;
    private String tone;
    private Integer sceneCount;
    private List<Scene> scenes;
}
