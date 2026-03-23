package com.aivideo.studio.controller;

import com.aivideo.studio.dto.Scene;
import com.aivideo.studio.dto.Frame;
import com.aivideo.studio.dto.FrameGenerateRequest;
import com.aivideo.studio.dto.SplitScriptResponse;
import com.aivideo.studio.service.GenerationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 이미지 생성 API
 *
 * POST /api/v1/sessions/{sessionId}/generation/images/{sceneId}
 *   → 특정 씬 이미지 1개 생성
 *
 * GET  /api/v1/sessions/{sessionId}/generation/images/{sceneId}/status
 *   → 씬 이미지 생성 상태 조회 (프론트의 pollSceneStatus와 연결)
 *
 * POST /api/v1/sessions/{sessionId}/generation/images
 *   → 세션 전체 씬 이미지 순차 생성
 *
 * POST /api/v1/sessions/{sessionId}/generation/frames/{sceneId}/add
 *   → 특정 씬에 프레임 1개 추가 (최대 4개)
 *
 * POST /api/v1/sessions/{sessionId}/generation/frames/{sceneId}
 *   → 특정 프레임(또는 자동 선택 프레임)의 이미지 생성
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/generation")
@RequiredArgsConstructor
public class GenerationController {

    private final GenerationService generationService;

    /**
     * 특정 씬의 이미지를 Imagen 3로 생성합니다.
     * 프론트엔드: POST /api/generate-image?id={sceneId}
     * next.config.mjs rewrites → /api/v1/sessions/{sessionId}/generation/images/{sceneId}
     */
    @PostMapping("/images/{sceneId}")
    public ResponseEntity<Scene> generateImage(
            @PathVariable String sessionId,
            @PathVariable String sceneId) {

        log.info("[GenerationController] 이미지 생성 요청 — sessionId: {}, sceneId: {}", sessionId, sceneId);
        Scene scene = generationService.generateImageForScene(sessionId, sceneId);
        return ResponseEntity.ok(scene);
    }

    /**
     * 씬의 현재 이미지 생성 상태를 반환합니다.
     * 프론트엔드 pollSceneStatus 폴링 대상:
     *   GET /api/status/{sceneId}  → rewrites → /api/v1/sessions/{sessionId}/generation/images/{sceneId}/status
     */
    @GetMapping("/images/{sceneId}/status")
    public ResponseEntity<Scene> getSceneStatus(
            @PathVariable String sessionId,
            @PathVariable String sceneId) {

        Scene scene = generationService.getSceneStatus(sessionId, sceneId);
        return ResponseEntity.ok(scene);
    }

    /**
     * 세션 내 모든 씬 이미지를 순차적으로 생성합니다.
     */
    @PostMapping("/images")
    public ResponseEntity<List<Scene>> generateAllImages(@PathVariable String sessionId) {
        log.info("[GenerationController] 전체 이미지 생성 요청 — sessionId: {}", sessionId);
        List<Scene> scenes = generationService.generateAllImages(sessionId);
        return ResponseEntity.ok(scenes);
    }

    /**
     * 특정 씬에 프레임을 추가합니다. (최대 4개)
     */
    @PostMapping("/frames/{sceneId}/add")
    public ResponseEntity<Frame> addFrame(
            @PathVariable String sessionId,
            @PathVariable String sceneId) {

        log.info("[GenerationController] 프레임 추가 요청 — sessionId: {}, sceneId: {}", sessionId, sceneId);
        Frame frame = generationService.addFrameToScene(sessionId, sceneId);
        return ResponseEntity.ok(frame);
    }

    /**
     * 특정 프레임의 이미지를 생성합니다.
     * body 예시: { "frameId": "f-1", "script": "cinematic close-up ..." }
     */
    @PostMapping({"/frames/{sceneId}", "/frames/{sceneId}/generate"})
    public ResponseEntity<Frame> generateFrame(
            @PathVariable String sessionId,
            @PathVariable String sceneId,
            @RequestBody(required = false) FrameGenerateRequest request) {

        String frameId = request != null ? request.getFrameId() : null;
        String script = request != null ? request.getScript() : null;

        log.info("[GenerationController] 프레임 이미지 생성 요청 — sessionId: {}, sceneId: {}, frameId: {}",
                sessionId, sceneId, frameId);

        Frame frame = generationService.generateFrameForScene(sessionId, sceneId, frameId, script);
        return ResponseEntity.ok(frame);
    }

