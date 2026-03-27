package com.aivideo.studio.dto;

import lombok.Data;
import java.util.List;

@Data
public class MergeRequest {
    private List<String> sceneIds;
    /** crossfade | fadeblack | slideleft | cut | none */
    private String transitionType = "crossfade";
    private double transitionDuration = 1.0;
    /** 업로드된 음악 파일 식별자 (선택) */
    private String musicFileId;
    /** 배경음악 볼륨 0~100 (기본 70) */
    private int musicVolume = 70;
}
