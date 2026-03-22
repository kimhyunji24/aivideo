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
        if (imageDataUrl == null || imageDataUrl.isBlank()) {
            throw new IllegalArgumentException("imageDataUrl must not be blank");
        }

        ParsedDataUrl parsed = parseDataUrl(imageDataUrl.trim());
        String name = (characterName == null || characterName.isBlank()) ? "캐릭터" : characterName.trim();
        String prompt = "첨부 이미지를 보고 캐릭터 외형을 한국어로 구체적으로 작성해줘.\n"
                + "형식 규칙:\n"
                + "1) 반드시 한 줄 텍스트로만 출력\n"
                + "2) 다음 순서를 유지: 헤어: ...; 얼굴/인상: ...; 체형/비율: ...; 의상/소품: ...; 색상/무드: ...\n"
                + "3) 인물 이름, 배경 설명, 성격 해석, 추측 문장 금지\n"
                + "4) 180~250자 범위로 작성\n"
                + "5) 프롬프트에 바로 붙여 쓸 수 있는 묘사문으로 출력";

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
                        "temperature", 0.2,
                        "maxOutputTokens", 200,
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
