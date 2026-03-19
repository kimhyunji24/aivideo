package com.aivideo.studio.service;

import com.aivideo.studio.dto.ProjectState;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PlanningService {
    
    private final SessionService sessionService;
    private final GeminiAdapter geminiAdapter;

    public ProjectState generateLogline(String sessionId, String idea) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new IllegalArgumentException("Session not found");
        
        String prompt = "다음 사용자의 아이디어를 바탕으로, 주인공이 무언가를 겪는 1~2줄짜리 흥미로운 단편 영화 로그라인을 작성해줘. 추가적인 말이나 설명 없이 로그라인 한문장만 출력해줘.\n아이디어: " + idea;
        String logline = geminiAdapter.generateText(prompt);
        
        state.setIdea(idea);
        state.setLogline(logline.trim());
        
        sessionService.updateSession(sessionId, state);
        return state;
    }
}
