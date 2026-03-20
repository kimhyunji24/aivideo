package com.aivideo.studio.controller;

import com.aivideo.studio.dto.Scene;
import com.aivideo.studio.service.GenerationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
     * 특정 씬의 비디오를 Veo 3.1 모델로 생성합니다. (Phase 3)
     */
    @PostMapping("/videos/{sceneId}")
    public ResponseEntity<Void> generateVideo(
            @PathVariable String sessionId,
            @PathVariable Object sceneId) {

        log.info("[GenerationController] 비디오 생성 요청 — sessionId: {}, sceneId: {}", sessionId, sceneId);
        
        // 영상 생성은 비동기 작업으로 길어질 수 있으므로 별도 스레드에서 실행
        new Thread(() -> {
            try {
                generationService.generateVideo(sessionId, sceneId);
            } catch (Exception e) {
                log.error("비디오 생성 중 오류 발생: sessionId={}, sceneId={}", sessionId, sceneId, e);
            }
        }).start();

        return ResponseEntity.ok().build();
    }
}
