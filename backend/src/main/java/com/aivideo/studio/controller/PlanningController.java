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
}
