package com.aivideo.studio.controller;

import com.aivideo.studio.dto.Scene;
import com.aivideo.studio.dto.Frame;
import com.aivideo.studio.dto.FrameGenerateRequest;
import com.aivideo.studio.service.GenerationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
}
