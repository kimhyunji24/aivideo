package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.repository.ProjectSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final ProjectSessionRepository repository;

    public String createNewSession() {
        String sessionId = UUID.randomUUID().toString();
        ProjectState initialState = new ProjectState();
        initialState.setMode("beginner"); // 프론트엔드 초기값 연동
        repository.save(sessionId, initialState);
        return sessionId;
    }

    public ProjectState getSession(String sessionId) {
        return repository.findById(sessionId);
    }

    public void updateSession(String sessionId, ProjectState state) {
        repository.save(sessionId, state);
    }
}
