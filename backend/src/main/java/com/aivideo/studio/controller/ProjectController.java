package com.aivideo.studio.controller;

import com.aivideo.studio.dto.ProjectRequest;
import com.aivideo.studio.dto.ProjectResponse;
import com.aivideo.studio.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(@RequestBody ProjectRequest request) {
        return ResponseEntity.ok(projectService.createProject(request));
    }

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getAllProjects() {
        return ResponseEntity.ok(projectService.getAllProjects());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectResponse> getProject(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getProject(id));
    }

    @PatchMapping("/{id}/video")
    public ResponseEntity<ProjectResponse> updateFinalVideo(
            @PathVariable Long id,
            @RequestParam String finalVideoUrl) {
        return ResponseEntity.ok(projectService.updateFinalVideo(id, finalVideoUrl));
    }
}
