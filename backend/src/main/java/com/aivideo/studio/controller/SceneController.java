package com.aivideo.studio.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.aivideo.studio.dto.ProjectRequest;
import com.aivideo.studio.dto.ProjectResponse;
import com.aivideo.studio.service.SceneService;

@RestController
@RequestMapping("/api")
public class SceneController {

    private final SceneService sceneService;

    public SceneController(SceneService sceneService) {
        this.sceneService = sceneService;
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjectResponse.SceneResponse> updateScene(
            @PathVariable Long id, 
            @RequestBody ProjectRequest.SceneRequest request) {
        return ResponseEntity.ok(sceneService.updateScene(id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ProjectResponse.SceneResponse> updateStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String imageUrl,
            @RequestParam(required = false) String videoUrl) {
        return ResponseEntity.ok(sceneService.updateStatus(id, status, imageUrl, videoUrl));
    }

    @PostMapping("/generate-image")
    public ResponseEntity<ProjectResponse.SceneResponse> generateImage(@RequestParam Long id) {
        return ResponseEntity.ok(sceneService.generateImage(id));
    }

    @PostMapping("/generate-video")
    public ResponseEntity<ProjectResponse.SceneResponse> generateVideo(@RequestParam Long id) {
        return ResponseEntity.ok(sceneService.generateVideo(id));
    }

    @GetMapping("/status/{id}")
    public ResponseEntity<ProjectResponse.SceneResponse> getStatus(@PathVariable Long id) {
        return ResponseEntity.ok(sceneService.getScene(id));
    }
}
