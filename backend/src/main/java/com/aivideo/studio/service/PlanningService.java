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

        String incomingIdea = idea.trim();
        String baseIdea = state.getIdea() != null && !state.getIdea().isBlank()
                ? state.getIdea().trim()
                : incomingIdea;
        boolean hasOriginalIdea = state.getIdea() != null && !state.getIdea().isBlank();

        String prompt = buildLoglinePrompt(baseIdea, incomingIdea, hasOriginalIdea);
        String logline = geminiAdapter.generateText(prompt);

        // 최초 아이디어를 기준으로 유지하고, 이후 입력은 수정 지시로만 반영한다.
        state.setIdea(baseIdea);
        state.setPlanningPrompt(incomingIdea);
        state.setLogline(logline.trim());

        sessionService.updateSession(sessionId, state);
        return state;
    }

    public ProjectState generateCharacters(String sessionId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);

        String prompt = String.format(
            "다음 로그라인과 장르, 세계관을 바탕으로 이 스토리에 등장해야 할 '핵심 인물'들을 생성해줘.\n" +
            "무조건 2명을 생성하지 마. 로그라인에 명시된 주요 인물이 1명이면 1명, 3명이면 3명 등 사건 전개에 꼭 필요한 인물 수만큼만 배열에 담아줘.\n" +
            "로그라인: %s\n장르: %s\n세계관: %s\n\n" +
            "중요: 반드시 아래의 JSON 배열 규격을 정확히 지켜야 해. 각 항목의 값은 따옴표가 닫히기 전에 절대 큰따옴표(\")를 사용하지 마.\n\n" +
            "[\n" +
            "  {\n" +
            "    \"id\": \"char-고유값\",\n" +
            "    \"name\": \"캐릭터의 자연스러운 이름 (로그라인에 이름이 있다면 그대로 사용)\",\n" +
            "    \"gender\": \"male 또는 female\",\n" +
            "    \"appearance\": \"외모 묘사 (100자 이내)\",\n" +
            "    \"personality\": \"성격 묘사 (100자 이내)\",\n" +
            "    \"values\": \"가치관 (100자 이내)\",\n" +
            "    \"trauma\": \"캐릭터 특징 및 관계성 (100자 이내)\"\n" +
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

    public ProjectState regenerateCharacter(String sessionId, String charId) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);

        List<Character> characters = state.getCharacters();
        if (characters == null || characters.isEmpty()) {
            throw new IllegalArgumentException("No characters exist to regenerate.");
        }

        Character oldChar = characters.stream()
            .filter(c -> c.getId().equals(charId))
            .findFirst()
            .orElse(null);

        String oldCharName = (oldChar != null && oldChar.getName() != null) ? oldChar.getName() : "이전 캐릭터";

        // 중복 회피를 위해 변경 불변 확정 캐릭터(다른 캐릭터들) 목록 구성
        String existingProfiles = characters.stream()
                .filter(c -> !c.getId().equals(charId))
                .map(c -> String.format("- 이름: %s\n  역할/성격: %s", c.getName(), c.getPersonality()))
                .collect(java.util.stream.Collectors.joining("\n"));

        String excludeInstruction = existingProfiles.isBlank() ? "" :
                "현재 스토리에 다음 캐릭터들은 이미 확정되어 있으니 다른 인물을 생성해 (단, 로그라인에 명시된 핵심 인물이어야 해):\n" + existingProfiles + "\n\n";

        String prompt = String.format(
            "다음 로그라인을 바탕으로, 확정된 캐릭터를 제외하고 스토리에 '반드시 등장해야 하는 핵심 인물' 1명을 새롭게 묘사해줘.\n" +
            "만약 로그라인에 뽀로로와 크롱이 등장하는데 확정 캐릭터에 크롱만 있다면, 새로 재생성해야 할 인물은 당연히 '뽀로로'야. 로그라인과 무관한 새로운 제3의 인물(예: 아크, 드론 등)을 절대 창조하지 마.\n" +
            "로그라인: %s\n장르: %s\n세계관: %s\n\n" +
            "%s" +
            "이전에는 '%s'라는 인물이 이 자리에 있었지만 사용자가 더 나은 묘사를 원해 새로고침을 요청했어. 만약 이 인물이 로그라인상 '꼭 필요한 핵심 인물'이라면 다른 인물로 바꾸지 말고, 이름과 역할을 유지하되 외모, 성격, 관련 설정 등 묘사를 훨씬 더 매력적이고 자연스럽게 발전시켜줘.\n\n" +
            "중요: 단 1명의 캐릭터만 포함된 JSON 배열을 반환해. 각 항목의 값은 따옴표가 닫히기 전에 절대 큰따옴표(\")를 사용하지 마.\n\n" +
            "[\n" +
            "  {\n" +
            "    \"id\": \"%s\",\n" +
            "    \"name\": \"캐릭터의 이름 (로그라인의 핵심 인물 이름 유지)\",\n" +
            "    \"gender\": \"male 또는 female\",\n" +
            "    \"appearance\": \"외모 묘사 (100자 이내)\",\n" +
            "    \"personality\": \"성격 묘사 (100자 이내)\",\n" +
            "    \"values\": \"가치관 (100자 이내)\",\n" +
            "    \"trauma\": \"캐릭터 특징 및 기타 관계성 (100자 이내)\"\n" +
            "  }\n" +
            "]",
            state.getLogline() != null ? state.getLogline() : "없음",
            state.getSelectedGenres() != null ? String.join(", ", state.getSelectedGenres()) : "지정 안됨",
            state.getSelectedWorldviews() != null ? String.join(", ", state.getSelectedWorldviews()) : "지정 안됨",
            excludeInstruction,
            oldCharName,
            charId
        );

        log.info("[PlanningService] Regenerating character with prompt: {}", prompt);
        String jsonResponse = geminiAdapter.generateJson(prompt);
        log.info("[PlanningService] Regenerated character response: {}", jsonResponse);
        String cleaned = stripMarkdownCodeFence(jsonResponse);
        try {
            List<Character> newChars = objectMapper.readValue(cleaned, new TypeReference<List<Character>>(){});
            if (newChars != null && !newChars.isEmpty()) {
                Character newChar = newChars.get(0);
                newChar.setId(charId); // 기존 ID 유지
                
                // 기존 캐릭터 목록에서 교체
                for (int i = 0; i < characters.size(); i++) {
                    if (characters.get(i).getId().equals(charId)) {
                        characters.set(i, newChar);
                        break;
                    }
                }
                state.setCharacters(characters);
                sessionService.updateSession(sessionId, state);
                return state;
            }
            throw new RuntimeException("Generated empty character array");
        } catch (Exception e) {
            log.error("Failed to parse regenerated character JSON: {}", cleaned, e);
            throw new RuntimeException("Failed to parse regenerated character JSON: " + cleaned, e);
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

    private String buildLoglinePrompt(String baseIdea, String incomingIdea, boolean hasOriginalIdea) {
        if (!hasOriginalIdea) {
            return "다음 사용자의 아이디어를 바탕으로, 주인공이 무언가를 겪는 1~2줄짜리 흥미로운 단편 영화 로그라인을 작성해줘. " +
                    "추가적인 말이나 설명 없이 로그라인 한 문장만 출력해줘.\n" +
                    "최초 아이디어: " + baseIdea;
        }

        return "아래의 최초 아이디어를 절대적인 기준으로 유지하고, 사용자의 최신 수정 요청을 반영해 로그라인을 다시 작성해줘. " +
                "핵심 사건/주제는 최초 아이디어에서 벗어나지 마.\n" +
                "출력은 추가 설명 없이 로그라인 한 문장만.\n" +
                "최초 아이디어: " + baseIdea + "\n" +
                "최신 수정 요청: " + incomingIdea;
    }
}
