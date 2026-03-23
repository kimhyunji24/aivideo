package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.dto.Scene;
import com.aivideo.studio.dto.Frame;
import com.aivideo.studio.dto.CustomAssetData;
import com.aivideo.studio.exception.ApiErrorInfo;
import com.aivideo.studio.exception.ErrorClassifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
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
        clearSceneError(target);
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
            clearSceneError(target);
            sessionService.updateSession(sessionId, state);

            log.info("[GenerationService] 씬 {} 이미지 생성 완료 — imageUrl: {}", sceneId, imageUrl);
            return target;

        } catch (Exception e) {
            log.error("[GenerationService] 씬 {} 이미지 생성 실패", sceneId, e);
            target.setStatus("error");
            applySceneError(target, e);
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

        // 캐릭터 레퍼런스 이미지 수집 (베이스 이미지가 있는 캐릭터만)
        List<String> characterRefUrls = new ArrayList<>();
        List<String> characterAppearances = new ArrayList<>();
        if (state.getCharacters() != null) {
            for (var c : state.getCharacters()) {
                List<String> refs = c.getReferenceImageUrls();
                if (refs != null && !refs.isEmpty()) {
                    characterRefUrls.add(refs.get(0)); // 베이스 이미지(index 0) 사용
                    characterAppearances.add(c.getAppearance() != null ? c.getAppearance() : "");
                }
            }
        }

        // 일관성(캐릭터/의상 유지)을 위해 해당 Scene ID를 기반으로 고정된 Seed 추출
        Integer seed = sceneId.hashCode() & 0x7FFFFFFF;
        String imageUrl = characterRefUrls.isEmpty()
                ? imagenAdapter.generateImage(englishPrompt, buildFrameSceneKey(sceneId, targetFrame.getId()), seed)
                : imagenAdapter.generateImage(englishPrompt, buildFrameSceneKey(sceneId, targetFrame.getId()), seed, characterRefUrls, characterAppearances, true);
        targetFrame.setImageUrl(imageUrl);
        if (targetFrame.getScript() == null || targetFrame.getScript().isBlank()) {
            targetFrame.setScript(prompt); // 원본 한국어 스크립트 유지
        }

        target.setFrames(frames);
        sessionService.updateSession(sessionId, state);
        return targetFrame;
    }

    // ─── Character Reference Image Methods ───────────────────────────────────

    private static final int MAX_REFERENCE_IMAGES = 10;

    /**
     * 캐릭터 외형 설명을 기반으로 베이스 레퍼런스 이미지를 생성합니다.
     */
    public com.aivideo.studio.dto.Character generateCharacterBaseImage(String sessionId, String charId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        com.aivideo.studio.dto.Character character = findCharacter(state, charId);
        if (character == null) throw new IllegalArgumentException("캐릭터를 찾을 수 없습니다: " + charId);

        List<String> refs = character.getReferenceImageUrls() == null
                ? new ArrayList<>()
                : new ArrayList<>(character.getReferenceImageUrls());
        if (refs.size() >= MAX_REFERENCE_IMAGES) {
            throw new IllegalArgumentException("레퍼런스 이미지는 최대 " + MAX_REFERENCE_IMAGES + "개까지 저장할 수 있습니다.");
        }

        String prompt = buildCharacterBasePrompt(character, state);
        String imageUrl = imagenAdapter.generateImage(prompt, "char-ref-" + charId, null);

        // 베이스 이미지는 항상 첫 번째로 교체
        if (refs.isEmpty()) {
            refs.add(imageUrl);
        } else {
            refs.set(0, imageUrl);
        }
        character.setReferenceImageUrls(refs);
        character.setImageUrl(imageUrl); // 기존 단일 imageUrl도 동기화

        sessionService.updateSession(sessionId, state);
        log.info("[GenerationService] 캐릭터 베이스 이미지 생성 완료 — charId: {}", charId);
        return character;
    }

    /**
     * 베이스 이미지를 레퍼런스로 표정/앵글 변형 이미지를 생성합니다.
     * variantType: smile | cry | angry | back | side
     */
    public com.aivideo.studio.dto.Character generateCharacterVariant(String sessionId, String charId, String variantType) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        com.aivideo.studio.dto.Character character = findCharacter(state, charId);
        if (character == null) throw new IllegalArgumentException("캐릭터를 찾을 수 없습니다: " + charId);

        List<String> refs = character.getReferenceImageUrls() == null
                ? new ArrayList<>()
                : new ArrayList<>(character.getReferenceImageUrls());
        if (refs.isEmpty()) {
            throw new IllegalArgumentException("베이스 이미지를 먼저 생성해야 합니다.");
        }
        if (refs.size() >= MAX_REFERENCE_IMAGES) {
            throw new IllegalArgumentException("레퍼런스 이미지는 최대 " + MAX_REFERENCE_IMAGES + "개까지 저장할 수 있습니다.");
        }

        String baseImageUrl = refs.get(0);
        String variantPrompt = buildCharacterVariantPrompt(character, variantType, state);

        String newImageUrl = imagenAdapter.generateImage(
                variantPrompt,
                "char-ref-" + charId + "-" + variantType + "-" + System.currentTimeMillis(),
                null,
                List.of(baseImageUrl),
                List.of(character.getAppearance() != null ? character.getAppearance() : ""),
                true
        );

        refs.add(newImageUrl);
        character.setReferenceImageUrls(refs);
        sessionService.updateSession(sessionId, state);
        log.info("[GenerationService] 캐릭터 변형 이미지 생성 완료 — charId: {}, type: {}", charId, variantType);
        return character;
    }

    /**
     * 특정 레퍼런스 이미지를 삭제합니다.
     */
    public com.aivideo.studio.dto.Character deleteCharacterReference(String sessionId, String charId, int index) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        com.aivideo.studio.dto.Character character = findCharacter(state, charId);
        if (character == null) throw new IllegalArgumentException("캐릭터를 찾을 수 없습니다: " + charId);

        List<String> refs = character.getReferenceImageUrls() == null
                ? new ArrayList<>()
                : new ArrayList<>(character.getReferenceImageUrls());
        if (index < 0 || index >= refs.size()) {
            throw new IllegalArgumentException("유효하지 않은 인덱스입니다: " + index);
        }

        refs.remove(index);
        character.setReferenceImageUrls(refs);
        if (index == 0) {
            character.setImageUrl(refs.isEmpty() ? null : refs.get(0));
        }
        sessionService.updateSession(sessionId, state);
        return character;
    }

    private com.aivideo.studio.dto.Character findCharacter(ProjectState state, String charId) {
        if (state.getCharacters() == null) return null;
        return state.getCharacters().stream()
                .filter(c -> charId.equals(c.getId()))
                .findFirst()
                .orElse(null);
    }

    private String buildCharacterBasePrompt(com.aivideo.studio.dto.Character character, ProjectState state) {
        StringBuilder sb = new StringBuilder();
        sb.append("Create a high-quality character reference sheet image.\n");
        sb.append("Character name: ").append(character.getName()).append("\n");
        sb.append("Appearance: ").append(character.getAppearance()).append("\n");
        if (state.getSelectedStyles() != null && !state.getSelectedStyles().isEmpty()) {
            sb.append("Art style: ").append(String.join(", ", state.getSelectedStyles())).append("\n");
        }
        sb.append("\nRules:\n");
        sb.append("- Neutral expression, front-facing, full body or portrait\n");
        sb.append("- Clear, clean white or simple background\n");
        sb.append("- High detail: reproduce all appearance details exactly\n");
        sb.append("- Output ONLY the character image, no text overlays\n");
        return geminiAdapter.generateText(
                "Translate and refine this character description into a concise, detailed English image generation prompt:\n\n" + sb
        ).trim();
    }

    private String buildCharacterVariantPrompt(com.aivideo.studio.dto.Character character, String variantType, ProjectState state) {
        String changeInstruction = switch (variantType) {
            case "smile" -> "happy smiling expression, cheeks lifted, bright warm smile, slight squint, teeth visible";
            case "cry" -> "tearful crying expression, tears streaming down cheeks, inner eyebrows raised and furrowed, trembling lower lip";
            case "angry" -> "angry expression, brows sharply furrowed downward, eyes narrowed with intensity, jaw clenched, lips pressed tight";
            case "back" -> "full back view, showing back of head and hair from behind, same outfit fully visible from behind";
            case "side" -> "left-side 90-degree profile view, face in exact profile, same outfit visible, clean side angle";
            default -> "neutral relaxed expression, front-facing, calm face";
        };

        // Direct English prompt — no Gemini translation needed; reference image anchors appearance
        StringBuilder sb = new StringBuilder();
        sb.append("CHARACTER IDENTITY LOCK — reference image [1] is IMMUTABLE. ");
        sb.append("Reproduce exactly from reference: face geometry, skin tone, hair (color, length, style), ");
        sb.append("eye shape and color, every detail of the outfit (colors, cut, accessories). ");
        sb.append("Apply ONLY this single change: ").append(changeInstruction).append(". ");
        sb.append("Character: ").append(character.getName()).append(". ");
        if (state.getSelectedStyles() != null && !state.getSelectedStyles().isEmpty()) {
            sb.append("Art style: ").append(String.join(", ", state.getSelectedStyles())).append(". ");
        }
        sb.append("Simple clean background. No text overlay. High-quality character reference sheet.");
        return sb.toString();
    }

    /**
     * 캐릭터 레퍼런스 이미지를 기준으로 자세/동작을 변경해 새 이미지를 생성합니다.
     */
    public com.aivideo.studio.dto.Character regenerateCharacterRefWithPose(String sessionId, String charId, int index, String koreanPrompt) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        com.aivideo.studio.dto.Character character = findCharacter(state, charId);
        if (character == null) throw new IllegalArgumentException("캐릭터를 찾을 수 없습니다: " + charId);

        List<String> refs = character.getReferenceImageUrls() == null
                ? new ArrayList<>() : new ArrayList<>(character.getReferenceImageUrls());
        if (index < 0 || index >= refs.size()) throw new IllegalArgumentException("유효하지 않은 인덱스: " + index);

        String currentImageUrl = refs.get(index);
        String englishPrompt = buildCharacterPoseChangePrompt(character, koreanPrompt, state);

        String newImageUrl = imagenAdapter.generateImage(
                englishPrompt,
                "char-ref-" + charId + "-pose-" + index + "-" + System.currentTimeMillis(),
                null,
                List.of(currentImageUrl),
                List.of(character.getAppearance() != null ? character.getAppearance() : ""),
                false  // 포즈 변경: 텍스트가 포즈 우선, 레퍼런스는 외형만
        );

        refs.set(index, newImageUrl);
        character.setReferenceImageUrls(refs);
        if (index == 0) character.setImageUrl(newImageUrl);
        sessionService.updateSession(sessionId, state);
        log.info("[GenerationService] 캐릭터 레퍼런스 자세 변경 완료 — charId: {}, index: {}", charId, index);
        return character;
    }

    /**
     * 캐릭터 레퍼런스 이미지를 인페인팅(부분 수정)합니다.
     */
    public com.aivideo.studio.dto.Character editCharacterRefImage(String sessionId, String charId, int index, String prompt, String maskBase64) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        com.aivideo.studio.dto.Character character = findCharacter(state, charId);
        if (character == null) throw new IllegalArgumentException("캐릭터를 찾을 수 없습니다: " + charId);

        List<String> refs = character.getReferenceImageUrls() == null
                ? new ArrayList<>() : new ArrayList<>(character.getReferenceImageUrls());
        if (index < 0 || index >= refs.size()) throw new IllegalArgumentException("유효하지 않은 인덱스: " + index);

        String currentImageUrl = refs.get(index);
        String englishPrompt = (prompt != null && !prompt.isBlank()) ? buildInpaintingPrompt(prompt, state) : null;
        String cleanMask = maskBase64 != null ? maskBase64.replaceFirst("^data:image/[^;]+;base64,", "") : "";

        String newImageUrl = imagenAdapter.editImage(englishPrompt, currentImageUrl, cleanMask,
                "char-ref-" + charId + "-edit-" + index);

        refs.set(index, newImageUrl);
        character.setReferenceImageUrls(refs);
        if (index == 0) character.setImageUrl(newImageUrl);
        sessionService.updateSession(sessionId, state);
        log.info("[GenerationService] 캐릭터 레퍼런스 인페인팅 완료 — charId: {}, index: {}", charId, index);
        return character;
    }

    private String buildCharacterPoseChangePrompt(com.aivideo.studio.dto.Character character, String koreanRequest, ProjectState state) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert AI image prompt engineer.\n");
        sb.append("A reference image of this character is provided. Keep ALL appearance details identical; only change pose/action/expression.\n\n");
        sb.append("Character: ").append(character.getName()).append("\n");
        if (character.getAppearance() != null && !character.getAppearance().isBlank()) {
            sb.append("Appearance: ").append(character.getAppearance()).append("\n");
        }
        if (state.getSelectedStyles() != null && !state.getSelectedStyles().isEmpty()) {
            sb.append("Art style: ").append(String.join(", ", state.getSelectedStyles())).append("\n");
        }
        sb.append("\nKeep IDENTICAL: face, skin tone, hair, eye color/shape, clothing/outfit, art style.\n");
        sb.append("Change ONLY: the pose/action/expression described below.\n");
        sb.append("Do NOT copy the pose from the reference image — fully replace with the new pose.\n\n");
        sb.append("User request (Korean): ").append(koreanRequest).append("\n\n");
        sb.append("Write a concise detailed English image generation prompt. Output ONLY the prompt.");
        return geminiAdapter.generateText(sb.toString()).trim();
    }

    // ─── Edit (Inpainting) Methods ───────────────────────────────────────────

    public Scene editSceneImage(String sessionId, String sceneId, String prompt, String maskBase64) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);
        if (target.getImageUrl() == null || target.getImageUrl().isBlank()) {
            throw new IllegalArgumentException("편집할 씬 이미지가 없습니다.");
        }

        try {
            String englishPrompt = null;
            if (prompt != null && !prompt.isBlank()) {
                englishPrompt = buildInpaintingPrompt(prompt, state);
            }
            String cleanMaskBase64 = maskBase64 != null ? maskBase64.replaceFirst("^data:image/[^;]+;base64,", "") : "";
            String newImageUrl = imagenAdapter.editImage(englishPrompt, target.getImageUrl(), cleanMaskBase64, sceneId);
            
            target.setImageUrl(newImageUrl);
            target.setStatus("done");
            clearSceneError(target);
            sessionService.updateSession(sessionId, state);
            
            return target;
        } catch (Exception e) {
            log.error("[GenerationService] 씬 {} 이미지 인페인팅 실패", sceneId, e);
            target.setStatus("error");
            applySceneError(target, e);
            sessionService.updateSession(sessionId, state);
            throw new RuntimeException("이미지 인페인팅 실패: " + e.getMessage(), e);
        }
    }

    public Frame editFrameImage(String sessionId, String sceneId, String frameId, String prompt, String maskBase64) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);

        Frame targetFrame = findFrame(target.getFrames(), frameId);
        if (targetFrame == null || targetFrame.getImageUrl() == null || targetFrame.getImageUrl().isBlank()) {
            throw new IllegalArgumentException("편집할 프레임 이미지가 없습니다.");
        }

        try {
            String englishPrompt = null;
            if (prompt != null && !prompt.isBlank()) {
                englishPrompt = buildInpaintingPrompt(prompt, state);
            }
            String cleanMaskBase64 = maskBase64 != null ? maskBase64.replaceFirst("^data:image/[^;]+;base64,", "") : "";
            String newImageUrl = imagenAdapter.editImage(englishPrompt, targetFrame.getImageUrl(), cleanMaskBase64, buildFrameSceneKey(sceneId, targetFrame.getId()));
            targetFrame.setImageUrl(newImageUrl);
            
            // If it's the first frame, update scene's main thumbnail as well
            if (target.getFrames() != null && target.getFrames().indexOf(targetFrame) == 0) {
                target.setImageUrl(newImageUrl);
            }
            
            sessionService.updateSession(sessionId, state);
            return targetFrame;
        } catch (Exception e) {
            log.error("[GenerationService] 프레임 {} 이미지 인페인팅 실패", targetFrame.getId(), e);
            throw new RuntimeException("이미지 인페인팅 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 현재 프레임 이미지를 Subject Reference로 사용해 새 포즈/동작으로 재생성합니다.
     * Inpainting과 달리 이미지 전체를 새로 생성하지만, 기존 이미지 외형을 레퍼런스로 유지합니다.
     */
    public Frame regenerateFrameWithReference(String sessionId, String sceneId, String frameId, String koreanPrompt) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("세션을 찾을 수 없습니다: " + sessionId);

        Scene target = findScene(state.getScenes(), sceneId);
        if (target == null) throw new IllegalArgumentException("씬을 찾을 수 없습니다: " + sceneId);

        Frame targetFrame = findFrame(target.getFrames(), frameId);
        if (targetFrame == null || targetFrame.getImageUrl() == null || targetFrame.getImageUrl().isBlank()) {
            throw new IllegalArgumentException("기준 이미지가 없습니다. 먼저 프레임 이미지를 생성해주세요.");
        }

        if (koreanPrompt == null || koreanPrompt.isBlank()) {
            throw new IllegalArgumentException("변경할 내용을 입력해주세요.");
        }

        try {
            String englishPrompt = buildReferenceRegenerationPrompt(koreanPrompt, state, targetFrame);
            log.info("[GenerationService] 레퍼런스 재생성 — sceneId: {}, frameId: {}, prompt: {}", sceneId, frameId, englishPrompt);

            List<String> refUrls = List.of(targetFrame.getImageUrl());
            List<String> appearances = state.getCharacters() != null && !state.getCharacters().isEmpty()
                    ? state.getCharacters().stream()
                        .map(c -> c.getAppearance() != null ? c.getAppearance() : "")
                        .collect(Collectors.toList())
                    : List.of();

            String newImageUrl = imagenAdapter.generateImage(
                    englishPrompt,
                    buildFrameSceneKey(sceneId, targetFrame.getId()) + "-ref",
                    null,
                    refUrls,
                    appearances,
                    false  // 포즈 변경: 얼굴만 참조, 포즈는 텍스트 우선
            );

            targetFrame.setImageUrl(newImageUrl);
            if (target.getFrames() != null && target.getFrames().indexOf(targetFrame) == 0) {
                target.setImageUrl(newImageUrl);
            }
            sessionService.updateSession(sessionId, state);
            return targetFrame;
        } catch (Exception e) {
            log.error("[GenerationService] 레퍼런스 재생성 실패 — frameId: {}", frameId, e);
            throw new RuntimeException("레퍼런스 재생성 실패: " + e.getMessage(), e);
        }
    }

    // ─── Private 헬퍼 ────────────────────────────────────────────────────────

    /**
     * 인페인팅용 영어 프롬프트를 생성합니다.
     * 캐릭터 외형 정보를 포함해 마스크 영역 밖 외형이 유지되도록 지시합니다.
     */
    private String buildReferenceRegenerationPrompt(String koreanRequest, ProjectState state, Frame referenceFrame) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert prompt engineer for AI image generation.\n");
        sb.append("A reference image is provided for character identity only. Generate a new image with the requested pose/action change.\n\n");

        if (state.getSelectedStyles() != null && !state.getSelectedStyles().isEmpty()) {
            sb.append("[Art style — must be preserved exactly, do not change rendering or drawing style]\n");
            sb.append(String.join(", ", state.getSelectedStyles())).append("\n\n");
        }

        if (state.getCharacters() != null && !state.getCharacters().isEmpty()) {
            sb.append("[Character Appearance — reproduce exactly from reference]\n");
            for (var c : state.getCharacters()) {
                if (c.getName() != null && c.getAppearance() != null) {
                    sb.append("- ").append(c.getName()).append(": ").append(c.getAppearance()).append("\n");
                }
            }
            sb.append("\n");
        }

        String originalScript = referenceFrame.getScript();
        if (originalScript != null && !originalScript.isBlank()) {
            sb.append("[Original scene context]\n").append(originalScript).append("\n\n");
        }

        sb.append("[User change request (Korean)]\n").append(koreanRequest).append("\n\n");

        sb.append("Task: Write a detailed English image generation prompt following ALL rules below:\n\n");

        sb.append("RULE 1 — REFERENCE IMAGE USAGE:\n");
        sb.append("  The reference image is used ONLY to copy: face, hair, skin tone, eye shape/color, and clothing style/color.\n");
        sb.append("  CRITICAL: Do NOT copy the body pose or arm positions from the reference image.\n");
        sb.append("  The reference image's arms/body will be completely REPLACED by the new pose described below.\n");
        sb.append("  This prevents duplicate limbs — the character must have exactly the right number of arms in the new pose.\n\n");

        sb.append("RULE 2 — WHAT STAYS THE SAME:\n");
        sb.append("  - Same face, hair, skin tone, eye color, outfit (exact same colors and style)\n");
        sb.append("  - Same background and environment as the original scene\n");
        sb.append("  - Same art style, rendering style, lighting, and camera angle\n");
        sb.append("  - Same body position (sitting/standing/etc.) UNLESS the request changes it\n\n");

        sb.append("RULE 3 — NEW POSE (describe every joint/limb in anatomical detail, do NOT skip):\n");
        sb.append("  For arms crossed: 'both arms folded across the chest, right forearm over left, hands tucked near opposite elbows, forearms parallel and horizontal'\n");
        sb.append("  For sitting on a chair: 'character is now seated on a chair, torso upright, hips and knees bent at 90 degrees, feet flat on the floor, thighs parallel to the ground, hands resting on thighs or armrests'\n");
        sb.append("  For sitting on the floor: 'character is seated cross-legged on the floor, torso straight, knees out to the sides, feet tucked beneath opposite knees, hands resting on knees'\n");
        sb.append("  For standing with hands on hips: 'standing upright, both hands on hips, elbows bent outward, fingers pointing downward, weight evenly distributed on both feet'\n");
        sb.append("  For lying down: 'character lying on their back, legs extended straight, arms resting at sides, head tilted slightly upward'\n");
        sb.append("  For any other pose: describe exact torso orientation (sitting/standing/crouching), leg position (bent/straight/crossed), arm position, and weight distribution in detail.\n\n");

        sb.append("CRITICAL: The user's requested pose change MUST be fully applied no matter what. \n");
        sb.append("If the user requests sitting, the character MUST be sitting. If standing, MUST be standing. Do NOT keep the original body posture.\n\n");

        sb.append("Write the final prompt incorporating all rules. ");
        sb.append("End with: 'same art style as original, identical background, same character from reference, no duplicate limbs'\n\n");
        sb.append("Output ONLY the final English prompt. No labels, no explanations.");

        return geminiAdapter.generateText(sb.toString()).trim();
    }

    private String buildInpaintingPrompt(String userRequest, ProjectState state) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a surgical inpainting prompt engineer. ");
        sb.append("Only the white-masked region will be regenerated. Everything else stays pixel-perfect.\n\n");

        if (state.getSelectedStyles() != null && !state.getSelectedStyles().isEmpty()) {
            sb.append("[Art style — must be preserved exactly]\n");
            sb.append(String.join(", ", state.getSelectedStyles())).append("\n\n");
        }

        if (state.getCharacters() != null && !state.getCharacters().isEmpty()) {
            sb.append("[Character appearance — every detail must be reproduced exactly in the masked region]\n");
            for (var c : state.getCharacters()) {
                if (c.getName() != null && c.getAppearance() != null) {
                    sb.append("- ").append(c.getName()).append(": ").append(c.getAppearance()).append("\n");
                }
            }
            sb.append("\n");
        }

        sb.append("[User edit request (Korean)]\n").append(userRequest).append("\n\n");

        sb.append("Instructions:\n");
        sb.append("Step 1 — Identify the edit type:\n");
        sb.append("  A) EXPRESSION CHANGE (angry, happy, sad, surprised, etc.)\n");
        sb.append("  B) ACCESSORY/OBJECT ADDITION (glasses, hat, mask, etc.)\n");
        sb.append("  C) OTHER\n\n");

        sb.append("Step 2 — Write the inpainting prompt:\n\n");

        sb.append("For type A (expression):\n");
        sb.append("  First, reproduce the character's face exactly: face shape, jaw line, skin tone, eye shape and color, ");
        sb.append("nose shape, lip shape, eyebrow shape and color, hair framing the face.\n");
        sb.append("  Then apply ONLY these muscle changes for the emotion:\n");
        sb.append("    angry: 'brows pulled sharply down and inward, deep vertical furrow between brows, ");
        sb.append("eyes narrowed with tense lower lids, lips pressed hard together, jaw clenched'\n");
        sb.append("    happy/smile: 'cheeks lifted, corners of mouth pulled up, teeth visible, slight squint'\n");
        sb.append("    sad: 'inner brow corners raised and tilted, lower lip pushed up, downturned mouth'\n");
        sb.append("  End with: 'SAME face shape, SAME eye shape and color, SAME nose, SAME skin tone, SAME hair — only expression muscles change, same art style'\n\n");

        sb.append("For type B (accessory):\n");
        sb.append("  First, reproduce all existing face features exactly as described above.\n");
        sb.append("  Describe the new object: material, color, shape, exact placement on face.\n");
        sb.append("  End with: 'eyes, mouth, nose, face shape, skin tone all completely unchanged, same art style'\n\n");

        sb.append("Output ONLY the final English inpainting prompt. No labels, no explanations, no markdown.");

        return geminiAdapter.generateText(sb.toString()).trim();
    }

    /**
     * 프레임의 한국어 대본을 영어 프롬프트로 변환하며, Start Frame 정보를 바탕으로 컨텍스트를 유지합니다.
     */
    private String buildEnglishFramePrompt(String koreanScript, Frame startFrame, Frame currentFrame, ProjectState state) {
        StringBuilder geminiPrompt = new StringBuilder();
        geminiPrompt.append("You are an expert prompt engineer for AI image generators. We are creating sequential frames for a single scene. Consistency of characters, clothing, and background is CRITICAL.\n\n");

        boolean isNotStartFrame = startFrame != null && !startFrame.getId().equals(currentFrame.getId());
        boolean hasCharacterRefs = state.getCharacters() != null && state.getCharacters().stream()
                .anyMatch(c -> c.getReferenceImageUrls() != null && !c.getReferenceImageUrls().isEmpty());

        if (state.getCharacters() != null && !state.getCharacters().isEmpty()) {
            geminiPrompt.append("[Main Characters Info]\n");
            for (var c : state.getCharacters()) {
                geminiPrompt.append("- ").append(c.getName()).append(": ").append(c.getAppearance()).append("\n");
            }
            geminiPrompt.append("\n");
        }

        if (hasCharacterRefs) {
            geminiPrompt.append("[Character Reference Images]\n");
            geminiPrompt.append("Reference images for the above characters are provided. The generated image MUST exactly reproduce every visual detail from the reference images: face geometry, hair color/length/style, skin tone, eye shape/color, and outfit (color, texture, cut, accessories).\n");
            geminiPrompt.append("The reference image takes absolute priority over any text description of appearance.\n\n");
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

    public ResponseEntity<byte[]> getVideoPreview(String sessionId, String sceneId) {
        Scene scene = getSceneStatus(sessionId, sceneId);
        if (scene.getVideoUrl() == null || scene.getVideoUrl().isBlank()) {
            throw new IllegalArgumentException("미리보기 가능한 비디오가 없습니다: " + sceneId);
        }
        try {
            return veoAdapter.fetchVideoBinary(scene.getVideoUrl());
        } catch (Exception e) {
            throw new RuntimeException("비디오 미리보기 로드 실패: " + e.getMessage(), e);
        }
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
        clearSceneError(target);
        sessionService.updateSession(sessionId, state);

        try {
            // 카메라 워킹 및 추가 모션 프롬프트 구성을 위해 한국어 씬 설명 번역
            String koreanPrompt = buildKoreanSceneDescription(target, state);
            String englishPrompt = geminiAdapter.generateText(
                "Translate this scene description to a highly detailed, cinematic English prompt for an AI video generator. Only provide the translated prompt without any conversational text:\n" + koreanPrompt
            ) + " Cinematic, realistic motion, highly detailed.";

            List<String> referenceImageUrls = collectReferenceImageUrls(target, state);
            String firstFrameUrl = firstNonBlank(findFirstFrameImageUrl(target), target.getImageUrl());
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
            clearSceneError(target);
            log.info("Finished video generation for scene: {}. URL: {}", sceneId, videoUrl);
        } catch (Exception e) {
            log.error("Failed to generate video for scene: {}", sceneId, e);
            target.setStatus("error");
            applySceneError(target, e);
            throw new RuntimeException("비디오 생성 실패: " + e.getMessage(), e);
        } finally {
            sessionService.updateSession(sessionId, state);
        }
    }

    private void clearSceneError(Scene scene) {
        if (scene == null) {
            return;
        }
        scene.setLastErrorCode(null);
        scene.setLastErrorMessage(null);
        scene.setLastErrorRetryable(null);
        scene.setLastErrorRequestId(null);
    }

    private void applySceneError(Scene scene, Throwable throwable) {
        if (scene == null) {
            return;
        }
        ApiErrorInfo info = ErrorClassifier.classify(throwable);
        scene.setLastErrorCode(info.code());
        scene.setLastErrorMessage(info.userMessage());
        scene.setLastErrorRetryable(info.retryable());
        scene.setLastErrorRequestId(UUID.randomUUID().toString());
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
