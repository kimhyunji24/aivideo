package com.aivideo.studio.controller;

import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.service.PlanningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/planning")
@RequiredArgsConstructor
public class PlanningController {

    private final PlanningService planningService;

    @PostMapping("/logline")
    public ResponseEntity<ProjectState> generateLogline(
            @PathVariable String sessionId,
            @RequestBody String idea) {
        ProjectState updatedState = planningService.generateLogline(sessionId, idea);
        return ResponseEntity.ok(updatedState);
    }

    @PostMapping("/characters")
    public ResponseEntity<ProjectState> generateCharacters(@PathVariable String sessionId) {
        ProjectState updatedState = planningService.generateCharacters(sessionId);
        return ResponseEntity.ok(updatedState);
    }

    @PostMapping("/plot")
    public ResponseEntity<ProjectState> generatePlot(
            @PathVariable String sessionId,
            @RequestBody com.aivideo.studio.dto.PlotGenerateRequest request) {
        ProjectState updatedState = planningService.generatePlot(sessionId, request.getStageCount(), request.getUserPrompt());
        return ResponseEntity.ok(updatedState);
    }
}
