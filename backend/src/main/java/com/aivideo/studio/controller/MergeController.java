package com.aivideo.studio.controller;

import com.aivideo.studio.dto.MergeJobStatus;
import com.aivideo.studio.dto.MergeRequest;
import com.aivideo.studio.service.MergeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/merge")
@RequiredArgsConstructor
public class MergeController {

    private final MergeService mergeService;

    /**
     * 병합 작업 시작
     * POST /api/v1/sessions/{sessionId}/merge
     * body: { "sceneIds": ["1", "2", "3"], "transitionDuration": 1.0 }
     */
    @PostMapping
    public ResponseEntity<MergeJobStatus> startMerge(
            @PathVariable String sessionId,
            @RequestBody MergeRequest request) {

        log.info("[MergeController] 병합 요청 — sessionId: {}, sceneIds: {}, musicFileId: {}",
                sessionId, request.getSceneIds(), request.getMusicFileId());
        MergeJobStatus status = mergeService.startMerge(
                sessionId, request.getSceneIds(), request.getTransitionType(), request.getTransitionDuration(),
                request.getMusicFileId(), request.getMusicVolume());
        return ResponseEntity.accepted().body(status);
    }

    /**
     * 배경음악 파일 업로드
     * POST /api/v1/sessions/{sessionId}/merge/music
     * multipart: file (audio)
     * returns: { musicFileId: "uuid" }
     */
    @PostMapping("/music")
    public ResponseEntity<Map<String, String>> uploadMusic(
            @PathVariable String sessionId,
            @RequestParam("file") MultipartFile file) {

        try {
            String musicFileId = mergeService.storeMusicFile(file.getBytes(), file.getOriginalFilename());
            log.info("[MergeController] 음악 업로드 — sessionId: {}, musicFileId: {}", sessionId, musicFileId);
            return ResponseEntity.ok(Map.of("musicFileId", musicFileId));
        } catch (Exception e) {
            log.error("[MergeController] 음악 업로드 실패 — sessionId: {}", sessionId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 병합 작업 상태 조회
     * GET /api/v1/sessions/{sessionId}/merge/{jobId}/status
     */
    @GetMapping("/{jobId}/status")
    public ResponseEntity<MergeJobStatus> getStatus(
            @PathVariable String sessionId,
            @PathVariable String jobId) {

        return ResponseEntity.ok(mergeService.getStatus(jobId));
    }

    /**
     * 병합 영상 조회 (미리보기 / 다운로드 공용)
     * GET /api/v1/sessions/{sessionId}/merge/{jobId}/video
     * GET /api/v1/sessions/{sessionId}/merge/{jobId}/video?download=true
     */
    @GetMapping("/{jobId}/video")
    public ResponseEntity<byte[]> getVideo(
            @PathVariable String sessionId,
            @PathVariable String jobId,
            @RequestParam(value = "download", defaultValue = "false") boolean download) {

        try {
            byte[] bytes = mergeService.getVideoBytes(jobId);
            ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("video/mp4"))
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .contentLength(bytes.length);

            if (download) {
                builder = builder.header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"merged_" + jobId.substring(0, 8) + ".mp4\"");
            }

            return builder.body(bytes);

        } catch (Exception e) {
            log.error("[MergeController] 영상 조회 실패 — jobId: {}", jobId, e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