    /**
     * 특정 씬 또는 프레임의 이미지를 수정(인페인팅)합니다.
     */
    @PostMapping("/images/{sceneId}/edit")
    public ResponseEntity<?> editImage(
            @PathVariable String sessionId,
            @PathVariable String sceneId,
            @RequestBody com.aivideo.studio.dto.ImageEditRequest request) {

        log.info("[GenerationController] 이미지 인페인팅 요청 — sessionId: {}, sceneId: {}, frameId: {}",
                sessionId, sceneId, request.getFrameId());

        if (request.getMaskBase64() == null || request.getMaskBase64().isBlank()) {
            throw new IllegalArgumentException("maskBase64가 필요합니다.");
        }

        if (request.getFrameId() != null && !request.getFrameId().isBlank()) {
            Frame frame = generationService.editFrameImage(sessionId, sceneId, request.getFrameId(), request.getPrompt(), request.getMaskBase64());
            return ResponseEntity.ok(frame);
        } else {
            Scene scene = generationService.editSceneImage(sessionId, sceneId, request.getPrompt(), request.getMaskBase64());
            return ResponseEntity.ok(scene);
        }
    }

    /**
     * 현재 프레임 이미지를 레퍼런스로 유지하면서 자세/동작을 재생성합니다.
     */
    @PostMapping("/images/{sceneId}/regenerate")
    public ResponseEntity<Frame> regenerateWithReference(
            @PathVariable String sessionId,
            @PathVariable String sceneId,
            @RequestBody com.aivideo.studio.dto.ImageEditRequest request) {

        log.info("[GenerationController] 레퍼런스 재생성 요청 — sessionId: {}, sceneId: {}, frameId: {}",
                sessionId, sceneId, request.getFrameId());

        Frame frame = generationService.regenerateFrameWithReference(
                sessionId, sceneId, request.getFrameId(), request.getPrompt());
        return ResponseEntity.ok(frame);
    }

    /**
     * 씬 description을 Gemini로 Start/End Frame 스크립트로 분리합니다.
     * POST /api/v1/sessions/{sessionId}/generation/frames/{sceneId}/split
     */
    @PostMapping("/frames/{sceneId}/split")
    public ResponseEntity<SplitScriptResponse> splitFrameScripts(
            @PathVariable String sessionId,
            @PathVariable String sceneId) {

        log.info("[GenerationController] 스크립트 분리 요청 — sessionId: {}, sceneId: {}", sessionId, sceneId);
        SplitScriptResponse response = generationService.splitFrameScripts(sessionId, sceneId);
        return ResponseEntity.ok(response);
    }

    /**
     * 특정 씬의 비디오를 Veo 3.1 모델로 생성합니다. (Phase 3)
     */
    @PostMapping("/videos/{sceneId}")
    public ResponseEntity<Map<String, String>> generateVideo(
            @PathVariable String sessionId,
            @PathVariable String sceneId) {

        log.info("[GenerationController] 비디오 생성 요청 — sessionId: {}, sceneId: {}", sessionId, sceneId);

        // 즉시 실패 가능한 조건(세션/씬/기준 이미지 누락)은 요청 단계에서 검증
        generationService.validateVideoGenerationRequest(sessionId, sceneId);

        // 영상 생성은 비동기 작업으로 길어질 수 있으므로 별도 스레드에서 실행
        Thread worker = new Thread(() -> {
            try {
                generationService.generateVideo(sessionId, sceneId);
            } catch (Exception e) {
                log.error("비디오 생성 중 오류 발생: sessionId={}, sceneId={}", sessionId, sceneId, e);
            }
        }, "video-generation-" + sessionId + "-" + sceneId);
        worker.setDaemon(true);
        worker.start();

        return ResponseEntity.accepted().body(Map.of(
                "status", "accepted",
                "message", "Video generation started",
                "sceneId", sceneId
        ));
    }

    @GetMapping("/videos/{sceneId}/preview")
    public ResponseEntity<byte[]> previewVideo(
            @PathVariable String sessionId,
            @PathVariable String sceneId) {

        ResponseEntity<byte[]> upstream = generationService.getVideoPreview(sessionId, sceneId);
        MediaType contentType = upstream.getHeaders().getContentType() != null
                ? upstream.getHeaders().getContentType()
                : MediaType.parseMediaType("video/mp4");

        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(upstream.getBody());
    }

    // ─── Character Reference Image APIs ──────────────────────────────────────

