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
public class Character implements Serializable {
    private String id;
    private String name;
    private String imageUrl;
    private String gender;
    private String appearance;
    private String personality;
    private String values;
    private String trauma;
    /** 캐릭터 레퍼런스 이미지 URL 목록 (최대 10개: 베이스 + 표정/앵글 변형) */
    private List<String> referenceImageUrls;
}
