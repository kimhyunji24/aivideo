package com.aivideo.studio.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.io.InputStream;

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

    private static final String GEMINI_GENERATE_URL_TEMPLATE =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    @Value("${gemini.text-model:gemini-1.5-pro}")
    private String geminiTextModel;

    @Value("${gemini.max-tokens:8192}")
    private int geminiMaxTokens;

    @Value("${gemini.temperature:0.7}")
    private double geminiTemperature;

    public AIService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 아이디어 기반 플롯 3개 생성 — Gemini API 우선, 실패 시 mock fallback.
     * README.md 기준 GOOGLE_API_KEY 환경 변수 사용.
     */
    public List<ProjectResponse.PlotResponse> generatePlot(String idea) {
        if (mockMode || googleApiKey == null || googleApiKey.isBlank()) {
            log.info("Mock mode or no Google API key — returning mock plots");
            return loadMockPlots(idea);
        }
        try {
            return generatePlotWithGemini(idea);
        } catch (Exception e) {
            log.error("Gemini API 호출 실패, mock으로 fallback: {}", e.getMessage());
            return loadMockPlots(idea);
        }
    }

    /**
     * Gemini GenerateContent API로 플롯 JSON 생성 후 PlotResponse 리스트로 변환.
     */
    private List<ProjectResponse.PlotResponse> generatePlotWithGemini(String idea) throws Exception {
        String userPrompt = buildPlotPrompt(idea);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> part = new HashMap<>();
        part.put("text", userPrompt);

        Map<String, Object> content = new HashMap<>();
        content.put("role", "user");
        content.put("parts", List.of(part));

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("maxOutputTokens", geminiMaxTokens);
        generationConfig.put("temperature", geminiTemperature);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(content));
        requestBody.put("generationConfig", generationConfig);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response = restTemplate.exchange(
                String.format(GEMINI_GENERATE_URL_TEMPLATE, geminiTextModel, googleApiKey),
                HttpMethod.POST,
                entity,
                Map.class
        );

        Map<String, Object> body = response.getBody();
        if (body == null) {
            throw new IllegalStateException("Gemini API returned empty body");
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new IllegalStateException("Gemini API response has no candidates");
        }

        String rawText = null;
        for (Map<String, Object> candidate : candidates) {
            @SuppressWarnings("unchecked")
            Map<String, Object> candidateContent = (Map<String, Object>) candidate.get("content");
            if (candidateContent == null) {
                continue;
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> parts = (List<Map<String, Object>>) candidateContent.get("parts");
            if (parts == null) {
                continue;
            }
            for (Map<String, Object> partNode : parts) {
                Object text = partNode.get("text");
                if (text != null) {
                    rawText = text.toString();
                    break;
                }
            }
            if (rawText != null) {
                break;
            }
        }
        if (rawText == null || rawText.isBlank()) {
            throw new IllegalStateException("Gemini API response has no text content");
        }

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
    private List<ProjectResponse.PlotResponse> loadMockPlots(String idea) {
        try (InputStream input = AIService.class.getResourceAsStream("/mock/plots.json")) {
            if (input == null) {
                throw new IllegalStateException("Mock plots.json not found");
            }
            JsonNode plotsArray = objectMapper.readTree(input);
            return parsePlots(plotsArray);
        } catch (Exception e) {
            log.warn("Mock plots.json 로드 실패, 런타임 생성으로 대체: {}", e.getMessage());
            return generateMockPlots(idea);
        }
    }

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
