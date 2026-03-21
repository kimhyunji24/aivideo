package com.aivideo.studio.service;

import com.aivideo.studio.dto.Character;
import com.aivideo.studio.dto.PlotPlan;
import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.exception.SessionNotFoundException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanningService {
    
    private final SessionService sessionService;
    private final GeminiAdapter geminiAdapter;
    private final ObjectMapper objectMapper;

    public ProjectState generateLogline(String sessionId, String idea) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);
        if (idea == null || idea.isBlank()) throw new IllegalArgumentException("idea must not be blank");
        
        String prompt = "다음 사용자의 아이디어를 바탕으로, 주인공이 무언가를 겪는 1~2줄짜리 흥미로운 단편 영화 로그라인을 작성해줘. 추가적인 말이나 설명 없이 로그라인 한문장만 출력해줘.\n아이디어: " + idea;
        String logline = geminiAdapter.generateText(prompt);
        
        state.setIdea(idea.trim());
        state.setLogline(logline.trim());
        
        sessionService.updateSession(sessionId, state);
        return state;
    }

    public ProjectState generateCharacters(String sessionId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);

        String prompt = String.format(
            "다음 로그라인과 장르, 세계관을 바탕으로 주인공과 대립/조력 인물 총 2명의 캐릭터를 생성해줘.\n" +
            "로그라인: %s\n장르: %s\n세계관: %s\n\n" +
            "중요: 반드시 아래의 JSON 배열 규격을 정확히 지켜야 해. 각 항목의 값은 따옴표가 닫히기 전에 절대 큰따옴표(\")를 사용하지 마.\n\n" +
            "[\n" +
            "  {\n" +
            "    \"id\": \"char-1\",\n" +
            "    \"name\": \"이름\",\n" +
            "    \"gender\": \"male\",\n" +
            "    \"appearance\": \"외모 묘사 (100자 이내)\",\n" +
            "    \"personality\": \"성격 묘사 (100자 이내)\",\n" +
            "    \"values\": \"가치관 (100자 이내)\",\n" +
            "    \"trauma\": \"캐릭터 관계성 또는 트라우마 (100자 이내)\"\n" +
            "  }\n" +
            "]",
            state.getLogline() != null ? state.getLogline() : "없음",
            state.getSelectedGenres() != null ? String.join(", ", state.getSelectedGenres()) : "지정 안됨",
            state.getSelectedWorldviews() != null ? String.join(", ", state.getSelectedWorldviews()) : "지정 안됨"
        );

        String jsonResponse = geminiAdapter.generateJson(prompt);
        String cleaned = stripMarkdownCodeFence(jsonResponse);
        try {
            List<Character> characters = objectMapper.readValue(cleaned, new TypeReference<List<Character>>(){});
            state.setCharacters(characters);
            sessionService.updateSession(sessionId, state);
            return state;
        } catch (Exception e) {
            log.error("Failed to parse characters JSON: {}", cleaned, e);
            throw new RuntimeException("Failed to parse characters JSON: " + cleaned, e);
        }
    }

    public ProjectState generatePlot(String sessionId, int stageCount, String userPrompt) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);

        String charactersStr = "";
        try {
            charactersStr = objectMapper.writeValueAsString(state.getCharacters());
        } catch (Exception e) {}

        String prompt = String.format(
            "다음 로그라인과 캐릭터 설정을 바탕으로, %d단계(발단-전개-위기-절정-결말 중)의 플롯을 JSON으로 생성해줘.\n" +
            "추가 사용자의 요구사항이 있다면 반드시 반영해줘.\n\n" +
            "로그라인: %s\n" +
            "캐릭터 정보: %s\n" +
            "사용자 요구사항: %s\n\n" +
            "반환할 JSON 포맷:\n" +
            "{\n" +
            "  \"stageCount\": %d,\n" +
            "  \"stages\": [\n" +
            "    {\n" +
            "      \"id\": \"stage-0\",\n" +
            "      \"label\": \"발단\",\n" +
            "      \"content\": \"발단 내용 (150자 이내)\"\n" +
            "    }\n" +
            "  ]\n" +
            "}\n" +
            "반드시 위 형태의 유효한 JSON 객체만 반환해.",
            stageCount,
            state.getLogline() != null ? state.getLogline() : "없음",
            charactersStr,
            userPrompt != null ? userPrompt : "없음",
            stageCount
        );

        String jsonResponse = geminiAdapter.generateJson(prompt);
        String cleaned = stripMarkdownCodeFence(jsonResponse);
        try {
            PlotPlan plotPlan = objectMapper.readValue(cleaned, PlotPlan.class);
            state.setPlotPlan(plotPlan);
            sessionService.updateSession(sessionId, state);
            return state;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse plot plan JSON from: " + cleaned, e);
        }
    }

    private String stripMarkdownCodeFence(String response) {
        if (response == null) {
            return "";
        }
        return response.trim()
                .replaceAll("(?s)^```json\\s*", "")
                .replaceAll("(?s)^```\\s*", "")
                .replaceAll("\\s*```$", "")
                .trim();
    }
}
