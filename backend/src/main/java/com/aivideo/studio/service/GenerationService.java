package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.dto.Scene;
import com.aivideo.studio.dto.Frame;
import com.aivideo.studio.dto.CustomAssetData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
            String englishPrompt = buildEnglishPrompt(target, state);
            log.info("[GenerationService] 씬 {} 이미지 생성 시작 — 프롬프트: {}", sceneId, englishPrompt);

            // Imagen 3 이미지 생성 - 캐릭터/스타일 일관성을 위해 Scene ID 기반의 고정 Seed 사용
            Integer seed = sceneId.hashCode() & 0x7FFFFFFF;
            String imageUrl = imagenAdapter.generateImage(englishPrompt, sceneId, seed);

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
        if (state.getScenes() == null || state.getScenes().isEmpty()) {
            return List.of();
        }

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

    /**
     * 특정 씬에 프레임을 1개 추가합니다. (최대 4개)
     */
    public Frame addFrameToScene(String sessionId, String sceneId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);

        List<Frame> frames = target.getFrames() == null ? new ArrayList<>() : new ArrayList<>(target.getFrames());
        if (frames.size() >= 4) {
            throw new IllegalArgumentException("프레임은 최대 4개까지 추가할 수 있습니다.");
        }

        Frame newFrame = Frame.builder()
                .id("f-" + System.currentTimeMillis())
                .script("")
                .imageUrl(null)
                .build();

        frames.add(newFrame);
        target.setFrames(frames);
        sessionService.updateSession(sessionId, state);
        return newFrame;
    }

    /**
     * 특정 씬의 프레임 이미지를 생성합니다.
     * frameId가 없으면 첫 프레임을 사용하고, 프레임이 없으면 자동 생성합니다.
     */
    public Frame generateFrameForScene(String sessionId, String sceneId, String frameId, String frameScript) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);

        List<Frame> frames = target.getFrames() == null ? new ArrayList<>() : new ArrayList<>(target.getFrames());
        if (frames.isEmpty()) {
            Frame seed = Frame.builder()
                    .id(resolveFrameId(frameId, 0))
                    .script(firstNonBlank(frameScript, target.getDescription(), target.getPrompt()))
                    .imageUrl(target.getImageUrl())
                    .build();
            frames.add(seed);
        }

        Frame targetFrame = findFrame(frames, frameId);
        if (targetFrame == null) {
            if (frames.size() >= 4) {
                throw new IllegalArgumentException("프레임은 최대 4개까지 추가할 수 있습니다.");
            }
            targetFrame = Frame.builder()
                    .id(resolveFrameId(frameId, frames.size()))
                    .script("")
                    .imageUrl(null)
                    .build();
            frames.add(targetFrame);
        }

        if (frameScript != null && !frameScript.isBlank()) {
            targetFrame.setScript(frameScript.trim());
        }

        int targetIndex = frames.indexOf(targetFrame);
        if (frames.size() >= 3 && targetIndex > 0 && targetIndex < frames.size() - 1) {
            Frame startFrame = frames.get(0);
            Frame endFrame = frames.get(frames.size() - 1);
            if (!hasGeneratedImage(startFrame) || !hasGeneratedImage(endFrame)) {
                throw new IllegalArgumentException("프레임이 3개 이상이면 Start/End 프레임 이미지를 먼저 생성해야 합니다.");
            }
        }

        String prompt = firstNonBlank(
                targetFrame.getScript(),
                target.getPrompt(),
                target.getDescription()
        );

        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("프레임 생성에 사용할 script 또는 scene prompt가 필요합니다.");
        }

        Frame startFrame = frames.isEmpty() ? null : frames.get(0);
        
        // 프레임 대본(한국어)을 영어 프롬프트로 변환 (Start Frame 일관성 유지 포함)
        String englishPrompt = buildEnglishFramePrompt(prompt, startFrame, targetFrame, state);
        log.info("[GenerationService] 씬 {}, 프레임 {} 이미지 생성 — 원본: {}, 번역: {}", sceneId, targetFrame.getId(), prompt, englishPrompt);

        // 일관성(캐릭터/의상 유지)을 위해 해당 Scene ID를 기반으로 고정된 Seed 추출
        Integer seed = sceneId.hashCode() & 0x7FFFFFFF;
        String imageUrl = imagenAdapter.generateImage(englishPrompt, buildFrameSceneKey(sceneId, targetFrame.getId()), seed);
        targetFrame.setImageUrl(imageUrl);
        if (targetFrame.getScript() == null || targetFrame.getScript().isBlank()) {
            targetFrame.setScript(prompt); // 원본 한국어 스크립트 유지
        }

        target.setFrames(frames);
        sessionService.updateSession(sessionId, state);
        return targetFrame;
    }

    // ─── Private 헬퍼 ────────────────────────────────────────────────────────

    /**
     * 프레임의 한국어 대본을 영어 프롬프트로 변환하며, Start Frame 정보를 바탕으로 컨텍스트를 유지합니다.
     */
    private String buildEnglishFramePrompt(String koreanScript, Frame startFrame, Frame currentFrame, ProjectState state) {
        StringBuilder geminiPrompt = new StringBuilder();
        geminiPrompt.append("You are an expert prompt engineer for AI image generators. We are creating sequential frames for a single scene. Consistency of characters, clothing, and background is CRITICAL.\n\n");
        
        boolean isNotStartFrame = startFrame != null && !startFrame.getId().equals(currentFrame.getId());
        
        if (state.getCharacters() != null && !state.getCharacters().isEmpty()) {
            geminiPrompt.append("[Main Characters Info]\n");
            for (var c : state.getCharacters()) {
                geminiPrompt.append("- ").append(c.getName()).append(": ").append(c.getAppearance()).append("\n");
            }
            geminiPrompt.append("\n");
        }

        if (isNotStartFrame && startFrame.getScript() != null && !startFrame.getScript().isBlank()) {
             geminiPrompt.append("[Start Frame Description (Reference for Consistency)]\n");
             geminiPrompt.append(startFrame.getScript()).append("\n\n");
             geminiPrompt.append("Task: Translate the [Current Frame Script] into a highly detailed English image generation prompt.\n");
             geminiPrompt.append("CRITICAL REQUIREMENT: To ensure visual consistency with the Start Frame, you MUST explicitly re-use the specific exact descriptions of the characters, their existing clothing/outfits, and the background/environment derived from the [Start Frame Description]. Then, apply the new action, pose, or camera angle from the [Current Frame Script].\n\n");
        } else {
             geminiPrompt.append("Task: Translate the [Current Frame Script] into a highly detailed English image generation prompt.\n");
             geminiPrompt.append("Make sure to explicitly include the detailed descriptions of the characters from the [Main Characters Info] if they appear in the script.\n\n");
        }
        
        geminiPrompt.append("[Current Frame Script]\n").append(koreanScript).append("\n\n");
        geminiPrompt.append("Output ONLY the translated, highly detailed English prompt, without any conversational text or markdown formatting. The prompt should be ready to be passed directly to an image generation model.");

        return geminiAdapter.generateText(geminiPrompt.toString()).trim();
    }

    /**
     * 씬의 영어 이미지 생성 프롬프트를 반환합니다.
     * 이미 영어 prompt가 있으면 사용하고, 없으면 씬 정보를 바탕으로 Gemini가 생성합니다.
     */
    private String buildEnglishPrompt(Scene scene, ProjectState state) {
        String assetHint = buildPinnedAssetHint(scene, state);

        // 이미 영어 prompt가 있으면 그대로 사용
        if (scene.getPrompt() != null && !scene.getPrompt().isBlank()) {
            return appendAssetHintToEnglishPrompt(scene.getPrompt(), assetHint);
        }

        // 씬 정보를 조합해 Gemini에게 영어 프롬프트 생성 요청
        String koreanInfo = buildKoreanSceneDescription(scene, state);
        String geminiPrompt = "다음 씬 정보를 바탕으로 Imagen 이미지 생성에 사용할 영어 프롬프트를 작성해줘. " +
                "프롬프트만 출력하고 다른 설명은 하지 마. 영문으로만 작성해.\n\n씬 정보:\n" + koreanInfo;

        String generated = geminiAdapter.generateText(geminiPrompt).trim();
        return appendAssetHintToEnglishPrompt(generated, assetHint);
    }

    private String buildKoreanSceneDescription(Scene scene, ProjectState state) {
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
        String assetHint = buildPinnedAssetHint(scene, state);
        if (!assetHint.isBlank()) {
            sb.append("고정 에셋: ").append(assetHint).append("\n");
        }
        return sb.toString();
    }

    private String appendAssetHintToEnglishPrompt(String prompt, String assetHint) {
        if (prompt == null || prompt.isBlank()) {
            return prompt;
        }
        if (assetHint == null || assetHint.isBlank()) {
            return prompt;
        }
        return prompt.trim() + "\n\nPinned asset requirements: " + assetHint;
    }

    private String buildPinnedAssetHint(Scene scene, ProjectState state) {
        if (scene == null || state == null || scene.getPinnedAssets() == null || scene.getPinnedAssets().isEmpty()) {
            return "";
        }

        Map<String, CustomAssetData> customAssets = state.getCustomAssets();
        if (customAssets == null || customAssets.isEmpty()) {
            return "";
        }

        LinkedHashSet<String> descriptions = new LinkedHashSet<>();
        for (String assetId : scene.getPinnedAssets()) {
            if (assetId == null || assetId.isBlank()) continue;
            CustomAssetData assetData = customAssets.get(assetId);
            if (assetData == null) continue;
            String description = assetData.getDescription();
            if (description != null && !description.isBlank()) {
                descriptions.add(description.trim());
            }
        }
        if (descriptions.isEmpty()) {
            return "";
        }
        return String.join("; ", descriptions);
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

    private Frame findFrame(List<Frame> frames, String frameId) {
        if (frames == null || frames.isEmpty()) {
            return null;
        }
        if (frameId == null || frameId.isBlank()) {
            return frames.get(0);
        }
        return frames.stream()
                .filter(f -> frameId.equals(String.valueOf(f.getId())))
                .findFirst()
                .orElse(null);
    }

    private String resolveFrameId(String frameId, int index) {
        if (frameId != null && !frameId.isBlank()) {
            return frameId;
        }
        return "f-" + (index + 1) + "-" + System.currentTimeMillis();
    }

    private String buildFrameSceneKey(String sceneId, String frameId) {
        String safeSceneId = sanitizeIdentifier(sceneId, "scene");
        String safeFrameId = sanitizeIdentifier(frameId, "frame");
        return safeSceneId + "-" + safeFrameId;
    }

    private String sanitizeIdentifier(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String sanitized = value.replaceAll("[^a-zA-Z0-9_-]", "-");
        return sanitized.isBlank() ? fallback : sanitized;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    private boolean hasGeneratedImage(Frame frame) {
        return frame != null
                && frame.getImageUrl() != null
                && !frame.getImageUrl().isBlank();
    }

    /**
     * Phase 3: 이미지가 생성된 씬(의 imageUrl)을 바탕으로 Veo 3.1 모델을 호출하여 영상을 생성
     */
    public void validateVideoGenerationRequest(String sessionId, String sceneId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) {
            throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);
        }

        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) {
            throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);
        }

        if (target.getImageUrl() == null || target.getImageUrl().isBlank()) {
            throw new IllegalArgumentException("기준 이미지가 먼저 생성되어야 영상을 만들 수 있습니다.");
        }
    }

    /**
     * Phase 3: 이미지가 생성된 씬(의 imageUrl)을 바탕으로 Veo 3.1 모델을 호출하여 영상을 생성
     */
    public void generateVideo(String sessionId, String sceneId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) {
            throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);
        }

        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) {
            throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);
        }

        if (target.getImageUrl() == null || target.getImageUrl().isBlank()) {
            throw new IllegalArgumentException("기준 이미지가 먼저 생성되어야 영상을 만들 수 있습니다.");
        }

        // 상태를 생성 중으로 업데이트
        target.setStatus("generating_video");
        sessionService.updateSession(sessionId, state);

        try {
            // 카메라 워킹 및 추가 모션 프롬프트 구성을 위해 한국어 씬 설명 번역
            String koreanPrompt = buildKoreanSceneDescription(target, state);
            String englishPrompt = geminiAdapter.generateText(
                "Translate this scene description to a highly detailed, cinematic English prompt for an AI video generator. Only provide the translated prompt without any conversational text:\n" + koreanPrompt
            ) + " Cinematic, realistic motion, highly detailed.";

            List<String> referenceImageUrls = collectReferenceImageUrls(target, state);
            String firstFrameUrl = findFirstFrameImageUrl(target);
            String lastFrameUrl = findLastFrameImageUrl(target);

            String videoUrl = veoAdapter.generateVideo(
                    target,
                    englishPrompt,
                    referenceImageUrls,
                    firstFrameUrl,
                    lastFrameUrl
            );

            // 생성 완료 시 상태 갱신
            target.setVideoUrl(videoUrl);
            target.setStatus("completed");
            log.info("Finished video generation for scene: {}. URL: {}", sceneId, videoUrl);
        } catch (Exception e) {
            log.error("Failed to generate video for scene: {}", sceneId, e);
            target.setStatus("error");
            throw new RuntimeException("비디오 생성 실패: " + e.getMessage(), e);
        } finally {
            sessionService.updateSession(sessionId, state);
        }
    }

    private List<String> collectReferenceImageUrls(Scene scene, ProjectState state) {
        if (scene == null || state == null || scene.getPinnedAssets() == null || scene.getPinnedAssets().isEmpty()) {
            return List.of();
        }

        Map<String, CustomAssetData> customAssets = state.getCustomAssets();
        if (customAssets == null || customAssets.isEmpty()) {
            return List.of();
        }

        return scene.getPinnedAssets().stream()
                .map(customAssets::get)
                .filter(Objects::nonNull)
                .map(CustomAssetData::getImageUrl)
                .filter(url -> url != null && !url.isBlank())
                .map(String::trim)
                .distinct()
                .limit(3)
                .collect(Collectors.toList());
    }

    private String findFirstFrameImageUrl(Scene scene) {
        if (scene == null || scene.getFrames() == null || scene.getFrames().isEmpty()) {
            return null;
        }
        return scene.getFrames().stream()
                .map(Frame::getImageUrl)
                .filter(url -> url != null && !url.isBlank())
                .map(String::trim)
                .findFirst()
                .orElse(null);
    }

    private String findLastFrameImageUrl(Scene scene) {
        if (scene == null || scene.getFrames() == null || scene.getFrames().isEmpty()) {
            return null;
        }
        List<Frame> frames = scene.getFrames();
        for (int i = frames.size() - 1; i >= 0; i--) {
            String imageUrl = frames.get(i).getImageUrl();
            if (imageUrl != null && !imageUrl.isBlank()) {
                return imageUrl.trim();
            }
        }
        return null;
    }
}
