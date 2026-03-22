package com.aivideo.studio.service;

import com.aivideo.studio.dto.Character;
import com.aivideo.studio.dto.PlotPlan;
import com.aivideo.studio.dto.PlotStage;
import com.aivideo.studio.dto.ProjectState;
import com.aivideo.studio.dto.PlanningTagsResponse;
import com.aivideo.studio.dto.SceneElements;
import com.aivideo.studio.exception.SessionNotFoundException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanningService {

    private static final List<String> DEFAULT_GENRES = List.of("SF", "코미디", "드라마");
    private static final List<String> DEFAULT_WORLDVIEWS = List.of("우주", "근미래 도시", "일상생활");

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
            "    \"appearance\": \"외형 묘사 (180~250자, 형식: 헤어: ...; 얼굴/인상: ...; 체형/비율: ...; 의상/소품: ...; 색상/무드: ...)\",\n" +
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
        String imageBasedAppearance = null;
        if (oldChar != null && oldChar.getImageUrl() != null && oldChar.getImageUrl().startsWith("data:image/")) {
            try {
                imageBasedAppearance = geminiAdapter.generateCharacterAppearanceFromImage(oldChar.getImageUrl(), oldCharName);
            } catch (Exception e) {
                log.warn("이미지 기반 외형 분석 실패 - charId={}: {}", charId, e.getMessage());
            }
        }
        String existingAppearance = (oldChar != null && oldChar.getAppearance() != null) ? oldChar.getAppearance().trim() : "";
        String lockedAppearance = (imageBasedAppearance != null && !imageBasedAppearance.isBlank())
                ? imageBasedAppearance.trim()
                : existingAppearance;

        // 중복 회피를 위해 변경 불변 확정 캐릭터(다른 캐릭터들) 목록 구성
        String existingProfiles = characters.stream()
                .filter(c -> !c.getId().equals(charId))
                .map(c -> String.format("- 이름: %s\n  역할/성격: %s", c.getName(), c.getPersonality()))
                .collect(java.util.stream.Collectors.joining("\n"));

        String excludeInstruction = existingProfiles.isBlank() ? "" :
                "현재 스토리에 다음 캐릭터들은 이미 확정되어 있으니 다른 인물을 생성해 (단, 로그라인에 명시된 핵심 인물이어야 해):\n" + existingProfiles + "\n\n";
        String imageConstraintInstruction = (lockedAppearance == null || lockedAppearance.isBlank()) ? "" :
                "중요: 이 캐릭터의 외형은 반드시 다음 묘사를 유지/반영해야 해: " + lockedAppearance + "\n";

        String prompt = String.format(
            "다음 로그라인을 바탕으로, 확정된 캐릭터를 제외하고 스토리에 '반드시 등장해야 하는 핵심 인물' 1명을 새롭게 묘사해줘.\n" +
            "만약 로그라인에 뽀로로와 크롱이 등장하는데 확정 캐릭터에 크롱만 있다면, 새로 재생성해야 할 인물은 당연히 '뽀로로'야. 로그라인과 무관한 새로운 제3의 인물(예: 아크, 드론 등)을 절대 창조하지 마.\n" +
            "로그라인: %s\n장르: %s\n세계관: %s\n\n" +
            "%s" +
            "%s" +
            "이전에는 '%s'라는 인물이 이 자리에 있었지만 사용자가 더 나은 묘사를 원해 새로고침을 요청했어. 만약 이 인물이 로그라인상 '꼭 필요한 핵심 인물'이라면 다른 인물로 바꾸지 말고, 이름과 역할을 유지하되 외모, 성격, 관련 설정 등 묘사를 훨씬 더 매력적이고 자연스럽게 발전시켜줘.\n\n" +
            "중요: 단 1명의 캐릭터만 포함된 JSON 배열을 반환해. 각 항목의 값은 따옴표가 닫히기 전에 절대 큰따옴표(\")를 사용하지 마.\n\n" +
            "[\n" +
            "  {\n" +
            "    \"id\": \"%s\",\n" +
            "    \"name\": \"캐릭터의 이름 (로그라인의 핵심 인물 이름 유지)\",\n" +
            "    \"gender\": \"male 또는 female\",\n" +
            "    \"appearance\": \"외형 묘사 (180~250자, 형식: 헤어: ...; 얼굴/인상: ...; 체형/비율: ...; 의상/소품: ...; 색상/무드: ...)\",\n" +
            "    \"personality\": \"성격 묘사 (100자 이내)\",\n" +
            "    \"values\": \"가치관 (100자 이내)\",\n" +
            "    \"trauma\": \"캐릭터 특징 및 기타 관계성 (100자 이내)\"\n" +
            "  }\n" +
            "]",
            state.getLogline() != null ? state.getLogline() : "없음",
            state.getSelectedGenres() != null ? String.join(", ", state.getSelectedGenres()) : "지정 안됨",
            state.getSelectedWorldviews() != null ? String.join(", ", state.getSelectedWorldviews()) : "지정 안됨",
            excludeInstruction,
            imageConstraintInstruction,
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
                if (oldChar != null && oldChar.getImageUrl() != null && !oldChar.getImageUrl().isBlank()) {
                    newChar.setImageUrl(oldChar.getImageUrl());
                }
                if (lockedAppearance != null && !lockedAppearance.isBlank()) {
                    newChar.setAppearance(lockedAppearance);
                }
                
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

    public ProjectState updateCharacterAppearanceFromImage(String sessionId, String charId, String imageDataUrl) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);

        List<Character> characters = state.getCharacters();
        if (characters == null || characters.isEmpty()) {
            throw new IllegalArgumentException("No characters exist to update.");
        }

        Character target = characters.stream()
                .filter(c -> c != null && charId.equals(c.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("캐릭터를 찾을 수 없습니다: " + charId));

        String analyzedAppearance = geminiAdapter.generateCharacterAppearanceFromImage(
                imageDataUrl,
                target.getName()
        );

        if (analyzedAppearance == null || analyzedAppearance.isBlank()) {
            throw new IllegalArgumentException("이미지 분석 결과가 비어 있습니다.");
        }

        target.setImageUrl(imageDataUrl);
        target.setAppearance(analyzedAppearance.trim());
        state.setCharacters(characters);
        sessionService.updateSession(sessionId, state);
        return state;
    }

    public ProjectState updateBackgroundReferenceFromImage(String sessionId, String imageDataUrl) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);

        String analyzedBackground = geminiAdapter.generateBackgroundDescriptionFromImage(imageDataUrl);
        if (analyzedBackground == null || analyzedBackground.isBlank()) {
            throw new IllegalArgumentException("배경 이미지 분석 결과가 비어 있습니다.");
        }

        state.setBackgroundReferenceImageUrl(imageDataUrl);
        state.setBackgroundReferenceDescription(analyzedBackground.trim());
        sessionService.updateSession(sessionId, state);
        return state;
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
            "각 단계는 반드시 'content'와 함께 구조화된 'elements' 10요소를 포함해야 해.\n" +
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
            "      \"content\": \"[Start Frame] 주인공이 방에 들어온다. [End Frame] 주인공이 의자에 앉아 편지를 읽는다. (총 150자 이내)\",\n" +
            "      \"elements\": {\n" +
            "        \"mainCharacter\": \"메인 인물\",\n" +
            "        \"subCharacter\": \"서브 인물\",\n" +
            "        \"action\": \"핵심 행동\",\n" +
            "        \"pose\": \"자세\",\n" +
            "        \"background\": \"배경\",\n" +
            "        \"time\": \"시간대\",\n" +
            "        \"composition\": \"구도\",\n" +
            "        \"lighting\": \"조명\",\n" +
            "        \"mood\": \"분위기\",\n" +
            "        \"story\": \"해당 단계 핵심 서사\"\n" +
            "      }\n" +
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
            plotPlan.setStages(ensureStageElements(plotPlan.getStages()));
            state.setPlotPlan(plotPlan);
            sessionService.updateSession(sessionId, state);
            return state;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse plot plan JSON from: " + cleaned, e);
        }
    }

    public PlanningTagsResponse generateTags(String sessionId, String requestedLogline) {
        ProjectState state = sessionService.getSession(sessionId);
        if (state == null) throw new SessionNotFoundException(sessionId);

        String effectiveLogline = firstNonBlank(requestedLogline, state.getLogline(), state.getIdea());
        if (effectiveLogline == null || effectiveLogline.isBlank()) {
            throw new IllegalArgumentException("logline must not be blank");
        }

        String prompt =
                "다음 로그라인과 가장 관련있는 장르/스타일과 세계관/배경 태그를 추천해줘.\n" +
                "반드시 JSON 객체만 반환하고, 설명 문장은 절대 출력하지 마.\n\n" +
                "규칙:\n" +
                "1) selectedGenres, selectedWorldviews는 각각 정확히 3개\n" +
                "2) genreOptions, worldviewOptions는 각각 4~7개\n" +
                "3) selected 항목은 반드시 options 안에 포함\n" +
                "4) 태그는 짧은 한국어 표현으로\n\n" +
                "반환 JSON 포맷:\n" +
                "{\n" +
                "  \"genreOptions\": [\"SF\", \"스릴러\", \"드라마\", \"...\"],\n" +
                "  \"worldviewOptions\": [\"우주\", \"근미래 도시\", \"...\"],\n" +
                "  \"selectedGenres\": [\"SF\", \"스릴러\", \"드라마\"],\n" +
                "  \"selectedWorldviews\": [\"우주\", \"근미래 도시\", \"일상생활\"]\n" +
                "}\n\n" +
                "로그라인: " + effectiveLogline;

        PlanningTagsResponse parsed;
        try {
            String jsonResponse = geminiAdapter.generateJson(prompt);
            String cleaned = stripMarkdownCodeFence(jsonResponse);
            parsed = objectMapper.readValue(cleaned, PlanningTagsResponse.class);
        } catch (Exception e) {
            log.error("Failed to generate planning tags via Gemini", e);
            parsed = PlanningTagsResponse.builder().build();
        }

        List<String> genreOptions = normalizeList(parsed.getGenreOptions(), DEFAULT_GENRES, 4, 7);
        List<String> worldviewOptions = normalizeList(parsed.getWorldviewOptions(), DEFAULT_WORLDVIEWS, 4, 7);
        List<String> selectedGenres = normalizeSelected(parsed.getSelectedGenres(), genreOptions, 3);
        List<String> selectedWorldviews = normalizeSelected(parsed.getSelectedWorldviews(), worldviewOptions, 3);

        state.setSelectedGenres(selectedGenres);
        state.setSelectedWorldviews(selectedWorldviews);
        sessionService.updateSession(sessionId, state);

        return PlanningTagsResponse.builder()
                .genreOptions(genreOptions)
                .worldviewOptions(worldviewOptions)
                .selectedGenres(selectedGenres)
                .selectedWorldviews(selectedWorldviews)
                .build();
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

    private List<String> normalizeList(List<String> raw, List<String> fallback, int min, int max) {
        List<String> unique = raw == null ? List.of() : raw.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .distinct()
                .limit(max)
                .toList();

        if (unique.size() >= min) {
            return unique;
        }

        return fallback.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .distinct()
                .limit(max)
                .toList();
    }

    private List<String> normalizeSelected(List<String> raw, List<String> options, int size) {
        List<String> fromRaw = raw == null ? List.of() : raw.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .filter(options::contains)
                .distinct()
                .limit(size)
                .toList();

        if (fromRaw.size() == size) {
            return fromRaw;
        }

        return options.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .distinct()
                .limit(size)
                .toList();
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private List<PlotStage> ensureStageElements(List<PlotStage> stages) {
        if (stages == null) {
            return List.of();
        }

        List<PlotStage> normalized = new ArrayList<>(stages.size());
        for (PlotStage stage : stages) {
            if (stage == null) continue;

            SceneElements merged = defaultSceneElements();
            SceneElements incoming = stage.getElements();
            if (incoming != null) {
                if (isNotBlank(incoming.getMainCharacter())) merged.setMainCharacter(incoming.getMainCharacter().trim());
                if (isNotBlank(incoming.getSubCharacter())) merged.setSubCharacter(incoming.getSubCharacter().trim());
                if (isNotBlank(incoming.getAction())) merged.setAction(incoming.getAction().trim());
                if (isNotBlank(incoming.getPose())) merged.setPose(incoming.getPose().trim());
                if (isNotBlank(incoming.getBackground())) merged.setBackground(incoming.getBackground().trim());
                if (isNotBlank(incoming.getTime())) merged.setTime(incoming.getTime().trim());
                if (isNotBlank(incoming.getComposition())) merged.setComposition(incoming.getComposition().trim());
                if (isNotBlank(incoming.getLighting())) merged.setLighting(incoming.getLighting().trim());
                if (isNotBlank(incoming.getMood())) merged.setMood(incoming.getMood().trim());
                if (isNotBlank(incoming.getStory())) merged.setStory(incoming.getStory().trim());
            }
            if (isNotBlank(stage.getContent()) && !isNotBlank(merged.getStory())) {
                merged.setStory(stage.getContent().trim());
            }
            stage.setElements(merged);
            normalized.add(stage);
        }
        return normalized;
    }

    private SceneElements defaultSceneElements() {
        return SceneElements.builder()
                .mainCharacter("주인공")
                .subCharacter("조력자 1인")
                .action("주변을 천천히 살피며 이동한다")
                .pose("자연스럽고 안정적인 자세")
                .background("현실적인 도심 배경")
                .time("늦은 오후")
                .composition("미디엄 샷 중심의 안정적 구도")
                .lighting("부드러운 자연광")
                .mood("차분하지만 기대감 있는 분위기")
                .story("작은 단서를 통해 다음 장면으로 이어지는 흐름")
                .build();
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
