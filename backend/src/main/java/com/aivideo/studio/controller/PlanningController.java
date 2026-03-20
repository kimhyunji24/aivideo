package com.aivideo.studio.controller;

import com.aivideo.studio.dto.ProjectState;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.aivideo.studio.service.PlanningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/planning")
@RequiredArgsConstructor
public class PlanningController {

    private final PlanningService planningService;
    private final ObjectMapper objectMapper;

    @PostMapping("/logline")
    public ResponseEntity<ProjectState> generateLogline(
            @PathVariable String sessionId,
            @RequestBody String body) {
        String idea = extractIdea(body);
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

    private String extractIdea(String body) {
        if (body == null || body.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        String trimmed = body.trim();
        try {
            JsonNode json = objectMapper.readTree(trimmed);
            if (json.isTextual()) {
                String value = json.asText();
                if (value == null || value.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "idea must not be blank");
                }
                return value.trim();
            }
            if (json.isObject()) {
                JsonNode ideaNode = json.get("idea");
                if (ideaNode == null || !ideaNode.isTextual() || ideaNode.asText().isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body must include non-empty 'idea'");
                }
                return ideaNode.asText().trim();
            }
        } catch (JsonProcessingException ignored) {
            // Not a JSON payload; treat it as plain-text idea.
        }

        if (trimmed.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "idea must not be blank");
        }
        return trimmed;
    }
}
