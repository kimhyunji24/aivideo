package com.aivideo.studio.service;

import com.aivideo.studio.exception.UpstreamServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Gemini (Vertex AI) 텍스트 생성 어댑터
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiAdapter {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${vertex.project-id:default-project-id}")
    private String projectId;

    @Value("${vertex.location:us-central1}")
    private String location;

    @Value("${gemini.text-model:gemini-1.5-flash-002}")
    private String textModel;

    @Value("${google.application-credentials:#{null}}")
    private String credentialsPath;

    @Value("${google.api-key:#{null}}")
    private String apiKey;

    public String generateText(String prompt) {
        return sendRequest(prompt, "text/plain");
    }

    public String generateJson(String prompt) {
        return sendRequest(prompt, "application/json");
    }

    public String generateCharacterAppearanceFromImage(String imageDataUrl, String characterName) {
        return generateCharacterAppearanceFromImage(imageDataUrl, characterName, null, null, null);
    }

    public String generateCharacterAppearanceFromImage(String imageDataUrl, String characterName,
            String existingPersonality, String existingValues, String existingTrauma) {
        if (imageDataUrl == null || imageDataUrl.isBlank()) {
            throw new IllegalArgumentException("imageDataUrl must not be blank");
        }

        ParsedDataUrl parsed = parseDataUrl(imageDataUrl.trim());
        String name = (characterName == null || characterName.isBlank()) ? "캐릭터" : characterName.trim();

        // 기존 성격 정보가 있으면 힌트로 포함 (외형 분석에 참고하되 성격 설명은 출력하지 않음)
        String personalityHint = "";
        if ((existingPersonality != null && !existingPersonality.isBlank())
                || (existingValues != null && !existingValues.isBlank())
                || (existingTrauma != null && !existingTrauma.isBlank())) {
            personalityHint = "\n[참고 — 출력에 포함하지 말 것] 이 캐릭터의 기존 설정: "
                    + (existingPersonality != null ? "성격=" + existingPersonality + " " : "")
                    + (existingValues != null ? "가치관=" + existingValues + " " : "")
                    + (existingTrauma != null ? "트라우마=" + existingTrauma : "")
                    + " (이 내용은 출력하지 말고, 외형 분석 시 캐릭터의 분위기·무드·색상 선택에만 참고할 것)";
        }

        String fewShotExample = "\n\n[출력 예시 — 이런 수준의 디테일과 길이로 작성]\n"
                + "헤어: 정수리가 완전히 벗겨진 탈모 상태, 두 귀 옆 측면에만 몇 가닥의 검은 M자형 생머리 잔존; "
                + "얼굴/인상: 밝은 레몬 옐로우 피부톤, 작고 게으르게 반쯤 감긴 검은 눈동자, 납작하고 둥근 코, "
                + "살짝 처진 두꺼운 입술, 오돌토돌한 수염 자국, 처진 턱과 이중턱이 강조된 중년 특유의 피곤하고 장난기 어린 표정; "
                + "체형/비율: 150~160cm 추정, 과체중의 통통하고 불룩한 배, 짧고 굵은 팔다리, 구형에 가까운 체형; "
                + "의상/소품: 흰색 반팔 폴로 셔츠, 파란색 슬랙스 바지, 검정 단화, 별도 액세서리 없음; "
                + "색상/무드: 선명한 노랑+흰색+파랑의 원색 배합, 1990년대 미국 시트콤풍의 밝고 친근하지만 코믹하고 허탈한 무드";

        String prompt = "첨부 이미지를 보고 캐릭터 외형을 한국어로 극도로 세밀하게 묘사해줘."
                + personalityHint
                + "\n[필수 형식 — 이 순서대로 각 항목을 세미콜론으로 구분]:\n"
                + "헤어: [색상 + 길이 + 질감 + 스타일 모두 포함]; "
                + "얼굴/인상: [피부톤 + 눈 모양·색 + 코 + 입 + 전체 인상]; "
                + "체형/비율: [신장 추정 + 체형 + 몸의 비율 특징]; "
                + "의상/소품: [상의·하의·신발·액세서리 색상과 디자인 포함]; "
                + "색상/무드: [전체적인 색조 팔레트와 캐릭터가 주는 시각적 무드]\n"
                + "[절대 금지] 인물 이름, 배경 설명, 성격 해석, 추측 문장, 빈칸 없음\n"
                + "[출력 목표] 250~350자 이상의 풍부한 묘사 — 짧으면 실패. 이미지에서 볼 수 있는 모든 시각적 디테일 포함\n"
                + "[출력] 한 줄 묘사문만 출력 (마크다운·줄바꿈 금지)"
                + fewShotExample;

        return sendMultimodalTextRequest(
                List.of(
                        Map.of("text", prompt),
                        Map.of("inlineData", Map.of(
                                "mimeType", parsed.mimeType(),
                                "data", parsed.base64Data()
                        ))
                ),
                name
        );
    }

    public String generateBackgroundDescriptionFromImage(String imageDataUrl) {
        if (imageDataUrl == null || imageDataUrl.isBlank()) {
            throw new IllegalArgumentException("imageDataUrl must not be blank");
        }

        ParsedDataUrl parsed = parseDataUrl(imageDataUrl.trim());
        String prompt = "첨부 이미지를 보고 배경/환경 묘사를 한국어로 구체적으로 작성해줘.\n"
                + "형식 규칙:\n"
                + "1) 반드시 한 줄 텍스트로만 출력\n"
                + "2) 다음 순서를 유지: 장소/공간: ...; 구조/오브젝트: ...; 조명/날씨: ...; 색감/무드: ...\n"
                + "3) 인물 외형 해석, 스토리 추측 금지\n"
                + "4) 120~180자 범위로 작성\n"
                + "5) 프롬프트에 바로 붙여 쓸 수 있는 배경 묘사문으로 출력";

        return sendMultimodalTextRequest(
                List.of(
                        Map.of("text", prompt),
                        Map.of("inlineData", Map.of(
                                "mimeType", parsed.mimeType(),
                                "data", parsed.base64Data()
                        ))
                ),
                "background-reference"
        );
    }

    private String sendRequest(String prompt, String mimeType) {
        log.info("[Gemini] Text generation request for model: {}", textModel);
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("prompt must not be blank");
        }

        try {
            if (isVertexConfigured()) {
                return sendVertexRequest(prompt, mimeType);
            }
            if (apiKey != null && !apiKey.isBlank()) {
                return sendDeveloperApiRequest(prompt, mimeType);
            }
            throw new UpstreamServiceException("Neither VERTEX_PROJECT_ID nor GOOGLE_API_KEY is configured");
        } catch (UpstreamServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Gemini] Failed to generate text", e);
            throw new UpstreamServiceException("Gemini generation failed: " + e.getMessage(), e);
        }
    }

    private String sendVertexRequest(String prompt, String mimeType) throws IOException {
        GoogleCredentials credentials = loadCredentials();
        credentials.refreshIfExpired();
        String accessToken = credentials.getAccessToken().getTokenValue();

        // Use non-streaming endpoint for deterministic JSON response parsing.
        String url = String.format("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
                location, projectId, location, textModel);

        String response = webClient.post()
                .uri(url)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(buildRequestBody(prompt, mimeType))
                .retrieve()
                .onStatus(status -> status.isError(), clientResponse -> {
                    return clientResponse.bodyToMono(String.class)
                            .doOnNext(body -> log.error("Vertex AI Gemini error body: {}", body))
                            .map(body -> new UpstreamServiceException("Vertex AI Gemini error " + clientResponse.statusCode() + ": " + body));
                })
                .bodyToMono(String.class)
                .block();

        return extractTextFromResponse(response, "Vertex AI Gemini");
    }

    private String sendDeveloperApiRequest(String prompt, String mimeType) throws IOException {
        String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", textModel, apiKey);

        String response = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(buildRequestBody(prompt, mimeType))
                .retrieve()
                .onStatus(status -> status.isError(), clientResponse -> {
                    return clientResponse.bodyToMono(String.class)
                            .doOnNext(body -> log.error("Gemini API key mode error body: {}", body))
                            .map(body -> new UpstreamServiceException("Gemini API key mode error " + clientResponse.statusCode() + ": " + body));
                })
                .bodyToMono(String.class)
                .block();

        return extractTextFromResponse(response, "Gemini API key mode");
    }

    private String sendMultimodalTextRequest(List<Map<String, Object>> parts, String characterName) {
        try {
            if (isVertexConfigured()) {
                return sendVertexMultimodalRequest(parts);
            }
            if (apiKey != null && !apiKey.isBlank()) {
                return sendDeveloperApiMultimodalRequest(parts);
            }
            throw new UpstreamServiceException("Neither VERTEX_PROJECT_ID nor GOOGLE_API_KEY is configured");
        } catch (UpstreamServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Gemini] Failed to analyze character image: {}", characterName, e);
            throw new UpstreamServiceException("Gemini image analysis failed: " + e.getMessage(), e);
        }
    }

    private String sendVertexMultimodalRequest(List<Map<String, Object>> parts) throws IOException {
        GoogleCredentials credentials = loadCredentials();
        credentials.refreshIfExpired();
        String accessToken = credentials.getAccessToken().getTokenValue();

        String url = String.format(
                "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
                location, projectId, location, textModel
        );

        String response = webClient.post()
                .uri(url)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(buildMultimodalRequestBody(parts))
                .retrieve()
                .onStatus(status -> status.isError(), clientResponse ->
                        clientResponse.bodyToMono(String.class)
                                .doOnNext(body -> log.error("Vertex AI Gemini multimodal error body: {}", body))
                                .map(body -> new UpstreamServiceException("Vertex AI Gemini multimodal error " + clientResponse.statusCode() + ": " + body))
                )
                .bodyToMono(String.class)
                .block();

        return extractTextFromResponse(response, "Vertex AI Gemini multimodal");
    }

    private String sendDeveloperApiMultimodalRequest(List<Map<String, Object>> parts) throws IOException {
        String url = String.format(
                "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                textModel, apiKey
        );

        String response = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(buildMultimodalRequestBody(parts))
                .retrieve()
                .onStatus(status -> status.isError(), clientResponse ->
                        clientResponse.bodyToMono(String.class)
                                .doOnNext(body -> log.error("Gemini API key multimodal error body: {}", body))
                                .map(body -> new UpstreamServiceException("Gemini API key multimodal error " + clientResponse.statusCode() + ": " + body))
                )
                .bodyToMono(String.class)
                .block();

        return extractTextFromResponse(response, "Gemini API key multimodal");
    }

    private Map<String, Object> buildRequestBody(String prompt, String mimeType) {
        return Map.of(
                "contents", new Object[]{
                        Map.of(
                                "role", "user",
                                "parts", new Object[]{
                                Map.of("text", prompt)
                                }
                        )
                },
                "generationConfig", Map.of(
                        "responseMimeType", mimeType
                )
        );
    }

    private Map<String, Object> buildMultimodalRequestBody(List<Map<String, Object>> parts) {
        return Map.of(
                "contents", new Object[]{
                        Map.of(
                                "role", "user",
                                "parts", parts
                        )
                },
                "generationConfig", Map.of(
                        "temperature", 0.4,
                        "maxOutputTokens", 1200,
                        "responseMimeType", "text/plain"
                )
        );
    }

    private ParsedDataUrl parseDataUrl(String imageDataUrl) {
        int commaIndex = imageDataUrl.indexOf(',');
        if (!imageDataUrl.startsWith("data:") || commaIndex <= 5) {
            throw new IllegalArgumentException("imageDataUrl must be a valid data URL");
        }
        String meta = imageDataUrl.substring(5, commaIndex);
        String base64 = imageDataUrl.substring(commaIndex + 1);
        if (!meta.contains(";base64") || base64.isBlank()) {
            throw new IllegalArgumentException("imageDataUrl must contain base64 payload");
        }
        String mimeType = meta.replace(";base64", "").trim();
        if (mimeType.isBlank()) {
            mimeType = "image/png";
        }
        return new ParsedDataUrl(mimeType, base64.trim());
    }

    private record ParsedDataUrl(String mimeType, String base64Data) {}

    private String extractTextFromResponse(String response, String providerName) throws IOException {
        if (response == null || response.isBlank()) {
            throw new UpstreamServiceException(providerName + " returned an empty response");
        }
        JsonNode root = objectMapper.readTree(response);
        String text = extractText(root);
        if (text == null || text.isBlank()) {
            throw new UpstreamServiceException(providerName + " returned no candidate text");
        }
        return text;
    }

    private String extractText(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isArray()) {
            for (JsonNode item : node) {
                String fromItem = extractText(item);
                if (fromItem != null && !fromItem.isBlank()) {
                    return fromItem;
                }
            }
            return null;
        }

        JsonNode candidates = node.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return null;
        }
        JsonNode firstCandidate = candidates.get(0);
        JsonNode parts = firstCandidate.path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            return null;
        }
        JsonNode firstPart = parts.get(0);
        if (firstPart == null || firstPart.isMissingNode()) {
            return null;
        }
        String text = firstPart.path("text").asText(null);
        return text != null ? text.trim() : null;
    }

    private boolean isVertexConfigured() {
        return projectId != null
                && !projectId.isBlank()
                && !"your-gcp-project-id".equals(projectId)
                && !"default-project-id".equals(projectId);
    }

    private GoogleCredentials loadCredentials() throws IOException {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            log.info("[Gemini] Loading credentials from path: {}", credentialsPath);
            try (FileInputStream fis = new FileInputStream(credentialsPath)) {
                // 특정 클래스로 강제 캐스팅하지 않고 범용 GoogleCredentials로 로드
                return GoogleCredentials.fromStream(fis)
                        .createScoped("https://www.googleapis.com/auth/cloud-platform");
            }
        }
        log.info("[Gemini] No credentials path provided, using Application Default Credentials");
        return GoogleCredentials.getApplicationDefault()
                .createScoped("https://www.googleapis.com/auth/cloud-platform");
    }
}
