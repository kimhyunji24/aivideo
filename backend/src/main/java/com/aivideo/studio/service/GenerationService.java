package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.dto.Scene;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenerationService {

    private final SessionService sessionService;
    private final ImagenAdapter imagenAdapter;
    private final GeminiAdapter geminiAdapter;
    private final VeoAdapter veoAdapter;

    /**
     * 특정 씬의 이미지를 Imagen 3로 생성합니다.
     * 씬의 prompt가 비어있거나 한국어인 경우, Gemini를 통해 영어 프롬프트로 변환합니다.
     *
     * @param sessionId 세션 ID
     * @param sceneId   이미지를 생성할 씬 ID
     * @return 이미지 URL이 업데이트된 씬 객체
     */
    public Scene generateImageForScene(String sessionId, String sceneId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        // 대상 씬 조회
        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);

        // 상태를 generating으로 변경 후 저장
        target.setStatus("generating");
        sessionService.updateSession(sessionId, state);

        try {
            // 영어 프롬프트 준비 (없으면 Gemini로 자동 생성)
            String englishPrompt = buildEnglishPrompt(target);
            log.info("[GenerationService] 씬 {} 이미지 생성 시작 — 프롬프트: {}", sceneId, englishPrompt);

            // Imagen 3 이미지 생성
            String imageUrl = imagenAdapter.generateImage(englishPrompt, sceneId);

            // 세션에 이미지 URL 저장
            target.setImageUrl(imageUrl);
            target.setStatus("done");
            sessionService.updateSession(sessionId, state);

            log.info("[GenerationService] 씬 {} 이미지 생성 완료 — imageUrl: {}", sceneId, imageUrl);
            return target;

        } catch (Exception e) {
            log.error("[GenerationService] 씬 {} 이미지 생성 실패", sceneId, e);
            target.setStatus("error");
            sessionService.updateSession(sessionId, state);
            throw new RuntimeException("이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 세션의 모든 씬에 대해 이미지를 순차 생성합니다.
     *
     * @param sessionId 세션 ID
     * @return imageUrl이 채워진 씬 목록
     */
    public List<Scene> generateAllImages(String sessionId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        return state.getScenes().stream()
                .filter(s -> !"done".equals(s.getStatus()))
                .map(s -> {
                    try {
                        return generateImageForScene(sessionId, String.valueOf(s.getId()));
                    } catch (Exception e) {
                        log.error("[GenerationService] 씬 {} 스킵 (오류: {})", s.getId(), e.getMessage());
                        return s;
                    }
                })
                .collect(Collectors.toList());
    }

    // ─── Private 헬퍼 ────────────────────────────────────────────────────────

    /**
     * 씬의 영어 이미지 생성 프롬프트를 반환합니다.
     * 이미 영어 prompt가 있으면 사용하고, 없으면 씬 정보를 바탕으로 Gemini가 생성합니다.
     */
    private String buildEnglishPrompt(Scene scene) {
        // 이미 영어 prompt가 있으면 그대로 사용
        if (scene.getPrompt() != null && !scene.getPrompt().isBlank()) {
            return scene.getPrompt();
        }

        // 씬 정보를 조합해 Gemini에게 영어 프롬프트 생성 요청
        String koreanInfo = buildKoreanSceneDescription(scene);
        String geminiPrompt = "다음 씬 정보를 바탕으로 Imagen 이미지 생성에 사용할 영어 프롬프트를 작성해줘. " +
                "프롬프트만 출력하고 다른 설명은 하지 마. 영문으로만 작성해.\n\n씬 정보:\n" + koreanInfo;

        return geminiAdapter.generateText(geminiPrompt).trim();
    }

    private String buildKoreanSceneDescription(Scene scene) {
        StringBuilder sb = new StringBuilder();
        sb.append("제목: ").append(scene.getTitle()).append("\n");
        sb.append("설명: ").append(scene.getDescription()).append("\n");

        if (scene.getElements() != null) {
            var el = scene.getElements();
            appendIfNotEmpty(sb, "배경", el.getBackground());
            appendIfNotEmpty(sb, "분위기", el.getMood());
            appendIfNotEmpty(sb, "조명", el.getLighting());
            appendIfNotEmpty(sb, "구도", el.getComposition());
            appendIfNotEmpty(sb, "시간대", el.getTime());
            appendIfNotEmpty(sb, "메인 캐릭터", el.getMainCharacter());
            appendIfNotEmpty(sb, "행동", el.getAction());
        }
        return sb.toString();
    }

    private void appendIfNotEmpty(StringBuilder sb, String label, String value) {
        if (value != null && !value.isBlank()) {
            sb.append(label).append(": ").append(value).append("\n");
        }
    }

    /**
     * 씬의 현재 상태를 조회합니다 (프론트엔드 폴링용).
     */
    public Scene getSceneStatus(String sessionId, String sceneId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        Scene scene = findScene(state.getScenes(), sceneId);
        if (scene == null) throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);
        return scene;
    }

    private Scene findScene(List<Scene> scenes, String sceneId) {
        if (scenes == null) return null;
        return scenes.stream()
                .filter(s -> String.valueOf(s.getId()).equals(sceneId))
                .findFirst()
                .orElse(null);
    }

    /**
     * Phase 3: 이미지가 생성된 씬(의 imageUrl)을 바탕으로 Veo 3.1 모델을 호출하여 영상을 생성
     */
    public void generateVideo(String sessionId, Object sceneId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) {
            throw new RuntimeException("Session not found: " + sessionId);
        }

        Scene target = null;
        for (Scene s : state.getScenes()) {
            if (s.getId().equals(sceneId)) {
                target = s;
                break;
            }
        }

        if (target == null) {
            throw new RuntimeException("Scene not found: " + sceneId);
        }

        if (target.getImageUrl() == null || target.getImageUrl().isEmpty()) {
            throw new RuntimeException("기준 이미지가 먼저 생성되어야 영상을 만들 수 있습니다.");
        }

        // 상태를 생성 중으로 업데이트
        target.setStatus("generating_video");
        sessionService.updateSession(sessionId, state);

        try {
            // 카메라 워킹 및 추가 모션 프롬프트 구성을 위해 한국어 씬 설명 번역
            String koreanPrompt = buildKoreanSceneDescription(target);
            String englishPrompt = geminiAdapter.generateText(
                "Translate this scene description to a highly detailed, cinematic English prompt for an AI video generator. Only provide the translated prompt without any conversational text:\n" + koreanPrompt
            ) + " Cinematic, realistic motion, highly detailed.";

            // VeoAdapter를 통해 영상 생성 진행 (이미지 URL과 영문 프롬프트 전달 구조)
            // 현재 버전은 프롬프트를 우선으로 넘기는 것으로 구현됨
            String videoUrl = veoAdapter.generateVideo(target, englishPrompt);

            // 생성 완료 시 상태 갱신
            target.setVideoUrl(videoUrl);
            target.setStatus("completed");
            log.info("Finished video generation for scene: {}. URL: {}", sceneId, videoUrl);
        } catch (Exception e) {
            log.error("Failed to generate video for scene: {}", sceneId, e);
            target.setStatus("error");
        }

        sessionService.updateSession(sessionId, state);
    }
}
