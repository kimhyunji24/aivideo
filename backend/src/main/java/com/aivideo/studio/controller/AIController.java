package com.aivideo.studio.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aivideo.studio.dto.PlanningSeedRequest;
import com.aivideo.studio.dto.PlanningSeedResponse;
import com.aivideo.studio.dto.ProjectResponse;
import com.aivideo.studio.service.AIService;

@RestController
@RequestMapping("/api")
public class AIController {

    private final AIService aiService;

    public AIController(AIService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/plot")
    public ResponseEntity<List<ProjectResponse.PlotResponse>> generatePlot(@RequestBody String idea) {
        return ResponseEntity.ok(aiService.generatePlot(idea));
    }

    @PostMapping("/planning-seed")
    public ResponseEntity<PlanningSeedResponse> generatePlanningSeed(@RequestBody PlanningSeedRequest request) {
        return ResponseEntity.ok(aiService.generatePlanningSeed(request));
    }
}
