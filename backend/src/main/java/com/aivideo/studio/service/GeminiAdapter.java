package com.aivideo.studio.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiAdapter {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${google.api-key}")
    private String apiKey;

    @Value("${gemini.text-model:gemini-1.5-pro}")
    private String textModel;

    public String generateText(String prompt) {
        return sendRequest(prompt, "text/plain");
    }

    public String generateJson(String prompt) {
        return sendRequest(prompt, "application/json");
    }

    private String sendRequest(String prompt, String mimeType) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Google API Key is not configured in application.yml or environment variables.");
        }

        String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", textModel, apiKey);

        Map<String, Object> requestBody = Map.of(
            "contents", new Object[]{
                Map.of("parts", new Object[]{
                    Map.of("text", prompt)
                })
            },
            "generationConfig", Map.of(
                "responseMimeType", mimeType
            )
        );

        try {
            String response = webClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.isError(), clientResponse -> {
                        return clientResponse.bodyToMono(String.class)
                                .doOnNext(body -> log.error("Gemini API error response body: {}", body))
                                .map(body -> new RuntimeException("Gemini API error " + clientResponse.statusCode() + ": " + body));
                    })
                    .bodyToMono(String.class)
                    .block();

            log.info("Gemini raw response: {}", response);
            JsonNode root = objectMapper.readTree(response);
            return root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
        } catch (Exception e) {
            log.error("Failed to generate from Gemini", e);
            throw new RuntimeException("AI generation failed: " + e.getMessage());
        }
    }
}
