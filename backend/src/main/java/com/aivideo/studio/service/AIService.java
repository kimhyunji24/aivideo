package com.aivideo.studio.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.aivideo.studio.dto.ProjectRequest;
import com.aivideo.studio.dto.ProjectResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AIService {

    private static final Logger log = LoggerFactory.getLogger(AIService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final Random random = new Random();

    @Value("${google.api-key:}")
    private String googleApiKey;

    @Value("${aivideo.mock-mode:false}")
    private boolean mockMode;

    public AIService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 아이디어 기반 플롯 3개 생성 — Claude API 우선, 실패 시 mock fallback
     */
    public List<ProjectResponse.PlotResponse> generatePlot(String idea) {
        if (mockMode || googleApiKey == null || googleApiKey.isBlank()) {
            log.info("Mock mode or no API key — returning mock plots");
            return generateMockPlots(idea);
        }
        try {
            return generatePlotWithGemini(idea);
        } catch (Exception e) {
            log.error("Gemini API 호출 실패, mock으로 fallback: {}", e.getMessage());
            return generateMockPlots(idea);
        }
    }

    private List<ProjectResponse.PlotResponse> generatePlotWithGemini(String idea) throws Exception {
        String prompt = buildPlotPrompt(idea);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> part = new HashMap<>();
        part.put("text", prompt);

        Map<String, Object> content = new HashMap<>();
        content.put("parts", List.of(part));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(content));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + googleApiKey;

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.getBody().get("candidates");
        Map<String, Object> candidateContent = (Map<String, Object>) candidates.get(0).get("content");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) candidateContent.get("parts");
        String rawText = (String) parts.get(0).get("text");

        // 마크다운 코드블록 제거
        String jsonText = rawText.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();

        JsonNode plotsArray = objectMapper.readTree(jsonText);
        return parsePlots(plotsArray);
    }

    private String buildPlotPrompt(String idea) {
        return """
                당신은 AI 팬 영상 제작 어시스턴트입니다. 아래 아이디어를 바탕으로 영상 플롯 3가지를 생성하세요.

                아이디어: "%s"

                다음 JSON 배열 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
                플롯 ID는 "plot-1", "plot-2", "plot-3" 으로 고정합니다.
                씬 title과 description은 한국어로, prompt는 이미지 AI 생성용 영문으로 작성합니다.

                [
                  {
                    "id": "plot-1",
                    "title": "플롯 제목 (한국어)",
                    "summary": "플롯 요약 설명 (한국어, 2-3문장)",
                    "tone": "분위기 키워드 (한국어, 예: 드라마틱/감성적)",
                    "scenes": [
                      {
                        "title": "씬 제목 (한국어)",
                        "description": "씬 상황 설명 (한국어, 1-2문장)",
                        "prompt": "cinematic shot of ...(English AI image prompt)",
                        "duration": 3,
                        "elements": {
                          "mainCharacter": "메인 캐릭터 묘사",
                          "subCharacter": "보조 캐릭터 묘사 (없으면 빈 문자열)",
                          "action": "행동 묘사",
                          "pose": "포즈 묘사",
                          "background": "배경 묘사",
                          "time": "시간대",
                          "composition": "카메라 구도",
                          "lighting": "조명",
                          "mood": "분위기",
                          "story": "씬의 서사적 역할"
                        }
                      }
                    ]
                  }
                ]

                plot-1: 드라마틱한 감성 중심 (씬 5개)
                plot-2: 역동적인 액션 중심 (씬 6개)
                plot-3: 시네마틱 분위기 중심 (씬 4개)
                """.formatted(idea);
    }

    private List<ProjectResponse.PlotResponse> parsePlots(JsonNode plotsArray) {
        List<ProjectResponse.PlotResponse> plots = new ArrayList<>();

        for (int i = 0; i < plotsArray.size(); i++) {
            JsonNode plotNode = plotsArray.get(i);
            ProjectResponse.PlotResponse plot = new ProjectResponse.PlotResponse();
            plot.setId(plotNode.path("id").asText("plot-" + (i + 1)));
            plot.setTitle(plotNode.path("title").asText("플롯 " + (i + 1)));
            plot.setSummary(plotNode.path("summary").asText(""));
            plot.setTone(plotNode.path("tone").asText(""));

            List<ProjectResponse.SceneResponse> scenes = new ArrayList<>();
            JsonNode scenesNode = plotNode.path("scenes");
            for (int j = 0; j < scenesNode.size(); j++) {
                JsonNode sceneNode = scenesNode.get(j);
                ProjectResponse.SceneResponse scene = new ProjectResponse.SceneResponse();
                scene.setId((long) Math.abs(random.nextInt(100000)));
                scene.setTitle(sceneNode.path("title").asText("씬 " + (j + 1)));
                scene.setDescription(sceneNode.path("description").asText(""));
                scene.setPrompt(sceneNode.path("prompt").asText(""));
                scene.setDuration(sceneNode.path("duration").asInt(3));
                scene.setStatus("pending");
                scene.setSeed(Math.abs(random.nextLong()));

                JsonNode elementsNode = sceneNode.path("elements");
                ProjectRequest.SceneElementsDto elements = new ProjectRequest.SceneElementsDto();
                if (!elementsNode.isMissingNode()) {
                    elements.setMainCharacter(nullIfEmpty(elementsNode.path("mainCharacter").asText(null)));
                    elements.setSubCharacter(nullIfEmpty(elementsNode.path("subCharacter").asText(null)));
                    elements.setAction(nullIfEmpty(elementsNode.path("action").asText(null)));
                    elements.setPose(nullIfEmpty(elementsNode.path("pose").asText(null)));
                    elements.setBackground(nullIfEmpty(elementsNode.path("background").asText(null)));
                    elements.setTime(nullIfEmpty(elementsNode.path("time").asText(null)));
                    elements.setComposition(nullIfEmpty(elementsNode.path("composition").asText(null)));
                    elements.setLighting(nullIfEmpty(elementsNode.path("lighting").asText(null)));
                    elements.setMood(nullIfEmpty(elementsNode.path("mood").asText(null)));
                    elements.setStory(nullIfEmpty(elementsNode.path("story").asText(null)));
                }
                scene.setElements(elements);
                scenes.add(scene);
            }

            plot.setSceneCount(scenes.size());
            plot.setScenes(scenes);
            plots.add(plot);
        }

        return plots;
    }

    private String nullIfEmpty(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }

    /**
     * Mock 플롯 — API 키 없거나 mock-mode 시 사용
     */
    private List<ProjectResponse.PlotResponse> generateMockPlots(String idea) {
        List<ProjectResponse.PlotResponse> plots = new ArrayList<>();
        plots.add(createMockPlot(idea, "plot-1", "드라마틱 내러티브", "\"" + idea + "\"의 감정적인 해석으로, 캐릭터의 깊이와 시각적 스토리텔링에 초점을 맞춘 드라마틱한 전개", "드라마틱 / 감성적", 5));
        plots.add(createMockPlot(idea, "plot-2", "액션 중심 버전", "\"" + idea + "\"의 역동적인 해석으로, 다이나믹한 카메라 워크와 흥미진진한 시각적 시퀀스 중심", "에너지틱 / 역동적", 6));
        plots.add(createMockPlot(idea, "plot-3", "분위기 있는 시네마틱", "\"" + idea + "\"의 슬로우번 시네마틱 접근으로, 분위기와 예술적 비주얼을 강조", "시네마틱 / 예술적", 4));
        return plots;
    }

    private ProjectResponse.PlotResponse createMockPlot(String idea, String id, String title, String summary, String tone, int count) {
        ProjectResponse.PlotResponse plot = new ProjectResponse.PlotResponse();
        plot.setId(id);
        plot.setTitle(title);
        plot.setSummary(summary);
        plot.setTone(tone);
        plot.setSceneCount(count);
        plot.setScenes(generateMockScenes(idea, count));
        return plot;
    }

    private List<ProjectResponse.SceneResponse> generateMockScenes(String idea, int count) {
        String[][] titleSets = {
            {"오프닝", "첫 만남", "전개", "클라이맥스", "엔딩"},
            {"시작", "긴장 고조", "대결", "반전", "결말", "에필로그"},
            {"도입", "분위기 조성", "전환점", "마무리"},
        };
        String[] titles = titleSets[Math.min(count - 4, 2)];

        List<ProjectResponse.SceneResponse> scenes = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ProjectResponse.SceneResponse scene = new ProjectResponse.SceneResponse();
            scene.setId((long) Math.abs(random.nextInt(100000)));
            scene.setTitle(i < titles.length ? titles[i] : "씬 " + (i + 1));
            scene.setDescription("\"" + idea + "\"를 기반으로 한 씬 설명");
            scene.setPrompt("Cinematic shot related to " + idea + ", scene " + (i + 1));
            scene.setDuration(3);
            scene.setStatus("pending");
            scene.setSeed(Math.abs(random.nextLong()));
            scene.setElements(new ProjectRequest.SceneElementsDto());
            scenes.add(scene);
        }
        return scenes;
    }

    /**
     * 10대 요소를 바탕으로 영문 프롬프트 조합
     */
    public String combinePrompt(ProjectRequest.SceneElementsDto elements) {
        if (elements == null) return "A cinematic scene";

        StringBuilder sb = new StringBuilder();
        if (elements.getComposition() != null) sb.append(elements.getComposition()).append(" of ");
        if (elements.getMainCharacter() != null) sb.append(elements.getMainCharacter());
        if (elements.getSubCharacter() != null) sb.append(" with ").append(elements.getSubCharacter());
        if (elements.getAction() != null) sb.append(", ").append(elements.getAction());
        if (elements.getPose() != null) sb.append(" in ").append(elements.getPose()).append(" pose");
        if (elements.getBackground() != null) sb.append(", background is ").append(elements.getBackground());
        if (elements.getTime() != null) sb.append(" at ").append(elements.getTime());
        if (elements.getLighting() != null) sb.append(", with ").append(elements.getLighting()).append(" lighting");
        if (elements.getMood() != null) sb.append(", ").append(elements.getMood()).append(" mood");
        if (elements.getStory() != null) sb.append(". Narrative: ").append(elements.getStory());

        return sb.isEmpty() ? "A cinematic scene" : sb.toString();
    }
}
