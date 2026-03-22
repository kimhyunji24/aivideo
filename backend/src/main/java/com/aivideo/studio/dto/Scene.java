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
public class Scene implements Serializable {
    private Object id;
    private String title;
    private String description;
    private String prompt;
    private String imageUrl;
    private String videoUrl;
    private Integer duration;
    private String status;
    private SceneElements elements;
    private SceneParams params;
    private String styleChip;
    private List<Frame> frames;
}
