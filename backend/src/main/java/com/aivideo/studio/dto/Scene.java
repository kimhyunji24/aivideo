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
    /** 에셋 라이브러리에서 이 씬에 핀 고정된 에셋 ID 목록 */
    private List<String> pinnedAssets;
    private List<Frame> frames;
}
