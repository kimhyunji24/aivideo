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

    private Map<String, Object> buildRequestBody(String prompt, String mimeType) {
        return Map.of(
                "contents", new Object[]{
                        Map.of("parts", new Object[]{
                                Map.of("text", prompt)
                        })
                },
                "generationConfig", Map.of(
                        "responseMimeType", mimeType
                )
        );
    }

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
