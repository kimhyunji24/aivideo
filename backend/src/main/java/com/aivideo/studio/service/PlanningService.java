package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PlanningService {
    
    private final SessionService sessionService;

    // TODO: 실제 AI API(Gemini 등) 연동 필요
    public ProjectState generateLogline(String sessionId, String idea) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("Session not found");
        
        // Mock 로직
        String logline = idea + "를 바탕으로, 주인공이 예상치 못한 위기 속에서 감정적 성장과 반전을 만들어내는 단편 서사.";
        state.setIdea(idea);
        state.setLogline(logline);
        
        sessionService.updateSession(sessionId, state);
        return state;
    }
}
