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
    /** 마지막 생성 실패 코드 (정책 차단/일시 오류/입력 오류 등) */
    private String lastErrorCode;
    /** 사용자에게 보여줄 마지막 생성 실패 메시지 */
    private String lastErrorMessage;
    /** 마지막 생성 실패가 재시도 가능한지 여부 */
    private Boolean lastErrorRetryable;
    /** 문제 추적용 마지막 생성 실패 요청 ID */
    private String lastErrorRequestId;
    /** 에셋 라이브러리에서 이 씬에 핀 고정된 에셋 ID 목록 */
    private List<String> pinnedAssets;
    private List<Frame> frames;
}