    /**
     * 캐릭터 베이스 레퍼런스 이미지를 생성합니다.
     * POST /api/v1/sessions/{sessionId}/generation/characters/{charId}/references/generate
     */
    @PostMapping("/characters/{charId}/references/generate")
    public ResponseEntity<com.aivideo.studio.dto.Character> generateCharacterBase(
            @PathVariable String sessionId,
            @PathVariable String charId) {

        log.info("[GenerationController] 캐릭터 베이스 이미지 생성 — sessionId: {}, charId: {}", sessionId, charId);
        com.aivideo.studio.dto.Character character = generationService.generateCharacterBaseImage(sessionId, charId);
        return ResponseEntity.ok(character);
    }

    /**
     * 베이스 이미지를 레퍼런스로 표정/앵글 변형 이미지를 생성합니다.
     * POST /api/v1/sessions/{sessionId}/generation/characters/{charId}/references/variant
     * body: { "variantType": "smile" | "cry" | "angry" | "back" | "side" }
     */
    @PostMapping("/characters/{charId}/references/variant")
    public ResponseEntity<com.aivideo.studio.dto.Character> generateCharacterVariant(
            @PathVariable String sessionId,
            @PathVariable String charId,
            @RequestBody Map<String, String> body) {

        String variantType = body.getOrDefault("variantType", "smile");
        log.info("[GenerationController] 캐릭터 변형 이미지 생성 — sessionId: {}, charId: {}, type: {}", sessionId, charId, variantType);
        com.aivideo.studio.dto.Character character = generationService.generateCharacterVariant(sessionId, charId, variantType);
        return ResponseEntity.ok(character);
    }

    /**
     * 특정 레퍼런스 이미지를 삭제합니다.
     * DELETE /api/v1/sessions/{sessionId}/generation/characters/{charId}/references/{index}
     */
    @DeleteMapping("/characters/{charId}/references/{index}")
    public ResponseEntity<com.aivideo.studio.dto.Character> deleteCharacterReference(
            @PathVariable String sessionId,
            @PathVariable String charId,
            @PathVariable int index) {

        log.info("[GenerationController] 캐릭터 레퍼런스 삭제 — sessionId: {}, charId: {}, index: {}", sessionId, charId, index);
        com.aivideo.studio.dto.Character character = generationService.deleteCharacterReference(sessionId, charId, index);
        return ResponseEntity.ok(character);
    }

    /**
     * 캐릭터 레퍼런스 이미지를 유지하면서 자세/동작을 변경해 재생성합니다.
     * POST /api/v1/sessions/{sessionId}/generation/characters/{charId}/references/{index}/pose
     * body: { "prompt": "웃으면서 팔짱을 낀 자세" }
     */
    @PostMapping("/characters/{charId}/references/{index}/pose")
    public ResponseEntity<com.aivideo.studio.dto.Character> regenerateCharacterRefPose(
            @PathVariable String sessionId,
            @PathVariable String charId,
            @PathVariable int index,
            @RequestBody Map<String, String> body) {

        String prompt = body.getOrDefault("prompt", "");
        log.info("[GenerationController] 캐릭터 레퍼런스 자세 변경 — sessionId: {}, charId: {}, index: {}", sessionId, charId, index);
        com.aivideo.studio.dto.Character character = generationService.regenerateCharacterRefWithPose(sessionId, charId, index, prompt);
        return ResponseEntity.ok(character);
    }

    /**
     * 캐릭터 레퍼런스 이미지를 인페인팅(부분 수정)합니다.
     * POST /api/v1/sessions/{sessionId}/generation/characters/{charId}/references/{index}/edit
     */
    @PostMapping("/characters/{charId}/references/{index}/edit")
    public ResponseEntity<com.aivideo.studio.dto.Character> editCharacterRef(
            @PathVariable String sessionId,
            @PathVariable String charId,
            @PathVariable int index,
            @RequestBody com.aivideo.studio.dto.ImageEditRequest request) {

        if (request.getMaskBase64() == null || request.getMaskBase64().isBlank()) {
            throw new IllegalArgumentException("maskBase64가 필요합니다.");
        }
        log.info("[GenerationController] 캐릭터 레퍼런스 인페인팅 — sessionId: {}, charId: {}, index: {}", sessionId, charId, index);
        com.aivideo.studio.dto.Character character = generationService.editCharacterRefImage(
                sessionId, charId, index, request.getPrompt(), request.getMaskBase64());
        return ResponseEntity.ok(character);
    }
}
