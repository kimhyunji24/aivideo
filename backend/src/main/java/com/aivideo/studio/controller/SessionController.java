package com.aivideo.studio.controller;

import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping
    public ResponseEntity<String> createSession() {
        String sessionId = sessionService.createNewSession();
        return ResponseEntity.ok(sessionId);
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<ProjectState> getSession(@PathVariable String sessionId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(state);
    }

    @PutMapping("/{sessionId}")
    public ResponseEntity<Void> updateSession(@PathVariable String sessionId, @RequestBody ProjectState state) {
        sessionService.updateSession(sessionId, state);
        return ResponseEntity.ok().build();
    }
}
