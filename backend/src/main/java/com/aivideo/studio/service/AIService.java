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

import com.aivideo.studio.dto.PlanningSeedRequest;
import com.aivideo.studio.dto.PlanningSeedResponse;
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
     * 기획 단계용 1차 시드(캐릭터 시트 + 플롯 단계) 생성.
     * mock-first: API 키가 없거나 실패하면 mock 결과를 반환한다.
     */
    public PlanningSeedResponse generatePlanningSeed(PlanningSeedRequest request) {
        if (request == null) {
            request = new PlanningSeedRequest();
        }
        if (mockMode || googleApiKey == null || googleApiKey.isBlank()) {
            log.info("Mock mode or no Google API key — returning mock planning seed");
            return generateMockPlanningSeed(request);
        }
        try {
            return generatePlanningSeedWithGemini(request);
        } catch (Exception e) {
            log.error("Gemini planning seed 호출 실패, mock으로 fallback: {}", e.getMessage());
            return generateMockPlanningSeed(request);
        }
    }

    /**
     * Gemini GenerateContent API로 플롯 JSON 생성 후 PlotResponse 리스트로 변환.
     */
    private List<ProjectResponse.PlotResponse> generatePlotWithGemini(String idea) throws Exception {
        String rawText = requestGeminiText(buildPlotPrompt(idea));
        String jsonText = stripJsonMarkdown(rawText);
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

    private PlanningSeedResponse generatePlanningSeedWithGemini(PlanningSeedRequest request) throws Exception {
        int stageCount = normalizeStageCount(request.getStageCount());
        List<String> stageLabels = getStageLabels(stageCount);
        String rawText = requestGeminiText(buildPlanningSeedPrompt(request, stageCount, stageLabels));
        String jsonText = stripJsonMarkdown(rawText);
        JsonNode root = objectMapper.readTree(jsonText);
        return parsePlanningSeed(root, request, stageCount, stageLabels, "gemini");
    }

    private PlanningSeedResponse generateMockPlanningSeed(PlanningSeedRequest request) {
        int stageCount = normalizeStageCount(request.getStageCount());
        List<String> stageLabels = getStageLabels(stageCount);
        String logline = firstNonBlank(request.getLogline(), request.getIdea(), "새로운 이야기");
        String userPrompt = firstNonBlank(request.getUserPrompt(), "");
        List<String> genres = safeList(request.getSelectedGenres());
        List<String> worldviews = safeList(request.getSelectedWorldviews());

        List<PlanningSeedResponse.CharacterSeed> characters = new ArrayList<>();
        String worldviewHint = worldviews.isEmpty() ? "현실 세계" : String.join(", ", worldviews);
        String genreHint = genres.isEmpty() ? "드라마" : String.join(", ", genres);

        characters.add(PlanningSeedResponse.CharacterSeed.builder()
                .id("char-auto-main")
                .name("주인공")
                .gender("male")
                .appearance(worldviewHint + "에서 살아가는 인물")
                .personality("결핍이 있지만 끝까지 포기하지 않는 성격")
                .values("소중한 관계와 약속을 지키는 것")
                .trauma(shorten(logline, 80))
                .build());
        characters.add(PlanningSeedResponse.CharacterSeed.builder()
                .id("char-auto-support")
                .name("대립/조력 인물")
                .gender("female")
                .appearance(genreHint + " 톤을 강화하는 대비적 인물")
                .personality("냉정하지만 결정적인 순간에 변화를 만드는 성격")
                .values("현실적 선택과 생존")
                .trauma("주인공과 얽힌 과거 사건")
                .build());

        List<PlanningSeedResponse.PlotStageSeed> stages = new ArrayList<>();
        String protagonist = characters.get(0).getName();
        for (int i = 0; i < stageLabels.size(); i++) {
            String label = stageLabels.get(i);
            String content = switch (label) {
                case "발단" -> protagonist + "은(는) " + shorten(logline, 60)
                        + "의 시작점에서 일상을 벗어날 선택 앞에 선다.";
                case "전개" -> protagonist + "은(는) 첫 시도를 통해 문제의 실체를 알게 되고, "
                        + "관계의 균열과 갈등이 점점 커진다.";
                case "위기" -> "숨겨진 진실이 드러나며 " + protagonist
                        + "이(가) 믿어 온 가치가 흔들리고, 모든 것을 잃을 위기에 처한다.";
                case "절정" -> protagonist
                        + "은(는) 가장 두려운 선택을 감수하고 정면 돌파를 택한다.";
                case "결말" -> protagonist
                        + "은(는) 대가를 치른 뒤 한 단계 성장한 모습으로 새로운 균형에 도달한다.";
                default -> label + " 단계 내용을 작성하세요.";
            };
            if (!userPrompt.isBlank()) {
                content = content + " 사용자 요청 반영: " + shorten(userPrompt, 80);
            }
            stages.add(PlanningSeedResponse.PlotStageSeed.builder()
                    .id("stage-" + i)
                    .label(label)
                    .content(content)
                    .build());
        }

        return PlanningSeedResponse.builder()
                .source("mock")
                .characters(characters)
                .plotPlan(PlanningSeedResponse.PlotPlanSeed.builder()
                        .stageCount(stageCount)
                        .stages(stages)
                        .build())
                .build();
    }

    private PlanningSeedResponse parsePlanningSeed(
            JsonNode root,
            PlanningSeedRequest request,
            int stageCount,
            List<String> stageLabels,
            String source
    ) {
        List<String> genres = safeList(request.getSelectedGenres());
        List<String> worldviews = safeList(request.getSelectedWorldviews());
        String logline = firstNonBlank(request.getLogline(), request.getIdea(), "새로운 이야기");

        List<PlanningSeedResponse.CharacterSeed> characters = new ArrayList<>();
        JsonNode charactersNode = root.path("characters");
        if (charactersNode.isArray()) {
            for (int i = 0; i < charactersNode.size(); i++) {
                JsonNode node = charactersNode.get(i);
                String name = firstNonBlank(node.path("name").asText(""), i == 0 ? "주인공" : "대립/조력 인물");
                String gender = normalizeGender(node.path("gender").asText(""));
                characters.add(PlanningSeedResponse.CharacterSeed.builder()
                        .id(firstNonBlank(node.path("id").asText(""), "char-auto-" + i))
                        .name(name)
                        .gender(gender)
                        .appearance(firstNonBlank(node.path("appearance").asText(""), "특징이 드러나는 외형"))
                        .personality(firstNonBlank(node.path("personality").asText(""), "핵심 성격을 지닌 인물"))
                        .values(firstNonBlank(node.path("values").asText(""), "지키고 싶은 가치"))
                        .trauma(firstNonBlank(node.path("trauma").asText(""), "갈등을 유발하는 과거 상처"))
                        .build());
            }
        }

        if (characters.isEmpty()) {
            PlanningSeedRequest fallbackReq = PlanningSeedRequest.builder()
                    .idea(request.getIdea())
                    .logline(logline)
                    .selectedGenres(genres)
                    .selectedWorldviews(worldviews)
                    .stageCount(stageCount)
                    .build();
            characters = generateMockPlanningSeed(fallbackReq).getCharacters();
        }

        JsonNode plotPlanNode = root.path("plotPlan");
        JsonNode stagesNode = plotPlanNode.path("stages");
        List<PlanningSeedResponse.PlotStageSeed> stages = new ArrayList<>();
        for (int i = 0; i < stageLabels.size(); i++) {
            String fallbackLabel = stageLabels.get(i);
            JsonNode stageNode = stagesNode.isArray() && i < stagesNode.size() ? stagesNode.get(i) : null;
            String label = fallbackLabel;
            String content = "";

            if (stageNode != null && !stageNode.isMissingNode()) {
                label = firstNonBlank(stageNode.path("label").asText(""), fallbackLabel);
                content = stageNode.path("content").asText("");
            }
            if (content == null || content.isBlank()) {
                content = label + " 단계 내용을 작성하세요.";
            }

            stages.add(PlanningSeedResponse.PlotStageSeed.builder()
                    .id("stage-" + i)
                    .label(label)
                    .content(content)
                    .build());
        }

        return PlanningSeedResponse.builder()
                .source(source)
                .characters(characters)
                .plotPlan(PlanningSeedResponse.PlotPlanSeed.builder()
                        .stageCount(stageCount)
                        .stages(stages)
                        .build())
                .build();
    }

    private String buildPlanningSeedPrompt(PlanningSeedRequest request, int stageCount, List<String> stageLabels) {
        String idea = firstNonBlank(request.getIdea(), "");
        String logline = firstNonBlank(request.getLogline(), idea, "새로운 이야기");
        String userPrompt = firstNonBlank(request.getUserPrompt(), "없음");
        String genres = safeList(request.getSelectedGenres()).isEmpty()
                ? "없음"
                : String.join(", ", safeList(request.getSelectedGenres()));
        String worldviews = safeList(request.getSelectedWorldviews()).isEmpty()
                ? "없음"
                : String.join(", ", safeList(request.getSelectedWorldviews()));

        return """
                당신은 영상 기획 어시스턴트입니다.
                아래 입력으로 '캐릭터 시트'와 '%d단계 1차 스토리'를 생성하세요.

                아이디어: "%s"
                로그라인: "%s"
                장르&스타일: "%s"
                세계관&배경: "%s"
                사용자 지시사항: "%s"
                단계 라벨 고정: %s

                응답은 반드시 아래 JSON 객체만 반환하세요. 다른 텍스트는 절대 포함하지 마세요.
                {
                  "characters": [
                    {
                      "id": "char-auto-main",
                      "name": "이름",
                      "gender": "male",
                      "appearance": "외면 설명",
                      "personality": "성격",
                      "values": "가치관",
                      "trauma": "상처/결핍"
                    },
                    {
                      "id": "char-auto-support",
                      "name": "이름",
                      "gender": "female",
                      "appearance": "외면 설명",
                      "personality": "성격",
                      "values": "가치관",
                      "trauma": "상처/결핍"
                    }
                  ],
                  "plotPlan": {
                    "stageCount": %d,
                    "stages": [
                      { "id": "stage-0", "label": "%s", "content": "한국어 2~3문장" }
                    ]
                  }
                }

                규칙:
                1) characters는 2~3명 생성.
                2) gender는 male/female 중 하나.
                3) stages 길이는 정확히 %d개.
                4) stages.label은 주어진 라벨 순서를 그대로 사용.
                5) content는 한국어, 각 단계 2~3문장.
                6) 사용자 지시사항이 있으면 반드시 반영.
                """.formatted(
                        stageCount,
                        idea,
                        logline,
                        genres,
                        worldviews,
                        userPrompt,
                        String.join(", ", stageLabels),
                        stageCount,
                        stageLabels.get(0),
                        stageCount
                );
    }

    private String requestGeminiText(String userPrompt) {
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
                if (text != null && !text.toString().isBlank()) {
                    return text.toString();
                }
            }
        }
        throw new IllegalStateException("Gemini API response has no text content");
    }

    private String stripJsonMarkdown(String rawText) {
        return rawText.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();
    }

    private int normalizeStageCount(Integer stageCount) {
        if (stageCount == null) return 3;
        return switch (stageCount) {
            case 4 -> 4;
            case 5 -> 5;
            default -> 3;
        };
    }

    private List<String> getStageLabels(int stageCount) {
        return switch (stageCount) {
            case 4 -> List.of("발단", "전개", "위기", "결말");
            case 5 -> List.of("발단", "전개", "위기", "절정", "결말");
            default -> List.of("발단", "전개", "결말");
        };
    }

    private String firstNonBlank(String... candidates) {
        if (candidates == null) return "";
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) return candidate;
        }
        return "";
    }

    private List<String> safeList(List<String> values) {
        return values == null ? List.of() : values;
    }

    private String shorten(String text, int maxLen) {
        if (text == null || text.isBlank()) return "";
        if (text.length() <= maxLen) return text;
        return text.substring(0, maxLen) + "...";
    }

    private String normalizeGender(String value) {
        if (value == null) return null;
        String normalized = value.trim().toLowerCase();
        if ("male".equals(normalized) || "female".equals(normalized)) {
            return normalized;
        }
        return null;
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
