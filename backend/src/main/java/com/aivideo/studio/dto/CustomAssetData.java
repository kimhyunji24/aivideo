package com.aivideo.studio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

/**
 * 사용자가 에셋 라이브러리에서 커스터마이즈한 에셋 데이터.
 * ProjectState.customAssets Map의 value로 사용됩니다.
 * 예) customAssets["char-hero"] = { imageUrl: "data:image/...", description: "영웅적인 외모의 주인공" }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomAssetData implements Serializable {
    /** 사용자가 업로드한 에셋 이미지 URL (base64 data URL 또는 외부 URL) */
    private String imageUrl;
    /** 사용자가 직접 수정한 에셋 설명 — Imagen 3 프롬프트에 포함됨 */
    private String description;
}
