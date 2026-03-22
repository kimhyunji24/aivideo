package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.dto.Scene;
import com.aivideo.studio.dto.Frame;
import com.aivideo.studio.dto.Character;
import com.aivideo.studio.dto.PlotStage;
import com.aivideo.studio.dto.SceneElements;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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

    private static final Map<String, String> DEFAULT_SCENE_ELEMENTS = buildDefaultSceneElements();

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
            // 구조화된 템플릿 기반 영어 프롬프트 자동 생성 (2x2 레이아웃 포함)
            String englishPrompt = buildEnglishPrompt(target, state);
            List<String> referenceImageUrls = collectReferenceImageUrls(state);
            log.info("[GenerationService] 씬 {} 이미지 생성 시작 — 프롬프트: {}", sceneId, englishPrompt);

            // 안정화된 전역 Seed로 씬 간 외형 일관성을 강화
            Integer seed = resolveConsistencySeed(state, sceneId);
            String imageUrl = imagenAdapter.generateImage(englishPrompt, sceneId, seed, referenceImageUrls);

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
            if (e instanceof IllegalArgumentException iae) {
                throw iae;
            }
            throw new RuntimeException("이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 세션의 모든 씬에 대해 이미지를 순차 생성합니다.
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

        SceneElements stageElements = resolveFrameElements(state, target);
        String prompt = firstNonBlank(
                targetFrame.getScript(), // 사용자 수정값 최우선
                target.getPrompt(),
                stageElements != null ? stageElements.getStory() : null, // 플롯 elements 차순위
                target.getDescription()
        );

        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("프레임 생성에 사용할 script 또는 scene prompt가 필요합니다.");
        }

        Frame startFrame = frames.isEmpty() ? null : frames.get(0);
        
        // 프레임 대본(한국어)을 영어 프롬프트로 변환 (Start Frame 일관성 유지 포함)
        String englishPrompt = buildEnglishFramePrompt(prompt, startFrame, targetFrame, state, stageElements);
        log.info("[GenerationService] 씬 {}, 프레임 {} 이미지 생성 — 원본: {}, 번역: {}", sceneId, targetFrame.getId(), prompt, englishPrompt);

        // 안정화된 전역 Seed 사용
        Integer seed = resolveConsistencySeed(state, sceneId);
        List<String> referenceImageUrls = collectReferenceImageUrls(state);
        String imageUrl = imagenAdapter.generateImage(
                englishPrompt,
                buildFrameSceneKey(sceneId, targetFrame.getId()),
                seed,
                referenceImageUrls
        );
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
    private String buildEnglishFramePrompt(String koreanScript, Frame startFrame, Frame currentFrame, ProjectState state, SceneElements stageElements) {
        StringBuilder geminiPrompt = new StringBuilder();
        geminiPrompt.append("You are an expert prompt engineer for AI image generators. We are creating sequential frames for a single scene. Consistency of characters, clothing, and background is CRITICAL.\n\n");
        
        boolean isNotStartFrame = startFrame != null && !startFrame.getId().equals(currentFrame.getId());
        
        String characterHint = buildCharacterAppearanceHint(state);
        if (!characterHint.isBlank()) {
            geminiPrompt.append("CRITICAL REQUIREMENT: Character Appearance MUST strictly follow these details: [").append(characterHint).append("]. Do not invent new clothing or features.\n\n");
        }

        if (stageElements != null) {
            Map<String, String> merged = mergeWithDefaultElements(stageElements);
            geminiPrompt.append("[Scene Element Design]\n");
            merged.forEach((k, v) -> geminiPrompt.append("- ").append(k).append(": ").append(v).append("\n"));
            geminiPrompt.append("\n");
        }

        if (isNotStartFrame && startFrame.getScript() != null && !startFrame.getScript().isBlank()) {
             geminiPrompt.append("[Start Frame Description (Reference for Consistency)]\n");
             geminiPrompt.append(startFrame.getScript()).append("\n\n");
             geminiPrompt.append("Task: Translate the [Current Frame Script] into a highly detailed English image generation prompt.\n");
             geminiPrompt.append("CRITICAL REQUIREMENT: To ensure visual consistency with the Start Frame, you MUST explicitly re-use the specific exact descriptions of the characters, their existing clothing/outfits, and the background/environment derived from the [Start Frame Description]. Then, apply the new action, pose, or camera angle from the [Current Frame Script].\n\n");
        } else {
             geminiPrompt.append("Task: Translate the [Current Frame Script] into a highly detailed English image generation prompt incorporating the Character Appearance provided above.\n\n");
        }
        
        geminiPrompt.append("[Current Frame Script]\n").append(koreanScript).append("\n\n");
        geminiPrompt.append("Output ONLY the translated, highly detailed English prompt, without any conversational text or markdown formatting. The prompt should flow logically as a single descriptive paragraph.");

        return geminiAdapter.generateText(geminiPrompt.toString()).trim();
    }

    /**
     * 씬의 영어 이미지 생성 프롬프트를 반환합니다.
     * 이미 영어 prompt가 있으면 사용하고, 없으면 구조화된 템플릿으로 Gemini가 생성합니다.
     * (2x2 레이아웃, 4컷 스토리보드 형태 생성 규칙 추가)
     */
    private String buildEnglishPrompt(Scene scene, ProjectState state) {
        // 이미 영어 prompt가 명확하게 작성되어 있다면 그대로 반환
        if (scene.getPrompt() != null && !scene.getPrompt().isBlank() && isEnglish(scene.getPrompt())) {
            return scene.getPrompt().trim();
        }

        String characterHint = buildCharacterAppearanceHint(state);
        String backgroundHint = buildBackgroundReferenceHint(state);
        String koreanInfo = buildKoreanSceneDescription(scene, state);

        // Gemini 프롬프트 고도화: 2x2 레이아웃 및 4컷 스토리 진행 강제
        StringBuilder geminiPrompt = new StringBuilder();
        geminiPrompt.append("You are an expert cinematic prompt engineer for Imagen 3.\n");
        geminiPrompt.append("Your task is to take the following scene elements and write a highly detailed English prompt that generates a SINGLE image containing a 2x2 grid layout (4 panels) illustrating a sequential story.\n\n");
        
        geminiPrompt.append("CRITICAL RULES:\n");
        geminiPrompt.append("1. Layout Requirement: You MUST explicitly start the prompt with phrases like \"A 2x2 grid layout storyboard...\" or \"A 4-panel comic style...\"\n");
        
        int ruleIndex = 2;
        if (!characterHint.isBlank()) {
            geminiPrompt.append(ruleIndex++).append(". Character Consistency: Whenever you describe the characters across the panels, you MUST seamlessly integrate these exact appearance details: [").append(characterHint).append("]. Do not invent new clothing or features.\n");
        }
        if (!backgroundHint.isBlank()) {
            geminiPrompt.append(ruleIndex++).append(". Background Consistency: The environment MUST be described incorporating these exact elements: [").append(backgroundHint).append("].\n");
        }
        
        geminiPrompt.append(ruleIndex++).append(". Story Progression: Briefly describe what happens in each of the 4 panels (Panel 1: Top-left, Panel 2: Top-right, Panel 3: Bottom-left, Panel 4: Bottom-right) to show a flowing narrative based on the provided [Scene Elements].\n");
        geminiPrompt.append(ruleIndex++).append(". Visual Style: Ensure the overall description includes the required [Lighting, Composition, Mood].\n");
        geminiPrompt.append(ruleIndex).append(". Output ONLY the English prompt string. No conversational text, no explanations, and no markdown blocks.\n\n");
        
        geminiPrompt.append("[Scene Elements]:\n").append(koreanInfo);

        return geminiAdapter.generateText(geminiPrompt.toString()).trim();
    }

    private boolean isEnglish(String text) {
        return text.matches("^[a-zA-Z0-9\\s\\p{Punct}]+$");
    }

    private String buildKoreanSceneDescription(Scene scene, ProjectState state) {
        Map<String, String> elements = mergeWithDefaultElements(scene != null ? scene.getElements() : null);
        StringBuilder sb = new StringBuilder();
        sb.append("제목: ").append(scene.getTitle()).append("\n");
        sb.append("설명: ").append(scene.getDescription()).append("\n");

        appendIfNotEmpty(sb, "메인 캐릭터", elements.get("mainCharacter"));
        appendIfNotEmpty(sb, "서브 캐릭터", elements.get("subCharacter"));
        appendIfNotEmpty(sb, "행동", elements.get("action"));
        appendIfNotEmpty(sb, "포즈", elements.get("pose"));
        appendIfNotEmpty(sb, "배경", elements.get("background"));
        appendIfNotEmpty(sb, "시간대", elements.get("time"));
        appendIfNotEmpty(sb, "구도", elements.get("composition"));
        appendIfNotEmpty(sb, "조명", elements.get("lighting"));
        appendIfNotEmpty(sb, "분위기", elements.get("mood"));
        appendIfNotEmpty(sb, "스토리", elements.get("story"));

        return sb.toString();
    }

    private String buildCharacterAppearanceHint(ProjectState state) {
        if (state == null || state.getCharacters() == null || state.getCharacters().isEmpty()) {
            return "";
        }

        return state.getCharacters().stream()
                .filter(Objects::nonNull)
                .map(c -> {
                    String name = c.getName() != null && !c.getName().isBlank() ? c.getName().trim() : "캐릭터";
                    String appearance = c.getAppearance() != null ? c.getAppearance().trim() : "";
                    if (appearance.isBlank()) return null;
                    return name + " (" + appearance + ")";
                })
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.joining("; "));
    }

    private String buildBackgroundReferenceHint(ProjectState state) {
        if (state == null) return "";
        String desc = state.getBackgroundReferenceDescription();
        return desc == null ? "" : desc.trim();
    }

    private List<String> collectReferenceImageUrls(ProjectState state) {
        List<String> refs = new ArrayList<>();
        refs.addAll(collectCharacterReferenceImageUrls(state));

        String backgroundRef = state != null ? firstNonBlank(state.getBackgroundReferenceImageUrl()) : null;
        if (backgroundRef != null && isSupportedReferenceImageUrl(backgroundRef)) {
            refs.add(backgroundRef.trim());
        }

        return refs.stream()
                .filter(Objects::nonNull)
                .distinct()
                .limit(2)
                .collect(Collectors.toList());
    }

    private List<String> collectCharacterReferenceImageUrls(ProjectState state) {
        if (state == null || state.getCharacters() == null || state.getCharacters().isEmpty()) {
            return List.of();
        }
        return state.getCharacters().stream()
                .filter(Objects::nonNull)
                .map(Character::getImageUrl)
                .filter(url -> url != null && !url.isBlank())
                .map(String::trim)
                .filter(this::isSupportedReferenceImageUrl)
                .distinct()
                .limit(1)
                .collect(Collectors.toList());
    }

    private boolean isSupportedReferenceImageUrl(String url) {
        if (url == null || url.isBlank()) return false;
        String normalized = url.trim();
        return normalized.startsWith("data:image/")
                || normalized.startsWith("/generated-images/")
                || normalized.startsWith("http://")
                || normalized.startsWith("https://");
    }

    private SceneElements findStageElementsBySceneId(ProjectState state, Scene targetScene) {
        if (state == null || targetScene == null || state.getPlotPlan() == null || state.getPlotPlan().getStages() == null) {
            return null;
        }

        String sceneId = String.valueOf(targetScene.getId());
        List<PlotStage> stages = state.getPlotPlan().getStages();
        for (int i = 0; i < stages.size(); i++) {
            PlotStage stage = stages.get(i);
            if (stage == null) continue;
            String derivedSceneId = "scene-" + (i + 1);
            if (sceneId.equals(derivedSceneId)) {
                return stage.getElements();
            }
        }
        return null;
    }

    private SceneElements resolveFrameElements(ProjectState state, Scene targetScene) {
        SceneElements fromStage = findStageElementsBySceneId(state, targetScene);
        if (fromStage != null) {
            return fromStage;
        }
        if (targetScene != null && targetScene.getElements() != null) {
            return targetScene.getElements();
        }
        Map<String, String> defaults = mergeWithDefaultElements(null);
        return SceneElements.builder()
                .mainCharacter(defaults.get("mainCharacter"))
                .subCharacter(defaults.get("subCharacter"))
                .action(defaults.get("action"))
                .pose(defaults.get("pose"))
                .background(defaults.get("background"))
                .time(defaults.get("time"))
                .composition(defaults.get("composition"))
                .lighting(defaults.get("lighting"))
                .mood(defaults.get("mood"))
                .story(defaults.get("story"))
                .build();
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

    private Integer resolveConsistencySeed(ProjectState state, String fallbackKey) {
        Integer sceneOneSeed = resolveSceneOneSeed(state);
        if (sceneOneSeed != null && sceneOneSeed > 0) {
            return sceneOneSeed;
        }

        String base = null;
        if (state != null && state.getCharacters() != null && !state.getCharacters().isEmpty()) {
            base = state.getCharacters().stream()
                    .filter(Objects::nonNull)
                    .map(c -> firstNonBlank(c.getImageUrl(), c.getAppearance(), c.getName()))
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
        }
        String seedSource = firstNonBlank(base, fallbackKey, "aivideo-consistency-seed");
        
        // 안정적인 양수 Seed 생성 로직 (해시 충돌 방지 및 고정 형태)
        long hash = seedSource.hashCode();
        hash = (hash ^ (hash >>> 32)) * 0x45d9f3b;
        return (int) (Math.abs(hash) % 9999999) + 10000;
    }

    private Integer resolveSceneOneSeed(ProjectState state) {
        if (state == null || state.getScenes() == null || state.getScenes().isEmpty()) {
            return null;
        }

        Scene sceneOne = state.getScenes().stream()
                .filter(Objects::nonNull)
                .filter(s -> "scene-1".equals(String.valueOf(s.getId())))
                .findFirst()
                .orElse(state.getScenes().get(0));

        if (sceneOne == null || sceneOne.getParams() == null) {
            return null;
        }
        return sceneOne.getParams().getSeed();
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
            // 카메라와 모션 워크를 명시하도록 Veo 특화 프롬프트 작성
            String koreanPrompt = buildVideoKoreanPrompt(target, state);
            
            String geminiVideoPrompt = "You are a master AI video prompt engineer for Veo 3.1.\n" +
                "Convert the following scene description into a highly detailed video generation prompt.\n" +
                "CRITICAL REQUIREMENTS:\n" +
                "1. Start by describing the exact visual state of the [Start Frame].\n" +
                "2. Explicitly describe the CAMERA MOVEMENT (e.g., slow zoom in, tracking shot, static wide shot).\n" +
                "3. Explicitly describe the SUBJECT'S MOTION and temporal changes over time.\n" +
                "4. Ensure wording is policy-safe (avoid explicit violence/sexual terms) while maintaining the cinematic tension.\n" +
                "5. Output ONLY the English prompt string, without any conversational text.\n\n" +
                "[Scene Description]:\n" + koreanPrompt;

            String englishPrompt = geminiAdapter.generateText(geminiVideoPrompt).trim() + ", cinematic lighting, photorealistic motion, highly detailed.";

            List<String> referenceImageUrls = collectReferenceImageUrls(state);
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
            log.info("Finished video generation for scene: {}. URL: {}", sceneId, videoUrl);
        } catch (Exception e) {
            log.error("Failed to generate video for scene: {}", sceneId, e);
            target.setStatus("error");
            throw new RuntimeException("비디오 생성 실패: " + e.getMessage(), e);
        } finally {
            sessionService.updateSession(sessionId, state);
        }
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

    private String buildVideoKoreanPrompt(Scene scene, ProjectState state) {
        String source = buildKoreanSceneDescription(scene, state);
        String normalized = normalizeStartEndFrameNarrative(source);
        return softenSensitiveWording(normalized);
    }

    private String normalizeStartEndFrameNarrative(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String startTag = "[Start Frame]";
        String endTag = "[End Frame]";
        int s = text.indexOf(startTag);
        int e = text.indexOf(endTag);
        if (s < 0 || e < 0 || e <= s) {
            return text;
        }
        String before = text.substring(0, s).trim();
        String start = text.substring(s + startTag.length(), e).trim();
        String afterEnd = text.substring(e + endTag.length()).trim();
        String transformed = "시작 장면: " + start + "\n전개 및 마무리 장면: " + afterEnd;
        return (before.isBlank() ? transformed : before + "\n" + transformed).trim();
    }

    private String softenSensitiveWording(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String softened = text;
        softened = softened.replace("살인", "강한 충돌");
        softened = softened.replace("죽인다", "압도한다");
        softened = softened.replace("죽음", "이별");
        softened = softened.replace("피가", "강렬한 흔적이");
        softened = softened.replace("유혈", "긴장감 있는");
        softened = softened.replace("고문", "극한의 압박");
        softened = softened.replace("잔인", "강렬");
        softened = softened.replace("노출", "세련된 스타일");
        softened = softened.replace("성적", "감정적");
        softened = softened.replace("혐오", "불편한");
        return softened;
    }

    private static Map<String, String> buildDefaultSceneElements() {
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("mainCharacter", "주인공");
        defaults.put("subCharacter", "조력자 1인");
        defaults.put("action", "주변을 천천히 살피며 이동한다");
        defaults.put("pose", "자연스럽고 안정적인 자세");
        defaults.put("background", "현실적인 도심 배경");
        defaults.put("time", "늦은 오후");
        defaults.put("composition", "미디엄 샷 중심의 안정적 구도");
        defaults.put("lighting", "부드러운 자연광");
        defaults.put("mood", "차분하지만 기대감 있는 분위기");
        defaults.put("story", "작은 단서를 통해 다음 장면으로 이어지는 흐름");
        return defaults;
    }

    private Map<String, String> mergeWithDefaultElements(SceneElements elements) {
        Map<String, String> merged = new LinkedHashMap<>(DEFAULT_SCENE_ELEMENTS);
        if (elements == null) {
            return merged;
        }
        putIfNotBlank(merged, "mainCharacter", elements.getMainCharacter());
        putIfNotBlank(merged, "subCharacter", elements.getSubCharacter());
        putIfNotBlank(merged, "action", elements.getAction());
        putIfNotBlank(merged, "pose", elements.getPose());
        putIfNotBlank(merged, "background", elements.getBackground());
        putIfNotBlank(merged, "time", elements.getTime());
        putIfNotBlank(merged, "composition", elements.getComposition());
        putIfNotBlank(merged, "lighting", elements.getLighting());
        putIfNotBlank(merged, "mood", elements.getMood());
        putIfNotBlank(merged, "story", elements.getStory());
        return merged;
    }

    private void putIfNotBlank(Map<String, String> target, String key, String value) {
        if (value != null && !value.isBlank()) {
            target.put(key, value.trim());
        }
    }
}